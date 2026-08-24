import type {
  Coord,
  GameStatus,
  PublicXiangqiState,
  Side,
  XiangqiVariant,
} from "../../lib/xiangqi/types";

const API_ROOT = "/api/xiangqi";
const SESSION_ENDPOINT = `${API_ROOT}/session`;
const HEARTBEAT_ENDPOINT = `${API_ROOT}/presence/heartbeat`;
const LOBBY_ENDPOINT = `${API_ROOT}/lobby`;
const INVITES_ENDPOINT = `${API_ROOT}/invites`;

export type XiangqiPresenceStatus = "available" | "waiting" | "playing";
export type XiangqiInviteStatus = "pending" | "accepted" | "declined" | "canceled" | "expired";
export type XiangqiClockMinutes = 5 | 10 | 15;

export type XiangqiOnlinePlayer = {
  id: string;
  name: string;
  status: XiangqiPresenceStatus;
  lastSeenAt: number;
};

export type XiangqiInvite = {
  id: string;
  kind: "link" | "direct";
  from: { id: string; name: string };
  to: { id: string; name: string } | null;
  roomCode: string | null;
  variant: XiangqiVariant;
  clockMinutes: number;
  status: XiangqiInviteStatus;
  gameId: string | null;
  expiresAt: number;
  createdAt: number;
};

export type XiangqiActiveGame = {
  id: string;
  variant: XiangqiVariant;
  clockMinutes: number;
  revision: number;
  status: "active";
  side: Side;
};

export type XiangqiLobbySnapshot = {
  player: { id: string; name: string };
  players: XiangqiOnlinePlayer[];
  invitations: XiangqiInvite[];
  waitingInvite: XiangqiInvite | null;
  activeGame: XiangqiActiveGame | null;
  room: XiangqiInvite | null;
  serverNow: number;
};

export type XiangqiGameSnapshot = {
  id: string;
  variant: XiangqiVariant;
  clockMinutes: number;
  revision: number;
  status: GameStatus;
  state: PublicXiangqiState;
  players: Record<Side, { id: string; name: string; ready: boolean }>;
  you: { id: string; side: Side };
  clocks: {
    redMs: number;
    blackMs: number;
    activeSide: Side | null;
    activeSince: number | null;
    serverNow: number;
  };
  pendingDrawBy: Side | null;
  rematchRequested: Record<Side, boolean>;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
};

export type XiangqiApiIssue = { code: string; message: string };

export class XiangqiApiError extends Error {
  readonly issue: XiangqiApiIssue;
  readonly status: number;
  readonly latestGame: XiangqiGameSnapshot | null;

  constructor(issue: XiangqiApiIssue, status = 0, latestGame: XiangqiGameSnapshot | null = null) {
    super(issue.message);
    this.name = "XiangqiApiError";
    this.issue = issue;
    this.status = status;
    this.latestGame = latestGame;
  }
}

export type XiangqiInviteInput =
  | { kind: "link"; variant: XiangqiVariant; clockMinutes: XiangqiClockMinutes }
  | { kind: "direct"; variant: XiangqiVariant; clockMinutes: XiangqiClockMinutes; targetSessionId: string };

export type XiangqiCommand =
  | { type: "ready" | "offer_draw" | "accept_draw" | "decline_draw" | "resign" | "rematch" }
  | { type: "move"; move: { from: Coord; to: Coord } };

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issueFromPayload(payload: unknown, fallback: string): XiangqiApiIssue {
  if (isRecord(payload) && isRecord(payload.error)) {
    const code = typeof payload.error.code === "string" ? payload.error.code : "request_failed";
    const message = typeof payload.error.message === "string" ? payload.error.message : fallback;
    return { code, message };
  }
  return { code: "request_failed", message: fallback };
}

function assertPublicGame(value: unknown): XiangqiGameSnapshot {
  if (!isRecord(value) || !isRecord(value.state) || value.state.visibility !== "public") {
    throw new XiangqiApiError({ code: "unsafe_snapshot", message: "Máy chủ đã trả về trạng thái ván cờ không an toàn." });
  }
  if ("seed" in value.state || "concealedPieces" in value.state) {
    throw new XiangqiApiError({ code: "unsafe_snapshot", message: "Dữ liệu riêng của ván Cờ úp không được phép xuất hiện trên trình duyệt." });
  }
  if (isRecord(value.state.board)) {
    for (const piece of Object.values(value.state.board)) {
      if (isRecord(piece) && piece.revealed === false && piece.role !== null) {
        throw new XiangqiApiError({ code: "unsafe_snapshot", message: "Danh tính quân úp chưa lật đã bị lộ." });
      }
    }
  }
  return value as XiangqiGameSnapshot;
}

async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 304) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export class XiangqiOnlineClient {
  private readonly gameEtags = new Map<string, string>();

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    if (options.body !== undefined) headers.set("Content-Type", "application/json");

    let response: Response;
    try {
      response = await fetch(path, {
        method: options.method ?? "GET",
        credentials: "same-origin",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new XiangqiApiError({ code: "network_error", message: "Không thể kết nối tới kỳ đài. Đang thử lại…" });
    }

    const payload = await readPayload(response);
    if (!response.ok) {
      const latestGame = isRecord(payload) && "game" in payload ? assertPublicGame(payload.game) : null;
      throw new XiangqiApiError(
        issueFromPayload(payload, `Yêu cầu chưa thành công (${response.status}).`),
        response.status,
        latestGame,
      );
    }
    return payload as T;
  }

  async ensureSession(name: string, signal?: AbortSignal) {
    return this.request<{ player: { id: string; name: string } }>(SESSION_ENDPOINT, {
      method: "POST",
      body: { name },
      signal,
    });
  }

  async heartbeat(signal?: AbortSignal) {
    return this.request<{
      status: XiangqiPresenceStatus;
      invitations: XiangqiInvite[];
      serverNow: number;
    }>(HEARTBEAT_ENDPOINT, { method: "POST", body: {}, signal });
  }

  async loadLobby(roomCode?: string, signal?: AbortSignal) {
    const query = roomCode ? `?roomCode=${encodeURIComponent(roomCode.trim().toUpperCase())}` : "";
    return this.request<XiangqiLobbySnapshot>(`${LOBBY_ENDPOINT}${query}`, { signal });
  }

  async createInvite(input: XiangqiInviteInput, signal?: AbortSignal) {
    return this.request<{ invite: XiangqiInvite }>(INVITES_ENDPOINT, {
      method: "POST",
      body: input,
      signal,
    });
  }

  async acceptInvite(inviteId: string, signal?: AbortSignal) {
    const result = await this.request<{ game: unknown }>(`${INVITES_ENDPOINT}/${encodeURIComponent(inviteId)}/accept`, {
      method: "POST",
      body: {},
      signal,
    });
    return assertPublicGame(result.game);
  }

  async declineInvite(inviteId: string, signal?: AbortSignal) {
    return this.request<{ ok: true; status: "declined" }>(`${INVITES_ENDPOINT}/${encodeURIComponent(inviteId)}/decline`, {
      method: "POST",
      body: {},
      signal,
    });
  }

  async cancelInvite(inviteId: string, signal?: AbortSignal) {
    return this.request<{ ok: true; status: "canceled" }>(`${INVITES_ENDPOINT}/${encodeURIComponent(inviteId)}/cancel`, {
      method: "POST",
      body: {},
      signal,
    });
  }

  async loadGame(gameId: string, signal?: AbortSignal): Promise<XiangqiGameSnapshot | null> {
    const headers = new Headers();
    const etag = this.gameEtags.get(gameId);
    if (etag) headers.set("If-None-Match", etag);

    let response: Response;
    try {
      response = await fetch(`${API_ROOT}/games/${encodeURIComponent(gameId)}`, {
        credentials: "same-origin",
        headers,
        signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new XiangqiApiError({ code: "network_error", message: "Mất kết nối với ván cờ. Đang thử lại…" });
    }
    if (response.status === 304) return null;

    const payload = await readPayload(response);
    if (!response.ok) {
      throw new XiangqiApiError(issueFromPayload(payload, `Không thể tải ván cờ (${response.status}).`), response.status);
    }
    if (!isRecord(payload) || !("game" in payload)) {
      throw new XiangqiApiError({ code: "invalid_response", message: "Máy chủ đã trả về dữ liệu ván cờ không hợp lệ." });
    }
    const snapshot = assertPublicGame(payload.game);
    const nextEtag = response.headers.get("ETag");
    if (nextEtag) this.gameEtags.set(gameId, nextEtag);
    return snapshot;
  }

  async command(gameId: string, command: XiangqiCommand, revision: number, signal?: AbortSignal) {
    const result = await this.request<{ game: unknown }>(`${API_ROOT}/games/${encodeURIComponent(gameId)}/commands`, {
      method: "POST",
      body: { ...command, revision },
      signal,
    });
    const snapshot = assertPublicGame(result.game);
    this.gameEtags.delete(gameId);
    return snapshot;
  }
}

export function isXiangqiApiError(error: unknown): error is XiangqiApiError {
  return error instanceof XiangqiApiError;
}
