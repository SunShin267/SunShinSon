import type { Env } from "./env.ts";
import { errorResponse, jsonResponse } from "./http.ts";

const COLORING_API_PATH = "/api/coloring/generate";
const COLORING_INTERNAL_API_PATH = "/api/internal/coloring/generate";
const COLORING_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const MAX_PROMPT_LENGTH = 160;

type ColoringRequestBody = {
  prompt?: unknown;
};

type WorkersAiImage = {
  image?: unknown;
};

const unsafePromptPattern = /\b(?:khỏa thân|khoa than|tình dục|tinh duc|máu me|mau me|giết|giet|súng|sung|dao đâm|dao dam|nude|sexual|gore|kill|gun)\b/i;

export function normalizeColoringPrompt(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

export function buildColoringPrompt(idea: string): string {
  return [
    "Create one printable children's coloring book page based on this idea:",
    `\"${idea}\".`,
    "Use pure white background and bold, smooth, clean black outlines only.",
    "Use large closed shapes, generous empty areas, and simple cheerful details suitable for children ages 4 to 8.",
    "Centered square composition that can be printed on A4 paper.",
    "No color, no gray, no shading, no gradients, no text, no letters, no names, no logo, no watermark, no scary details, no weapons.",
  ].join(" ");
}

function imageFromResult(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const image = (result as WorkersAiImage).image;
  return typeof image === "string" && image.length > 0 ? image : null;
}

async function runWithBinding(env: Env, prompt: string): Promise<string | null> {
  if (!env.AI) return null;
  const result = await env.AI.run(COLORING_MODEL, { prompt, steps: 4 });
  return imageFromResult(result);
}

async function runWithRestApi(env: Env, prompt: string): Promise<string | null> {
  const accountId = env.CLOUDFLARE_AI_ACCOUNT_ID?.trim();
  const apiToken = env.CLOUDFLARE_AI_API_TOKEN?.trim();
  if (!accountId || !apiToken) return null;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${COLORING_MODEL}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ prompt, steps: 4 }),
      signal: AbortSignal.timeout(45_000),
    },
  );

  if (!response.ok) {
    const error = new Error(`Workers AI returned ${response.status}`);
    Object.assign(error, { status: response.status, retryAfter: response.headers.get("retry-after") });
    throw error;
  }

  const payload = await response.json() as { result?: unknown };
  return imageFromResult(payload.result);
}

async function runWithProxy(env: Env, prompt: string): Promise<string | null> {
  const proxyUrl = env.COLORING_AI_PROXY_URL?.trim().replace(/\/$/, "");
  const proxySecret = env.COLORING_AI_PROXY_SECRET?.trim();
  if (!proxyUrl || !proxySecret) return null;

  const response = await fetch(`${proxyUrl}${COLORING_INTERNAL_API_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-coloring-proxy-secret": proxySecret,
    },
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    const error = new Error(`Coloring proxy returned ${response.status}`);
    Object.assign(error, { status: response.status, retryAfter: response.headers.get("retry-after") });
    throw error;
  }

  const payload = await response.json() as { image?: unknown };
  return typeof payload.image === "string" && payload.image.length > 0 ? payload.image : null;
}

async function handleInternalColoringRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Method not allowed.", undefined, { allow: "POST" });
  }

  const expectedSecret = env.COLORING_AI_PROXY_SECRET?.trim();
  const providedSecret = request.headers.get("x-coloring-proxy-secret")?.trim();
  if (!expectedSecret || !providedSecret || expectedSecret !== providedSecret) {
    return errorResponse(401, "UNAUTHORIZED", "Unauthorized.");
  }

  let body: ColoringRequestBody;
  try {
    body = await request.json() as ColoringRequestBody;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Invalid request.");
  }

  const prompt = normalizeColoringPrompt(body.prompt);
  if (!prompt || prompt.length > 2048 || !env.AI) {
    return errorResponse(503, "AI_UNAVAILABLE", "Image provider unavailable.");
  }

  try {
    const image = await runWithBinding(env, prompt);
    return image
      ? jsonResponse({ image }, 200, { "cache-control": "no-store" })
      : errorResponse(502, "AI_EMPTY_RESULT", "Image provider returned no image.");
  } catch {
    return errorResponse(502, "AI_GENERATION_FAILED", "Image provider failed.");
  }
}

export async function handleColoringApiRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === COLORING_INTERNAL_API_PATH) return handleInternalColoringRequest(request, env);
  if (url.pathname !== COLORING_API_PATH) return null;

  if (request.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Chỉ hỗ trợ tạo tranh bằng phương thức POST.", undefined, { allow: "POST" });
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) {
    return errorResponse(403, "ORIGIN_NOT_ALLOWED", "Yêu cầu tạo tranh không hợp lệ.");
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 4096) {
    return errorResponse(413, "REQUEST_TOO_LARGE", "Ý tưởng của bé dài quá rồi.");
  }

  let body: ColoringRequestBody;
  try {
    body = await request.json() as ColoringRequestBody;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Sun chưa đọc được ý tưởng này.");
  }

  const idea = normalizeColoringPrompt(body.prompt);
  if (idea.length < 3 || idea.length > MAX_PROMPT_LENGTH) {
    return errorResponse(400, "INVALID_PROMPT", `Ý tưởng cần từ 3 đến ${MAX_PROMPT_LENGTH} ký tự.`);
  }
  if (unsafePromptPattern.test(idea)) {
    return errorResponse(400, "UNSAFE_PROMPT", "Bé hãy chọn một ý tưởng vui vẻ và phù hợp để tô màu nhé.");
  }

  try {
    const generatedPrompt = buildColoringPrompt(idea);
    const image = await runWithBinding(env, generatedPrompt)
      ?? await runWithProxy(env, generatedPrompt)
      ?? await runWithRestApi(env, generatedPrompt);
    if (!image) {
      return errorResponse(503, "AI_NOT_CONFIGURED", "Sun đang dùng thư viện tranh mẫu trong lúc chờ kết nối xưởng vẽ AI.");
    }

    return jsonResponse(
      { image: `data:image/jpeg;base64,${image}`, model: "flux-1-schnell" },
      200,
      { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    );
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
    const retryAfter = typeof error === "object" && error && "retryAfter" in error && typeof error.retryAfter === "string"
      ? error.retryAfter
      : undefined;

    if (status === 429) {
      return errorResponse(429, "AI_RATE_LIMITED", "Xưởng vẽ đang đông. Bé thử lại sau một chút nhé.", undefined, retryAfter ? { "retry-after": retryAfter } : undefined);
    }
    return errorResponse(502, "AI_GENERATION_FAILED", "Sun chưa vẽ được tranh này. Bé thử một ý tưởng khác nhé.");
  }
}
