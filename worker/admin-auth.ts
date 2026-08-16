import { eq, lt } from "drizzle-orm";

import { createDb } from "../db";
import { adminLoginAttempts } from "../db/schema";
import type { Env } from "./env";
import { errorResponse, jsonResponse } from "./http";

const SESSION_COOKIE_NAME = "sunshinson_admin";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_BLOCK_SECONDS = 15 * 60;
const LOGIN_ATTEMPT_RETENTION_SECONDS = 24 * 60 * 60;
const MAX_FAILED_ATTEMPTS = 5;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function bytesToBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error("Invalid base64url value");
  }

  const paddingLength = (4 - (value.length % 4)) % 4;
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/")
    + "=".repeat(paddingLength);
  const binary = atob(base64);
  const result = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    result[index] = binary.charCodeAt(index);
  }

  return result;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}

function passwordMatches(password: string, env: Env): boolean {
  if (typeof env.ADMIN_PASSWORD !== "string" || env.ADMIN_PASSWORD.length === 0) {
    throw new Error("ADMIN_PASSWORD must be configured.");
  }

  return constantTimeEqual(encoder.encode(password), encoder.encode(env.ADMIN_PASSWORD));
}

async function importSessionKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    base64UrlToBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signSessionPayload(
  encodedPayload: string,
  secret: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await importSessionKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload));
  return new Uint8Array(signature);
}

async function createSessionToken(env: Env, now: number): Promise<string> {
  const payload = JSON.stringify({ exp: now + SESSION_MAX_AGE_SECONDS });
  const encodedPayload = bytesToBase64Url(encoder.encode(payload));
  const signature = await signSessionPayload(encodedPayload, env.ADMIN_SESSION_SECRET);

  return `${encodedPayload}.${bytesToBase64Url(signature)}`;
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;

  for (const entry of header.split(";")) {
    const separator = entry.indexOf("=");
    if (separator === -1) continue;
    if (entry.slice(0, separator).trim() === name) {
      return entry.slice(separator + 1).trim();
    }
  }

  return null;
}

function sessionCookie(value: string, maxAge: number): string {
  return `${SESSION_COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

async function hasValidSession(request: Request, env: Env, now: number): Promise<boolean> {
  try {
    const token = getCookie(request, SESSION_COOKIE_NAME);
    if (!token) return false;

    const parts = token.split(".");
    if (parts.length !== 2) return false;

    const [encodedPayload, encodedSignature] = parts;
    const providedSignature = base64UrlToBytes(encodedSignature);
    const expectedSignature = await signSessionPayload(encodedPayload, env.ADMIN_SESSION_SECRET);
    if (!constantTimeEqual(providedSignature, expectedSignature)) return false;

    const payload = JSON.parse(decoder.decode(base64UrlToBytes(encodedPayload))) as unknown;
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return false;

    const exp = (payload as { exp?: unknown }).exp;
    return Number.isInteger(exp) && (exp as number) > now;
  } catch {
    return false;
  }
}

async function clientKey(request: Request, salt: string): Promise<string> {
  const ipAddress = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${ipAddress}:${salt}`));
  return bytesToBase64Url(new Uint8Array(digest));
}

function invalidLoginResponse(): Response {
  return errorResponse(401, "invalid_credentials", "Thông tin đăng nhập không hợp lệ.");
}

interface ReservedLoginAttempt {
  failed_count: number;
  blocked_until: number | null;
}

async function reserveLoginAttempt(
  env: Env,
  key: string,
  now: number,
): Promise<ReservedLoginAttempt> {
  const windowCutoff = now - LOGIN_WINDOW_SECONDS;
  const blockedUntil = now + LOGIN_BLOCK_SECONDS;
  const attempt = await env.DB.prepare(`
    INSERT INTO admin_login_attempts (
      client_key,
      failed_count,
      window_started_at,
      blocked_until
    ) VALUES (?, 1, ?, NULL)
    ON CONFLICT(client_key) DO UPDATE SET
      failed_count = CASE
        WHEN admin_login_attempts.blocked_until > ?
          THEN admin_login_attempts.failed_count + 1
        WHEN admin_login_attempts.window_started_at <= ? THEN 1
        ELSE admin_login_attempts.failed_count + 1
      END,
      window_started_at = CASE
        WHEN admin_login_attempts.blocked_until > ?
          THEN admin_login_attempts.window_started_at
        WHEN admin_login_attempts.window_started_at <= ? THEN excluded.window_started_at
        ELSE admin_login_attempts.window_started_at
      END,
      blocked_until = CASE
        WHEN admin_login_attempts.blocked_until > ?
          THEN admin_login_attempts.blocked_until
        WHEN admin_login_attempts.window_started_at <= ? THEN NULL
        WHEN admin_login_attempts.failed_count + 1 >= ? THEN ?
        ELSE NULL
      END
    RETURNING failed_count, blocked_until
  `).bind(
    key,
    now,
    now,
    windowCutoff,
    now,
    windowCutoff,
    now,
    windowCutoff,
    MAX_FAILED_ATTEMPTS,
    blockedUntil,
  ).first<ReservedLoginAttempt>();

  if (!attempt) {
    throw new Error("Failed to reserve admin login attempt");
  }

  return attempt;
}

export function requireSameOrigin(request: Request): Response | null {
  const requestOrigin = new URL(request.url).origin;
  if (request.headers.get("Origin") !== requestOrigin) {
    return errorResponse(403, "forbidden_origin", "Yêu cầu không hợp lệ.");
  }

  return null;
}

export async function requireAdmin(request: Request, env: Env): Promise<Response | null> {
  const now = Math.floor(Date.now() / 1000);
  if (!(await hasValidSession(request, env, now))) {
    return errorResponse(401, "unauthorized", "Bạn cần đăng nhập để tiếp tục.");
  }

  return null;
}

export async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Phương thức không được hỗ trợ.", undefined, {
      Allow: "POST",
    });
  }

  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return errorResponse(400, "invalid_request", "Dữ liệu đăng nhập không hợp lệ.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Dữ liệu đăng nhập không hợp lệ.");
  }

  if (
    typeof body !== "object"
    || body === null
    || Array.isArray(body)
    || Object.keys(body).length !== 1
    || typeof (body as { password?: unknown }).password !== "string"
  ) {
    return errorResponse(400, "invalid_request", "Dữ liệu đăng nhập không hợp lệ.");
  }

  const password = (body as { password: string }).password;
  const passwordIsValid = passwordMatches(password, env);
  const now = Math.floor(Date.now() / 1000);
  const key = await clientKey(request, env.LOGIN_ATTEMPT_SALT);
  const db = createDb(env.DB);

  await db.delete(adminLoginAttempts).where(
    lt(adminLoginAttempts.windowStartedAt, now - LOGIN_ATTEMPT_RETENTION_SECONDS),
  );

  const reservedAttempt = await reserveLoginAttempt(env, key, now);

  if (
    reservedAttempt.failed_count > MAX_FAILED_ATTEMPTS
    && reservedAttempt.blocked_until !== null
    && reservedAttempt.blocked_until > now
  ) {
    return errorResponse(
      429,
      "too_many_login_attempts",
      "Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau.",
      undefined,
      { "Retry-After": String(reservedAttempt.blocked_until - now) },
    );
  }

  if (passwordIsValid) {
    await db.delete(adminLoginAttempts).where(eq(adminLoginAttempts.clientKey, key));
    const token = await createSessionToken(env, now);

    return jsonResponse(
      { ok: true },
      200,
      { "Set-Cookie": sessionCookie(token, SESSION_MAX_AGE_SECONDS) },
    );
  }

  return invalidLoginResponse();
}

export function handleAdminLogout(request: Request): Response {
  if (request.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Phương thức không được hỗ trợ.", undefined, {
      Allow: "POST",
    });
  }

  const originError = requireSameOrigin(request);
  if (originError) return originError;

  return jsonResponse(
    { ok: true },
    200,
    { "Set-Cookie": sessionCookie("", 0) },
  );
}
