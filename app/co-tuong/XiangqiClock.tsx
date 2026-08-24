import type { Side } from "../../lib/xiangqi/types";

type XiangqiClockProps = {
  side: Side;
  playerName: string;
  remainingMs: number;
  totalMs: number;
  isRunning: boolean;
  isStopped?: boolean;
};

export function formatXiangqiClock(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function XiangqiClock({ side, playerName, remainingMs, totalMs, isRunning, isStopped = false }: XiangqiClockProps) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const isLow = seconds <= 60;
  const isCritical = seconds <= 15;
  const percent = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));
  const sideLabel = side === "red" ? "Đỏ" : "Đen";

  return (
    <article className={`xiangqi-clock xiangqi-clock--${side}${isRunning ? " is-running" : ""}${isLow ? " is-low" : ""}${isCritical ? " is-critical" : ""}`}>
      <div className="xiangqi-clock-heading">
        <span aria-hidden="true">{side === "red" ? "帥" : "將"}</span>
        <div><strong>{playerName}</strong><small>Quân {sideLabel} · {isRunning ? "Đang đi" : isStopped ? "Đã dừng" : "Đang chờ"}</small></div>
        <time dateTime={`PT${seconds}S`} aria-label={`${playerName} còn ${formatXiangqiClock(remainingMs)}`}>
          {formatXiangqiClock(remainingMs)}
        </time>
      </div>
      <div
        className="xiangqi-clock-progress"
        role="progressbar"
        aria-label={`Thời gian còn lại của ${playerName}`}
        aria-valuemin={0}
        aria-valuemax={Math.ceil(totalMs / 1000)}
        aria-valuenow={seconds}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      {isLow ? <p><span aria-hidden="true">⚠</span> {isCritical ? "Sắp hết giờ!" : "Chỉ còn dưới một phút"}</p> : null}
    </article>
  );
}
