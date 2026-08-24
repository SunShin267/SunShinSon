import { useState } from "react";

import type { Difficulty, Side, XiangqiVariant } from "../../lib/xiangqi/types";

export type XiangqiMode = "computer" | "online";
export type XiangqiClockMinutes = 5 | 10 | 15;

export type XiangqiConfig = {
  variant: XiangqiVariant;
  mode: XiangqiMode;
  humanSide: Side;
  difficulty: Difficulty;
  clockMinutes: XiangqiClockMinutes;
};

type XiangqiSetupProps = {
  playerName: string;
  initialMode?: XiangqiMode;
  notice?: string;
  onStart: (config: XiangqiConfig) => void;
};

const DIFFICULTIES: readonly [Difficulty, string, string][] = [
  ["easy", "Dễ", "Máy suy nghĩ nhanh và vui"],
  ["medium", "Vừa", "Cân bằng cho một ván hay"],
  ["hard", "Khó", "Thử thách chiến thuật cao hơn"],
];

export function XiangqiSetup({ playerName, initialMode = "computer", notice, onStart }: XiangqiSetupProps) {
  const [variant, setVariant] = useState<XiangqiVariant>("bright");
  const [mode, setMode] = useState<XiangqiMode>(initialMode);
  const [humanSide, setHumanSide] = useState<Side>("red");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [clockMinutes, setClockMinutes] = useState<XiangqiClockMinutes>(10);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStart({ variant, mode, humanSide, difficulty, clockMinutes });
  }

  return (
    <section className="xiangqi-card xiangqi-setup" aria-labelledby="xiangqi-setup-title">
      <div className="xiangqi-section-heading">
        <div>
          <p className="xiangqi-kicker">Chuẩn bị khai cuộc</p>
          <h2 id="xiangqi-setup-title" tabIndex={-1}>Chọn ván cờ của {playerName || "bé"}</h2>
        </div>
        <span aria-hidden="true">🏮</span>
      </div>

      <form onSubmit={submit}>
        <fieldset className="xiangqi-choice-grid xiangqi-variant-picker">
          <legend>1. Chọn loại cờ</legend>
          <label className={variant === "bright" ? "is-selected" : ""}>
            <input type="radio" name="variant" value="bright" checked={variant === "bright"} onChange={() => setVariant("bright")} />
            <span className="xiangqi-choice-icon" aria-hidden="true">帥</span>
            <strong>Cờ sáng</strong>
            <small>Mọi quân đều ngửa, theo luật Cờ tướng chuẩn.</small>
          </label>
          <label className={variant === "blind" ? "is-selected" : ""}>
            <input type="radio" name="variant" value="blind" checked={variant === "blind"} onChange={() => setVariant("blind")} />
            <span className="xiangqi-choice-icon is-hidden-piece" aria-hidden="true">☯</span>
            <strong>Cờ úp</strong>
            <small>Khám phá quân thật sau nước đi đầu tiên.</small>
          </label>
        </fieldset>

        <fieldset className="xiangqi-choice-grid xiangqi-mode-picker">
          <legend>2. Chọn đối thủ</legend>
          <label className={mode === "computer" ? "is-selected" : ""}>
            <input type="radio" name="mode" value="computer" checked={mode === "computer"} onChange={() => setMode("computer")} />
            <span className="xiangqi-choice-icon" aria-hidden="true">🤖</span>
            <strong>Chơi với máy</strong>
            <small>Chơi ngay trên thiết bị này.</small>
          </label>
          <label className={mode === "online" ? "is-selected" : ""}>
            <input type="radio" name="mode" value="online" checked={mode === "online"} onChange={() => setMode("online")} />
            <span className="xiangqi-choice-icon" aria-hidden="true">🌐</span>
            <strong>Chơi online</strong>
            <small>Mời bạn bằng link hoặc từ sảnh.</small>
          </label>
        </fieldset>

        <div className="xiangqi-setup-options">
          {mode === "computer" ? (
            <fieldset className="xiangqi-option-card">
              <legend>3. Bé cầm quân</legend>
              <div className="xiangqi-segmented">
                {(["red", "black"] as const).map((side) => (
                  <button key={side} type="button" className={humanSide === side ? "is-selected" : ""} aria-pressed={humanSide === side} onClick={() => setHumanSide(side)}>
                    <span className={`xiangqi-mini-piece xiangqi-mini-piece--${side}`} aria-hidden="true">{side === "red" ? "帥" : "將"}</span>
                    Quân {side === "red" ? "Đỏ · đi trước" : "Đen · đi sau"}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
            <div className="xiangqi-option-card xiangqi-online-note">
              <strong>🎲 Màu quân được xáo ngẫu nhiên</strong>
              <p>Hai bên sẽ nhận màu Đỏ hoặc Đen khi ghép trận thành công.</p>
            </div>
          )}

          {mode === "computer" ? (
            <fieldset className="xiangqi-option-card">
              <legend>4. Độ khó</legend>
              <div className="xiangqi-difficulty-list">
                {DIFFICULTIES.map(([value, label, description]) => (
                  <label key={value} className={difficulty === value ? "is-selected" : ""}>
                    <input type="radio" name="difficulty" value={value} checked={difficulty === value} onChange={() => setDifficulty(value)} />
                    <strong>{label}</strong><small>{description}</small>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <fieldset className="xiangqi-option-card xiangqi-time-card">
            <legend>{mode === "computer" ? "5" : "3"}. Thời gian mỗi bên</legend>
            <div className="xiangqi-segmented xiangqi-time-picker">
              {([5, 10, 15] as const).map((minutes) => (
                <button key={minutes} type="button" className={clockMinutes === minutes ? "is-selected" : ""} aria-pressed={clockMinutes === minutes} onClick={() => setClockMinutes(minutes)}>
                  <strong>{minutes}</strong><span>phút</span>
                </button>
              ))}
            </div>
            <p>Không cộng thêm thời gian sau mỗi nước.</p>
          </fieldset>
        </div>

        {notice ? <p className="xiangqi-setup-notice" role="status">{notice}</p> : null}
        <button className="xiangqi-primary-button xiangqi-start-button" type="submit">
          {mode === "computer" ? "Bắt đầu đấu với máy" : "Đi tới sảnh online"} <span aria-hidden="true">→</span>
        </button>
      </form>
    </section>
  );
}
