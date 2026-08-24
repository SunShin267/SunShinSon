import { applyMove, createGame, getGameStatus, hydrateState, toPublicState } from "../lib/xiangqi/rules";
import { isBoardCoord, type Move, type Side, type XiangqiState, type XiangqiVariant } from "../lib/xiangqi/types";
import type { Env } from "./env";
import { errorResponse, jsonResponse } from "./http";

const API_PREFIX = "/api/xiangqi";
const SESSION_COOKIE_NAME = "sunshinson_xiangqi";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const PRESENCE_TTL_MS = 15_000;
const LINK_INVITE_TTL_MS = 10 * 60_000;
const DIRECT_INVITE_TTL_MS = 2 * 60_000;
const INVITE_ROUTE = /^\/api\/xiangqi\/invites\/([0-9a-f-]{36})\/(accept|decline|cancel)$/u;
const GAME_ROUTE = /^\/api\/xiangqi\/games\/([0-9a-f-]{36})$/u;
const COMMAND_ROUTE = /^\/api\/xiangqi\/games\/([0-9a-f-]{36})\/commands$/u;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const encoder = new TextEncoder();

type PresenceStatus = "available" | "waiting" | "playing";
type InviteStatus = "pending" | "accepted" | "declined" | "canceled" | "expired";

interface SessionRow {
  id: string;
  display_name: string;
}

interface InviteRow {
  id: string;
  kind: "link" | "direct";
  from_session_id: string;
  from_name: string;
  to_session_id: string | null;
  to_name: string | null;
  room_code: string | null;
  variant: XiangqiVariant;
  clock_minutes: number;
  status: InviteStatus;
  game_id: string | null;
  expires_at: number;
  created_at: number;
}

interface GameRow {
  id: string;
  red_session_id: string;
  red_name: string;
  black_session_id: string;
  black_name: string;
  variant: XiangqiVariant;
  time_control_ms: number;
  state_json: string;
  revision: number;
  active_side: Side | null;
  red_clock_ms: number;
  black_clock_ms: number;
  active_clock_started_at: number | null;
  red_ready: number;
  black_ready: number;
  pending_draw_by: string | null;
  red_rematch: number;
  black_rematch: number;
  status: "active" | "finished";
  result_kind: string | null;
  winner_side: Side | null;
  created_at: number;
  updated_at: number;
  finished_at: number | null;
}

interface CommandBase {
  type: "ready" | "move" | "offer_draw" | "accept_draw" | "decline_draw" | "resign" | "rematch";
  revision: number;
}

type ParsedCommand = CommandBase & { move?: Move };

function response(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  return jsonResponse(body, status, responseHeaders);
}

function apiError(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
  headers?: HeadersInit,
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  return errorResponse(status, code, message, fields, responseHeaders);
}

function methodNotAllowed(allow: string): Response {
  return apiError(405, "method_not_allowed", "Phương thức không được hỗ trợ.", undefined, { Allow: allow });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function bytesToBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("Invalid base64url");
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

async function sessionSignature(sessionId: string, env: Env): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.ADMIN_SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`xiangqi:${sessionId}`)));
}

async function createSessionToken(sessionId: string, env: Env): Promise<string> {
  return `${sessionId}.${bytesToBase64Url(await sessionSignature(sessionId, env))}`;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const entry of header.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    if (entry.slice(0, separator).trim() === name) return entry.slice(separator + 1).trim();
  }
  return null;
}

async function sessionIdFromCookie(request: Request, env: Env): Promise<string | null> {
  try {
    const token = readCookie(request, SESSION_COOKIE_NAME);
    if (!token) return null;
    const separator = token.indexOf(".");
    if (separator < 0 || token.indexOf(".", separator + 1) >= 0) return null;
    const sessionId = token.slice(0, separator);
    if (!/^[0-9a-f-]{36}$/u.test(sessionId)) return null;
    const supplied = base64UrlToBytes(token.slice(separator + 1));
    const expected = await sessionSignature(sessionId, env);
    return constantTimeEqual(supplied, expected) ? sessionId : null;
  } catch {
    return null;
  }
}

function sessionCookie(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

function validateMutationHeaders(request: Request): Response | null {
  if (request.headers.get("Origin") !== new URL(request.url).origin) {
    return apiError(403, "forbidden_origin", "Nguồn gửi yêu cầu không hợp lệ.");
  }
  if (request.headers.get("Content-Type")?.trim().toLowerCase() !== "application/json") {
    return apiError(400, "invalid_request", "Dữ liệu gửi lên không hợp lệ.", {
      body: "Nội dung yêu cầu phải có kiểu chính xác application/json.",
    });
  }
  return null;
}

async function readJson(request: Request): Promise<unknown | Response> {
  const headerError = validateMutationHeaders(request);
  if (headerError) return headerError;
  try {
    return await request.json();
  } catch {
    return apiError(400, "invalid_request", "Dữ liệu JSON không hợp lệ.");
  }
}

async function requireSession(request: Request, env: Env): Promise<SessionRow | Response> {
  const sessionId = await sessionIdFromCookie(request, env);
  if (!sessionId) return apiError(401, "session_required", "Bạn cần nhập tên để tiếp tục.");
  const session = await env.DB.prepare(
    "SELECT id, display_name FROM xiangqi_sessions WHERE id = ?",
  ).bind(sessionId).first<SessionRow>();
  return session ?? apiError(401, "session_required", "Phiên chơi không còn hợp lệ. Vui lòng nhập lại tên.");
}

function normalizeName(value: string): string | null {
  const normalized = value.trim().replace(/\s+/gu, " ");
  const characters = Array.from(normalized);
  if (characters.length < 1 || characters.length > 30 || /\p{C}/u.test(normalized)) return null;
  return normalized;
}

function randomRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join("");
}

function isConstraintConflict(error: unknown): boolean {
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      const text = `${current.name}: ${current.message}`.toLowerCase();
      if (text.includes("constraint") || text.includes("unique") || text.includes("participant already active")) {
        return true;
      }
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

async function handleSession(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  const body = await readJson(request);
  if (body instanceof Response) return body;
  if (!isRecord(body) || !hasExactKeys(body, ["name"]) || typeof body.name !== "string") {
    return apiError(400, "validation_error", "Tên người chơi không hợp lệ.", {
      name: "Chỉ gửi một trường name dạng chuỗi.",
    });
  }
  const displayName = normalizeName(body.name);
  if (!displayName) {
    return apiError(400, "validation_error", "Tên người chơi không hợp lệ.", {
      name: "Tên phải có từ 1 đến 30 ký tự hiển thị.",
    });
  }

  const cookieSessionId = await sessionIdFromCookie(request, env);
  const existing = cookieSessionId
    ? await env.DB.prepare("SELECT id FROM xiangqi_sessions WHERE id = ?").bind(cookieSessionId).first<{ id: string }>()
    : null;
  const sessionId = existing?.id ?? crypto.randomUUID();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO xiangqi_sessions (id, display_name, created_at, last_seen_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, last_seen_at = excluded.last_seen_at
    `).bind(sessionId, displayName, now, now),
    env.DB.prepare(`
      INSERT INTO xiangqi_presence (session_id, status, invite_id, game_id, last_heartbeat_at)
      VALUES (?, 'available', NULL, NULL, ?)
      ON CONFLICT(session_id) DO UPDATE SET last_heartbeat_at = excluded.last_heartbeat_at
    `).bind(sessionId, now),
  ]);
  const token = await createSessionToken(sessionId, env);
  return response(
    { player: { id: sessionId, name: displayName } },
    200,
    { "Set-Cookie": sessionCookie(token) },
  );
}

async function expireInvites(env: Env, now: number): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE xiangqi_invites
      SET status = 'expired', updated_at = ?
      WHERE status = 'pending' AND expires_at <= ?
    `).bind(now, now),
    env.DB.prepare(`
      UPDATE xiangqi_presence
      SET status = 'available', invite_id = NULL, game_id = NULL
      WHERE status = 'waiting'
        AND invite_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM xiangqi_invites
          WHERE id = xiangqi_presence.invite_id AND status = 'pending' AND expires_at > ?
        )
        AND NOT EXISTS (
          SELECT 1 FROM xiangqi_games
          WHERE id = xiangqi_presence.game_id AND status = 'active'
        )
    `).bind(now),
  ]);
}

async function syncPresence(env: Env, sessionId: string, now: number): Promise<PresenceStatus> {
  const activeGame = await env.DB.prepare(`
    SELECT id FROM xiangqi_games
    WHERE status = 'active' AND (red_session_id = ? OR black_session_id = ?)
    ORDER BY updated_at DESC LIMIT 1
  `).bind(sessionId, sessionId).first<{ id: string }>();
  const waitingInvite = activeGame ? null : await env.DB.prepare(`
    SELECT id FROM xiangqi_invites
    WHERE from_session_id = ? AND status = 'pending' AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).bind(sessionId, now).first<{ id: string }>();
  const status: PresenceStatus = activeGame ? "playing" : waitingInvite ? "waiting" : "available";
  await env.DB.prepare(`
    INSERT INTO xiangqi_presence (session_id, status, invite_id, game_id, last_heartbeat_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      status = excluded.status,
      invite_id = excluded.invite_id,
      game_id = excluded.game_id,
      last_heartbeat_at = excluded.last_heartbeat_at
  `).bind(sessionId, status, waitingInvite?.id ?? null, activeGame?.id ?? null, now).run();
  await env.DB.prepare("UPDATE xiangqi_sessions SET last_seen_at = ? WHERE id = ?").bind(now, sessionId).run();
  return status;
}

const INVITE_SELECT = `
  SELECT i.id, i.kind, i.from_session_id, sender.display_name AS from_name,
    i.to_session_id, recipient.display_name AS to_name, i.room_code, i.variant,
    i.clock_minutes, i.status, i.game_id, i.expires_at, i.created_at
  FROM xiangqi_invites i
  JOIN xiangqi_sessions sender ON sender.id = i.from_session_id
  LEFT JOIN xiangqi_sessions recipient ON recipient.id = i.to_session_id
`;

function publicInvite(invite: InviteRow) {
  return {
    id: invite.id,
    kind: invite.kind,
    from: { id: invite.from_session_id, name: invite.from_name },
    to: invite.to_session_id && invite.to_name ? { id: invite.to_session_id, name: invite.to_name } : null,
    roomCode: invite.room_code,
    variant: invite.variant,
    clockMinutes: invite.clock_minutes,
    status: invite.status,
    gameId: invite.game_id,
    expiresAt: invite.expires_at,
    createdAt: invite.created_at,
  };
}

async function pendingInvitesFor(env: Env, sessionId: string, now: number): Promise<InviteRow[]> {
  const result = await env.DB.prepare(`${INVITE_SELECT}
    WHERE i.to_session_id = ? AND i.status = 'pending' AND i.expires_at > ?
    ORDER BY i.created_at DESC
  `).bind(sessionId, now).all<InviteRow>();
  return result.results;
}

async function handleHeartbeat(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  const body = await readJson(request);
  if (body instanceof Response) return body;
  if (!isRecord(body) || !hasExactKeys(body, [])) {
    return apiError(400, "validation_error", "Heartbeat không hợp lệ.");
  }
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const now = Date.now();
  await expireInvites(env, now);
  const status = await syncPresence(env, session.id, now);
  const invitations = await pendingInvitesFor(env, session.id, now);
  return response({ status, invitations: invitations.map(publicInvite), serverNow: now });
}

async function activeGameSummary(env: Env, sessionId: string) {
  const game = await env.DB.prepare(`
    SELECT id, variant, time_control_ms, revision, status, red_session_id, black_session_id
    FROM xiangqi_games
    WHERE status = 'active' AND (red_session_id = ? OR black_session_id = ?)
    ORDER BY updated_at DESC LIMIT 1
  `).bind(sessionId, sessionId).first<{
    id: string;
    variant: XiangqiVariant;
    time_control_ms: number;
    revision: number;
    status: "active";
    red_session_id: string;
    black_session_id: string;
  }>();
  if (!game) return null;
  return {
    id: game.id,
    variant: game.variant,
    clockMinutes: game.time_control_ms / 60_000,
    revision: game.revision,
    status: game.status,
    side: game.red_session_id === sessionId ? "red" : "black",
  };
}

async function handleLobby(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const now = Date.now();
  await expireInvites(env, now);
  const cutoff = now - PRESENCE_TTL_MS;
  const players = await env.DB.prepare(`
    SELECT s.id, s.display_name AS name, p.status, p.last_heartbeat_at
    FROM xiangqi_presence p
    JOIN xiangqi_sessions s ON s.id = p.session_id
    WHERE p.session_id <> ? AND p.last_heartbeat_at > ?
    ORDER BY CASE p.status WHEN 'available' THEN 0 WHEN 'waiting' THEN 1 ELSE 2 END,
      lower(s.display_name), s.id
  `).bind(session.id, cutoff).all<{
    id: string;
    name: string;
    status: PresenceStatus;
    last_heartbeat_at: number;
  }>();
  const invitations = await pendingInvitesFor(env, session.id, now);
  const waitingInvite = await env.DB.prepare(`${INVITE_SELECT}
    WHERE i.from_session_id = ? AND i.status = 'pending' AND i.expires_at > ?
    ORDER BY i.created_at DESC LIMIT 1
  `).bind(session.id, now).first<InviteRow>();
  const requestedRoomCode = url.searchParams.get("roomCode")?.trim().toUpperCase() ?? null;
  const room = requestedRoomCode && /^[A-Z2-9]{6}$/u.test(requestedRoomCode)
    ? await env.DB.prepare(`${INVITE_SELECT} WHERE i.room_code = ? LIMIT 1`)
      .bind(requestedRoomCode).first<InviteRow>()
    : null;
  return response({
    player: { id: session.id, name: session.display_name },
    players: players.results.map((player) => ({
      id: player.id,
      name: player.name,
      status: player.status,
      lastSeenAt: player.last_heartbeat_at,
    })),
    invitations: invitations.map(publicInvite),
    waitingInvite: waitingInvite ? publicInvite(waitingInvite) : null,
    activeGame: await activeGameSummary(env, session.id),
    room: room ? publicInvite(room) : null,
    serverNow: now,
  });
}

function validateInviteInput(body: unknown):
  | { kind: "link"; variant: XiangqiVariant; clockMinutes: 5 | 10 | 15 }
  | { kind: "direct"; variant: XiangqiVariant; clockMinutes: 5 | 10 | 15; targetSessionId: string }
  | null {
  if (!isRecord(body) || (body.kind !== "link" && body.kind !== "direct")) return null;
  if (body.variant !== "bright" && body.variant !== "blind") return null;
  if (body.clockMinutes !== 5 && body.clockMinutes !== 10 && body.clockMinutes !== 15) return null;
  if (body.kind === "link" && hasExactKeys(body, ["kind", "variant", "clockMinutes"])) {
    return { kind: body.kind, variant: body.variant, clockMinutes: body.clockMinutes };
  }
  if (
    body.kind === "direct"
    && hasExactKeys(body, ["kind", "variant", "clockMinutes", "targetSessionId"])
    && typeof body.targetSessionId === "string"
    && /^[0-9a-f-]{36}$/u.test(body.targetSessionId)
  ) {
    return {
      kind: body.kind,
      variant: body.variant,
      clockMinutes: body.clockMinutes,
      targetSessionId: body.targetSessionId,
    };
  }
  return null;
}

async function handleCreateInvite(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const input = validateInviteInput(body);
  if (!input) return apiError(400, "validation_error", "Cấu hình lời mời không hợp lệ.");
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  if (input.kind === "direct" && input.targetSessionId === session.id) {
    return apiError(400, "validation_error", "Bạn không thể tự mời chính mình.");
  }

  const now = Date.now();
  await expireInvites(env, now);
  const inviteId = crypto.randomUUID();
  const roomCode = input.kind === "link" ? randomRoomCode() : null;
  const targetSessionId = input.kind === "direct" ? input.targetSessionId : null;
  const expiresAt = now + (input.kind === "link" ? LINK_INVITE_TTL_MS : DIRECT_INVITE_TTL_MS);
  try {
    const statements: D1PreparedStatement[] = [env.DB.prepare(`
      INSERT INTO xiangqi_invites (
        id, kind, from_session_id, to_session_id, room_code, variant, clock_minutes,
        status, game_id, expires_at, created_at, updated_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM xiangqi_invites
        WHERE from_session_id = ? AND status = 'pending' AND expires_at > ?
      )
      AND NOT EXISTS (
        SELECT 1 FROM xiangqi_games
        WHERE status = 'active' AND (red_session_id = ? OR black_session_id = ?)
      )
      AND (
        ? = 'link' OR EXISTS (
          SELECT 1 FROM xiangqi_presence p
          WHERE p.session_id = ? AND p.status = 'available' AND p.last_heartbeat_at > ?
            AND NOT EXISTS (
              SELECT 1 FROM xiangqi_games g
              WHERE g.status = 'active' AND (g.red_session_id = p.session_id OR g.black_session_id = p.session_id)
            )
        )
      )
    `).bind(
      inviteId,
      input.kind,
      session.id,
      targetSessionId,
      roomCode,
      input.variant,
      input.clockMinutes,
      expiresAt,
      now,
      now,
      session.id,
      now,
      session.id,
      session.id,
      input.kind,
      targetSessionId,
      now - PRESENCE_TTL_MS,
    ), env.DB.prepare(`
      UPDATE xiangqi_presence
      SET status = 'waiting', invite_id = ?, game_id = NULL, last_heartbeat_at = ?
      WHERE session_id = ? AND EXISTS (
        SELECT 1 FROM xiangqi_invites WHERE id = ? AND status = 'pending'
      )
    `).bind(inviteId, now, session.id, inviteId)];
    const result = await env.DB.batch(statements);
    if ((result[0]?.meta.changes ?? 0) !== 1) {
      return apiError(409, "invite_conflict", "Bạn hoặc người được mời hiện không thể tham gia lời mời này.");
    }
  } catch (error) {
    if (isConstraintConflict(error)) {
      return apiError(409, "invite_conflict", "Bạn đã có phòng chờ hoặc mã phòng vừa bị trùng. Vui lòng thử lại.");
    }
    throw error;
  }

  const invite = await env.DB.prepare(`${INVITE_SELECT} WHERE i.id = ?`).bind(inviteId).first<InviteRow>();
  if (!invite) throw new Error("Created Xiangqi invite is missing");
  return response({ invite: publicInvite(invite) }, 201);
}

async function findInvite(env: Env, inviteId: string): Promise<InviteRow | null> {
  return env.DB.prepare(`${INVITE_SELECT} WHERE i.id = ? LIMIT 1`).bind(inviteId).first<InviteRow>();
}

function emptyBody(body: unknown): boolean {
  return isRecord(body) && hasExactKeys(body, []);
}

async function fetchGame(env: Env, gameId: string): Promise<GameRow | null> {
  return env.DB.prepare(`
    SELECT g.*, red.display_name AS red_name, black.display_name AS black_name
    FROM xiangqi_games g
    JOIN xiangqi_sessions red ON red.id = g.red_session_id
    JOIN xiangqi_sessions black ON black.id = g.black_session_id
    WHERE g.id = ?
  `).bind(gameId).first<GameRow>();
}

function participantSide(game: GameRow, sessionId: string): Side | null {
  if (game.red_session_id === sessionId) return "red";
  if (game.black_session_id === sessionId) return "black";
  return null;
}

function gameEtag(revision: number): string {
  return `"xiangqi-${revision}"`;
}

function snapshot(game: GameRow, sessionId: string, now: number) {
  const privateState = hydrateState(game.state_json);
  const publicState = toPublicState(privateState);
  const status = getGameStatus(publicState);
  const side = participantSide(game, sessionId);
  if (!side) throw new Error("Cannot create a non-participant snapshot");
  return {
    id: game.id,
    variant: game.variant,
    clockMinutes: game.time_control_ms / 60_000,
    revision: game.revision,
    status,
    state: publicState,
    players: {
      red: { id: game.red_session_id, name: game.red_name, ready: game.red_ready === 1 },
      black: { id: game.black_session_id, name: game.black_name, ready: game.black_ready === 1 },
    },
    you: { id: sessionId, side },
    clocks: {
      redMs: game.red_clock_ms,
      blackMs: game.black_clock_ms,
      activeSide: game.active_side,
      activeSince: game.active_clock_started_at,
      serverNow: now,
    },
    pendingDrawBy: game.pending_draw_by === game.red_session_id
      ? "red"
      : game.pending_draw_by === game.black_session_id ? "black" : null,
    rematchRequested: { red: game.red_rematch === 1, black: game.black_rematch === 1 },
    createdAt: game.created_at,
    updatedAt: game.updated_at,
    finishedAt: game.finished_at,
  };
}

async function finishPresenceStatements(env: Env, gameId: string, revision: number): Promise<D1PreparedStatement[]> {
  return [
    env.DB.prepare(`
      UPDATE xiangqi_presence SET status = 'available', invite_id = NULL, game_id = NULL
      WHERE game_id = ? AND EXISTS (
        SELECT 1 FROM xiangqi_games WHERE id = ? AND status = 'finished' AND revision = ?
      )
    `).bind(gameId, gameId, revision),
  ];
}

async function settleClock(env: Env, original: GameRow, now: number, attempts = 0): Promise<GameRow> {
  if (
    original.status !== "active"
    || original.active_side === null
    || original.active_clock_started_at === null
  ) return original;
  const elapsed = Math.max(0, now - original.active_clock_started_at);
  if (elapsed === 0) return original;
  const remaining = original.active_side === "red"
    ? Math.max(0, original.red_clock_ms - elapsed)
    : Math.max(0, original.black_clock_ms - elapsed);

  if (remaining > 0) {
    const result = await env.DB.prepare(`
      UPDATE xiangqi_games
      SET red_clock_ms = ?, black_clock_ms = ?, active_clock_started_at = ?, updated_at = ?
      WHERE id = ? AND status = 'active' AND revision = ?
        AND active_side = ? AND active_clock_started_at = ?
    `).bind(
      original.active_side === "red" ? remaining : original.red_clock_ms,
      original.active_side === "black" ? remaining : original.black_clock_ms,
      now,
      now,
      original.id,
      original.revision,
      original.active_side,
      original.active_clock_started_at,
    ).run();
    if (result.meta.changes === 1) {
      return {
        ...original,
        red_clock_ms: original.active_side === "red" ? remaining : original.red_clock_ms,
        black_clock_ms: original.active_side === "black" ? remaining : original.black_clock_ms,
        active_clock_started_at: now,
        updated_at: now,
      };
    }
  } else {
    const privateState = hydrateState(original.state_json);
    const winner: Side = original.active_side === "red" ? "black" : "red";
    const timedOutState: XiangqiState = { ...privateState, outcome: { kind: "timeout", winner } };
    const nextRevision = original.revision + 1;
    const update = env.DB.prepare(`
      UPDATE xiangqi_games
      SET state_json = ?, revision = ?, active_side = NULL,
        red_clock_ms = ?, black_clock_ms = ?, active_clock_started_at = NULL,
        status = 'finished', result_kind = 'timeout', winner_side = ?,
        updated_at = ?, finished_at = ?
      WHERE id = ? AND status = 'active' AND revision = ?
        AND active_side = ? AND active_clock_started_at = ?
    `).bind(
      JSON.stringify(timedOutState),
      nextRevision,
      original.active_side === "red" ? 0 : original.red_clock_ms,
      original.active_side === "black" ? 0 : original.black_clock_ms,
      winner,
      now,
      now,
      original.id,
      original.revision,
      original.active_side,
      original.active_clock_started_at,
    );
    const results = await env.DB.batch([update, ...(await finishPresenceStatements(env, original.id, nextRevision))]);
    if ((results[0]?.meta.changes ?? 0) === 1) {
      const updated = await fetchGame(env, original.id);
      if (!updated) throw new Error("Timed-out Xiangqi game disappeared");
      return updated;
    }
  }

  if (attempts >= 2) {
    const latest = await fetchGame(env, original.id);
    if (!latest) throw new Error("Xiangqi game disappeared during clock update");
    return latest;
  }
  const latest = await fetchGame(env, original.id);
  if (!latest) throw new Error("Xiangqi game disappeared during clock update");
  return settleClock(env, latest, Date.now(), attempts + 1);
}

async function participantGame(
  env: Env,
  gameId: string,
  sessionId: string,
): Promise<GameRow | Response> {
  const game = await fetchGame(env, gameId);
  if (!game) return apiError(404, "game_not_found", "Không tìm thấy ván cờ.");
  if (!participantSide(game, sessionId)) {
    return apiError(403, "forbidden", "Bạn không phải người chơi của ván cờ này.");
  }
  return settleClock(env, game, Date.now());
}

function gameResponse(game: GameRow, sessionId: string, status = 200): Response {
  return response(
    { game: snapshot(game, sessionId, Date.now()) },
    status,
    { ETag: gameEtag(game.revision) },
  );
}

async function staleGameResponse(env: Env, gameId: string, sessionId: string): Promise<Response> {
  const latest = await participantGame(env, gameId, sessionId);
  if (latest instanceof Response) return latest;
  const body = {
    error: { code: "stale_revision", message: "Ván cờ đã thay đổi. Hãy đồng bộ trạng thái mới." },
    game: snapshot(latest, sessionId, Date.now()),
  };
  return response(body, 409, { ETag: gameEtag(latest.revision) });
}

async function handleAcceptInvite(
  request: Request,
  env: Env,
  inviteId: string,
  session: SessionRow,
): Promise<Response> {
  const body = await readJson(request);
  if (body instanceof Response) return body;
  if (!emptyBody(body)) return apiError(400, "validation_error", "Yêu cầu chấp nhận không hợp lệ.");
  const now = Date.now();
  await expireInvites(env, now);
  const invite = await findInvite(env, inviteId);
  if (!invite) return apiError(404, "invite_not_found", "Không tìm thấy lời mời.");
  if (invite.expires_at <= now || invite.status === "expired") {
    return apiError(410, "invite_expired", "Lời mời đã hết hạn.");
  }
  const eligible = invite.kind === "direct"
    ? invite.to_session_id === session.id
    : invite.to_session_id === null && invite.from_session_id !== session.id;
  if (!eligible) return apiError(403, "forbidden", "Bạn không thể chấp nhận lời mời này.");
  if (invite.status !== "pending") {
    if (invite.status === "accepted" && invite.game_id) {
      const acceptedGame = await participantGame(env, invite.game_id, session.id);
      if (!(acceptedGame instanceof Response)) return gameResponse(acceptedGame, session.id);
    }
    return apiError(409, "invite_unavailable", "Lời mời không còn chờ chấp nhận.");
  }

  const gameId = crypto.randomUUID();
  const seed = crypto.randomUUID();
  const privateState = createGame(invite.variant, seed);
  const redIsOwner = crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 0;
  const redSessionId = redIsOwner ? invite.from_session_id : session.id;
  const blackSessionId = redIsOwner ? session.id : invite.from_session_id;
  const timeControlMs = invite.clock_minutes * 60_000;
  try {
    const statements = [
      env.DB.prepare(`
        UPDATE xiangqi_invites
        SET status = 'accepted', updated_at = ?
        WHERE id = ? AND status = 'pending' AND expires_at > ?
          AND ((kind = 'direct' AND to_session_id = ?)
            OR (kind = 'link' AND to_session_id IS NULL AND from_session_id <> ?))
          AND NOT EXISTS (
            SELECT 1 FROM xiangqi_games
            WHERE status = 'active' AND (red_session_id IN (?, ?) OR black_session_id IN (?, ?))
          )
          AND NOT EXISTS (
            SELECT 1 FROM xiangqi_invites other
            WHERE other.from_session_id = ? AND other.status = 'pending' AND other.id <> ?
          )
      `).bind(
        now,
        inviteId,
        now,
        session.id,
        session.id,
        invite.from_session_id,
        session.id,
        invite.from_session_id,
        session.id,
        session.id,
        inviteId,
      ),
      env.DB.prepare(`
        INSERT INTO xiangqi_games (
          id, red_session_id, black_session_id, variant, time_control_ms, state_json,
          revision, active_side, red_clock_ms, black_clock_ms, active_clock_started_at,
          red_ready, black_ready, pending_draw_by, red_rematch, black_rematch,
          status, result_kind, winner_side, created_at, updated_at, finished_at
        )
        SELECT ?, ?, ?, variant, ?, ?, 0, NULL, ?, ?, NULL,
          0, 0, NULL, 0, 0, 'active', NULL, NULL, ?, ?, NULL
        FROM xiangqi_invites
        WHERE id = ? AND status = 'accepted' AND game_id IS NULL
      `).bind(
        gameId,
        redSessionId,
        blackSessionId,
        timeControlMs,
        JSON.stringify(privateState),
        timeControlMs,
        timeControlMs,
        now,
        now,
        inviteId,
      ),
      env.DB.prepare(`
        UPDATE xiangqi_invites
        SET game_id = ?, updated_at = ?
        WHERE id = ? AND status = 'accepted' AND game_id IS NULL
          AND EXISTS (SELECT 1 FROM xiangqi_games WHERE id = ?)
      `).bind(
        gameId,
        now,
        inviteId,
        gameId,
      ),
      env.DB.prepare(`
        UPDATE xiangqi_invites SET status = 'canceled', updated_at = ?
        WHERE id <> ? AND status = 'pending'
          AND (from_session_id IN (?, ?) OR to_session_id IN (?, ?))
          AND EXISTS (SELECT 1 FROM xiangqi_games WHERE id = ?)
      `).bind(
        now,
        inviteId,
        invite.from_session_id,
        session.id,
        invite.from_session_id,
        session.id,
        gameId,
      ),
      env.DB.prepare(`
        UPDATE xiangqi_presence
        SET status = 'playing', invite_id = NULL, game_id = ?, last_heartbeat_at = ?
        WHERE session_id IN (?, ?) AND EXISTS (SELECT 1 FROM xiangqi_games WHERE id = ?)
      `).bind(gameId, now, invite.from_session_id, session.id, gameId),
    ];
    const results = await env.DB.batch(statements);
    if (
      (results[0]?.meta.changes ?? 0) !== 1
      || (results[1]?.meta.changes ?? 0) !== 1
      || (results[2]?.meta.changes ?? 0) !== 1
    ) {
      const concurrentInvite = await findInvite(env, inviteId);
      if (concurrentInvite?.status === "accepted" && concurrentInvite.game_id) {
        const acceptedGame = await participantGame(env, concurrentInvite.game_id, session.id);
        if (!(acceptedGame instanceof Response)) return gameResponse(acceptedGame, session.id);
      }
      return apiError(409, "invite_conflict", "Một trong hai người chơi đã vào phòng hoặc ván khác.");
    }
  } catch (error) {
    if (isConstraintConflict(error)) {
      return apiError(409, "invite_conflict", "Một trong hai người chơi đã vào phòng hoặc ván khác.");
    }
    throw error;
  }

  const game = await participantGame(env, gameId, session.id);
  if (game instanceof Response) return game;
  return gameResponse(game, session.id, 201);
}

async function handleDeclineOrCancel(
  request: Request,
  env: Env,
  inviteId: string,
  action: "decline" | "cancel",
  session: SessionRow,
): Promise<Response> {
  const body = await readJson(request);
  if (body instanceof Response) return body;
  if (!emptyBody(body)) return apiError(400, "validation_error", "Yêu cầu cập nhật lời mời không hợp lệ.");
  const now = Date.now();
  await expireInvites(env, now);
  const invite = await findInvite(env, inviteId);
  if (!invite) return apiError(404, "invite_not_found", "Không tìm thấy lời mời.");
  if (invite.expires_at <= now || invite.status === "expired") {
    return apiError(410, "invite_expired", "Lời mời đã hết hạn.");
  }
  const permitted = action === "cancel"
    ? invite.from_session_id === session.id
    : invite.kind === "direct" && invite.to_session_id === session.id;
  if (!permitted) return apiError(403, "forbidden", "Bạn không thể cập nhật lời mời này.");
  const nextStatus: InviteStatus = action === "cancel" ? "canceled" : "declined";
  const results = await env.DB.batch([
    env.DB.prepare(`
      UPDATE xiangqi_invites SET status = ?, updated_at = ?
      WHERE id = ? AND status = 'pending' AND expires_at > ?
    `).bind(nextStatus, now, inviteId, now),
    env.DB.prepare(`
      UPDATE xiangqi_presence SET status = 'available', invite_id = NULL, game_id = NULL
      WHERE session_id = ? AND invite_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM xiangqi_games
          WHERE status = 'active' AND (red_session_id = ? OR black_session_id = ?)
        )
    `).bind(invite.from_session_id, inviteId, invite.from_session_id, invite.from_session_id),
  ]);
  if ((results[0]?.meta.changes ?? 0) !== 1) {
    return apiError(409, "invite_unavailable", "Lời mời không còn chờ xử lý.");
  }
  return response({ ok: true, status: nextStatus });
}

async function handleInviteAction(
  request: Request,
  env: Env,
  inviteId: string,
  action: "accept" | "decline" | "cancel",
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  const headerError = validateMutationHeaders(request);
  if (headerError) return headerError;
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  if (action === "accept") return handleAcceptInvite(request, env, inviteId, session);
  return handleDeclineOrCancel(request, env, inviteId, action, session);
}

async function handleGetGame(request: Request, env: Env, gameId: string): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const game = await participantGame(env, gameId, session.id);
  if (game instanceof Response) return game;
  const etag = gameEtag(game.revision);
  if (request.headers.get("If-None-Match") === etag) {
    return new Response(null, {
      status: 304,
      headers: { "Cache-Control": "no-store", ETag: etag },
    });
  }
  return gameResponse(game, session.id);
}

function parseCommand(body: unknown): ParsedCommand | null {
  if (!isRecord(body) || typeof body.type !== "string" || !Number.isInteger(body.revision) || (body.revision as number) < 0) {
    return null;
  }
  const types: CommandBase["type"][] = [
    "ready", "move", "offer_draw", "accept_draw", "decline_draw", "resign", "rematch",
  ];
  if (!types.includes(body.type as CommandBase["type"])) return null;
  if (body.type === "move") {
    if (!hasExactKeys(body, ["type", "revision", "move"]) || !isRecord(body.move)) return null;
    if (!hasExactKeys(body.move, ["from", "to"]) || !isBoardCoord(body.move.from) || !isBoardCoord(body.move.to)) {
      return null;
    }
    return {
      type: "move",
      revision: body.revision as number,
      move: { from: [body.move.from[0], body.move.from[1]], to: [body.move.to[0], body.move.to[1]] },
    };
  }
  if (!hasExactKeys(body, ["type", "revision"])) return null;
  return { type: body.type as CommandBase["type"], revision: body.revision as number };
}

function clockCondition(game: GameRow): readonly unknown[] {
  return [game.id, game.revision, game.active_clock_started_at, game.red_clock_ms, game.black_clock_ms];
}

const CLOCK_WHERE = `
  id = ? AND revision = ? AND active_clock_started_at IS ?
  AND red_clock_ms = ? AND black_clock_ms = ?
`;

async function commandReady(
  env: Env,
  game: GameRow,
  side: Side,
  state: XiangqiState,
  now: number,
): Promise<boolean> {
  if (game.status !== "active" || getGameStatus(state).kind !== "active") return false;
  if ((side === "red" ? game.red_ready : game.black_ready) === 1) return true;
  const bothReady = side === "red" ? game.black_ready === 1 : game.red_ready === 1;
  const readyColumn = side === "red" ? "red_ready" : "black_ready";
  const result = await env.DB.prepare(`
    UPDATE xiangqi_games
    SET ${readyColumn} = 1, revision = revision + 1,
      active_side = CASE WHEN ? THEN ? ELSE active_side END,
      active_clock_started_at = CASE WHEN ? THEN ? ELSE active_clock_started_at END,
      updated_at = ?
    WHERE ${CLOCK_WHERE} AND status = 'active'
  `).bind(
    bothReady ? 1 : 0,
    state.turn,
    bothReady ? 1 : 0,
    now,
    now,
    ...clockCondition(game),
  ).run();
  return result.meta.changes === 1;
}

function terminalFields(state: XiangqiState) {
  const status = getGameStatus(state);
  if (status.kind === "active") {
    return { gameStatus: "active" as const, resultKind: null, winner: null, finishedAt: null };
  }
  return {
    gameStatus: "finished" as const,
    resultKind: status.kind,
    winner: status.winner,
    finishedAt: Date.now(),
  };
}

async function commandMove(
  env: Env,
  game: GameRow,
  side: Side,
  state: XiangqiState,
  move: Move,
  now: number,
): Promise<"updated" | "retry" | "illegal" | "conflict"> {
  if (
    game.status !== "active"
    || game.red_ready !== 1
    || game.black_ready !== 1
    || game.active_side !== side
    || state.turn !== side
    || getGameStatus(state).kind !== "active"
  ) return "conflict";
  let nextState: XiangqiState;
  try {
    nextState = applyMove(state, move);
  } catch {
    return "illegal";
  }
  const terminal = terminalFields(nextState);
  const nextRevision = game.revision + 1;
  const serialized = JSON.stringify(nextState);
  const lastMove = nextState.moves[nextState.moves.length - 1];
  if (!lastMove) throw new Error("Applied Xiangqi move has no history record");
  const update = env.DB.prepare(`
    UPDATE xiangqi_games
    SET state_json = ?, revision = ?, active_side = ?, active_clock_started_at = ?,
      pending_draw_by = NULL, status = ?, result_kind = ?, winner_side = ?,
      updated_at = ?, finished_at = ?
    WHERE ${CLOCK_WHERE} AND status = 'active' AND active_side = ?
  `).bind(
    serialized,
    nextRevision,
    terminal.gameStatus === "active" ? nextState.turn : null,
    terminal.gameStatus === "active" ? now : null,
    terminal.gameStatus,
    terminal.resultKind,
    terminal.winner,
    now,
    terminal.gameStatus === "finished" ? now : null,
    ...clockCondition(game),
    side,
  );
  const insertMove = env.DB.prepare(`
    INSERT INTO xiangqi_moves (
      game_id, game_revision, ply, side, from_x, from_y, to_x, to_y, revealed_role,
      red_clock_ms, black_clock_ms, created_at
    )
    SELECT ?, ?, (SELECT COALESCE(MAX(ply), 0) + 1 FROM xiangqi_moves WHERE game_id = ?),
      ?, ?, ?, ?, ?, ?, ?, ?, ?
    FROM xiangqi_games
    WHERE id = ? AND revision = ? AND state_json = ?
  `).bind(
    game.id,
    nextRevision,
    game.id,
    side,
    move.from[0],
    move.from[1],
    move.to[0],
    move.to[1],
    lastMove.revealedRole ?? null,
    game.red_clock_ms,
    game.black_clock_ms,
    now,
    game.id,
    nextRevision,
    serialized,
  );
  try {
    const statements = [update, insertMove];
    if (terminal.gameStatus === "finished") {
      statements.push(...await finishPresenceStatements(env, game.id, nextRevision));
    }
    const result = await env.DB.batch(statements);
    return (result[0]?.meta.changes ?? 0) === 1 ? "updated" : "retry";
  } catch (error) {
    if (isConstraintConflict(error)) return "retry";
    throw error;
  }
}

async function commandSimple(
  env: Env,
  game: GameRow,
  side: Side,
  state: XiangqiState,
  command: Exclude<CommandBase["type"], "ready" | "move" | "rematch">,
  now: number,
): Promise<"updated" | "retry" | "conflict"> {
  if (game.status !== "active" || getGameStatus(state).kind !== "active") return "conflict";
  const sessionId = side === "red" ? game.red_session_id : game.black_session_id;
  if (command === "offer_draw") {
    if (game.pending_draw_by !== null) return "conflict";
    const result = await env.DB.prepare(`
      UPDATE xiangqi_games SET pending_draw_by = ?, revision = revision + 1, updated_at = ?
      WHERE ${CLOCK_WHERE} AND status = 'active' AND pending_draw_by IS NULL
    `).bind(sessionId, now, ...clockCondition(game)).run();
    return result.meta.changes === 1 ? "updated" : "retry";
  }
  if (command === "decline_draw") {
    if (game.pending_draw_by === null || game.pending_draw_by === sessionId) return "conflict";
    const result = await env.DB.prepare(`
      UPDATE xiangqi_games SET pending_draw_by = NULL, revision = revision + 1, updated_at = ?
      WHERE ${CLOCK_WHERE} AND status = 'active' AND pending_draw_by IS NOT NULL AND pending_draw_by <> ?
    `).bind(now, ...clockCondition(game), sessionId).run();
    return result.meta.changes === 1 ? "updated" : "retry";
  }

  let outcome: XiangqiState["outcome"];
  if (command === "accept_draw") {
    if (game.pending_draw_by === null || game.pending_draw_by === sessionId) return "conflict";
    outcome = { kind: "draw-agreed", winner: null };
  } else {
    outcome = { kind: "resignation", winner: side === "red" ? "black" : "red" };
  }
  const finishedState: XiangqiState = { ...state, outcome };
  const nextRevision = game.revision + 1;
  const result = await env.DB.batch([
    env.DB.prepare(`
      UPDATE xiangqi_games
      SET state_json = ?, revision = ?, active_side = NULL, active_clock_started_at = NULL,
        pending_draw_by = NULL, status = 'finished', result_kind = ?, winner_side = ?,
        updated_at = ?, finished_at = ?
      WHERE ${CLOCK_WHERE} AND status = 'active'
        ${command === "accept_draw" ? "AND pending_draw_by IS NOT NULL AND pending_draw_by <> ?" : ""}
    `).bind(
      JSON.stringify(finishedState),
      nextRevision,
      outcome.kind,
      outcome.winner,
      now,
      now,
      ...clockCondition(game),
      ...(command === "accept_draw" ? [sessionId] : []),
    ),
    ...await finishPresenceStatements(env, game.id, nextRevision),
  ]);
  return (result[0]?.meta.changes ?? 0) === 1 ? "updated" : "retry";
}

async function commandRematch(
  env: Env,
  game: GameRow,
  side: Side,
  now: number,
): Promise<"updated" | "retry" | "conflict"> {
  if (game.status !== "finished") return "conflict";
  if ((side === "red" ? game.red_rematch : game.black_rematch) === 1) return "updated";
  const opponentRequested = side === "red" ? game.black_rematch === 1 : game.red_rematch === 1;
  if (!opponentRequested) {
    const column = side === "red" ? "red_rematch" : "black_rematch";
    const result = await env.DB.prepare(`
      UPDATE xiangqi_games SET ${column} = 1, revision = revision + 1, updated_at = ?
      WHERE ${CLOCK_WHERE} AND status = 'finished'
    `).bind(now, ...clockCondition(game)).run();
    return result.meta.changes === 1 ? "updated" : "retry";
  }

  const nextState = createGame(game.variant, crypto.randomUUID());
  const nextRevision = game.revision + 1;
  try {
    const result = await env.DB.batch([
      env.DB.prepare(`
        UPDATE xiangqi_games
        SET red_session_id = ?, black_session_id = ?, state_json = ?, revision = ?,
          active_side = NULL, red_clock_ms = time_control_ms, black_clock_ms = time_control_ms,
          active_clock_started_at = NULL, red_ready = 0, black_ready = 0,
          pending_draw_by = NULL, red_rematch = 0, black_rematch = 0,
          status = 'active', result_kind = NULL, winner_side = NULL,
          updated_at = ?, finished_at = NULL
        WHERE ${CLOCK_WHERE} AND status = 'finished'
      `).bind(
        game.black_session_id,
        game.red_session_id,
        JSON.stringify(nextState),
        nextRevision,
        now,
        ...clockCondition(game),
      ),
      env.DB.prepare(`
        UPDATE xiangqi_invites SET status = 'canceled', updated_at = ?
        WHERE status = 'pending'
          AND (from_session_id IN (?, ?) OR to_session_id IN (?, ?))
          AND EXISTS (SELECT 1 FROM xiangqi_games WHERE id = ? AND status = 'active' AND revision = ?)
      `).bind(
        now,
        game.red_session_id,
        game.black_session_id,
        game.red_session_id,
        game.black_session_id,
        game.id,
        nextRevision,
      ),
      env.DB.prepare(`
        UPDATE xiangqi_presence
        SET status = 'playing', invite_id = NULL, game_id = ?, last_heartbeat_at = ?
        WHERE session_id IN (?, ?)
          AND EXISTS (SELECT 1 FROM xiangqi_games WHERE id = ? AND status = 'active' AND revision = ?)
      `).bind(
        game.id,
        now,
        game.red_session_id,
        game.black_session_id,
        game.id,
        nextRevision,
      ),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1 ? "updated" : "retry";
  } catch (error) {
    if (isConstraintConflict(error)) return "conflict";
    throw error;
  }
}

async function handleCommand(request: Request, env: Env, gameId: string): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const command = parseCommand(body);
  if (!command) return apiError(400, "validation_error", "Lệnh ván cờ không hợp lệ.");
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const gameOrResponse = await participantGame(env, gameId, session.id);
    if (gameOrResponse instanceof Response) return gameOrResponse;
    const game = gameOrResponse;
    if (game.revision !== command.revision) return staleGameResponse(env, gameId, session.id);
    const side = participantSide(game, session.id);
    if (!side) return apiError(403, "forbidden", "Bạn không phải người chơi của ván cờ này.");
    const state = hydrateState(game.state_json);
    const now = Date.now();

    if (command.type === "ready") {
      const updated = await commandReady(env, game, side, state, now);
      if (!updated) {
        if (game.status !== "active") return apiError(409, "game_finished", "Ván cờ đã kết thúc.");
        continue;
      }
    } else if (command.type === "move") {
      const result = await commandMove(env, game, side, state, command.move as Move, now);
      if (result === "illegal") return apiError(422, "illegal_move", "Nước đi không hợp lệ.");
      if (result === "conflict") {
        return apiError(409, "command_conflict", "Chưa đến lượt bạn hoặc ván cờ chưa sẵn sàng.");
      }
      if (result === "retry") continue;
    } else if (command.type === "rematch") {
      const result = await commandRematch(env, game, side, now);
      if (result === "conflict") {
        return apiError(409, "rematch_conflict", "Không thể bắt đầu ván chơi lại lúc này.");
      }
      if (result === "retry") continue;
    } else {
      const result = await commandSimple(env, game, side, state, command.type, now);
      if (result === "conflict") {
        return apiError(409, "command_conflict", "Lệnh không phù hợp với trạng thái ván cờ.");
      }
      if (result === "retry") continue;
    }

    const updated = await participantGame(env, gameId, session.id);
    if (updated instanceof Response) return updated;
    return gameResponse(updated, session.id);
  }
  return staleGameResponse(env, gameId, session.id);
}

async function routeXiangqiRequest(request: Request, env: Env, url: URL): Promise<Response> {
  const { pathname } = url;
  if (pathname === `${API_PREFIX}/session`) return handleSession(request, env);
  if (pathname === `${API_PREFIX}/presence/heartbeat`) return handleHeartbeat(request, env);
  if (pathname === `${API_PREFIX}/lobby`) return handleLobby(request, env, url);
  if (pathname === `${API_PREFIX}/invites`) return handleCreateInvite(request, env);

  const inviteMatch = INVITE_ROUTE.exec(pathname);
  if (inviteMatch) {
    return handleInviteAction(
      request,
      env,
      inviteMatch[1],
      inviteMatch[2] as "accept" | "decline" | "cancel",
    );
  }
  const commandMatch = COMMAND_ROUTE.exec(pathname);
  if (commandMatch) return handleCommand(request, env, commandMatch[1]);
  const gameMatch = GAME_ROUTE.exec(pathname);
  if (gameMatch) return handleGetGame(request, env, gameMatch[1]);
  return apiError(404, "not_found", "Không tìm thấy tài nguyên Cờ tướng.");
}

export async function handleXiangqiApiRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== API_PREFIX && !url.pathname.startsWith(`${API_PREFIX}/`)) return null;
  try {
    return await routeXiangqiRequest(request, env, url);
  } catch (error) {
    console.error("Unhandled Xiangqi API error", error);
    return apiError(500, "internal_error", "Đã xảy ra lỗi. Vui lòng thử lại sau.");
  }
}
