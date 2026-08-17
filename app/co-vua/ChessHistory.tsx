"use client";

import { useEffect, useMemo, useState } from "react";
import { ChessBoard } from "./ChessBoard";
import { clearChessHistory, deleteChessGame, replayChessPly, type ChessGameRecord } from "./chess-history";
import type { ChessBoardThemeId, ChessPieceThemeId } from "./chess-themes";

const resultLabel = { white: "Trắng thắng", black: "Đen thắng", draw: "Hòa" } as const;

export function ChessHistory({ records, boardTheme, pieceTheme, onChange, onBack }: { records: ChessGameRecord[]; boardTheme: ChessBoardThemeId; pieceTheme: ChessPieceThemeId; onChange: (records: ChessGameRecord[]) => void; onBack: () => void }) {
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? "");
  const selected = records.find((record) => record.id === selectedId) ?? records[0];
  const [ply, setPly] = useState(selected?.moves.length ?? 0);
  const [playing, setPlaying] = useState(false);
  const [storageError, setStorageError] = useState("");
  const replay = useMemo(() => selected ? replayChessPly(selected, ply) : null, [selected, ply]);

  useEffect(() => {
    if (!playing || !selected) return;
    if (ply >= selected.moves.length) return;
    const timer = window.setTimeout(() => {
      const next = ply + 1;
      setPly(next);
      if (next >= selected.moves.length) setPlaying(false);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [playing, ply, selected]);

  function remove(id: string) {
    const outcome = deleteChessGame(id);
    if (!outcome.saved) {
      setStorageError("Thiết bị chưa thể xóa ván cờ. Lịch sử vẫn được giữ nguyên.");
      return;
    }
    setStorageError("");
    onChange(outcome.records);
    setSelectedId(outcome.records[0]?.id ?? "");
  }

  function selectRecord(record: ChessGameRecord) {
    setSelectedId(record.id);
    setPly(record.moves.length);
    setPlaying(false);
  }

  function togglePlayback() {
    if (!selected) return;
    if (!playing && ply >= selected.moves.length) setPly(0);
    setPlaying((value) => !value);
  }

  return <section className="chess-panel chess-history" aria-labelledby="chess-history-title">
    <div className="chess-panel-heading"><div><p className="kicker">Nhìn lại để tiến bộ</p><h2 id="chess-history-title">Lịch sử ván cờ</h2></div><div className="chess-heading-actions"><button className="chess-button secondary" type="button" onClick={onBack}>Quay lại</button>{records.length ? <button className="chess-button danger" type="button" onClick={() => { if (window.confirm("Xóa toàn bộ lịch sử cờ vua?")) { const outcome = clearChessHistory(); if (outcome.saved) { setStorageError(""); onChange(outcome.records); setSelectedId(""); } else setStorageError("Thiết bị chưa thể xóa lịch sử. Các ván cờ vẫn được giữ nguyên."); } }}>Xóa tất cả</button> : null}</div></div>
    {storageError ? <p className="chess-storage-notice" role="alert">{storageError}</p> : null}
    {!selected || !replay ? <div className="chess-empty"><span aria-hidden="true">♙</span><h3>Chưa có ván cờ nào</h3><p>Ván đã hoàn thành sẽ xuất hiện ở đây để bé xem lại.</p></div> : <div className="chess-history-layout">
      <div className="chess-record-list">{records.map((record) => <article key={record.id} className={record.id === selected.id ? "is-selected" : ""}><button type="button" onClick={() => selectRecord(record)}><strong>{record.players.white} – {record.players.black}</strong><small>{resultLabel[record.result]} · {new Date(record.completedAt).toLocaleDateString("vi-VN")}</small><span>{record.san.length} nước · {record.mode === "computer" ? "Đấu máy" : "Hai người"}</span></button><button className="chess-delete-record" type="button" aria-label={`Xóa ván ${record.players.white} gặp ${record.players.black}`} onClick={() => remove(record.id)}>×</button></article>)}</div>
      <div className="chess-replay"><div className="chess-replay-heading"><div><strong>{resultLabel[selected.result]}</strong><span>{selected.reason}</span></div><output>Nước {ply}/{selected.moves.length}</output></div><ChessBoard game={replay} orientation="w" boardTheme={boardTheme} pieceTheme={pieceTheme} disabled label="Bàn cờ xem lại" /><div className="chess-replay-controls"><button type="button" aria-label="Về nước đầu tiên" onClick={() => setPly(0)} disabled={ply === 0}>⏮</button><button type="button" aria-label="Xem nước trước" onClick={() => setPly((value) => Math.max(0, value - 1))} disabled={ply === 0}>←</button><button type="button" onClick={togglePlayback}>{playing ? "Tạm dừng" : "Phát lại"}</button><button type="button" aria-label="Xem nước tiếp theo" onClick={() => setPly((value) => Math.min(selected.moves.length, value + 1))} disabled={ply === selected.moves.length}>→</button><button type="button" aria-label="Đến nước cuối cùng" onClick={() => setPly(selected.moves.length)} disabled={ply === selected.moves.length}>⏭</button></div></div>
    </div>}
  </section>;
}
