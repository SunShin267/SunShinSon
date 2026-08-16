"use client";

import { useState } from "react";
import type { Color } from "chess.js";
import { STOCKFISH_LEVELS, type StockfishLevel } from "./stockfish-levels";

export type ChessConfig = {
  mode: "local" | "computer";
  players: { white: string; black: string };
  humanColor: Color;
  orientation: Color;
  clockInitialMs: number | null;
  difficulty?: StockfishLevel;
};

export function ChessSetup({ childName, historyCount, onStart, onHistory }: { childName: string; historyCount: number; onStart: (config: ChessConfig) => void; onHistory: () => void }) {
  const [mode, setMode] = useState<ChessConfig["mode"]>("local");
  const [playerName, setPlayerName] = useState(childName || "Bé");
  const [opponentName, setOpponentName] = useState("Bạn chơi");
  const [humanColor, setHumanColor] = useState<Color>("w");
  const [orientation, setOrientation] = useState<Color>("w");
  const [clockMinutes, setClockMinutes] = useState(0);
  const [difficulty, setDifficulty] = useState<StockfishLevel>("medium");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const child = playerName.trim();
    const opponent = mode === "computer" ? "Stockfish" : opponentName.trim();
    if (!child || !opponent) {
      setError("Bé hãy nhập tên cho cả hai người chơi.");
      return;
    }
    const players = humanColor === "w" ? { white: child, black: opponent } : { white: opponent, black: child };
    onStart({ mode, players, humanColor, orientation, clockInitialMs: clockMinutes ? clockMinutes * 60_000 : null, ...(mode === "computer" ? { difficulty } : {}) });
  }

  return <section className="chess-panel chess-setup" aria-labelledby="chess-setup-title">
    <div className="chess-panel-heading"><div><p className="kicker">Chuẩn bị ván cờ</p><h2 id="chess-setup-title">Bé muốn chơi cùng ai?</h2></div><button className="chess-button secondary" type="button" onClick={onHistory}>Lịch sử ({historyCount})</button></div>
    <form onSubmit={submit}>
      <fieldset className="chess-mode-picker"><legend>Chế độ</legend>
        <label className={mode === "local" ? "is-selected" : ""}><input type="radio" name="chess-mode" checked={mode === "local"} onChange={() => setMode("local")} /><span aria-hidden="true">👥</span><strong>Hai người</strong><small>Luân phiên trên cùng thiết bị</small></label>
        <label className={mode === "computer" ? "is-selected" : ""}><input type="radio" name="chess-mode" checked={mode === "computer"} onChange={() => setMode("computer")} /><span aria-hidden="true">🤖</span><strong>Đấu với máy</strong><small>Ba mức độ để thử sức</small></label>
      </fieldset>
      <div className="chess-form-grid">
        <label>Tên của bé<input value={playerName} maxLength={24} onChange={(event) => setPlayerName(event.target.value)} /></label>
        {mode === "local" ? <label>Tên bạn chơi<input value={opponentName} maxLength={24} onChange={(event) => setOpponentName(event.target.value)} /></label> : <label>Độ khó<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as StockfishLevel)}>{Object.entries(STOCKFISH_LEVELS).map(([value, level]) => <option key={value} value={value}>{level.label} · {level.movetimeMs} ms</option>)}</select></label>}
        <label>Màu của bé<select value={humanColor} onChange={(event) => { const color = event.target.value as Color; setHumanColor(color); setOrientation(color); }}><option value="w">Trắng · đi trước</option><option value="b">Đen · đi sau</option></select></label>
        <label>Hướng bàn cờ<select value={orientation} onChange={(event) => setOrientation(event.target.value as Color)}><option value="w">Trắng ở phía bé</option><option value="b">Đen ở phía bé</option></select></label>
        <label>Đồng hồ<select value={clockMinutes} onChange={(event) => setClockMinutes(Number(event.target.value))}><option value={0}>Không giới hạn</option><option value={3}>3 phút mỗi bên</option><option value={5}>5 phút mỗi bên</option><option value={10}>10 phút mỗi bên</option><option value={15}>15 phút mỗi bên</option></select></label>
      </div>
      {error ? <p className="chess-form-error" role="alert">{error}</p> : null}
      <button type="submit" className="chess-button chess-start">Bắt đầu ván cờ <span aria-hidden="true">→</span></button>
    </form>
  </section>;
}
