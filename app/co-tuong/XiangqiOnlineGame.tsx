"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { legalMoves } from "../../lib/xiangqi/rules";
import { coordKey, otherSide, sameCoord, type Coord, type PieceRole, type Side } from "../../lib/xiangqi/types";
import { XiangqiBoard } from "./XiangqiBoard";
import { XiangqiClock } from "./XiangqiClock";
import {
  classifyXiangqiFailure,
  isXiangqiApiError,
  type XiangqiCommand,
  type XiangqiGameSnapshot,
  type XiangqiOnlineClient,
} from "./xiangqi-online-client";

type XiangqiOnlineGameProps = {
  client: XiangqiOnlineClient;
  gameId?: string;
  inviteCode?: string;
  onReturnToLobby: () => void;
  onActiveChange?: (active: boolean) => void;
  onSessionRequired: (message: string) => void;
};

type ConnectionState = "connecting" | "connected" | "retrying";
type ClockValues = Record<Side, number>;

const RETRY_DELAYS = [1_000, 2_000, 4_000, 8_000] as const;
const ROLE_LABELS: Record<PieceRole, string> = {
  general: "Tướng", advisor: "Sĩ", elephant: "Tượng", horse: "Mã",
  rook: "Xe", cannon: "Pháo", soldier: "Tốt",
};

function sideLabel(side: Side) {
  return side === "red" ? "Đỏ" : "Đen";
}

function coordLabel([x, y]: Coord) {
  return `${String.fromCharCode(65 + x)}${10 - y}`;
}

function moveLabel(move: XiangqiGameSnapshot["state"]["moves"][number]) {
  const reveal = move.revealedRole ? ` · lật ${ROLE_LABELS[move.revealedRole]}` : "";
  return `${coordLabel(move.from)}${move.capturedPieceId ? " ×" : " →"} ${coordLabel(move.to)}${reveal}`;
}

function terminalMessage(game: XiangqiGameSnapshot) {
  const status = game.status;
  if (status.kind === "repetition") return "Ván cờ hòa vì thế cờ lặp lại ba lần.";
  if (status.kind === "draw-agreed") return "Hai bên đã đồng ý hòa.";
  if (status.kind === "active") return "Ván cờ đang diễn ra.";
  const winner = status.winner ? game.players[status.winner].name : "Hai bên";
  const reason = {
    checkmate: "chiếu bí",
    "no-legal-move": "đối thủ không còn nước hợp lệ",
    timeout: "đối thủ hết giờ",
    resignation: "đối thủ đầu hàng",
  }[status.kind];
  return `${winner} thắng vì ${reason}.`;
}

function clockValues(game: XiangqiGameSnapshot, receivedAt: number, now: number): ClockValues {
  const values = { red: game.clocks.redMs, black: game.clocks.blackMs };
  const activeSide = game.clocks.activeSide;
  if (game.status.kind !== "active" || !activeSide || game.clocks.activeSince === null) return values;
  const estimatedServerNow = game.clocks.serverNow + Math.max(0, now - receivedAt);
  const elapsed = Math.max(0, estimatedServerNow - game.clocks.activeSince);
  return { ...values, [activeSide]: Math.max(0, values[activeSide] - elapsed) };
}

export function XiangqiOnlineGame({
  client,
  gameId,
  inviteCode,
  onReturnToLobby,
  onActiveChange,
  onSessionRequired,
}: XiangqiOnlineGameProps) {
  const [invitedGameId, setInvitedGameId] = useState("");
  const resolvedGameId = gameId ?? invitedGameId;
  const [snapshot, setSnapshot] = useState<XiangqiGameSnapshot | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [connectionMessage, setConnectionMessage] = useState("Đang tải ván cờ…");
  const [announcement, setAnnouncement] = useState("Đang đồng bộ bàn cờ từ máy chủ…");
  const [selectedSquare, setSelectedSquare] = useState<Coord | null>(null);
  const [busyCommand, setBusyCommand] = useState<XiangqiCommand["type"] | null>(null);
  const [fatalError, setFatalError] = useState("");
  const [pollGeneration, setPollGeneration] = useState(0);
  const [resolveGeneration, setResolveGeneration] = useState(0);
  const [readyRetryVersion, setReadyRetryVersion] = useState(0);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [receivedAt, setReceivedAt] = useState(() => Date.now());
  const snapshotRef = useRef<XiangqiGameSnapshot | null>(null);
  const readyInFlightRef = useRef(false);
  const readyRetryIndexRef = useRef(0);
  const readyRetryTimerRef = useRef<number | null>(null);

  const applySnapshot = useCallback((next: XiangqiGameSnapshot) => {
    const current = snapshotRef.current;
    if (current?.id === next.id && current.revision > next.revision) return;
    snapshotRef.current = next;
    setReceivedAt(Date.now());
    setSnapshot(next);
    setFatalError("");
    setSelectedSquare(null);
    setConnection("connected");
    setConnectionMessage("Đã kết nối");
  }, []);

  useEffect(() => {
    if (resolvedGameId || !inviteCode) return;
    const controller = new AbortController();
    client.loadLobby(inviteCode, controller.signal)
      .then(async (lobby) => {
        if (lobby.activeGame) {
          setInvitedGameId(lobby.activeGame.id);
          return;
        }
        const room = lobby.room;
        if (!room) throw new Error("Không tìm thấy phòng mời.");
        if (room.status !== "pending" || room.expiresAt <= lobby.serverNow) throw new Error("Phòng mời không còn nhận người chơi.");
        if (room.from.id === lobby.player.id) throw new Error("Phòng đang chờ người bạn mở link.");
        const game = await client.acceptInvite(room.id, controller.signal);
        applySnapshot(game);
        setInvitedGameId(game.id);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (classifyXiangqiFailure(error) === "session") {
          onSessionRequired(isXiangqiApiError(error) ? error.issue.message : "Phiên online đã hết hạn. Bé hãy nhập lại tên.");
          return;
        }
        setFatalError(isXiangqiApiError(error) ? error.issue.message : error instanceof Error ? error.message : "Chưa thể mở phòng mời.");
      });
    return () => controller.abort();
  }, [applySnapshot, client, inviteCode, onSessionRequired, resolveGeneration, resolvedGameId]);

  useEffect(() => {
    if (!resolvedGameId) return;
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
        const hasCurrentSnapshot = snapshotRef.current?.id === resolvedGameId;
        const next = await client.loadGame(resolvedGameId, controller.signal, { allowNotModified: hasCurrentSnapshot });
        if (next) applySnapshot(next);
        else {
          setConnection("connected");
          setConnectionMessage("Đã kết nối");
        }
        retryIndex = 0;
        schedule(1_000);
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
          const message = isXiangqiApiError(error) ? error.issue.message : "Ván cờ không còn truy cập được.";
          setFatalError(message);
          setConnectionMessage(message);
          return;
        }
        const delay = RETRY_DELAYS[Math.min(retryIndex, RETRY_DELAYS.length - 1)];
        retryIndex += 1;
        setConnection("retrying");
        setConnectionMessage(`Mất kết nối. Thử lại sau ${delay / 1_000} giây…`);
        schedule(delay);
      }
    };
    const syncNow = () => {
      if (document.visibilityState === "visible") schedule(0);
    };

    void poll();
    document.addEventListener("visibilitychange", syncNow);
    window.addEventListener("focus", syncNow);
    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", syncNow);
      window.removeEventListener("focus", syncNow);
    };
  }, [applySnapshot, client, onSessionRequired, pollGeneration, resolvedGameId]);

  const sendCommand = useCallback(async (command: XiangqiCommand, successMessage?: string) => {
    const current = snapshotRef.current;
    if (!current || busyCommand) return;
    setBusyCommand(command.type);
    try {
      const next = await client.command(current.id, command, current.revision);
      applySnapshot(next);
      if (successMessage) setAnnouncement(successMessage);
    } catch (error) {
      if (isXiangqiApiError(error) && error.latestGame) {
        applySnapshot(error.latestGame);
        setAnnouncement("Ván cờ vừa thay đổi. Bàn đã được đồng bộ lại theo máy chủ.");
      } else if (classifyXiangqiFailure(error) === "session") {
        onSessionRequired(isXiangqiApiError(error) ? error.issue.message : "Phiên online đã hết hạn. Bé hãy nhập lại tên.");
      } else {
        setAnnouncement(isXiangqiApiError(error) ? error.issue.message : "Lệnh chưa gửi được. Bàn cờ vẫn giữ nguyên để chờ đồng bộ.");
      }
    } finally {
      setBusyCommand(null);
    }
  }, [applySnapshot, busyCommand, client, onSessionRequired]);

  const scheduleReadyRetry = useCallback((delay: number) => {
    if (readyRetryTimerRef.current !== null) window.clearTimeout(readyRetryTimerRef.current);
    readyRetryTimerRef.current = window.setTimeout(() => {
      readyRetryTimerRef.current = null;
      setReadyRetryVersion((value) => value + 1);
    }, delay);
  }, []);

  useEffect(() => {
    if (!snapshot || snapshot.status.kind !== "active") return;
    if (snapshot.players[snapshot.you.side].ready) {
      readyRetryIndexRef.current = 0;
      if (readyRetryTimerRef.current !== null) window.clearTimeout(readyRetryTimerRef.current);
      readyRetryTimerRef.current = null;
      return;
    }
    if (readyInFlightRef.current) return;
    if (readyRetryTimerRef.current !== null) window.clearTimeout(readyRetryTimerRef.current);
    readyRetryTimerRef.current = null;
    readyInFlightRef.current = true;
    const revision = snapshot.revision;
    client.command(snapshot.id, { type: "ready" }, revision)
      .then(applySnapshot)
      .catch((error: unknown) => {
        if (isXiangqiApiError(error) && error.latestGame) {
          applySnapshot(error.latestGame);
          scheduleReadyRetry(0);
          return;
        }
        const failureKind = classifyXiangqiFailure(error);
        if (failureKind === "session") {
          onSessionRequired(isXiangqiApiError(error) ? error.issue.message : "Phiên online đã hết hạn. Bé hãy nhập lại tên.");
          return;
        }
        if (failureKind === "permanent") {
          const code = isXiangqiApiError(error) ? error.issue.code : "";
          if (code === "game_finished") {
            setConnectionMessage(isXiangqiApiError(error) ? error.issue.message : "Không thể báo sẵn sàng cho ván này.");
          } else {
            setFatalError(isXiangqiApiError(error) ? error.issue.message : "Không thể báo sẵn sàng cho ván này.");
          }
          return;
        }
        const delay = RETRY_DELAYS[Math.min(readyRetryIndexRef.current, RETRY_DELAYS.length - 1)];
        readyRetryIndexRef.current += 1;
        setConnection("retrying");
        setConnectionMessage(`Chưa báo sẵn sàng được. Thử lại sau ${delay / 1_000} giây…`);
        scheduleReadyRetry(delay);
      })
      .finally(() => { readyInFlightRef.current = false; });
  }, [applySnapshot, client, onSessionRequired, readyRetryVersion, scheduleReadyRetry, snapshot]);

  useEffect(() => () => {
    if (readyRetryTimerRef.current !== null) window.clearTimeout(readyRetryTimerRef.current);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    onActiveChange?.(snapshot?.status.kind === "active");
    return () => onActiveChange?.(false);
  }, [onActiveChange, snapshot?.status.kind]);

  const bothReady = Boolean(snapshot?.players.red.ready && snapshot.players.black.ready);
  const canMove = Boolean(
    snapshot
    && bothReady
    && snapshot.status.kind === "active"
    && snapshot.state.turn === snapshot.you.side
    && connection === "connected"
    && !busyCommand,
  );
  const legalTargets = useMemo(() => {
    if (!snapshot || !selectedSquare || !canMove) return [];
    return legalMoves(snapshot.state, selectedSquare).map((move) => move.to);
  }, [canMove, selectedSquare, snapshot]);

  function chooseSquare(coord: Coord) {
    const current = snapshotRef.current;
    if (!current || !canMove) return;
    const piece = current.state.board[coordKey(coord)];
    if (!selectedSquare) {
      if (piece?.side === current.you.side) {
        setSelectedSquare(coord);
        const count = legalMoves(current.state, coord).length;
        setAnnouncement(count ? `Đã chọn ${piece.revealed && piece.role ? ROLE_LABELS[piece.role] : "quân úp"}. Có ${count} đích hợp lệ.` : "Quân này chưa có nước đi hợp lệ.");
      } else setAnnouncement("Hãy chọn một quân của bé trước nhé.");
      return;
    }
    if (sameCoord(selectedSquare, coord)) {
      setSelectedSquare(null);
      setAnnouncement("Đã bỏ chọn quân cờ.");
      return;
    }
    if (piece?.side === current.you.side) {
      setSelectedSquare(coord);
      setAnnouncement(`Đã đổi quân. Có ${legalMoves(current.state, coord).length} đích hợp lệ.`);
      return;
    }
    const move = legalMoves(current.state, selectedSquare).find((candidate) => sameCoord(candidate.to, coord));
    if (!move) {
      setAnnouncement("Ô đó không phải đích hợp lệ. Bé hãy chọn một chấm xanh.");
      return;
    }
    void sendCommand({ type: "move", move }, `Đã gửi nước ${coordLabel(move.from)} đến ${coordLabel(move.to)}.`);
  }

  if (fatalError) {
    return (
      <section className="xiangqi-card xiangqi-room-state" aria-labelledby="xiangqi-game-error-title">
        <span aria-hidden="true">⚠</span>
        <p className="xiangqi-kicker">Ván online</p>
        <h2 id="xiangqi-game-error-title">Không thể mở ván cờ</h2>
        <p role="alert">{fatalError}</p>
        <div className="xiangqi-inline-actions">
          <button type="button" className="xiangqi-primary-button" onClick={() => { setFatalError(""); setConnection("connecting"); setConnectionMessage("Đang thử tải lại ván cờ…"); if (resolvedGameId) setPollGeneration((value) => value + 1); else setResolveGeneration((value) => value + 1); }}>Thử tải lại</button>
          <button type="button" className="xiangqi-secondary-button" onClick={onReturnToLobby}>Về sảnh</button>
        </div>
      </section>
    );
  }

  if (!snapshot) {
    return (
      <section className="xiangqi-card xiangqi-room-joining" aria-live="polite">
        <span aria-hidden="true">♟</span>
        <h2>Đang mở bàn cờ online</h2>
        <p>{connectionMessage}</p>
        {connection === "retrying" ? <button type="button" className="xiangqi-secondary-button" onClick={onReturnToLobby}>Về sảnh</button> : null}
      </section>
    );
  }

  const playerSide = snapshot.you.side;
  const opponentSide = otherSide(playerSide);
  const totalMs = snapshot.clockMinutes * 60_000;
  const clocks = clockValues(snapshot, receivedAt, clockNow);
  const opponentOfferedDraw = snapshot.pendingDrawBy === opponentSide;
  const ownOfferedDraw = snapshot.pendingDrawBy === playerSide;
  const sideOrder: readonly Side[] = [opponentSide, playerSide];
  const turnName = snapshot.players[snapshot.state.turn].name;
  const connectionLabel = connection === "connected" ? "Đã kết nối" : connection === "retrying" ? "Đang kết nối lại" : "Đang kết nối";

  if (!bothReady && snapshot.status.kind === "active") {
    return (
      <section className="xiangqi-card xiangqi-online-ready" aria-labelledby="xiangqi-ready-title">
        <div className="xiangqi-online-ready-icon" aria-hidden="true">🏮</div>
        <p className="xiangqi-kicker">Phòng sẵn sàng</p>
        <h2 id="xiangqi-ready-title">Chờ cả hai bên vào bàn</h2>
        <p>Đồng hồ chỉ bắt đầu sau khi cả hai trình duyệt đã tải xong bàn cờ.</p>
        <div className="xiangqi-ready-players">
          {(["red", "black"] as const).map((side) => (
            <article key={side} className={snapshot.players[side].ready ? "is-ready" : ""}>
              <span className={`xiangqi-mini-piece xiangqi-mini-piece--${side}`} aria-hidden="true">{side === "red" ? "帥" : "將"}</span>
              <div><strong>{snapshot.players[side].name}</strong><small>Quân {sideLabel(side)}</small></div>
              <b>{snapshot.players[side].ready ? "✓ Sẵn sàng" : "Đang vào…"}</b>
            </article>
          ))}
        </div>
        <p className={`xiangqi-online-connection is-${connection}`} role="status" aria-live="polite"><span aria-hidden="true" />{connectionMessage || connectionLabel}</p>
        <button type="button" className="xiangqi-secondary-button" onClick={onReturnToLobby}>Rời phòng</button>
      </section>
    );
  }

  return (
    <section className="xiangqi-game-layout xiangqi-online-game" aria-label="Ván Cờ tướng online">
      <div className="xiangqi-board-column">
        <div className="xiangqi-game-toolbar">
          <div><span>{snapshot.variant === "blind" ? "Cờ úp online" : "Cờ sáng online"}</span><strong>{snapshot.clockMinutes} phút · Bé cầm quân {sideLabel(playerSide)}</strong></div>
          <button type="button" onClick={onReturnToLobby}>Về sảnh</button>
        </div>
        <p className={`xiangqi-online-connection is-${connection}`} role="status" aria-live="polite"><span aria-hidden="true" />{connectionMessage || connectionLabel}</p>
        <XiangqiBoard state={snapshot.state} playerSide={playerSide} selectedSquare={selectedSquare} legalTargets={legalTargets} disabled={!canMove} onSquareClick={chooseSquare} />
        <p className="xiangqi-announcement" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
      </div>

      <aside className="xiangqi-sidebar" aria-label="Thông tin ván cờ online">
        <section className={`xiangqi-turn-card${snapshot.status.inCheck ? " is-check" : ""}${snapshot.status.kind !== "active" ? " is-finished" : ""}`}>
          <p>{snapshot.status.kind === "active" ? "Lượt hiện tại" : "Ván cờ kết thúc"}</p>
          {snapshot.status.kind === "active" ? (
            <><strong>Quân {sideLabel(snapshot.state.turn)} · {turnName}</strong><span>{snapshot.status.inCheck ? "⚠ Tướng đang bị chiếu" : snapshot.state.turn === playerSide ? "Đến lượt bé" : "Đang chờ đối thủ đi"}</span></>
          ) : <><strong>{terminalMessage(snapshot)}</strong><span>Có thể mời đối thủ chơi lại cùng bàn.</span></>}
        </section>

        <div className="xiangqi-clocks">
          {sideOrder.map((side) => <XiangqiClock key={side} side={side} playerName={snapshot.players[side].name} remainingMs={clocks[side]} totalMs={totalMs} isRunning={snapshot.status.kind === "active" && snapshot.clocks.activeSide === side} isStopped={snapshot.status.kind !== "active"} />)}
        </div>

        {opponentOfferedDraw ? (
          <section className="xiangqi-draw-offer" aria-labelledby="xiangqi-draw-title">
            <strong id="xiangqi-draw-title">{snapshot.players[opponentSide].name} xin hòa</strong>
            <p>Bé muốn đồng ý kết thúc ván với kết quả hòa không?</p>
            <div className="xiangqi-inline-actions">
              <button type="button" className="xiangqi-primary-button" disabled={Boolean(busyCommand)} onClick={() => void sendCommand({ type: "accept_draw" }, "Hai bên đã đồng ý hòa.")}>Đồng ý hòa</button>
              <button type="button" className="xiangqi-secondary-button" disabled={Boolean(busyCommand)} onClick={() => void sendCommand({ type: "decline_draw" }, "Đã từ chối đề nghị hòa.")}>Tiếp tục chơi</button>
            </div>
          </section>
        ) : null}

        <div className="xiangqi-actions">
          {snapshot.status.kind === "active" ? (
            <>
              <button type="button" className="xiangqi-secondary-button" disabled={Boolean(busyCommand) || Boolean(snapshot.pendingDrawBy)} onClick={() => void sendCommand({ type: "offer_draw" }, "Đã gửi đề nghị hòa tới đối thủ.")}>{ownOfferedDraw ? "Đang chờ trả lời…" : "🤝 Xin hòa"}</button>
              <button type="button" className="xiangqi-danger-button" disabled={Boolean(busyCommand)} onClick={() => void sendCommand({ type: "resign" }, "Bé đã đầu hàng ván này.")}>⚑ Đầu hàng</button>
            </>
          ) : (
            <>
              <button type="button" className="xiangqi-primary-button" disabled={Boolean(busyCommand) || snapshot.rematchRequested[playerSide]} onClick={() => void sendCommand({ type: "rematch" }, "Đã mời đối thủ chơi lại.")}>{snapshot.rematchRequested[playerSide] ? "Đang chờ đối thủ…" : snapshot.rematchRequested[opponentSide] ? "↻ Nhận lời chơi lại" : "↻ Mời chơi lại"}</button>
              <button type="button" className="xiangqi-secondary-button" onClick={onReturnToLobby}>Tìm bạn khác</button>
            </>
          )}
        </div>

        <section className="xiangqi-history" aria-labelledby="xiangqi-online-history-title">
          <div><strong id="xiangqi-online-history-title">Biên bản nước đi</strong><span>{snapshot.state.moves.length} nước</span></div>
          {snapshot.state.moves.length ? (
            <ol>{snapshot.state.moves.map((move, index) => <li key={`${move.pieceId}-${index}`}><b>{index + 1}.</b><span className={`is-${move.side}`}>{sideLabel(move.side)}</span><span>{moveLabel(move)}</span></li>)}</ol>
          ) : <p>Nước đi đầu tiên sẽ xuất hiện ở đây.</p>}
        </section>
      </aside>
    </section>
  );
}
