"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { XiangqiVariant } from "../../lib/xiangqi/types";
import { internalPath } from "../lib/navigation";
import {
  classifyXiangqiFailure,
  isXiangqiApiError,
  type XiangqiClockMinutes,
  type XiangqiInvite,
  type XiangqiLobbySnapshot,
  type XiangqiOnlineClient,
  type XiangqiOnlinePlayer,
  type XiangqiPresenceStatus,
} from "./xiangqi-online-client";

type XiangqiLobbyProps = {
  client: XiangqiOnlineClient;
  variant: XiangqiVariant;
  clockMinutes: XiangqiClockMinutes;
  inviteCode?: string;
  onEnterGame: (gameId: string) => void;
  onBack: () => void;
  onSessionRequired: (message: string) => void;
};

const STATUS_GROUPS: readonly [XiangqiPresenceStatus, string, string][] = [
  ["available", "Rảnh", "Có thể nhận lời mời"],
  ["waiting", "Đang chờ", "Đã mở một phòng"],
  ["playing", "Đang chơi", "Đang trong một ván"],
];
const RETRY_DELAYS = [1_000, 2_000, 4_000, 8_000] as const;

function variantLabel(variant: XiangqiVariant) {
  return variant === "blind" ? "Cờ úp" : "Cờ sáng";
}

function inviteDescription(invite: XiangqiInvite) {
  return `${variantLabel(invite.variant)} · ${invite.clockMinutes} phút`;
}

function roomMessage(room: XiangqiInvite | null, now: number): { kind: "unknown" | "expired" | "full"; text: string } | null {
  if (!room) return { kind: "unknown", text: "Không tìm thấy phòng mang mã này. Có thể link đã bị nhập sai." };
  if (room.expiresAt <= now || room.status === "expired") {
    return { kind: "expired", text: "Phòng mời đã hết hạn. Hãy nhờ chủ phòng tạo một link mới nhé." };
  }
  if (room.status === "canceled") {
    return { kind: "expired", text: "Chủ phòng đã hủy lời mời này." };
  }
  if (room.status !== "pending") {
    return { kind: "full", text: "Phòng này đã đủ hai người hoặc không còn nhận người chơi mới." };
  }
  return null;
}

export function XiangqiLobby({
  client,
  variant,
  clockMinutes,
  inviteCode,
  onEnterGame,
  onBack,
  onSessionRequired,
}: XiangqiLobbyProps) {
  const [lobby, setLobby] = useState<XiangqiLobbySnapshot | null>(null);
  const [connectionMessage, setConnectionMessage] = useState("Đang kết nối với sảnh…");
  const [notice, setNotice] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [roomJoinError, setRoomJoinError] = useState("");
  const [fatalError, setFatalError] = useState("");
  const [pollGeneration, setPollGeneration] = useState(0);
  const acceptingRoomRef = useRef<string | null>(null);
  const autoAcceptAttemptedRef = useRef<string | null>(null);
  const enteredGameRef = useRef<string | null>(null);

  const enterGame = useCallback((gameId: string) => {
    if (enteredGameRef.current === gameId) return;
    enteredGameRef.current = gameId;
    onEnterGame(gameId);
  }, [onEnterGame]);

  const updateLobby = useCallback(async (signal?: AbortSignal) => {
    await client.heartbeat(signal);
    const next = await client.loadLobby(inviteCode, signal);
    setLobby(next);
    setFatalError("");
    setConnectionMessage("");
    if (next.activeGame) enterGame(next.activeGame.id);
    return next;
  }, [client, enterGame, inviteCode]);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;
    let controller: AbortController | null = null;
    let retryIndex = 0;

    const schedule = (delay: number) => {
      if (!active) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(poll, delay);
    };
    const poll = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        await updateLobby(controller.signal);
        retryIndex = 0;
        schedule(3_000);
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        const failureKind = classifyXiangqiFailure(error);
        if (failureKind === "session") {
          active = false;
          onSessionRequired(isXiangqiApiError(error) ? error.issue.message : "Phiên online đã hết hạn. Bé hãy nhập lại tên.");
          return;
        }
        if (failureKind === "permanent") {
          active = false;
          const message = isXiangqiApiError(error) ? error.issue.message : "Sảnh online không còn truy cập được.";
          setFatalError(message);
          setConnectionMessage(message);
          return;
        }
        const delay = RETRY_DELAYS[Math.min(retryIndex, RETRY_DELAYS.length - 1)];
        retryIndex += 1;
        setConnectionMessage(`Mất kết nối sảnh. Thử lại sau ${delay / 1_000} giây…`);
        schedule(delay);
      }
    };
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") schedule(0);
    };

    void poll();
    document.addEventListener("visibilitychange", syncWhenVisible);
    window.addEventListener("focus", syncWhenVisible);
    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.removeEventListener("focus", syncWhenVisible);
    };
  }, [onSessionRequired, pollGeneration, updateLobby]);

  const acceptRoom = useCallback(async (room: XiangqiInvite) => {
    if (acceptingRoomRef.current === room.id) return;
    acceptingRoomRef.current = room.id;
    setBusyAction(`accept-${room.id}`);
    setRoomJoinError("");
    setNotice("Đang nhận lời mời và xếp màu quân…");
    try {
      const game = await client.acceptInvite(room.id);
      enterGame(game.id);
    } catch (error) {
      if (classifyXiangqiFailure(error) === "session") {
        onSessionRequired(isXiangqiApiError(error) ? error.issue.message : "Phiên online đã hết hạn. Bé hãy nhập lại tên.");
      } else {
        setRoomJoinError(isXiangqiApiError(error) ? error.issue.message : "Chưa thể vào phòng. Bé có thể thử lại thủ công.");
      }
    } finally {
      acceptingRoomRef.current = null;
      setBusyAction(null);
    }
  }, [client, enterGame, onSessionRequired]);

  useEffect(() => {
    if (!inviteCode || !lobby || lobby.activeGame) return;
    const room = lobby.room;
    if (!room || roomMessage(room, lobby.serverNow) || room.from.id === lobby.player.id) return;
    if (autoAcceptAttemptedRef.current === room.id) return;
    autoAcceptAttemptedRef.current = room.id;
    void acceptRoom(room);
  }, [acceptRoom, inviteCode, lobby]);

  const groupedPlayers = useMemo(() => {
    const groups: Record<XiangqiPresenceStatus, XiangqiOnlinePlayer[]> = {
      available: [], waiting: [], playing: [],
    };
    for (const player of lobby?.players ?? []) groups[player.status].push(player);
    return groups;
  }, [lobby?.players]);

  const roomProblem = inviteCode && lobby ? roomMessage(lobby.room, lobby.serverNow) : null;
  const waitingInvite = lobby?.waitingInvite ?? null;
  const ownRoomLink = waitingInvite?.kind === "link" && waitingInvite.roomCode
    ? internalPath(`/co-tuong/phong/${waitingInvite.roomCode}`)
    : "";
  const invitedOwnRoom = lobby && inviteCode && lobby.room?.from.id === lobby.player.id ? lobby.room : null;
  const ownStatus: XiangqiPresenceStatus = lobby?.activeGame ? "playing" : waitingInvite ? "waiting" : "available";

  async function runAction(key: string, action: () => Promise<unknown>, successMessage: string, refresh = true) {
    setBusyAction(key);
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
      if (refresh) await updateLobby();
    } catch (error) {
      if (classifyXiangqiFailure(error) === "session") {
        onSessionRequired(isXiangqiApiError(error) ? error.issue.message : "Phiên online đã hết hạn. Bé hãy nhập lại tên.");
      } else {
        setNotice(isXiangqiApiError(error) ? error.issue.message : "Thao tác chưa thành công. Vui lòng thử lại.");
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function copyInviteLink() {
    if (!ownRoomLink) return;
    try {
      await navigator.clipboard.writeText(new URL(ownRoomLink, window.location.origin).toString());
      setCopyFeedback("Đã sao chép link mời!");
    } catch {
      setCopyFeedback("Chưa thể sao chép tự động. Hãy chọn và sao chép link bên dưới.");
    }
  }

  if (fatalError) {
    return (
      <section className="xiangqi-card xiangqi-room-state" aria-labelledby="xiangqi-lobby-error-title">
        <span aria-hidden="true">⚠</span>
        <p className="xiangqi-kicker">Sảnh online</p>
        <h2 id="xiangqi-lobby-error-title">Không thể mở sảnh</h2>
        <p role="alert">{fatalError}</p>
        <div className="xiangqi-inline-actions">
          <button type="button" className="xiangqi-primary-button" onClick={() => { setFatalError(""); setConnectionMessage("Đang kết nối lại sảnh…"); setPollGeneration((value) => value + 1); }}>Thử tải lại</button>
          <button type="button" className="xiangqi-secondary-button" onClick={onBack}>Về trang Cờ tướng</button>
        </div>
      </section>
    );
  }

  if (roomProblem) {
    return (
      <section className="xiangqi-card xiangqi-room-state" aria-labelledby="xiangqi-room-state-title">
        <span aria-hidden="true">{roomProblem.kind === "expired" ? "⌛" : roomProblem.kind === "full" ? "🏁" : "🧭"}</span>
        <p className="xiangqi-kicker">Mã phòng {inviteCode}</p>
        <h2 id="xiangqi-room-state-title">{roomProblem.kind === "expired" ? "Link đã hết hiệu lực" : roomProblem.kind === "full" ? "Phòng đã đủ người" : "Không tìm thấy phòng"}</h2>
        <p>{roomProblem.text}</p>
        <button type="button" className="xiangqi-primary-button" onClick={onBack}>Về sảnh Cờ tướng</button>
      </section>
    );
  }

  return (
    <section className="xiangqi-card xiangqi-lobby" aria-labelledby="xiangqi-lobby-title">
      <div className="xiangqi-lobby-heading">
        <div>
          <p className="xiangqi-kicker">Sảnh online</p>
          <h2 id="xiangqi-lobby-title">Chào {lobby?.player.name ?? "bé"}, tìm bạn đánh cờ nhé</h2>
          <p>{variantLabel(inviteCode && lobby?.room ? lobby.room.variant : variant)} · {inviteCode && lobby?.room ? lobby.room.clockMinutes : clockMinutes} phút mỗi bên</p>
        </div>
        <div className={`xiangqi-presence-pill is-${ownStatus}`}>
          <span aria-hidden="true" />
          {ownStatus === "available" ? "Rảnh" : ownStatus === "waiting" ? "Đang chờ" : "Đang chơi"}
        </div>
      </div>

      <p className="xiangqi-connection-line" role="status" aria-live="polite">
        {connectionMessage || notice || copyFeedback || "Sảnh được làm mới mỗi 3 giây."}
      </p>

      {invitedOwnRoom ? (
        <div className="xiangqi-invite-panel">
          <div><strong>Đây là phòng của bé</strong><p>Gửi link này cho bạn. Ván sẽ mở tự động khi bạn tham gia.</p></div>
          {ownRoomLink ? <input aria-label="Link mời Cờ tướng" readOnly value={ownRoomLink} onFocus={(event) => event.currentTarget.select()} /> : null}
          <div className="xiangqi-inline-actions">
            <button type="button" className="xiangqi-primary-button" onClick={copyInviteLink}>Sao chép link</button>
            <button type="button" className="xiangqi-secondary-button" disabled={busyAction === `cancel-${invitedOwnRoom.id}`} onClick={() => runAction(`cancel-${invitedOwnRoom.id}`, () => client.cancelInvite(invitedOwnRoom.id), "Đã hủy phòng chờ.")}>Hủy phòng</button>
          </div>
        </div>
      ) : null}

      {!inviteCode ? (
        <div className="xiangqi-lobby-grid">
          <div className="xiangqi-invite-column">
            <h3>Mời bằng link</h3>
            {waitingInvite ? (
              <div className="xiangqi-invite-panel">
                <div>
                  <strong>{waitingInvite.kind === "link" ? `Phòng ${waitingInvite.roomCode}` : `Đã mời ${waitingInvite.to?.name ?? "một người bạn"}`}</strong>
                  <p>{inviteDescription(waitingInvite)} · đang chờ phản hồi</p>
                </div>
                {ownRoomLink ? <input aria-label="Link mời Cờ tướng" readOnly value={ownRoomLink} onFocus={(event) => event.currentTarget.select()} /> : null}
                <div className="xiangqi-inline-actions">
                  {ownRoomLink ? <button type="button" className="xiangqi-primary-button" onClick={copyInviteLink}>Sao chép link</button> : null}
                  <button type="button" className="xiangqi-secondary-button" disabled={busyAction === `cancel-${waitingInvite.id}`} onClick={() => runAction(`cancel-${waitingInvite.id}`, () => client.cancelInvite(waitingInvite.id), "Đã hủy lời mời.")}>Hủy lời mời</button>
                </div>
              </div>
            ) : (
              <div className="xiangqi-invite-panel">
                <div><strong>Tạo phòng riêng</strong><p>Link có hiệu lực trong 10 phút và chỉ nhận một người bạn.</p></div>
                <button type="button" className="xiangqi-primary-button" disabled={busyAction === "create-link"} onClick={() => runAction("create-link", () => client.createInvite({ kind: "link", variant, clockMinutes }), "Đã tạo link mời. Sao chép và gửi cho bạn nhé!")}>{busyAction === "create-link" ? "Đang tạo…" : "Tạo link mời"}</button>
              </div>
            )}

            <section className="xiangqi-received-invites" aria-labelledby="xiangqi-received-title">
              <h3 id="xiangqi-received-title">Lời mời nhận được</h3>
              {lobby?.invitations.length ? lobby.invitations.map((invite) => (
                <article key={invite.id}>
                  <div><strong>{invite.from.name} mời bé chơi</strong><p>{inviteDescription(invite)}</p></div>
                  <div className="xiangqi-inline-actions">
                    <button type="button" className="xiangqi-primary-button" disabled={busyAction === `accept-${invite.id}`} onClick={() => runAction(`accept-${invite.id}`, async () => enterGame((await client.acceptInvite(invite.id)).id), "Đang vào ván…", false)}>Nhận lời</button>
                    <button type="button" className="xiangqi-secondary-button" disabled={busyAction === `decline-${invite.id}`} onClick={() => runAction(`decline-${invite.id}`, () => client.declineInvite(invite.id), "Đã từ chối lời mời.")}>Từ chối</button>
                  </div>
                </article>
              )) : <p>Chưa có lời mời mới.</p>}
            </section>
          </div>

          <div className="xiangqi-player-column">
            <div className="xiangqi-player-heading"><h3>Người đang online</h3><span>{lobby?.players.length ?? 0} người</span></div>
            {STATUS_GROUPS.map(([status, label, description]) => (
              <section key={status} className="xiangqi-player-group" aria-labelledby={`xiangqi-player-${status}`}>
                <div><h4 id={`xiangqi-player-${status}`}>{label}</h4><span>{description}</span></div>
                {groupedPlayers[status].length ? groupedPlayers[status].map((player) => (
                  <article key={player.id}>
                    <span className="xiangqi-player-avatar" aria-hidden="true">{player.name.slice(0, 1).toUpperCase()}</span>
                    <strong>{player.name}</strong>
                    {status === "available" ? (
                      <button type="button" className="xiangqi-secondary-button" disabled={Boolean(waitingInvite) || busyAction === `invite-${player.id}`} onClick={() => runAction(`invite-${player.id}`, () => client.createInvite({ kind: "direct", variant, clockMinutes, targetSessionId: player.id }), `Đã gửi lời mời tới ${player.name}.`)}>Mời chơi</button>
                    ) : <span className={`xiangqi-status-tag is-${status}`}>{label}</span>}
                  </article>
                )) : <p>Chưa có ai ở trạng thái này.</p>}
              </section>
            ))}
          </div>
        </div>
      ) : busyAction?.startsWith("accept-") ? (
        <div className="xiangqi-room-joining" role="status"><span aria-hidden="true">♟</span><strong>Đang vào phòng…</strong><p>Màu quân sẽ được máy chủ xáo ngẫu nhiên.</p></div>
      ) : roomJoinError && lobby?.room ? (
        <div className="xiangqi-invite-panel xiangqi-room-recovery" role="alert">
          <div><strong>Chưa thể vào phòng</strong><p>{roomJoinError}</p></div>
          {waitingInvite ? <p>Bé đang có một lời mời/phòng khác. Hãy hủy lời mời đó trước rồi thử vào lại.</p> : null}
          <div className="xiangqi-inline-actions">
            {waitingInvite ? <button type="button" className="xiangqi-secondary-button" disabled={busyAction === `cancel-${waitingInvite.id}`} onClick={() => runAction(`cancel-${waitingInvite.id}`, () => client.cancelInvite(waitingInvite.id), "Đã hủy lời mời đang chờ. Bé có thể thử vào phòng lại.")}>Hủy lời mời đang chờ</button> : null}
            <button type="button" className="xiangqi-primary-button" disabled={Boolean(busyAction)} onClick={() => void acceptRoom(lobby.room!)}>Thử vào lại</button>
          </div>
        </div>
      ) : null}

      <button type="button" className="xiangqi-lobby-back" onClick={onBack}>← {inviteCode ? "Về trang Cờ tướng" : "Đổi loại cờ hoặc thời gian"}</button>
    </section>
  );
}
