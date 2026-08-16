import { useMemo, useState } from "react";
import {
  PIECE_THEMES,
  PLAYER_COLORS,
  type Difficulty,
  type GameMode,
  type GomokuConfig,
  type PieceTheme,
  type Stone,
} from "./gomoku-types";

type GomokuSetupProps = {
  childName: string;
  onStart: (config: GomokuConfig) => void;
  onOpenHistory: () => void;
  historyCount: number;
};

const THEME_LABELS: Record<PieceTheme, string> = {
  classic: "X / O",
  sky: "Mặt trời / Mặt trăng",
  garden: "Hoa / Lá",
};

export function GomokuSetup({ childName, onStart, onOpenHistory, historyCount }: GomokuSetupProps) {
  const [mode, setMode] = useState<GameMode>("computer");
  const [p1Name, setP1Name] = useState(childName);
  const [p2Name, setP2Name] = useState("Bạn chơi cùng");
  const [p1Color, setP1Color] = useState<string>(PLAYER_COLORS[0]);
  const [p2Color, setP2Color] = useState<string>(PLAYER_COLORS[2]);
  const [theme, setTheme] = useState<PieceTheme>("sky");
  const [startingPlayer, setStartingPlayer] = useState<Stone>("p1");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const pieces = PIECE_THEMES[theme];
  const secondName = mode === "computer" ? "Máy tính" : p2Name.trim();
  const valid = useMemo(
    () => Boolean(p1Name.trim() && secondName && p1Color !== p2Color),
    [p1Name, secondName, p1Color, p2Color],
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    onStart({
      mode,
      difficulty: mode === "computer" ? difficulty : undefined,
      theme,
      startingPlayer,
      players: [
        { id: "p1", name: p1Name.trim(), color: p1Color, piece: pieces[0] },
        { id: "p2", name: secondName, color: p2Color, piece: pieces[1] },
      ],
    });
  }

  return (
    <section className="gomoku-panel gomoku-setup-panel" aria-labelledby="gomoku-setup-title">
      <div className="gomoku-panel-heading">
        <div>
          <p className="kicker">Chuẩn bị ván cờ</p>
          <h2 id="gomoku-setup-title">Chọn đội hình của bé</h2>
        </div>
        <button type="button" className="gomoku-button secondary" onClick={onOpenHistory}>
          Lịch sử <span aria-label={`${historyCount} ván`}>({historyCount})</span>
        </button>
      </div>

      <form className="gomoku-setup-form" onSubmit={submit}>
        <fieldset className="gomoku-mode-picker">
          <legend>Chế độ chơi</legend>
          <label className={mode === "computer" ? "is-selected" : ""}>
            <input type="radio" name="mode" value="computer" checked={mode === "computer"} onChange={() => setMode("computer")} />
            <span>🤖</span><strong>Đấu với máy</strong><small>Ba mức thử thách</small>
          </label>
          <label className={mode === "local" ? "is-selected" : ""}>
            <input type="radio" name="mode" value="local" checked={mode === "local"} onChange={() => setMode("local")} />
            <span>👫</span><strong>Hai người</strong><small>Cùng chơi tại chỗ</small>
          </label>
        </fieldset>

        <div className="gomoku-player-fields">
          <fieldset>
            <legend>Người chơi 1</legend>
            <label>Tên người chơi 1<input required maxLength={24} value={p1Name} onChange={(event) => setP1Name(event.target.value)} /></label>
            <label>Màu quân 1
              <select value={p1Color} onChange={(event) => setP1Color(event.target.value)}>
                {PLAYER_COLORS.map((color, index) => <option key={color} value={color}>Màu {index + 1}</option>)}
              </select>
            </label>
          </fieldset>
          <fieldset>
            <legend>{mode === "computer" ? "Máy tính" : "Người chơi 2"}</legend>
            {mode === "local" ? (
              <label>Tên người chơi 2<input required maxLength={24} value={p2Name} onChange={(event) => setP2Name(event.target.value)} /></label>
            ) : <p className="gomoku-computer-name">🤖 Máy tính</p>}
            <label>Màu quân 2
              <select value={p2Color} onChange={(event) => setP2Color(event.target.value)}>
                {PLAYER_COLORS.map((color, index) => <option key={color} value={color}>Màu {index + 1}</option>)}
              </select>
            </label>
          </fieldset>
        </div>

        {p1Color === p2Color ? <p className="gomoku-form-error" role="alert">Hai bên cần chọn hai màu khác nhau nhé.</p> : null}

        <div className="gomoku-setup-options">
          <label>Bộ quân
            <select value={theme} onChange={(event) => setTheme(event.target.value as PieceTheme)}>
              {(Object.keys(THEME_LABELS) as PieceTheme[]).map((item) => <option key={item} value={item}>{THEME_LABELS[item]}</option>)}
            </select>
          </label>
          <label>Người đi trước
            <select value={startingPlayer} onChange={(event) => setStartingPlayer(event.target.value as Stone)}>
              <option value="p1">{p1Name.trim() || "Người chơi 1"} ({pieces[0]})</option>
              <option value="p2">{secondName || "Người chơi 2"} ({pieces[1]})</option>
            </select>
          </label>
          {mode === "computer" ? (
            <label>Độ khó
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}>
                <option value="easy">Dễ</option><option value="medium">Vừa</option><option value="hard">Khó</option>
              </select>
            </label>
          ) : null}
        </div>

        <button className="gomoku-button gomoku-start" type="submit" disabled={!valid}>Bắt đầu chơi</button>
      </form>
    </section>
  );
}
