import { and, desc, eq } from "drizzle-orm";

import { createDb } from "../db";
import { coloringDrawings, googleDriveConnections } from "../db/schema";
import type { Env } from "./env";
import { errorResponse, jsonResponse } from "./http";

const API_PREFIX = "/api/coloring/drive";
const CALLBACK_PATH = `${API_PREFIX}/callback`;
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_FOLDER_NAME = "SunShinSon - Tranh cua be";
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type DriveConnection = typeof googleDriveConnections.$inferSelect;
type AuthenticatedUser = { userId: string; email: string };
type OAuthState = { exp: number; nonce: string; origin: string; userId: string };

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("invalid-base64url");
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function configured(env: Env): boolean {
  return Boolean(env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET && env.GOOGLE_DRIVE_TOKEN_KEY);
}

function authenticatedUser(request: Request): AuthenticatedUser | null {
  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  return userId && email ? { userId, email } : null;
}

function requireUser(request: Request): AuthenticatedUser | Response {
  return authenticatedUser(request) ?? errorResponse(401, "authentication_required", "Ba mẹ cần đăng nhập SunShinSon trước khi dùng Google Drive.");
}

function requireConfiguration(env: Env): Response | null {
  return configured(env) ? null : errorResponse(503, "drive_not_configured", "Google Drive chưa được cấu hình. Ba mẹ hãy bổ sung Client ID, Client Secret và khóa mã hóa.");
}

function requireSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return errorResponse(403, "invalid_origin", "Yêu cầu không hợp lệ.");
  }
  return null;
}

async function encryptionKey(env: Env, usages: KeyUsage[]): Promise<CryptoKey> {
  const bytes = fromBase64Url(env.GOOGLE_DRIVE_TOKEN_KEY ?? "");
  if (bytes.byteLength !== 32) throw new Error("GOOGLE_DRIVE_TOKEN_KEY must be a 32-byte base64url value");
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, usages);
}

async function encryptToken(value: string, env: Env): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(env, ["encrypt"]), encoder.encode(value));
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

async function decryptToken(value: string, env: Env): Promise<string> {
  const [version, encodedIv, encodedCiphertext] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedCiphertext) throw new Error("invalid-encrypted-token");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(encodedIv) },
    await encryptionKey(env, ["decrypt"]),
    fromBase64Url(encodedCiphertext),
  );
  return decoder.decode(decrypted);
}

async function stateKey(env: Env): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    fromBase64Url(env.GOOGLE_DRIVE_TOKEN_KEY ?? ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function createState(request: Request, user: AuthenticatedUser, env: Env): Promise<string> {
  const payload: OAuthState = {
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
    nonce: crypto.randomUUID(),
    origin: new URL(request.url).origin,
    userId: user.userId,
  };
  const encoded = base64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await stateKey(env), encoder.encode(encoded));
  return `${encoded}.${base64Url(new Uint8Array(signature))}`;
}

async function readState(value: string, request: Request, user: AuthenticatedUser, env: Env): Promise<OAuthState | null> {
  try {
    const [encoded, signature] = value.split(".");
    if (!encoded || !signature) return null;
    const valid = await crypto.subtle.verify("HMAC", await stateKey(env), fromBase64Url(signature), encoder.encode(encoded));
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(fromBase64Url(encoded))) as OAuthState;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (payload.userId !== user.userId || payload.origin !== new URL(request.url).origin) return null;
    return payload;
  } catch {
    return null;
  }
}

function callbackUrl(request: Request): string {
  return new URL(CALLBACK_PATH, request.url).toString();
}

function popupResponse(origin: string, ok: boolean, message: string): Response {
  const safeOrigin = JSON.stringify(origin);
  const safeMessage = JSON.stringify(message);
  const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><title>Google Drive · SunShinSon</title><body style="font-family:system-ui;padding:32px;text-align:center"><h1>${ok ? "Đã kết nối Google Drive" : "Chưa thể kết nối"}</h1><p>${message}</p><script>if(window.opener){window.opener.postMessage({type:"sunshinson:drive-connected",ok:${ok},message:${safeMessage}},${safeOrigin});window.close();}</script></body></html>`;
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

async function connectionFor(userId: string, env: Env): Promise<DriveConnection | null> {
  const [connection] = await createDb(env.DB).select().from(googleDriveConnections)
    .where(eq(googleDriveConnections.userId, userId)).limit(1);
  return connection ?? null;
}

async function exchangeAuthorizationCode(code: string, request: Request, env: Env) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_DRIVE_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_DRIVE_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl(request),
    }),
  });
  if (!response.ok) throw new Error(`oauth-exchange-${response.status}`);
  return response.json() as Promise<{ access_token: string; expires_in?: number; refresh_token?: string }>;
}

async function accessToken(connection: DriveConnection, env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (connection.encryptedAccessToken && (connection.accessTokenExpiresAt ?? 0) > now + 60) {
    return decryptToken(connection.encryptedAccessToken, env);
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_DRIVE_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_DRIVE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: await decryptToken(connection.encryptedRefreshToken, env),
    }),
  });
  if (!response.ok) throw new Error(`oauth-refresh-${response.status}`);
  const payload = await response.json() as { access_token: string; expires_in?: number };
  const expiresAt = now + Math.max(60, payload.expires_in ?? 3600);
  const encryptedAccessToken = await encryptToken(payload.access_token, env);
  await createDb(env.DB).update(googleDriveConnections).set({
    encryptedAccessToken,
    accessTokenExpiresAt: expiresAt,
    updatedAt: now,
  }).where(eq(googleDriveConnections.userId, connection.userId));
  return payload.access_token;
}

async function driveFetch(token: string, input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

async function ensureFolder(connection: DriveConnection, token: string, env: Env): Promise<string> {
  if (connection.folderId) return connection.folderId;
  const response = await driveFetch(token, "https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
      appProperties: { sunshinson: "coloring-folder" },
    }),
  });
  if (!response.ok) throw new Error(`drive-folder-${response.status}`);
  const folder = await response.json() as { id: string };
  await createDb(env.DB).update(googleDriveConnections).set({ folderId: folder.id, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(googleDriveConnections.userId, connection.userId));
  return folder.id;
}

async function uploadPng(token: string, folderId: string, file: File, name: string, artId: string) {
  const boundary = `sunshinson_${crypto.randomUUID().replaceAll("-", "")}`;
  const metadata = JSON.stringify({
    name,
    parents: [folderId],
    appProperties: { artId, sunshinson: "colored-drawing" },
  });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: image/png\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ]);
  const response = await driveFetch(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size", {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!response.ok) throw new Error(`drive-upload-${response.status}`);
  return response.json() as Promise<{ id: string; mimeType: string; name: string; size?: string }>;
}

function safeText(value: FormDataEntryValue | null, maximum: number, fallback: string): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) || fallback : fallback;
}

function safeFileName(title: string): string {
  const cleaned = title.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").replace(/[^A-Za-z0-9 _-]/gu, "").trim().replace(/\s+/gu, "-");
  return `${cleaned || "tranh-cua-be"}-${new Date().toISOString().slice(0, 10)}.png`;
}

async function status(request: Request, env: Env): Promise<Response> {
  const user = authenticatedUser(request);
  if (!user) return jsonResponse({ configured: configured(env), connected: false }, 200, { "Cache-Control": "no-store" });
  const connection = configured(env) ? await connectionFor(user.userId, env) : null;
  return jsonResponse({ configured: configured(env), connected: Boolean(connection), email: connection?.email }, 200, { "Cache-Control": "no-store" });
}

async function connect(request: Request, env: Env): Promise<Response> {
  const configError = requireConfiguration(env);
  if (configError) return configError;
  const user = requireUser(request);
  if (user instanceof Response) return user;
  const state = await createState(request, user, env);
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.search = new URLSearchParams({
    access_type: "offline",
    client_id: env.GOOGLE_DRIVE_CLIENT_ID ?? "",
    include_granted_scopes: "true",
    prompt: "consent",
    redirect_uri: callbackUrl(request),
    response_type: "code",
    scope: DRIVE_SCOPE,
    state,
  }).toString();
  return Response.redirect(authorization.toString(), 302);
}

async function callback(request: Request, env: Env): Promise<Response> {
  const origin = new URL(request.url).origin;
  const configError = requireConfiguration(env);
  if (configError) return popupResponse(origin, false, "Google Drive chưa được cấu hình.");
  const user = requireUser(request);
  if (user instanceof Response) return popupResponse(origin, false, "Phiên đăng nhập đã hết hạn.");
  const url = new URL(request.url);
  const state = await readState(url.searchParams.get("state") ?? "", request, user, env);
  const code = url.searchParams.get("code");
  if (!state || !code || url.searchParams.has("error")) return popupResponse(origin, false, "Yêu cầu kết nối không hợp lệ hoặc đã hết hạn.");

  try {
    const tokens = await exchangeAuthorizationCode(code, request, env);
    const existing = await connectionFor(user.userId, env);
    const refreshToken = tokens.refresh_token
      ? await encryptToken(tokens.refresh_token, env)
      : existing?.encryptedRefreshToken;
    if (!refreshToken) throw new Error("missing-refresh-token");
    const now = Math.floor(Date.now() / 1000);
    await createDb(env.DB).insert(googleDriveConnections).values({
      userId: user.userId,
      email: user.email,
      encryptedRefreshToken: refreshToken,
      encryptedAccessToken: await encryptToken(tokens.access_token, env),
      accessTokenExpiresAt: now + Math.max(60, tokens.expires_in ?? 3600),
      folderId: existing?.folderId ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }).onConflictDoUpdate({ target: googleDriveConnections.userId, set: {
      email: user.email,
      encryptedRefreshToken: refreshToken,
      encryptedAccessToken: await encryptToken(tokens.access_token, env),
      accessTokenExpiresAt: now + Math.max(60, tokens.expires_in ?? 3600),
      updatedAt: now,
    } });
    return popupResponse(origin, true, "Ba mẹ có thể đóng cửa sổ này và lưu tranh của bé.");
  } catch {
    return popupResponse(origin, false, "Sun chưa thể hoàn tất kết nối. Ba mẹ hãy thử lại.");
  }
}

async function listDrawings(request: Request, env: Env): Promise<Response> {
  const configError = requireConfiguration(env);
  if (configError) return configError;
  const user = requireUser(request);
  if (user instanceof Response) return user;
  if (!await connectionFor(user.userId, env)) return errorResponse(409, "drive_not_connected", "Google Drive chưa được kết nối.");
  const rows = await createDb(env.DB).select().from(coloringDrawings)
    .where(eq(coloringDrawings.userId, user.userId)).orderBy(desc(coloringDrawings.updatedAt)).limit(100);
  return jsonResponse({ drawings: rows.map((row) => ({
    id: row.id,
    artId: row.artId,
    title: row.title,
    childName: row.childName,
    src: `${API_PREFIX}/files/${encodeURIComponent(row.id)}`,
    sizeBytes: row.sizeBytes,
    updatedAt: row.updatedAt,
  })) }, 200, { "Cache-Control": "no-store" });
}

async function saveDrawing(request: Request, env: Env): Promise<Response> {
  const configError = requireConfiguration(env);
  if (configError) return configError;
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const user = requireUser(request);
  if (user instanceof Response) return user;
  const connection = await connectionFor(user.userId, env);
  if (!connection) return errorResponse(409, "drive_not_connected", "Google Drive chưa được kết nối.");

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.type !== "image/png" || file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return errorResponse(400, "invalid_file", "Tranh phải là ảnh PNG và không lớn hơn 15 MB.");
  }
  const title = safeText(form.get("title"), 140, "Tranh của bé");
  const artId = safeText(form.get("artId"), 180, "unknown-art");
  const childName = safeText(form.get("childName"), 80, "Bé");

  try {
    const token = await accessToken(connection, env);
    const folderId = await ensureFolder(connection, token, env);
    const uploaded = await uploadPng(token, folderId, file, safeFileName(title), artId);
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await createDb(env.DB).insert(coloringDrawings).values({
      id,
      userId: user.userId,
      artId,
      title,
      childName,
      driveFileId: uploaded.id,
      mimeType: uploaded.mimeType || "image/png",
      sizeBytes: Number(uploaded.size ?? file.size),
      createdAt: now,
      updatedAt: now,
    });
    return jsonResponse({ drawing: { id, title, src: `${API_PREFIX}/files/${id}`, updatedAt: now } }, 201, { "Cache-Control": "no-store" });
  } catch {
    return errorResponse(502, "drive_save_failed", "Sun chưa thể lưu tranh lên Google Drive. Ba mẹ hãy thử lại.");
  }
}

async function fileResponse(request: Request, env: Env, id: string): Promise<Response> {
  const configError = requireConfiguration(env);
  if (configError) return configError;
  const user = requireUser(request);
  if (user instanceof Response) return user;
  const [drawing] = await createDb(env.DB).select().from(coloringDrawings)
    .where(and(eq(coloringDrawings.id, id), eq(coloringDrawings.userId, user.userId))).limit(1);
  if (!drawing) return errorResponse(404, "drawing_not_found", "Không tìm thấy tranh.");
  const connection = await connectionFor(user.userId, env);
  if (!connection) return errorResponse(409, "drive_not_connected", "Google Drive chưa được kết nối.");
  try {
    const response = await driveFetch(await accessToken(connection, env), `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(drawing.driveFileId)}?alt=media`);
    if (!response.ok || !response.body) return errorResponse(502, "drive_read_failed", "Sun chưa thể tải tranh từ Google Drive.");
    return new Response(response.body, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": `inline; filename="${safeFileName(drawing.title)}"`,
        "Content-Type": drawing.mimeType,
      },
    });
  } catch {
    return errorResponse(502, "drive_read_failed", "Sun chưa thể tải tranh từ Google Drive.");
  }
}

export async function handleGoogleDriveApiRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(API_PREFIX)) return null;
  if (url.pathname === `${API_PREFIX}/status` && request.method === "GET") return status(request, env);
  if (url.pathname === `${API_PREFIX}/connect` && request.method === "GET") return connect(request, env);
  if (url.pathname === CALLBACK_PATH && request.method === "GET") return callback(request, env);
  if (url.pathname === `${API_PREFIX}/drawings` && request.method === "GET") return listDrawings(request, env);
  if (url.pathname === `${API_PREFIX}/drawings` && request.method === "POST") return saveDrawing(request, env);
  const fileMatch = /^\/api\/coloring\/drive\/files\/([^/]+)$/u.exec(url.pathname);
  if (fileMatch && request.method === "GET") return fileResponse(request, env, decodeURIComponent(fileMatch[1]));
  return errorResponse(405, "method_not_allowed", "Phương thức không được hỗ trợ.");
}
