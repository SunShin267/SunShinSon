import { useEffect, useMemo, useState } from "react";
import { replayMoves } from "./gomoku-engine";
import {
  clearGomokuHistory,
  deleteCompletedGame,
  getPairStats,
  normalizePair,
  type GomokuGameRecord,
} from "./gomoku-history";
import { coordKey } from "./gomoku-types";

type GomokuHistoryProps = {
  records: readonly GomokuGameRecord[];
  onBack: () => void;
  onRecordsChange: (records: GomokuGameRecord[]) => void;
};

function resultLabel(record: GomokuGameRecord) {
  if (record.result === "draw") return "Hòa";
  return `${record.players.find((player) => player.id === record.result)?.name ?? "Người chơi"} thắng`;
}

export function GomokuHistory({ records, onBack, onRecordsChange }: GomokuHistoryProps) {
  const [selectedId, setSelectedId] = useState<string | null>(records[0]?.id ?? null);
  const selected = records.find((record) => record.id === selectedId) ?? null;
  const [replayIndex, setReplayIndex] = useState(selected?.moves.length ?? 0);
  const [playing, setPlaying] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");

  useEffect(() => {
    if (!playing || !selected) return;
    const timer = window.setTimeout(() => {
      if (replayIndex >= selected.moves.length) setPlaying(false);
      else setReplayIndex(replayIndex + 1);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [playing, selected, replayIndex]);

  const stats = useMemo(() => {
    const seen = new Set<string>();
    return records.flatMap((record) => {
      if (record.mode !== "local") return [];
      const key = normalizePair(record.players[0].name, record.players[1].name);
      if (seen.has(key)) return [];
      seen.add(key);
      return [getPairStats(records, record.players[0].name, record.players[1].name)];
    });
  }, [records]);

  const replayState = selected
    ? replayMoves({ startingPlayer: selected.startingPlayer }, selected.moves.slice(0, replayIndex), selected.size)
    : null;

  function showRecord(record: GomokuGameRecord, replay: boolean) {
    setSelectedId(record.id);
    setReplayIndex(replay ? 0 : record.moves.length);
    setPlaying(false);
  }

  function removeRecord(record: GomokuGameRecord) {
    if (!window.confirm(`Xóa ván ${resultLabel(record)}?`)) return;
    const result = deleteCompletedGame(record.id);
    if (!result.saved) {
      setStorageNotice("Thiết bị chưa thể xóa ván này. Lịch sử vẫn được giữ nguyên.");
      return;
    }
    setStorageNotice("");
    const next = result.records;
    onRecordsChange(next);
    if (selectedId === record.id) {
      setSelectedId(next[0]?.id ?? null);
      setReplayIndex(next[0]?.moves.length ?? 0);
      setPlaying(false);
    }
  }

  return (
    <section className="gomoku-panel gomoku-history-panel" aria-labelledby="gomoku-history-title">
      <div className="gomoku-panel-heading">
        <div><p className="kicker">Nhật ký bàn cờ</p><h2 id="gomoku-history-title">Lịch sử và thành tích</h2></div>
        <div className="gomoku-heading-actions">
          {records.length ? <button className="gomoku-button danger" type="button" onClick={() => {
            if (!window.confirm("Xóa toàn bộ lịch sử cờ caro?")) return;
            const result = clearGomokuHistory();
            if (!result.saved) {
              setStorageNotice("Thiết bị chưa thể xóa lịch sử. Các ván vẫn được giữ nguyên.");
              return;
            }
            setStorageNotice("");
            onRecordsChange(result.records);
            setSelectedId(null);
            setPlaying(false);
          }}>Xóa tất cả</button> : null}
          <button className="gomoku-button secondary" type="button" onClick={onBack}>Quay lại</button>
        </div>
      </div>

      {storageNotice ? <p className="gomoku-storage-notice" role="status">{storageNotice}</p> : null}

      {stats.length ? (
        <div className="gomoku-stats-grid">
          {stats.map((pair) => (
            <article key={pair.pairKey}>
              <strong>{pair.players[0].name} ↔ {pair.players[1].name}</strong>
              <span>{pair.games} ván · {pair.draws} hòa</span>
              <small>{pair.players[0].wins}–{pair.players[1].wins} trận thắng · chuỗi tốt nhất {pair.players[0].bestWinStreak}/{pair.players[1].bestWinStreak}</small>
            </article>
          ))}
        </div>
      ) : null}

      {!records.length ? (
        <div className="gomoku-empty"><span>🌱</span><h3>Chưa có ván nào</h3><p>Chơi xong một ván, bàn cờ cuối sẽ xuất hiện ở đây.</p></div>
      ) : (
        <div className="gomoku-history-layout">
          <div className="gomoku-record-list" aria-label="Danh sách ván đã chơi">
            {records.map((record) => (
              <article key={record.id} className={selectedId === record.id ? "is-selected" : ""}>
                <div><strong>{record.players[0].name} – {record.players[1].name}</strong><span>{resultLabel(record)}</span></div>
                <small>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(record.completedAt))} · {record.size}×{record.size} · {record.moves.length} nước</small>
                <div className="gomoku-record-actions">
                  <button type="button" onClick={() => showRecord(record, false)}>Bàn cuối</button>
                  <button type="button" onClick={() => showRecord(record, true)}>Xem lại</button>
                  <button type="button" className="danger" onClick={() => removeRecord(record)}>Xóa</button>
                </div>
              </article>
            ))}
          </div>

          {selected && replayState ? (
            <div className="gomoku-replay">
              <div className="gomoku-replay-heading">
                <div><strong>{resultLabel(selected)}</strong><span>Nước {replayIndex} trên {selected.moves.length}</span></div>
                <span>{selected.mode === "computer" ? `Máy · ${selected.difficulty ?? "vừa"}` : "Hai người"}</span>
              </div>
              <div className="gomoku-snapshot-wrap">
                <div className="gomoku-snapshot" style={{ gridTemplateColumns: `repeat(${selected.size}, 1fr)` }} role="img" aria-label={`Bàn cờ ở nước ${replayIndex}`}>
                  {Array.from({ length: selected.size * selected.size }, (_, index) => {
                    const coord = [index % selected.size, Math.floor(index / selected.size)] as const;
                    const stone = replayState.cells[coordKey(coord)];
                    const player = stone ? selected.players.find((item) => item.id === stone) : null;
                    const winning = selected.winningCells.some((item) => item[0] === coord[0] && item[1] === coord[1]) && replayIndex === selected.moves.length;
                    return <span key={coordKey(coord)} className={winning ? "is-winning" : ""} style={{ color: player?.color }}>{player?.piece}</span>;
                  })}
                </div>
              </div>
              <div className="gomoku-replay-controls">
                <button type="button" aria-label="Nước đầu tiên" onClick={() => { setReplayIndex(0); setPlaying(false); }}>⏮</button>
                <button type="button" aria-label="Nước trước" disabled={replayIndex === 0} onClick={() => { setReplayIndex((value) => Math.max(0, value - 1)); setPlaying(false); }}>←</button>
                <button type="button" onClick={() => {
                  if (replayIndex >= selected.moves.length) setReplayIndex(0);
                  setPlaying((value) => !value);
                }}>{playing ? "Tạm dừng" : "Tự động"}</button>
                <button type="button" aria-label="Nước tiếp theo" disabled={replayIndex === selected.moves.length} onClick={() => { setReplayIndex((value) => Math.min(selected.moves.length, value + 1)); setPlaying(false); }}>→</button>
                <button type="button" aria-label="Nước cuối cùng" onClick={() => { setReplayIndex(selected.moves.length); setPlaying(false); }}>⏭</button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
