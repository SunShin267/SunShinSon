"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Color, Square } from "chess.js";
import { GameShell } from "../components/GameShell";
import { readChildName } from "../lib/child-session";
import { ChessBoard } from "./ChessBoard";
import { formatClock, pauseClock, createClock, switchClock, tickClock, type ClockState } from "./chess-clock";
import { checkedKingSquare, createChessGame, getChessStatus, hasMatingMaterial, hydrateChess, lastMove, legalMoves, makeChessMove, type ChessGame as ChessGameState, type ChessMoveInput, type PromotionPiece } from "./chess-game";
import { ChessHistory } from "./ChessHistory";
import { loadChessHistory, recordChessGame, uciMove, type ChessGameRecord } from "./chess-history";
import { ChessLearn } from "./ChessLearn";
import { ChessSetup, type ChessConfig } from "./ChessSetup";
import { StockfishClient } from "./stockfish-client";

type Tab = "pieces" | "rules" | "play";
type PlayScreen = "setup" | "game" | "history";
type FinalState = { result: "white" | "black" | "draw"; reason: string };
type PromotionRequest = { from: Square; to: Square };

const reasonLabels: Record<string, string> = {
  checkmate: "Chiếu hết",
  stalemate: "Hết nước đi — hòa",
  repetition: "Lặp lại thế cờ ba lần — hòa",
  insufficient: "Không đủ quân chiếu hết — hòa",
  "fifty-move": "Luật 50 nước — hòa",
  draw: "Ván cờ hòa",
  resignation: "Đầu hàng",
  timeout: "Hết giờ",
  "timeout-draw": "Hết giờ nhưng đối thủ không đủ quân chiếu hết — hòa",
};

export function ChessGame() {
  const [tab, setTab] = useState<Tab>("pieces");
  const [screen, setScreen] = useState<PlayScreen>("setup");
  const [childName, setChildName] = useState("");
  const [config, setConfig] = useState<ChessConfig | null>(null);
  const [game, setGame] = useState<ChessGameState | null>(null);
  const [history, setHistory] = useState<ChessGameRecord[]>([]);
  const [orientation, setOrientation] = useState<Color>("w");
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<PromotionRequest | null>(null);
  const [clock, setClock] = useState<ClockState | null>(null);
  const [finalState, setFinalState] = useState<FinalState | null>(null);
  const [announcement, setAnnouncement] = useState("Chọn một quân để bắt đầu.");
  const [thinking, setThinking] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [engineAttempt, setEngineAttempt] = useState(0);
  const [storageNotice, setStorageNotice] = useState("");
  const clientRef = useRef<StockfishClient | null>(null);
  const engineController = useRef<AbortController | null>(null);
  const promotionDialogRef = useRef<HTMLDivElement | null>(null);
  const savedRef = useRef(false);
  const startedAt = useRef(new Date().toISOString());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setChildName(readChildName());
      setHistory(loadChessHistory());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => () => {
    engineController.current?.abort();
    clientRef.current?.dispose();
  }, []);

  useEffect(() => {
    if (!promotion) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => promotionDialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus(), 0);
    return () => { window.clearTimeout(timer); previous?.focus(); };
  }, [promotion]);

  const finishGame = useCallback((finalGame: ChessGameState, result: FinalState["result"], reason: string) => {
    if (!config || savedRef.current) return;
    savedRef.current = true;
    engineController.current?.abort();
    clientRef.current?.cancel();
    setThinking(false);
    setFinalState({ result, reason });
    setClock((current) => current ? pauseClock(current, performance.now()) : null);
    const record: ChessGameRecord = {
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      startedAt: startedAt.current,
      completedAt: new Date().toISOString(),
      players: config.players,
      mode: config.mode,
      ...(config.difficulty ? { difficulty: config.difficulty } : {}),
      result,
      reason: reasonLabels[reason] ?? reason,
      clockInitialMs: config.clockInitialMs,
      pgn: finalGame.pgn,
      moves: finalGame.history,
      san: finalGame.san,
      initialFen: finalGame.initialFen,
      finalFen: finalGame.fen,
    };
    const stored = recordChessGame(record);
    setHistory(stored.records);
    if (!stored.saved) setStorageNotice("Ván cờ đã kết thúc nhưng thiết bị không thể lưu vào lịch sử.");
  }, [config]);

  const commitMove = useCallback((source: ChessGameState, input: ChessMoveInput) => {
    const next = makeChessMove(source, input);
    setGame((current) => current === source ? next : current);
    setSelected(null);
    setAnnouncement(`Nước ${next.san.at(-1)} đã được thực hiện.`);
    setClock((current) => current ? switchClock(current, performance.now()) : null);
    const status = getChessStatus(next);
    if (status.gameOver && status.result && status.reason) finishGame(next, status.result, status.reason);
    return next;
  }, [finishGame]);

  useEffect(() => {
    if (!game || !config || config.mode !== "computer" || finalState || engineError) return;
    const status = getChessStatus(game);
    if (status.turn === config.humanColor) return;
    const controller = new AbortController();
    engineController.current?.abort();
    engineController.current = controller;
    const snapshot = game;
    const timer = window.setTimeout(() => {
      setThinking(true);
      setAnnouncement("Máy đang suy nghĩ…");
      try {
        clientRef.current ??= new StockfishClient();
      } catch {
        setThinking(false);
        setClock((current) => current ? pauseClock(current, performance.now()) : null);
        setEngineError("Không thể khởi động máy chơi cờ.");
        return;
      }
      clientRef.current.bestMove(snapshot.fen, config.difficulty ?? "medium", controller.signal)
        .then((value) => {
          if (controller.signal.aborted) return;
          const move = uciMove(value);
          if (!move) throw new Error("Máy trả về nước đi không hợp lệ.");
          commitMove(snapshot, move);
          setThinking(false);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setThinking(false);
          setClock((current) => current ? pauseClock(current, performance.now()) : null);
          setEngineError(error instanceof Error ? error.message : "Máy chơi cờ gặp lỗi.");
          setAnnouncement("Máy chơi cờ gặp lỗi. Bé có thể thử lại hoặc chuyển sang hai người.");
        });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [game, config, finalState, engineError, engineAttempt, commitMove]);

  useEffect(() => {
    if (!config?.clockInitialMs || finalState || !game) return;
    const timer = window.setInterval(() => setClock((current) => current ? tickClock(current, performance.now()) : null), 250);
    return () => window.clearInterval(timer);
  }, [config?.clockInitialMs, finalState, game]);

  useEffect(() => {
    if (!clock?.expired || finalState || !game) return;
    const timer = window.setTimeout(() => {
      const winner: Color = clock.expired === "w" ? "b" : "w";
      if (hasMatingMaterial(game, winner)) finishGame(game, winner === "w" ? "white" : "black", "timeout");
      else finishGame(game, "draw", "timeout-draw");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [clock?.expired, finalState, game, finishGame]);

  function start(nextConfig: ChessConfig) {
    engineController.current?.abort();
    clientRef.current?.dispose();
    clientRef.current = null;
    const next = createChessGame();
    setConfig(nextConfig);
    setGame(next);
    setOrientation(nextConfig.orientation);
    setSelected(null);
    setPromotion(null);
    setFinalState(null);
    setEngineError("");
    setStorageNotice("");
    setThinking(false);
    setClock(nextConfig.clockInitialMs ? createClock(nextConfig.clockInitialMs, performance.now()) : null);
    setAnnouncement(`${nextConfig.players.white} cầm quân Trắng đi trước.`);
    savedRef.current = false;
    startedAt.current = new Date().toISOString();
    setScreen("game");
  }

  function chooseSquare(square: Square) {
    if (!game || !config || finalState || thinking || engineError) return;
    const chess = hydrateChess(game);
    const status = getChessStatus(game);
    if (config.mode === "computer" && status.turn !== config.humanColor) return;
    const piece = chess.get(square);
    if (selected) {
      const candidates = legalMoves(game, selected).filter((move) => move.to === square);
      if (candidates.length) {
        if (candidates.some((move) => move.isPromotion())) setPromotion({ from: selected, to: square });
        else commitMove(game, { from: selected, to: square });
        return;
      }
    }
    if (piece?.color === status.turn) {
      setSelected(square);
      setAnnouncement(`Đã chọn ${square}. Có ${legalMoves(game, square).length} nước hợp lệ.`);
    } else {
      setAnnouncement(`Không thể đi tới ô ${square}. Hãy chọn quân đúng lượt và một đích hợp lệ.`);
    }
  }

  function promote(piece: PromotionPiece) {
    if (!promotion || !game) return;
    commitMove(game, { ...promotion, promotion: piece });
    setPromotion(null);
  }

  function retryEngine() {
    clientRef.current?.dispose();
    clientRef.current = null;
    setEngineError("");
    if (game) setClock((current) => current ? { ...current, active: getChessStatus(game).turn, lastTick: performance.now() } : null);
    setEngineAttempt((value) => value + 1);
  }

  function switchToLocal() {
    engineController.current?.abort();
    clientRef.current?.dispose();
    clientRef.current = null;
    setThinking(false);
    setEngineError("");
    if (game) setClock((current) => current ? { ...current, active: getChessStatus(game).turn, lastTick: performance.now() } : null);
    setConfig((current) => current ? { ...current, mode: "local", difficulty: undefined } : current);
    setAnnouncement("Đã chuyển sang chế độ hai người. Người đang tới lượt có thể đi.");
  }

  function confirmAnd(action: () => void) {
    if (game?.history.length && !finalState && !window.confirm("Ván cờ đang chơi sẽ không được lưu. Bé muốn tiếp tục?")) return;
    action();
  }

  function trapPromotionFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { setPromotion(null); return; }
    if (event.key !== "Tab") return;
    const controls = Array.from(promotionDialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    if (!controls.length) return;
    const first = controls[0];
    const last = controls.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  const status = game ? getChessStatus(game) : null;
  const activeName = status && config ? (status.turn === "w" ? config.players.white : config.players.black) : "";
  const legalTargets = useMemo(() => game && selected ? legalMoves(game, selected).map((move) => move.to) : [], [game, selected]);
  const recentMove = game ? lastMove(game) : null;
  const inProgress = Boolean(screen === "game" && game && !finalState);
  const resultText = finalState ? finalState.result === "draw" ? "Hai bên hòa nhau" : `${finalState.result === "white" ? config?.players.white : config?.players.black} thắng` : "";

  return <GameShell isGameInProgress={inProgress} onLeaveGame={() => { engineController.current?.abort(); clientRef.current?.dispose(); }} helpContent={<div><p>Chọn <strong>Học quân</strong> để làm quen sáu quân cờ, <strong>Học luật</strong> để xem các tình huống đặc biệt, hoặc <strong>Chơi cờ</strong> để bắt đầu một ván.</p><p>Trong ván, chọn quân rồi chọn một ô có chấm tròn. Các nước đi đều được kiểm tra bởi luật cờ đầy đủ.</p></div>}>
    <main className="chess-page">
      <header className="chess-hero"><div><p className="kicker">Học chiến thuật từng nước</p><h1>Cờ vua</h1><p>Gặp gỡ sáu quân cờ, hiểu luật và thử tài trên bàn cờ thật.</p></div><span aria-hidden="true">♞</span></header>
      <nav className="chess-main-tabs" aria-label="Khu vực cờ vua">{(["pieces", "rules", "play"] as const).map((item) => <button key={item} type="button" aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}><span aria-hidden="true">{item === "pieces" ? "♟" : item === "rules" ? "📖" : "♜"}</span>{item === "pieces" ? "Học quân" : item === "rules" ? "Học luật" : "Chơi cờ"}</button>)}</nav>
      {tab === "pieces" ? <ChessLearn section="pieces" /> : null}
      {tab === "rules" ? <ChessLearn section="rules" /> : null}
      {tab === "play" && screen === "setup" ? <ChessSetup key={childName || "loading"} childName={childName} historyCount={history.length} onStart={start} onHistory={() => setScreen("history")} /> : null}
      {tab === "play" && screen === "history" ? <ChessHistory records={history} onChange={setHistory} onBack={() => setScreen(game ? "game" : "setup")} /> : null}
      {tab === "play" && screen === "game" && game && config && status ? <section className="chess-game-layout">
        <aside className="chess-game-sidebar">
          <div className={`chess-turn-card ${status.check ? "is-check" : ""}`}><p>{finalState ? "Ván cờ kết thúc" : thinking ? "Máy đang suy nghĩ…" : status.check ? "Chiếu Vua!" : "Đến lượt"}</p><strong>{finalState ? resultText : activeName}</strong><span>{finalState ? reasonLabels[finalState.reason] : `${status.turn === "w" ? "Trắng" : "Đen"} · ${game.san.length} nước`}</span></div>
          {clock ? <div className="chess-clocks" aria-label="Đồng hồ"><div className={clock.active === "b" ? "is-active" : ""}><span>⚫ {config.players.black}</span><strong>{formatClock(clock.blackMs)}</strong></div><div className={clock.active === "w" ? "is-active" : ""}><span>⚪ {config.players.white}</span><strong>{formatClock(clock.whiteMs)}</strong></div></div> : null}
          <div className="chess-player-cards"><article className={status.turn === "w" && !finalState ? "is-active" : ""}><span aria-hidden="true">♔</span><div><strong>{config.players.white}</strong><small>Quân Trắng</small></div></article><article className={status.turn === "b" && !finalState ? "is-active" : ""}><span aria-hidden="true">♚</span><div><strong>{config.players.black}</strong><small>Quân Đen</small></div></article></div>
          <div className="chess-game-actions"><button type="button" onClick={() => setOrientation((value) => value === "w" ? "b" : "w")}>⇅ Lật bàn</button><button type="button" onClick={() => setScreen("history")}>☷ Lịch sử</button><button type="button" onClick={() => confirmAnd(() => start(config))}>↻ Chơi lại</button>{!finalState ? <button type="button" className="danger" onClick={() => finishGame(game, status.turn === "w" ? "black" : "white", "resignation")}>⚑ Đầu hàng</button> : null}<button type="button" className="secondary" onClick={() => confirmAnd(() => { setGame(null); setConfig(null); setScreen("setup"); })}>Thiết lập mới</button></div>
        </aside>
        <div className="chess-board-column">
          {engineError ? <div className="chess-engine-error" role="alert"><div><strong>Máy chơi cờ chưa sẵn sàng</strong><p>{engineError}</p></div><button type="button" onClick={retryEngine}>Thử lại</button><button type="button" onClick={switchToLocal}>Chuyển sang hai người</button></div> : null}
          <ChessBoard game={game} orientation={orientation} selected={selected} legalTargets={legalTargets} lastMove={recentMove} checkedKing={checkedKingSquare(game)} disabled={Boolean(finalState) || thinking || Boolean(engineError) || (config.mode === "computer" && status.turn !== config.humanColor)} onSquare={chooseSquare} />
          <p className="chess-announcement" role="status" aria-live="polite">{announcement}</p>
          {storageNotice ? <p className="chess-storage-notice" role="status">{storageNotice}</p> : null}
        </div>
        <aside className="chess-moves"><div className="chess-moves-heading"><strong>Biên bản ván cờ</strong><span>{game.san.length} nước</span></div><ol>{Array.from({ length: Math.ceil(game.san.length / 2) }, (_, index) => <li key={index}><b>{index + 1}.</b><span>{game.san[index * 2] ?? ""}</span><span>{game.san[index * 2 + 1] ?? ""}</span></li>)}</ol>{!game.san.length ? <p>Những nước đi ký hiệu SAN sẽ xuất hiện tại đây.</p> : null}</aside>
      </section> : null}
    </main>
    {promotion ? <section className="game-overlay" role="dialog" aria-modal="true" aria-labelledby="promotion-title"><div ref={promotionDialogRef} onKeyDown={trapPromotionFocus} className="game-dialog chess-promotion-dialog"><h2 id="promotion-title">Phong cấp Tốt</h2><p>Chọn quân mới cho Tốt vừa tới hàng cuối.</p><div>{(["q", "r", "b", "n"] as PromotionPiece[]).map((piece) => <button key={piece} type="button" onClick={() => promote(piece)}><span aria-hidden="true">{{ q: "♕", r: "♖", b: "♗", n: "♘" }[piece]}</span>{{ q: "Hậu", r: "Xe", b: "Tượng", n: "Mã" }[piece]}</button>)}</div><button className="game-dialog-secondary" type="button" onClick={() => setPromotion(null)}>Chọn lại nước đi</button></div></section> : null}
  </GameShell>;
}
