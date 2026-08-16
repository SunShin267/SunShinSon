"use client";

import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { GameShell } from "../components/GameShell";
import { readChildName } from "../lib/child-session";
import { findLegalFallbackMove, requestComputerMove } from "./gomoku-ai-client";
import { expandBoard } from "./board-viewport";
import { createGomokuGame, playMove, undoTurn } from "./gomoku-engine";
import { createCompletedRecord, loadGomokuHistory, recordCompletedGame, type GomokuGameRecord } from "./gomoku-history";
import { GomokuBoard } from "./GomokuBoard";
import { GomokuHistory } from "./GomokuHistory";
import { GomokuSetup } from "./GomokuSetup";
import { otherStone, type BoardSize, type Coord, type GomokuConfig, type GomokuState } from "./gomoku-types";

type Screen = "setup" | "game" | "history";
type PendingAction = "restart" | "switch-start" | "setup";

export function GomokuGame() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [childName, setChildName] = useState("");
  const [config, setConfig] = useState<GomokuConfig | null>(null);
  const [game, setGame] = useState<GomokuState | null>(null);
  const [history, setHistory] = useState<GomokuGameRecord[]>([]);
  const [thinking, setThinking] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [matchKey, setMatchKey] = useState(0);
  const aiController = useRef<AbortController | null>(null);
  const blinkTimer = useRef<number | null>(null);
  const pendingDialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setChildName(readChildName());
      setHistory(loadGomokuHistory());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!pendingAction) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => pendingDialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      previous?.focus();
    };
  }, [pendingAction]);

  useEffect(() => () => {
    aiController.current?.abort();
    if (blinkTimer.current) window.clearTimeout(blinkTimer.current);
  }, []);

  const beginWinFeedback = useCallback(() => {
    if (blinkTimer.current) window.clearTimeout(blinkTimer.current);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setBlinking(!reduceMotion);
    if (!reduceMotion) blinkTimer.current = window.setTimeout(() => setBlinking(false), 3000);
  }, []);

  const finishIfNeeded = useCallback((next: GomokuState, currentConfig: GomokuConfig) => {
    if (!next.winner && !next.draw) return;
    if (next.winner) beginWinFeedback();
    const stored = recordCompletedGame(createCompletedRecord(currentConfig, next));
    setHistory(stored.records);
    setStorageNotice(stored.saved ? "" : "Ván cờ đã kết thúc nhưng thiết bị không thể lưu vào lịch sử.");
  }, [beginWinFeedback]);

  useEffect(() => {
    if (!game || !config || config.mode !== "computer" || game.turn !== "p2" || game.winner || game.draw) return;
    const controller = new AbortController();
    aiController.current?.abort();
    aiController.current = controller;
    const snapshot = game;
    const timer = window.setTimeout(() => {
      setThinking(true);
      requestComputerMove(snapshot, config.difficulty ?? "medium", { signal: controller.signal })
        .then((coord) => {
          if (controller.signal.aborted) return;
          const next = playMove(snapshot, coord);
          if (next === snapshot) throw new Error("Computer worker returned an illegal move");
          finishIfNeeded(next, config);
          setThinking(false);
          setGame((current) => current === snapshot ? next : current);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          console.error("Gomoku computer move failed; using a legal fallback", error);
          const fallback = findLegalFallbackMove(snapshot);
          const next = fallback ? playMove(snapshot, fallback) : { ...snapshot, draw: true };
          finishIfNeeded(next, config);
          setThinking(false);
          setGame((current) => current === snapshot ? next : current);
        });
    }, 240);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (aiController.current === controller) aiController.current = null;
    };
  }, [game, config, finishIfNeeded]);

  function start(nextConfig: GomokuConfig) {
    aiController.current?.abort();
    setConfig(nextConfig);
    setGame(createGomokuGame(nextConfig));
    setThinking(false);
    setBlinking(false);
    setStorageNotice("");
    setPendingAction(null);
    setMatchKey((value) => value + 1);
    setScreen("game");
  }

  function play(coord: Coord) {
    if (!game || !config || thinking || game.winner || game.draw || (config.mode === "computer" && game.turn === "p2")) return;
    const next = playMove(game, coord);
    if (next === game) return;
    finishIfNeeded(next, config);
    setGame(next);
  }

  function undo() {
    if (!game || !game.moves.length || game.winner || game.draw) return;
    aiController.current?.abort();
    const plies = config?.mode === "computer" && game.moves[game.moves.length - 1]?.stone === "p2" ? 2 : 1;
    setGame(undoTurn(game, plies));
    setThinking(false);
  }

  function performAction(action: PendingAction) {
    if (!config) return;
    if (action === "setup") {
      aiController.current?.abort();
      setGame(null);
      setConfig(null);
      setThinking(false);
      setScreen("setup");
    } else if (action === "switch-start") {
      start({ ...config, startingPlayer: otherStone(config.startingPlayer) });
    } else {
      start(config);
    }
    setPendingAction(null);
  }

  function performPendingAction() {
    if (pendingAction) performAction(pendingAction);
  }

  function requestAction(action: PendingAction) {
    if (game?.moves.length && !game.winner && !game.draw) setPendingAction(action);
    else performAction(action);
  }

  function trapPendingDialogFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setPendingAction(null);
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(pendingDialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    if (!controls.length) return;
    const first = controls[0];
    const last = controls.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const activePlayer = game && config ? config.players.find((player) => player.id === game.turn) : null;
  const winner = game?.winner && config ? config.players.find((player) => player.id === game.winner?.stone) : null;
  const inProgress = Boolean(game?.moves.length && !game.winner && !game.draw);

  return (
    <GameShell
      isGameInProgress={inProgress}
      onLeaveGame={() => aiController.current?.abort()}
      helpContent={<div className="gomoku-help"><p>Đặt đúng 5 quân liên tiếp theo hàng ngang, dọc hoặc chéo để thắng. Một hàng 5 quân bị đối thủ chặn cả hai đầu sẽ chưa thắng.</p><p>Thu nhỏ bàn cờ để mở rộng từ 20×20 đến tối đa 50×50. Bàn đã mở rộng sẽ không co lại trong ván.</p></div>}
    >
      <main className="gomoku-page">
        <header className="gomoku-hero">
          <div><p className="kicker">Năm quân thẳng hàng</p><h1>Cờ caro</h1><p>Quan sát, dự đoán và tạo một đường đi thật thông minh.</p></div>
          <span aria-hidden="true">⭕</span>
        </header>

        {storageNotice ? <p className="gomoku-storage-notice" role="status">{storageNotice}</p> : null}

        {screen === "setup" ? <GomokuSetup key={childName || "loading"} childName={childName} onStart={start} onOpenHistory={() => setScreen("history")} historyCount={history.length} /> : null}
        {screen === "history" ? <GomokuHistory records={history} onBack={() => setScreen(config ? "game" : "setup")} onRecordsChange={setHistory} /> : null}
        {screen === "game" && game && config ? (
          <section className="gomoku-game-layout">
            <aside className="gomoku-sidebar">
              <div className="gomoku-turn-card">
                <p>{winner ? "Ván cờ kết thúc" : game.draw ? "Ván cờ kết thúc" : thinking ? "Máy đang suy nghĩ…" : "Đến lượt"}</p>
                <strong style={{ color: winner?.color ?? activePlayer?.color }}>{winner ? `${winner.piece} ${winner.name} thắng!` : game.draw ? "Hai bên hòa nhau!" : `${activePlayer?.piece} ${activePlayer?.name}`}</strong>
                <span>{game.moves.length} nước · bàn {game.size}×{game.size}</span>
              </div>
              <div className="gomoku-player-list">
                {config.players.map((player) => (
                  <article key={player.id} className={game.turn === player.id && !game.winner && !game.draw ? "is-active" : ""}>
                    <span style={{ color: player.color }}>{player.piece}</span><div><strong>{player.name}</strong><small>{player.id === config.startingPlayer ? "Đi trước" : "Đi sau"}</small></div>
                  </article>
                ))}
              </div>
              <div className="gomoku-game-actions">
                <button type="button" onClick={undo} disabled={!game.moves.length || Boolean(game.winner) || game.draw || thinking}>↶ Hoàn tác</button>
                <button type="button" onClick={() => requestAction("restart")}>↻ Chơi lại</button>
                <button type="button" onClick={() => requestAction("switch-start")}>⇄ Đổi người đi trước</button>
                <button type="button" onClick={() => setScreen("history")}>☷ Lịch sử</button>
                <button type="button" className="secondary" onClick={() => requestAction("setup")}>Thay đội hình</button>
              </div>
            </aside>
            <GomokuBoard key={matchKey} state={game} players={config.players} disabled={thinking || Boolean(game.winner) || game.draw || (config.mode === "computer" && game.turn === "p2")} blinking={blinking} onPlay={play} onExpand={(size: BoardSize) => setGame((current) => current ? expandBoard(current, size) : current)} />
          </section>
        ) : null}
      </main>

      {pendingAction ? (
        <section className="game-overlay" role="dialog" aria-modal="true" aria-labelledby="gomoku-confirm-title" aria-describedby="gomoku-confirm-description">
          <div ref={pendingDialogRef} onKeyDown={trapPendingDialogFocus} className="game-dialog">
            <h2 id="gomoku-confirm-title">Bắt đầu lại ván cờ?</h2>
            <p id="gomoku-confirm-description">Các nước đang chơi sẽ bị xóa và không được lưu vào lịch sử.</p>
            <div className="game-dialog-actions"><button className="game-dialog-secondary" onClick={() => setPendingAction(null)}>Chơi tiếp</button><button className="game-dialog-primary" onClick={performPendingAction}>Đồng ý</button></div>
          </div>
        </section>
      ) : null}
    </GameShell>
  );
}
