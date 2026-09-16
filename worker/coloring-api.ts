import type { Env } from "./env.ts";
import { errorResponse, jsonResponse } from "./http.ts";

const COLORING_API_PATH = "/api/coloring/generate";
const COLORING_INTERNAL_API_PATH = "/api/internal/coloring/generate";
const COLORING_INTERNAL_TRANSLATE_PATH = "/api/internal/coloring/translate";
const COLORING_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const TRANSLATION_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const POLLINATIONS_API_URL = "https://gen.pollinations.ai/v1/images/generations";
const POLLINATIONS_TEXT_API_URL = "https://gen.pollinations.ai/v1/chat/completions";
const POLLINATIONS_DEFAULT_MODEL = "flux";
const POLLINATIONS_DEFAULT_TEXT_MODEL = "openai";
const MAX_PROMPT_LENGTH = 160;

type ColoringRequestBody = {
  prompt?: unknown;
};

type WorkersAiImage = {
  image?: unknown;
};

type WorkersAiText = {
  response?: unknown;
};

type GeneratedImage = {
  image: string;
  model: string;
  provider: "cloudflare" | "pollinations";
};

type ImageProvider = {
  model: string;
  provider: GeneratedImage["provider"];
  run: () => Promise<string | null>;
};

const unsafePromptPattern = /\b(?:khỏa thân|khoa than|tình dục|tinh duc|máu me|mau me|giết|giet|súng|sung|dao đâm|dao dam|nude|sexual|gore|kill|gun)\b/i;

export function normalizeColoringPrompt(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

export function buildColoringPrompt(idea: string): string {
  return [
    "BLACK-AND-WHITE COLORING BOOK LINE ART ONLY. This must be an uncolored printable outline page, not a finished illustration.",
    `Subject: \"${idea}\".`,
    "Draw the subject with bold, smooth, consistent pure-black contour lines on a completely pure-white background.",
    "Keep every shape interior white and unfilled. Use large closed shapes, wide open coloring spaces, minimal details, and a cheerful child-friendly style for ages 4 to 8.",
    "Use one centered square composition with comfortable white margins, suitable for printing on A4 paper.",
    "STRICTLY FORBIDDEN: any color, colored pixels, gray, grayscale, filled black areas, shading, shadows, gradients, lighting effects, textures, hatching, photorealism, paint, text, letters, names, logos, watermarks, scary details, or weapons.",
    "Final result must look like clean black ink outlines on blank white coloring-book paper, ready for a child to color in.",
  ].join(" ");
}

function buildTranslationMessages(idea: string) {
  return [
    {
      role: "system",
      content: "Translate children's drawing ideas into concise natural English. Preserve every subject and action. Output only the English translation, with no quotation marks, explanation, prefix, or added detail.",
    },
    { role: "user", content: idea },
  ];
}

function cleanEnglishTranslation(value: unknown): string {
  if (typeof value !== "string") return "";
  return normalizeColoringPrompt(value)
    .replace(/^(?:english translation|translation|english)\s*:\s*/i, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim()
    .slice(0, 320);
}

async function translateWithBinding(env: Env, idea: string): Promise<string | null> {
  if (!env.AI) return null;
  const result = await env.AI.run(TRANSLATION_MODEL, {
    messages: buildTranslationMessages(idea),
    max_tokens: 120,
    temperature: 0,
  });
  const response = result && typeof result === "object" ? (result as WorkersAiText).response : null;
  return cleanEnglishTranslation(response) || null;
}

async function translateWithRestApi(env: Env, idea: string): Promise<string | null> {
  const accountId = env.CLOUDFLARE_AI_ACCOUNT_ID?.trim();
  const apiToken = env.CLOUDFLARE_AI_API_TOKEN?.trim();
  if (!accountId || !apiToken) return null;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${TRANSLATION_MODEL}`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
      body: JSON.stringify({ messages: buildTranslationMessages(idea), max_tokens: 120, temperature: 0 }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) throw Object.assign(new Error(`Translation API returned ${response.status}`), { status: response.status });
  const payload = await response.json() as { result?: WorkersAiText };
  return cleanEnglishTranslation(payload.result?.response) || null;
}

async function translateWithProxy(env: Env, idea: string): Promise<string | null> {
  const proxyUrl = env.COLORING_AI_PROXY_URL?.trim().replace(/\/$/, "");
  const proxySecret = env.COLORING_AI_PROXY_SECRET?.trim();
  if (!proxyUrl || !proxySecret) return null;

  const response = await fetch(`${proxyUrl}${COLORING_INTERNAL_TRANSLATE_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-coloring-proxy-secret": proxySecret },
    body: JSON.stringify({ prompt: idea }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw Object.assign(new Error(`Translation proxy returned ${response.status}`), { status: response.status });
  const payload = await response.json() as { translation?: unknown };
  return cleanEnglishTranslation(payload.translation) || null;
}

async function translateWithPollinations(env: Env, idea: string): Promise<string | null> {
  const apiKey = env.POLLINATIONS_API_KEY?.trim();
  if (!apiKey) return null;

  const response = await fetch(POLLINATIONS_TEXT_API_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: env.POLLINATIONS_TEXT_MODEL?.trim() || POLLINATIONS_DEFAULT_TEXT_MODEL,
      messages: buildTranslationMessages(idea),
      temperature: 0,
      max_tokens: 120,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw Object.assign(new Error(`Pollinations translation returned ${response.status}`), { status: response.status });
  const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  return cleanEnglishTranslation(payload.choices?.[0]?.message?.content) || null;
}

export async function translateColoringIdeaToEnglish(env: Env, idea: string): Promise<string> {
  const translators = [
    () => translateWithBinding(env, idea),
    () => translateWithProxy(env, idea),
    () => translateWithRestApi(env, idea),
    () => translateWithPollinations(env, idea),
  ];
  let lastError: unknown;

  for (const translate of translators) {
    try {
      const result = await translate();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No translation provider is configured");
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

async function runWithPollinations(env: Env, prompt: string): Promise<string | null> {
  const apiKey = env.POLLINATIONS_API_KEY?.trim();
  if (!apiKey) return null;

  const model = env.POLLINATIONS_IMAGE_MODEL?.trim() || POLLINATIONS_DEFAULT_MODEL;
  const response = await fetch(POLLINATIONS_API_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      model,
      n: 1,
      size: "1024x1024",
      quality: "medium",
      response_format: "b64_json",
      safe: "privacy,secrets,sexual,violence,shield",
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const error = new Error(`Pollinations returned ${response.status}`);
    Object.assign(error, { status: response.status, retryAfter: response.headers.get("retry-after") });
    throw error;
  }

  const payload = await response.json() as { data?: Array<{ b64_json?: unknown }> };
  const image = payload.data?.[0]?.b64_json;
  if (typeof image !== "string" || image.length === 0) return null;
  return image.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
}

async function generateWithFallback(env: Env, prompt: string): Promise<GeneratedImage | null> {
  const providers: ImageProvider[] = [];

  if (env.AI) {
    providers.push({
      provider: "cloudflare",
      model: "flux-1-schnell",
      run: () => runWithBinding(env, prompt),
    });
  }
  if (env.COLORING_AI_PROXY_URL?.trim() && env.COLORING_AI_PROXY_SECRET?.trim()) {
    providers.push({
      provider: "cloudflare",
      model: "flux-1-schnell",
      run: () => runWithProxy(env, prompt),
    });
  }
  if (env.CLOUDFLARE_AI_ACCOUNT_ID?.trim() && env.CLOUDFLARE_AI_API_TOKEN?.trim()) {
    providers.push({
      provider: "cloudflare",
      model: "flux-1-schnell",
      run: () => runWithRestApi(env, prompt),
    });
  }
  if (env.POLLINATIONS_API_KEY?.trim()) {
    providers.push({
      provider: "pollinations",
      model: env.POLLINATIONS_IMAGE_MODEL?.trim() || POLLINATIONS_DEFAULT_MODEL,
      run: () => runWithPollinations(env, prompt),
    });
  }

  if (providers.length === 0) return null;

  let lastError: unknown;
  for (const provider of providers) {
    try {
      const image = await provider.run();
      if (image) return { image, model: provider.model, provider: provider.provider };
      lastError = new Error(`${provider.provider} returned an empty image`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No image provider returned an image");
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

async function handleInternalTranslationRequest(request: Request, env: Env): Promise<Response> {
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

  const idea = normalizeColoringPrompt(body.prompt);
  if (idea.length < 3 || idea.length > MAX_PROMPT_LENGTH || !env.AI) {
    return errorResponse(503, "AI_UNAVAILABLE", "Translation provider unavailable.");
  }

  try {
    const translation = await translateWithBinding(env, idea);
    return translation
      ? jsonResponse({ translation }, 200, { "cache-control": "no-store" })
      : errorResponse(502, "AI_EMPTY_RESULT", "Translation provider returned no text.");
  } catch {
    return errorResponse(502, "AI_TRANSLATION_FAILED", "Translation provider failed.");
  }
}

export async function handleColoringApiRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === COLORING_INTERNAL_API_PATH) return handleInternalColoringRequest(request, env);
  if (url.pathname === COLORING_INTERNAL_TRANSLATE_PATH) return handleInternalTranslationRequest(request, env);
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
    const englishIdea = await translateColoringIdeaToEnglish(env, idea);
    const generatedPrompt = buildColoringPrompt(englishIdea);
    const result = await generateWithFallback(env, generatedPrompt);
    if (!result) {
      return errorResponse(503, "AI_NOT_CONFIGURED", "Sun đang dùng thư viện tranh mẫu trong lúc chờ kết nối xưởng vẽ AI.");
    }

    return jsonResponse(
      { image: `data:image/jpeg;base64,${result.image}`, model: result.model, provider: result.provider },
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
