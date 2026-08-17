import { useMemo, useState } from "react";
import {
  PIECE_OPTIONS,
  PLAYER_COLORS,
  type Difficulty,
  type GameMode,
  type GomokuConfig,
  type Stone,
} from "./gomoku-types";

type GomokuSetupProps = {
  childName: string;
  onStart: (config: GomokuConfig) => void;
  onOpenHistory: () => void;
  historyCount: number;
};

export function GomokuSetup({ childName, onStart, onOpenHistory, historyCount }: GomokuSetupProps) {
  const [mode, setMode] = useState<GameMode>("computer");
  const [p1Name, setP1Name] = useState(childName);
  const [p2Name, setP2Name] = useState("Bạn chơi cùng");
  const [p1Color, setP1Color] = useState<string>(PLAYER_COLORS[0]);
  const [p2Color, setP2Color] = useState<string>(PLAYER_COLORS[2]);
  const [p1Piece, setP1Piece] = useState<string>("☀");
  const [p2Piece, setP2Piece] = useState<string>("☾");
  const [startingPlayer, setStartingPlayer] = useState<Stone>("p1");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const secondName = mode === "computer" ? "Máy tính" : p2Name.trim();
  const valid = useMemo(
    () => Boolean(p1Name.trim() && secondName && p1Color !== p2Color && p1Piece !== p2Piece),
    [p1Name, secondName, p1Color, p2Color, p1Piece, p2Piece],
  );

  function choosePiece(player: Stone, piece: string) {
    if (player === "p1") {
      if (piece === p2Piece) setP2Piece(p1Piece);
      setP1Piece(piece);
      return;
    }
    if (piece === p1Piece) setP1Piece(p2Piece);
    setP2Piece(piece);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    onStart({
      mode,
      difficulty: mode === "computer" ? difficulty : undefined,
      startingPlayer,
      players: [
        { id: "p1", name: p1Name.trim(), color: p1Color, piece: p1Piece },
        { id: "p2", name: secondName, color: p2Color, piece: p2Piece },
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
          <fieldset className="gomoku-player-card" style={{ "--player-color": p1Color } as React.CSSProperties}>
            <legend><span className="gomoku-player-preview" style={{ color: p1Color }}>{p1Piece}</span> Người chơi 1</legend>
            <label>Tên người chơi 1<input required maxLength={24} value={p1Name} onChange={(event) => setP1Name(event.target.value)} /></label>
            <div className="gomoku-choice-group">
              <span>Màu quân</span>
              <div className="gomoku-swatch-picker" role="radiogroup" aria-label="Màu quân người chơi 1">
                {PLAYER_COLORS.map((color) => (
                  <button key={color} type="button" role="radio" aria-checked={p1Color === color} aria-label={`Chọn màu ${color}`} className={p1Color === color ? "is-selected" : ""} style={{ "--swatch": color } as React.CSSProperties} disabled={p2Color === color} onClick={() => setP1Color(color)}>
                    <span aria-hidden="true">✓</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="gomoku-choice-group">
              <span>Quân cờ</span>
              <div className="gomoku-piece-picker" role="radiogroup" aria-label="Quân cờ người chơi 1">
                {PIECE_OPTIONS.map((piece) => <button key={piece} type="button" role="radio" aria-checked={p1Piece === piece} aria-label={`Chọn quân ${piece}`} className={p1Piece === piece ? "is-selected" : ""} style={{ color: p1Color }} onClick={() => choosePiece("p1", piece)}>{piece}</button>)}
              </div>
            </div>
          </fieldset>
          <fieldset className="gomoku-player-card" style={{ "--player-color": p2Color } as React.CSSProperties}>
            <legend><span className="gomoku-player-preview" style={{ color: p2Color }}>{p2Piece}</span> {mode === "computer" ? "Máy tính" : "Người chơi 2"}</legend>
            {mode === "local" ? (
              <label>Tên người chơi 2<input required maxLength={24} value={p2Name} onChange={(event) => setP2Name(event.target.value)} /></label>
            ) : <p className="gomoku-computer-name">🤖 Máy tính</p>}
            <div className="gomoku-choice-group">
              <span>Màu quân</span>
              <div className="gomoku-swatch-picker" role="radiogroup" aria-label="Màu quân người chơi 2">
                {PLAYER_COLORS.map((color) => (
                  <button key={color} type="button" role="radio" aria-checked={p2Color === color} aria-label={`Chọn màu ${color}`} className={p2Color === color ? "is-selected" : ""} style={{ "--swatch": color } as React.CSSProperties} disabled={p1Color === color} onClick={() => setP2Color(color)}>
                    <span aria-hidden="true">✓</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="gomoku-choice-group">
              <span>Quân cờ</span>
              <div className="gomoku-piece-picker" role="radiogroup" aria-label="Quân cờ người chơi 2">
                {PIECE_OPTIONS.map((piece) => <button key={piece} type="button" role="radio" aria-checked={p2Piece === piece} aria-label={`Chọn quân ${piece}`} className={p2Piece === piece ? "is-selected" : ""} style={{ color: p2Color }} onClick={() => choosePiece("p2", piece)}>{piece}</button>)}
              </div>
            </div>
          </fieldset>
        </div>

        <div className="gomoku-setup-options">
          <fieldset className="gomoku-segment-card">
            <legend>Người đi trước</legend>
            <div className="gomoku-segmented">
              <button type="button" className={startingPlayer === "p1" ? "is-selected" : ""} aria-pressed={startingPlayer === "p1"} onClick={() => setStartingPlayer("p1")}><span style={{ color: p1Color }}>{p1Piece}</span>{p1Name.trim() || "Người chơi 1"}</button>
              <button type="button" className={startingPlayer === "p2" ? "is-selected" : ""} aria-pressed={startingPlayer === "p2"} onClick={() => setStartingPlayer("p2")}><span style={{ color: p2Color }}>{p2Piece}</span>{secondName || "Người chơi 2"}</button>
            </div>
          </fieldset>
          {mode === "computer" ? (
            <fieldset className="gomoku-segment-card">
              <legend>Độ khó</legend>
              <div className="gomoku-segmented gomoku-difficulty-picker">
                {([['easy', 'Dễ'], ['medium', 'Vừa'], ['hard', 'Khó']] as const).map(([value, label]) => <button key={value} type="button" className={difficulty === value ? "is-selected" : ""} aria-pressed={difficulty === value} onClick={() => setDifficulty(value)}>{label}</button>)}
              </div>
            </fieldset>
          ) : null}
        </div>

        <button className="gomoku-button gomoku-start" type="submit" disabled={!valid}>Bắt đầu chơi</button>
      </form>
    </section>
  );
}
