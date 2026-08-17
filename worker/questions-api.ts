import { asc, eq } from "drizzle-orm";

import { createDb } from "../db";
import { questions } from "../db/schema";
import {
  handleAdminLogin,
  handleAdminLogout,
  requireAdmin,
  requireSameOrigin,
} from "./admin-auth";
import type { Env } from "./env";
import { errorResponse, jsonResponse } from "./http";
import {
  normalizeQuestion,
  toPublicQuestion,
  validateQuestionInput,
  type QuestionInput,
} from "./question-model";

interface WaitUntilContext {
  waitUntil(promise: Promise<unknown>): void;
}

const PUBLIC_QUESTIONS_PATH = "/api/questions";
const ADMIN_QUESTIONS_PATH = "/api/admin/questions";
const ITEM_ROUTE = /^\/api\/admin\/questions\/([1-9]\d*)$/u;
const STATUS_ROUTE = /^\/api\/admin\/questions\/([1-9]\d*)\/status$/u;

function methodNotAllowed(allow: string): Response {
  return errorResponse(
    405,
    "method_not_allowed",
    "Phương thức không được hỗ trợ.",
    undefined,
    { Allow: allow },
  );
}

function notFound(): Response {
  return errorResponse(404, "not_found", "Không tìm thấy tài nguyên yêu cầu.");
}

function cacheKey(url: URL): string {
  return `${url.origin}${PUBLIC_QUESTIONS_PATH}`;
}

function defaultCache(): Cache {
  return (caches as CacheStorage & { default: Cache }).default;
}

function invalidatePublicQuestions(url: URL, ctx: WaitUntilContext): void {
  ctx.waitUntil(defaultCache().delete(cacheKey(url)));
}

function isUniqueQuestionConflict(error: unknown): boolean {
  let current: unknown = error;
  const visited = new Set<unknown>();

  while (current !== null && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    if (current instanceof Error) {
      const message = `${current.name}: ${current.message}`.toLowerCase();
      if (
        message.includes("unique constraint failed: questions.normalized_question")
        || message.includes("questions_normalized_unique")
      ) {
        return true;
      }
    }
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

function duplicateQuestionResponse(): Response {
  return errorResponse(409, "duplicate_question", "Câu hỏi này đã tồn tại.");
}

async function readJson(request: Request): Promise<unknown | Response> {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return errorResponse(400, "invalid_request", "Dữ liệu gửi lên không hợp lệ.", {
      body: "Nội dung yêu cầu phải có kiểu application/json.",
    });
  }

  try {
    return await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Dữ liệu gửi lên không hợp lệ.", {
      body: "Nội dung JSON không hợp lệ.",
    });
  }
}

function valuesFromInput(input: QuestionInput, now: number) {
  return {
    topic: input.topic,
    age: input.age,
    tag: input.tag,
    questionText: input.q,
    normalizedQuestion: normalizeQuestion(input.q),
    optionA: input.opts[0],
    optionB: input.opts[1],
    optionC: input.opts[2],
    optionD: input.opts[3],
    correctIndex: input.correct,
    explanation: input.explain,
    isActive: input.isActive,
    updatedAt: now,
  };
}

async function handlePublicQuestions(
  request: Request,
  env: Env,
  url: URL,
  ctx: WaitUntilContext,
): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");

  const key = cacheKey(url);
  const cached = await defaultCache().match(key);
  if (cached) return cached;

  const rows = await createDb(env.DB)
    .select()
    .from(questions)
    .where(eq(questions.isActive, true))
    .orderBy(asc(questions.id));
  const body = rows.map((row) => {
    const question = toPublicQuestion(row);
    delete question.isActive;
    return question;
  });
  const response = jsonResponse(body, 200, {
    "Cache-Control": "public, max-age=60, s-maxage=300",
  });

  ctx.waitUntil(defaultCache().put(key, response.clone()));
  return response;
}

async function authorizeAdmin(
  request: Request,
  env: Env,
  mutation: boolean,
): Promise<Response | null> {
  if (mutation) {
    const originError = requireSameOrigin(request);
    if (originError) return originError;
  }

  return requireAdmin(request, env);
}

async function listAdminQuestions(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET, POST");

  const authError = await authorizeAdmin(request, env, false);
  if (authError) return authError;

  const rows = await createDb(env.DB)
    .select()
    .from(questions)
    .orderBy(asc(questions.id));
  return jsonResponse(rows.map(toPublicQuestion), 200, { "Cache-Control": "no-store" });
}

async function createQuestion(
  request: Request,
  env: Env,
  url: URL,
  ctx: WaitUntilContext,
): Promise<Response> {
  const authError = await authorizeAdmin(request, env, true);
  if (authError) return authError;

  const body = await readJson(request);
  if (body instanceof Response) return body;

  const validation = validateQuestionInput(body);
  if (!validation.ok) {
    return errorResponse(400, "validation_error", "Dữ liệu câu hỏi không hợp lệ.", validation.fields);
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    const [created] = await createDb(env.DB)
      .insert(questions)
      .values({ ...valuesFromInput(validation.value, now), createdAt: now })
      .returning();
    if (!created) throw new Error("Question insert did not return a row");

    invalidatePublicQuestions(url, ctx);
    return jsonResponse(toPublicQuestion(created), 201, { "Cache-Control": "no-store" });
  } catch (error) {
    if (isUniqueQuestionConflict(error)) return duplicateQuestionResponse();
    throw error;
  }
}

async function updateQuestion(
  request: Request,
  env: Env,
  url: URL,
  ctx: WaitUntilContext,
  id: number,
): Promise<Response> {
  const authError = await authorizeAdmin(request, env, true);
  if (authError) return authError;

  const body = await readJson(request);
  if (body instanceof Response) return body;
  const validation = validateQuestionInput(body);
  if (!validation.ok) {
    return errorResponse(400, "validation_error", "Dữ liệu câu hỏi không hợp lệ.", validation.fields);
  }

  try {
    const [updated] = await createDb(env.DB)
      .update(questions)
      .set(valuesFromInput(validation.value, Math.floor(Date.now() / 1000)))
      .where(eq(questions.id, id))
      .returning();
    if (!updated) return notFound();

    invalidatePublicQuestions(url, ctx);
    return jsonResponse(toPublicQuestion(updated), 200, { "Cache-Control": "no-store" });
  } catch (error) {
    if (isUniqueQuestionConflict(error)) return duplicateQuestionResponse();
    throw error;
  }
}

async function updateQuestionStatus(
  request: Request,
  env: Env,
  url: URL,
  ctx: WaitUntilContext,
  id: number,
): Promise<Response> {
  const authError = await authorizeAdmin(request, env, true);
  if (authError) return authError;

  const body = await readJson(request);
  if (body instanceof Response) return body;
  if (
    typeof body !== "object"
    || body === null
    || Array.isArray(body)
    || Object.keys(body).length !== 1
    || typeof (body as { isActive?: unknown }).isActive !== "boolean"
  ) {
    return errorResponse(400, "validation_error", "Dữ liệu trạng thái không hợp lệ.", {
      isActive: "Trạng thái xuất bản phải là boolean.",
    });
  }

  const [updated] = await createDb(env.DB)
    .update(questions)
    .set({
      isActive: (body as { isActive: boolean }).isActive,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(questions.id, id))
    .returning();
  if (!updated) return notFound();

  invalidatePublicQuestions(url, ctx);
  return jsonResponse(toPublicQuestion(updated), 200, { "Cache-Control": "no-store" });
}

async function deleteQuestion(
  request: Request,
  env: Env,
  url: URL,
  ctx: WaitUntilContext,
  id: number,
): Promise<Response> {
  const authError = await authorizeAdmin(request, env, true);
  if (authError) return authError;

  const [deleted] = await createDb(env.DB)
    .delete(questions)
    .where(eq(questions.id, id))
    .returning({ id: questions.id });
  if (!deleted) return notFound();

  invalidatePublicQuestions(url, ctx);
  return new Response(null, { status: 204 });
}

async function routeApiRequest(
  request: Request,
  env: Env,
  ctx: WaitUntilContext,
  url: URL,
): Promise<Response> {
  const { pathname } = url;

  if (pathname === PUBLIC_QUESTIONS_PATH) {
    return handlePublicQuestions(request, env, url, ctx);
  }
  if (pathname === "/api/admin/login") return handleAdminLogin(request, env);
  if (pathname === "/api/admin/logout") return handleAdminLogout(request);

  if (pathname === ADMIN_QUESTIONS_PATH) {
    if (request.method === "GET") return listAdminQuestions(request, env);
    if (request.method === "POST") return createQuestion(request, env, url, ctx);
    return methodNotAllowed("GET, POST");
  }

  const statusMatch = STATUS_ROUTE.exec(pathname);
  if (statusMatch) {
    if (request.method !== "PATCH") return methodNotAllowed("PATCH");
    const id = Number(statusMatch[1]);
    if (!Number.isSafeInteger(id)) return notFound();
    return updateQuestionStatus(request, env, url, ctx, id);
  }

  const itemMatch = ITEM_ROUTE.exec(pathname);
  if (itemMatch) {
    const id = Number(itemMatch[1]);
    if (!Number.isSafeInteger(id)) return notFound();
    if (request.method === "PUT") return updateQuestion(request, env, url, ctx, id);
    if (request.method === "DELETE") return deleteQuestion(request, env, url, ctx, id);
    return methodNotAllowed("PUT, DELETE");
  }

  return notFound();
}

export async function handleApiRequest(
  request: Request,
  env: Env,
  ctx: WaitUntilContext,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

  try {
    return await routeApiRequest(request, env, ctx, url);
  } catch (error) {
    console.error("Unhandled API request error", error);
    return errorResponse(500, "internal_error", "Đã xảy ra lỗi. Vui lòng thử lại sau.");
  }
}
