"use client";

import { type KeyboardEvent, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { applyMove, createGame, getGameStatus, legalMoves, toPublicState } from "../../lib/xiangqi/rules";
import {
  coordKey,
  otherSide,
  sameCoord,
  type Coord,
  type GameStatus,
  type Move,
  type PieceRole,
  type Side,
  type StoredOutcome,
  type XiangqiState,
} from "../../lib/xiangqi/types";
import { GameShell } from "../components/GameShell";
import { readChildName, saveChildName } from "../lib/child-session";
import { navigateInternal } from "../lib/navigation";
import { XiangqiBoard } from "./XiangqiBoard";
import { XiangqiClock } from "./XiangqiClock";
import { XiangqiLobby } from "./XiangqiLobby";
import { XiangqiOnlineGame } from "./XiangqiOnlineGame";
import { XiangqiSetup, type XiangqiConfig } from "./XiangqiSetup";
import { findLegalFallbackMove, requestComputerMove } from "./xiangqi-ai-client";
import { isXiangqiApiError, XiangqiOnlineClient } from "./xiangqi-online-client";

type XiangqiGameProps = {
  inviteCode?: string;
};

type ClockValues = Record<Side, number>;
type OnlinePhase = "idle" | "checking" | "name" | "connecting" | "ready" | "error";

const ROLE_LABELS: Record<PieceRole, string> = {
  general: "Tướng",
  advisor: "Sĩ",
  elephant: "Tượng",
  horse: "Mã",
  rook: "Xe",
  cannon: "Pháo",
  soldier: "Tốt",
};

function sideLabel(side: Side): string {
  return side === "red" ? "Đỏ" : "Đen";
}

function coordLabel([x, y]: Coord): string {
  return `${String.fromCharCode(65 + x)}${10 - y}`;
}

function moveLabel(move: XiangqiState["moves"][number]): string {
  const reveal = move.revealedRole ? ` · lật ${ROLE_LABELS[move.revealedRole]}` : "";
  const capture = move.capturedPieceId ? " ×" : " →";
  return `${coordLabel(move.from)}${capture} ${coordLabel(move.to)}${reveal}`;
}

function seedForLocalGame(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function winnerName(side: Side, config: XiangqiConfig, playerName: string): string {
  return side === config.humanSide ? playerName : "Máy Cờ Tướng";
}

function terminalMessage(status: Exclude<GameStatus, { kind: "active" }>, config: XiangqiConfig, playerName: string): string {
  if (status.kind === "repetition") return "Ván cờ hòa vì thế cờ lặp lại ba lần.";
  if (status.kind === "draw-agreed") return "Hai bên đã đồng ý hòa.";
  const winner = status.winner ? winnerName(status.winner, config, playerName) : "Hai bên";
  const reason = {
    checkmate: "chiếu bí",
    "no-legal-move": "đối thủ không còn nước hợp lệ",
    timeout: "đối thủ hết giờ",
    resignation: "đối thủ đầu hàng",
  }[status.kind];
  return `${winner} thắng vì ${reason}.`;
}

function turnMessage(state: XiangqiState, config: XiangqiConfig, playerName: string): string {
  const name = state.turn === config.humanSide ? playerName : "Máy Cờ Tướng";
  const check = getGameStatus(state).inCheck ? " Tướng đang bị chiếu!" : "";
  return `Đến lượt ${name}, quân ${sideLabel(state.turn)}.${check}`;
}

export function XiangqiGame({ inviteCode }: XiangqiGameProps) {
  const onlineClient = useMemo(() => new XiangqiOnlineClient(), []);
  const [playerName, setPlayerName] = useState("Bé");
  const [config, setConfig] = useState<XiangqiConfig | null>(null);
  const [game, setGame] = useState<XiangqiState | null>(null);
  const [clocks, setClocks] = useState<ClockValues>({ red: 10 * 60_000, black: 10 * 60_000 });
  const [selectedSquare, setSelectedSquare] = useState<Coord | null>(null);
  const [announcement, setAnnouncement] = useState("Chọn kiểu chơi để bắt đầu một ván Cờ tướng.");
  const [aiFailure, setAiFailure] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [runningSide, setRunningSide] = useState<Side | null>(null);
  const [setupNotice, setSetupNotice] = useState("");
  const [onlineConfig, setOnlineConfig] = useState<XiangqiConfig | null>(inviteCode ? {
    variant: "bright",
    mode: "online",
    humanSide: "red",
    difficulty: "medium",
    clockMinutes: 10,
  } : null);
  const [onlinePhase, setOnlinePhase] = useState<OnlinePhase>(inviteCode ? "checking" : "idle");
  const [onlineGameId, setOnlineGameId] = useState("");
  const [onlineError, setOnlineError] = useState("");
  const [loginName, setLoginName] = useState("");
  const [onlineGameActive, setOnlineGameActive] = useState(false);
  const [setupConfirmOpen, setSetupConfirmOpen] = useState(false);

  const gameRef = useRef<XiangqiState | null>(null);
  const configRef = useRef<XiangqiConfig | null>(null);
  const clocksRef = useRef<ClockValues>(clocks);
  const runningSideRef = useRef<Side | null>(null);
  const lastClockMarkRef = useRef<number | null>(null);
  const revisionRef = useRef(0);
  const aiControllerRef = useRef<AbortController | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const setupConfirmRef = useRef<HTMLDialogElement | null>(null);
  const setupConfirmTriggerRef = useRef<HTMLButtonElement | null>(null);
  const focusSetupAfterExitRef = useRef(false);

  useEffect(() => {
    if (!setupConfirmOpen) return;

    const dialog = setupConfirmRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const focusTimer = window.setTimeout(() => {
      dialog.querySelector<HTMLButtonElement>("button")?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      if (dialog.open) dialog.close();
    };
  }, [setupConfirmOpen]);

  useEffect(() => {
    if (game || config || !focusSetupAfterExitRef.current) return;
    focusSetupAfterExitRef.current = false;
    const focusTimer = window.setTimeout(() => document.getElementById("xiangqi-setup-title")?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [config, game]);

  const ensureOnlineSession = useCallback(async (name: string, signal?: AbortSignal) => {
    const normalized = name.trim().replace(/\s+/gu, " ");
    if (!normalized) {
      setOnlinePhase("name");
      setOnlineError("Bé hãy nhập tên để vào kỳ đài nhé.");
      return false;
    }
    setOnlinePhase("connecting");
    setOnlineError("");
    try {
      const session = await onlineClient.ensureSession(normalized, signal);
      if (!saveChildName(session.player.name)) {
        setOnlineError("Trình duyệt chưa lưu được tên. Bé hãy cho phép lưu dữ liệu trang rồi thử lại.");
        setOnlinePhase("error");
        return false;
      }
      setPlayerName(session.player.name);
      setLoginName(session.player.name);
      setOnlinePhase("ready");
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      setOnlineError(isXiangqiApiError(error) ? error.issue.message : "Chưa thể vào kỳ đài online. Vui lòng thử lại.");
      setOnlinePhase(isXiangqiApiError(error) && error.issue.code === "validation_error" ? "name" : "error");
      return false;
    }
  }, [onlineClient]);

  const requestOnlineName = useCallback((message: string) => {
    const savedName = readChildName();
    if (!inviteCode && !savedName) {
      navigateInternal("/", true);
      return;
    }
    setLoginName(savedName);
    setOnlineError(message);
    setOnlinePhase("name");
  }, [inviteCode]);

  useEffect(() => {
    const savedName = readChildName();
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPlayerName(savedName || "Bé");
      setLoginName(savedName);
      if (!inviteCode) return;
      if (savedName) {
        void ensureOnlineSession(savedName, controller.signal);
      } else {
        onlineClient.loadLobby(inviteCode, controller.signal)
          .then((lobby) => {
            if (!saveChildName(lobby.player.name)) {
              setOnlineError("Trình duyệt chưa lưu được tên. Bé hãy cho phép lưu dữ liệu trang rồi thử lại.");
              setOnlinePhase("error");
              return;
            }
            setPlayerName(lobby.player.name);
            setLoginName(lobby.player.name);
            setOnlinePhase("ready");
          })
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === "AbortError") return;
            if (isXiangqiApiError(error) && error.issue.code === "session_required") {
              setOnlinePhase("name");
              return;
            }
            setOnlineError(isXiangqiApiError(error) ? error.issue.message : "Chưa thể kiểm tra phòng mời. Vui lòng thử lại.");
            setOnlinePhase("error");
          });
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [ensureOnlineSession, inviteCode, onlineClient]);

  const stopPendingWork = useCallback(() => {
    aiControllerRef.current?.abort();
    aiControllerRef.current = null;
    if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = null;
    runningSideRef.current = null;
    lastClockMarkRef.current = null;
  }, []);

  useEffect(() => () => stopPendingWork(), [stopPendingWork]);

  const beginTurn = useCallback((side: Side) => {
    runningSideRef.current = side;
    lastClockMarkRef.current = performance.now();
    setRunningSide(side);
  }, []);

  const finishWithOutcome = useCallback((outcome: StoredOutcome, message: string) => {
    const current = gameRef.current;
    if (!current || getGameStatus(current).kind !== "active") return;
    const finished: XiangqiState = { ...current, outcome };
    revisionRef.current += 1;
    gameRef.current = finished;
    stopPendingWork();
    setRunningSide(null);
    setAiFailure(false);
    setRevealing(false);
    setSelectedSquare(null);
    setGame(finished);
    setAnnouncement(message);
  }, [stopPendingWork]);

  const settleClock = useCallback((now = performance.now()): boolean => {
    const runningSide = runningSideRef.current;
    const lastMark = lastClockMarkRef.current;
    if (!runningSide || lastMark === null) return true;

    const elapsed = Math.max(0, now - lastMark);
    lastClockMarkRef.current = now;
    const nextRemaining = Math.max(0, clocksRef.current[runningSide] - elapsed);
    const nextClocks = { ...clocksRef.current, [runningSide]: nextRemaining };
    clocksRef.current = nextClocks;
    setClocks(nextClocks);

    if (nextRemaining > 0) return true;
    const currentConfig = configRef.current;
    const winner = otherSide(runningSide);
    const message = currentConfig
      ? `${winnerName(winner, currentConfig, playerName)} thắng vì quân ${sideLabel(runningSide)} hết giờ.`
      : `Quân ${sideLabel(winner)} thắng vì đối thủ hết giờ.`;
    finishWithOutcome({ kind: "timeout", winner }, message);
    return false;
  }, [finishWithOutcome, playerName]);

  const applyLocalMove = useCallback((move: Move, actor: "human" | "computer", fallbackUsed = false) => {
    const current = gameRef.current;
    const currentConfig = configRef.current;
    if (!current || !currentConfig || getGameStatus(current).kind !== "active") return;
    if (!settleClock()) return;

    const legal = legalMoves(current, move.from).find((candidate) => sameCoord(candidate.to, move.to));
    if (!legal) {
      if (actor === "computer") setAnnouncement("Máy vừa gửi một nước không còn hợp lệ. Bé có thể thử lại ván.");
      return;
    }

    let next: XiangqiState;
    try {
      next = applyMove(current, legal);
    } catch {
      setAnnouncement("Nước đi chưa thể thực hiện. Hãy chọn lại một quân cờ nhé.");
      return;
    }

    revisionRef.current += 1;
    gameRef.current = next;
    setGame(next);
    setAiFailure(false);
    setSelectedSquare(null);
    const latest = next.moves.at(-1);
    const status = getGameStatus(next);
    const actorName = actor === "human" ? playerName : "Máy Cờ Tướng";
    const revealText = latest?.revealedRole ? ` Quân úp lật thành ${ROLE_LABELS[latest.revealedRole]}.` : "";
    const fallbackText = fallbackUsed ? " Máy gặp trục trặc và đã chọn một nước hợp lệ dự phòng." : "";

    if (status.kind !== "active") {
      runningSideRef.current = null;
      lastClockMarkRef.current = null;
      setRunningSide(null);
      setAnnouncement(`${actorName} vừa đi ${coordLabel(legal.from)} đến ${coordLabel(legal.to)}.${revealText}${fallbackText} ${terminalMessage(status, currentConfig, playerName)}`.replace(/\s+/g, " ").trim());
      return;
    }

    const afterMove = `${actorName} vừa đi ${coordLabel(legal.from)} đến ${coordLabel(legal.to)}.${revealText}${fallbackText}`;
    if (latest?.revealedRole) {
      beginTurn(next.turn);
      setRevealing(true);
      setAnnouncement(afterMove);
      const expectedRevision = revisionRef.current;
      revealTimerRef.current = window.setTimeout(() => {
        revealTimerRef.current = null;
        if (revisionRef.current !== expectedRevision || gameRef.current !== next) return;
        setRevealing(false);
        setAnnouncement(`${afterMove} ${turnMessage(next, currentConfig, playerName)}`);
      }, 460);
      return;
    }

    beginTurn(next.turn);
    setAnnouncement(`${afterMove} ${turnMessage(next, currentConfig, playerName)}`);
  }, [beginTurn, playerName, settleClock]);

  const startLocalGame = useCallback((nextConfig: XiangqiConfig) => {
    stopPendingWork();
    const nextGame = createGame(nextConfig.variant, seedForLocalGame());
    const totalMs = nextConfig.clockMinutes * 60_000;
    const nextClocks = { red: totalMs, black: totalMs };
    revisionRef.current += 1;
    gameRef.current = nextGame;
    configRef.current = nextConfig;
    clocksRef.current = nextClocks;
    setConfig(nextConfig);
    setGame(nextGame);
    setClocks(nextClocks);
    setSelectedSquare(null);
    setAiFailure(false);
    setRevealing(false);
    setSetupNotice("");
    beginTurn("red");
    setAnnouncement(nextConfig.humanSide === "red"
      ? `${playerName} cầm quân Đỏ và đi trước. Chọn một quân để khai cuộc!`
      : "Bé cầm quân Đen. Máy Cờ Tướng đang chuẩn bị nước khai cuộc.");
  }, [beginTurn, playerName, stopPendingWork]);

  function handleSetup(configChoice: XiangqiConfig) {
    if (configChoice.mode === "online") {
      const savedName = readChildName();
      if (!savedName && !inviteCode) {
        navigateInternal("/", true);
        return;
      }
      setOnlineConfig(configChoice);
      setSetupNotice("");
      if (!savedName) {
        setLoginName("");
        setOnlineError("");
        setOnlinePhase("name");
        return;
      }
      void ensureOnlineSession(savedName);
      return;
    }
    startLocalGame(configChoice);
  }

  function returnToSetup() {
    stopPendingWork();
    revisionRef.current += 1;
    setSetupConfirmOpen(false);
    setupConfirmTriggerRef.current = null;
    gameRef.current = null;
    configRef.current = null;
    setGame(null);
    setConfig(null);
    setRunningSide(null);
    setAiFailure(false);
    setRevealing(false);
    setSelectedSquare(null);
    setAnnouncement("Chọn kiểu chơi để bắt đầu một ván Cờ tướng.");
  }

  function requestReturnToSetup(event: MouseEvent<HTMLButtonElement>) {
    setupConfirmTriggerRef.current = event.currentTarget;
    settleClock();
    aiControllerRef.current?.abort();
    aiControllerRef.current = null;
    runningSideRef.current = null;
    lastClockMarkRef.current = null;
    setRunningSide(null);
    setSetupConfirmOpen(true);
  }

  function cancelReturnToSetup() {
    const trigger = setupConfirmTriggerRef.current;
    const current = gameRef.current;
    setSetupConfirmOpen(false);
    if (current && getGameStatus(current).kind === "active") beginTurn(current.turn);
    window.setTimeout(() => trigger?.focus(), 0);
  }

  function confirmReturnToSetup() {
    focusSetupAfterExitRef.current = true;
    returnToSetup();
  }

  function handleSetupConfirmKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelReturnToSetup();
      return;
    }
    if (event.key !== "Tab") return;

    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    const firstButton = buttons[0];
    const lastButton = buttons.at(-1);
    if (!firstButton || !lastButton) return;

    if (event.shiftKey && document.activeElement === firstButton) {
      event.preventDefault();
      lastButton.focus();
    } else if (!event.shiftKey && document.activeElement === lastButton) {
      event.preventDefault();
      firstButton.focus();
    }
  }

  function leaveOnlineFlow() {
    setOnlineGameId("");
    setOnlineGameActive(false);
    if (inviteCode) {
      navigateInternal("/co-tuong");
      return;
    }
    setOnlineConfig(null);
    setOnlinePhase("idle");
  }

  function returnToOnlineLobby() {
    setOnlineGameId("");
    setOnlineGameActive(false);
    if (inviteCode) navigateInternal("/co-tuong");
  }

  useEffect(() => {
    if (!game || !config || setupConfirmOpen || revealing || aiFailure || getGameStatus(game).kind !== "active" || game.turn === config.humanSide) return;

    const controller = new AbortController();
    const expectedRevision = revisionRef.current;
    aiControllerRef.current?.abort();
    aiControllerRef.current = controller;

    requestComputerMove(game, config.difficulty, { signal: controller.signal })
      .then(({ move, fallbackUsed }) => {
        const current = gameRef.current;
        if (controller.signal.aborted || !current || revisionRef.current !== expectedRevision || current.turn !== game.turn) return;
        const stillLegal = legalMoves(current, move.from).some((candidate) => sameCoord(candidate.to, move.to));
        if (!stillLegal) throw new Error("Nước máy chọn đã cũ");
        applyLocalMove(move, "computer", fallbackUsed);
      })
      .catch((error: unknown) => {
        if (isAbortError(error) || controller.signal.aborted) return;
        const current = gameRef.current;
        if (!current || revisionRef.current !== expectedRevision || current.turn !== game.turn) return;
        const fallback = findLegalFallbackMove(toPublicState(current));
        if (fallback) {
          applyLocalMove(fallback, "computer", true);
          return;
        }
        if (!settleClock()) return;
        runningSideRef.current = null;
        lastClockMarkRef.current = null;
        setRunningSide(null);
        setAiFailure(true);
        setAnnouncement("Máy chưa thể tìm được nước đi. Bé có thể chơi lại hoặc đổi mức độ khó.");
      })
      .finally(() => {
        if (aiControllerRef.current !== controller) return;
        aiControllerRef.current = null;
      });

    return () => controller.abort();
  }, [aiFailure, applyLocalMove, config, game, revealing, settleClock, setupConfirmOpen]);

  useEffect(() => {
    if (!game || setupConfirmOpen || getGameStatus(game).kind !== "active") return;
    const interval = window.setInterval(() => settleClock(), 200);
    return () => window.clearInterval(interval);
  }, [game, settleClock, setupConfirmOpen]);

  const status = useMemo(() => game ? getGameStatus(game) : null, [game]);
  const publicState = useMemo(() => game ? toPublicState(game) : null, [game]);

  const legalTargets = useMemo(() => {
    if (!game || !config || !selectedSquare || game.turn !== config.humanSide || status?.kind !== "active") return [];
    return legalMoves(game, selectedSquare).map((move) => move.to);
  }, [config, game, selectedSquare, status?.kind]);

  const chooseSquare = useCallback((coord: Coord) => {
    if (!game || !config || revealing || status?.kind !== "active" || game.turn !== config.humanSide) return;
    const piece = game.board[coordKey(coord)];

    if (!selectedSquare) {
      if (piece?.side === game.turn) {
        setSelectedSquare(coord);
        const moves = legalMoves(game, coord);
        setAnnouncement(moves.length ? `Đã chọn ${piece.revealed && piece.role ? ROLE_LABELS[piece.role] : "quân úp"}. Có ${moves.length} đích hợp lệ.` : "Quân này chưa có nước đi hợp lệ.");
      } else {
        setAnnouncement("Hãy chọn một quân của bé trước nhé.");
      }
      return;
    }

    if (sameCoord(selectedSquare, coord)) {
      setSelectedSquare(null);
      setAnnouncement("Đã bỏ chọn quân cờ.");
      return;
    }
    if (piece?.side === game.turn) {
      setSelectedSquare(coord);
      const moves = legalMoves(game, coord);
      setAnnouncement(moves.length ? `Đã đổi sang quân khác. Có ${moves.length} đích hợp lệ.` : "Quân này chưa có nước đi hợp lệ.");
      return;
    }

    const move = legalMoves(game, selectedSquare).find((candidate) => sameCoord(candidate.to, coord));
    if (!move) {
      setAnnouncement("Ô đó không phải đích hợp lệ. Bé hãy chọn một chấm xanh.");
      return;
    }
    applyLocalMove(move, "human");
  }, [applyLocalMove, config, game, revealing, selectedSquare, status?.kind]);

  const totalMs = config ? config.clockMinutes * 60_000 : 10 * 60_000;
  const humanName = playerName || "Bé";
  const playerForSide = (side: Side) => config && side === config.humanSide ? humanName : "Máy Cờ Tướng";
  const sideOrder: readonly Side[] = config ? [otherSide(config.humanSide), config.humanSide] : ["black", "red"];
  const inProgress = status?.kind === "active";
  const thinking = Boolean(inProgress && game && config && game.turn !== config.humanSide && !revealing && !aiFailure);

  const helpContent = (
    <div className="xiangqi-help">
      <p><strong>Cờ tướng:</strong> quân Đỏ đi trước. Chọn một quân rồi chọn chấm xanh để đi.</p>
      <p><strong>Cờ úp:</strong> ngoài Tướng, các quân bắt đầu úp và đi theo vị trí đang che. Sau nước đầu, quân sẽ lật để lộ vai trò thật.</p>
      <p>Dùng phím mũi tên để di chuyển tiêu điểm trên bàn; nhấn Enter hoặc Space để chọn. Bên hết giờ, bị chiếu bí hoặc không còn nước hợp lệ sẽ thua.</p>
    </div>
  );

  if ((inviteCode || onlineConfig) && onlinePhase !== "ready") {
    const needsName = onlinePhase === "name";
    return (
      <main className="xiangqi-inline-login-page">
        <section className="xiangqi-inline-login-card" aria-labelledby="xiangqi-inline-login-title">
          <div className="xiangqi-inline-login-emblem" aria-hidden="true">帥</div>
          <p className="xiangqi-kicker">{inviteCode ? `Phòng mời ${inviteCode.toUpperCase()}` : "Kỳ đài online"}</p>
          <h1 id="xiangqi-inline-login-title">{needsName ? "Bé tên là gì?" : onlinePhase === "error" ? "Chưa kết nối được" : "Đang mở kỳ đài…"}</h1>
          {needsName ? (
            <>
              <p>Chỉ cần một cái tên, không cần tài khoản hay mật khẩu. Bé sẽ vào đúng phòng này sau khi kết nối.</p>
              <form onSubmit={(event) => { event.preventDefault(); void ensureOnlineSession(loginName); }}>
                <label htmlFor="xiangqi-online-name">Tên hiển thị</label>
                <div className="xiangqi-name-input"><span aria-hidden="true">☺</span><input id="xiangqi-online-name" name="name" value={loginName} maxLength={30} autoComplete="nickname" autoFocus onChange={(event) => setLoginName(event.target.value)} placeholder="Ví dụ: Mít" required /></div>
                {onlineError ? <p className="xiangqi-inline-login-error" role="alert">{onlineError}</p> : null}
                <button type="submit" className="xiangqi-primary-button" disabled={!loginName.trim()}>Vào phòng Cờ tướng <span aria-hidden="true">→</span></button>
              </form>
            </>
          ) : onlinePhase === "error" ? (
            <>
              <p role="alert">{onlineError}</p>
              <div className="xiangqi-inline-actions">
                <button type="button" className="xiangqi-primary-button" onClick={() => loginName ? void ensureOnlineSession(loginName) : window.location.reload()}>Thử kết nối lại</button>
                <button type="button" className="xiangqi-secondary-button" onClick={() => navigateInternal("/co-tuong")}>Về trang Cờ tướng</button>
              </div>
            </>
          ) : (
            <p role="status" aria-live="polite">{onlineError || "Đang kiểm tra phiên và giữ nguyên mã phòng cho bé…"}</p>
          )}
        </section>
      </main>
    );
  }

  return (
    <GameShell helpContent={helpContent} isGameInProgress={Boolean(inProgress || onlineGameActive)} onLeaveGame={stopPendingWork}>
      <main className="xiangqi-page">
        <section className="xiangqi-hero" aria-labelledby="xiangqi-title">
          <div>
            <p className="xiangqi-kicker">SunShinSon kỳ đài</p>
            <h1 id="xiangqi-title">Cờ tướng <span>·</span> Cờ úp</h1>
            <p>Luyện quan sát, tính trước vài nước và vui với mỗi lần quân úp hé lộ bí mật.</p>
          </div>
          <div className="xiangqi-hero-emblem" aria-hidden="true"><span>帥</span><span>將</span></div>
        </section>

        {onlineConfig ? (
          onlineGameId ? (
            <XiangqiOnlineGame
              client={onlineClient}
              gameId={onlineGameId}
              inviteCode={inviteCode}
              onActiveChange={setOnlineGameActive}
              onReturnToLobby={returnToOnlineLobby}
              onSessionRequired={requestOnlineName}
            />
          ) : (
            <XiangqiLobby
              client={onlineClient}
              variant={onlineConfig.variant}
              clockMinutes={onlineConfig.clockMinutes}
              inviteCode={inviteCode}
              onEnterGame={setOnlineGameId}
              onBack={leaveOnlineFlow}
              onSessionRequired={requestOnlineName}
            />
          )
        ) : !game || !config ? (
          <XiangqiSetup playerName={humanName} initialMode={inviteCode ? "online" : "computer"} notice={setupNotice} onStart={handleSetup} />
        ) : publicState && status ? (
          <section className="xiangqi-game-layout" aria-label="Ván Cờ tướng với máy">
            <div className="xiangqi-board-column">
              <div className="xiangqi-game-toolbar">
                <div>
                  <span>{config.variant === "blind" ? "Cờ úp" : "Cờ sáng"}</span>
                  <strong>{config.clockMinutes} phút · {{ easy: "Dễ", medium: "Vừa", hard: "Khó" }[config.difficulty]}</strong>
                </div>
                <button type="button" onClick={requestReturnToSetup}>Đổi lựa chọn</button>
              </div>
              {aiFailure ? (
                <div className="xiangqi-ai-error" role="alert">
                  <div><strong>Máy tạm dừng suy nghĩ</strong><p>{announcement}</p></div>
                  <button type="button" onClick={() => { beginTurn(game.turn); setAiFailure(false); setAnnouncement("Đang thử lại nước đi của máy…"); }}>Thử lại</button>
                </div>
              ) : null}
              <XiangqiBoard
                state={publicState}
                playerSide={config.humanSide}
                selectedSquare={selectedSquare}
                legalTargets={legalTargets}
                inCheck={status.inCheck}
                disabled={!inProgress || thinking || revealing || game.turn !== config.humanSide}
                onSquareClick={chooseSquare}
              />
              <p className="xiangqi-announcement" role="status" aria-live="polite" aria-atomic="true">
                {thinking ? <span className="xiangqi-thinking-dot" aria-hidden="true" /> : null}{announcement}
              </p>
            </div>

            <aside className="xiangqi-sidebar" aria-label="Thông tin ván cờ">
              <section className={`xiangqi-turn-card${status.inCheck ? " is-check" : ""}${status.kind !== "active" ? " is-finished" : ""}`}>
                <p>{status.kind === "active" ? "Lượt hiện tại" : "Ván cờ kết thúc"}</p>
                {status.kind === "active" ? (
                  <><strong>Quân {sideLabel(game.turn)} · {playerForSide(game.turn)}</strong><span>{thinking ? "Máy đang suy nghĩ…" : revealing ? "Quân úp đang lật…" : status.inCheck ? "⚠ Tướng đang bị chiếu" : "Sẵn sàng đi"}</span></>
                ) : <><strong>{terminalMessage(status, config, humanName)}</strong><span>Chọn Chơi lại để bắt đầu một ván mới.</span></>}
              </section>

              <div className="xiangqi-clocks">
                {sideOrder.map((side) => (
                  <XiangqiClock key={side} side={side} playerName={playerForSide(side)} remainingMs={clocks[side]} totalMs={totalMs} isRunning={inProgress && runningSide === side} isStopped={!inProgress} />
                ))}
              </div>

              <div className="xiangqi-actions">
                {inProgress ? <button type="button" className="xiangqi-danger-button" onClick={() => finishWithOutcome({ kind: "resignation", winner: otherSide(config.humanSide) }, `${humanName} đã đầu hàng. Máy Cờ Tướng thắng ván này.`)}>⚑ Đầu hàng</button> : null}
                <button type="button" className="xiangqi-primary-button" onClick={() => startLocalGame(config)}>↻ Chơi lại</button>
                <button type="button" className="xiangqi-secondary-button" onClick={requestReturnToSetup}>⚙ Đổi thiết lập</button>
              </div>

              <section className="xiangqi-history" aria-labelledby="xiangqi-history-title">
                <div><strong id="xiangqi-history-title">Biên bản nước đi</strong><span>{game.moves.length} nước</span></div>
                {game.moves.length ? (
                  <ol>
                    {game.moves.map((move, index) => (
                      <li key={`${move.pieceId}-${index}`}><b>{index + 1}.</b><span className={`is-${move.side}`}>{sideLabel(move.side)}</span><span>{moveLabel(move)}</span></li>
                    ))}
                  </ol>
                ) : <p>Nước đi đầu tiên sẽ xuất hiện ở đây.</p>}
              </section>
            </aside>
          </section>
        ) : null}

      </main>

      {setupConfirmOpen ? (
        <dialog
          ref={setupConfirmRef}
          className="game-dialog xiangqi-setup-confirm-dialog"
          aria-labelledby="xiangqi-setup-confirm-title"
          aria-describedby="xiangqi-setup-confirm-description"
          onCancel={(event) => { event.preventDefault(); cancelReturnToSetup(); }}
          onKeyDown={handleSetupConfirmKeyDown}
        >
          <h2 id="xiangqi-setup-confirm-title">Có chắc chắn muốn thoát ván?</h2>
          <p id="xiangqi-setup-confirm-description">Bàn cờ và thời gian hiện tại sẽ bị xóa để bé thay đổi thiết lập.</p>
          <div className="game-dialog-actions">
            <button type="button" className="game-dialog-secondary" onClick={cancelReturnToSetup}>Ở lại chơi</button>
            <button type="button" className="game-dialog-danger" onClick={confirmReturnToSetup}>Thoát và đổi thiết lập</button>
          </div>
        </dialog>
      ) : null}
    </GameShell>
  );
}
