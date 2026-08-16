"use client";

import { useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { PIECE_LESSONS, RULE_LESSONS } from "./chess-lessons";

const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const pieceGlyph: Record<string, string> = { wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙", bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟" };

function LessonBoard({ fen, from, interactive, onTry }: { fen: string; from?: Square; interactive?: boolean; onTry?: (square: Square, valid: boolean) => void }) {
  const chess = useMemo(() => new Chess(fen), [fen]);
  const legal = useMemo(() => from ? new Set(chess.moves({ square: from, verbose: true }).map((move) => move.to)) : new Set<Square>(), [chess, from]);
  const squares = [8, 7, 6, 5, 4, 3, 2, 1].flatMap((rank) => files.map((file) => `${file}${rank}` as Square));
  return <div className="chess-lesson-board" role="grid" aria-label="Bàn cờ minh họa">
    {squares.map((square) => {
      const piece = chess.get(square);
      const valid = legal.has(square);
      return <button key={square} type="button" role="gridcell" disabled={!interactive} className={`${(files.indexOf(square[0] as typeof files[number]) + Number(square[1])) % 2 ? "light" : "dark"} ${valid ? "is-target" : ""} ${square === from ? "is-origin" : ""}`} aria-label={`Ô ${square}${piece ? `, quân ${pieceGlyph[`${piece.color}${piece.type}`]}` : " trống"}${valid ? ", đích hợp lệ" : ""}`} onClick={() => onTry?.(square, valid)}>
        <span aria-hidden="true">{piece ? pieceGlyph[`${piece.color}${piece.type}`] : valid ? "•" : ""}</span>
      </button>;
    })}
  </div>;
}

export function ChessLearn({ section }: { section: "pieces" | "rules" }) {
  const [pieceIndex, setPieceIndex] = useState(0);
  const [feedback, setFeedback] = useState("");
  const lesson = PIECE_LESSONS[pieceIndex];

  if (section === "rules") return <section className="chess-panel chess-rules" aria-labelledby="rules-title">
    <div className="chess-panel-heading"><div><p className="kicker">Từng bước một</p><h2 id="rules-title">Luật cờ cần nhớ</h2></div><span>{RULE_LESSONS.length} bài ngắn</span></div>
    <div className="chess-rule-grid">{RULE_LESSONS.map((rule, index) => <details key={rule.id} open={index === 0}>
      <summary><span aria-hidden="true">{rule.icon}</span><div><strong>{rule.title}</strong><small>{rule.summary}</small></div><b aria-hidden="true">＋</b></summary>
      <div className="chess-rule-body"><LessonBoard fen={rule.exampleFen} /><ol>{rule.steps.map((step) => <li key={step}>{step}</li>)}</ol></div>
    </details>)}</div>
  </section>;

  return <section className="chess-panel" aria-labelledby="pieces-title">
    <div className="chess-panel-heading"><div><p className="kicker">Làm quen đội quân</p><h2 id="pieces-title">Sáu quân cờ</h2></div><span>Chọn một quân để học và thử</span></div>
    <div className="chess-piece-tabs" role="tablist" aria-label="Chọn quân cờ">{PIECE_LESSONS.map((item, index) => <button key={item.piece} type="button" role="tab" aria-selected={pieceIndex === index} onClick={() => { setPieceIndex(index); setFeedback(""); }}><span aria-hidden="true">{item.symbol}</span><strong>{item.nameVi}</strong><small>{item.nameEn}</small></button>)}</div>
    <article className="chess-piece-lesson">
      <div className="chess-lesson-copy"><p className="chess-piece-value">Giá trị tương đối: <strong>{lesson.value}</strong></p><h3>{lesson.nameVi} <small>· {lesson.nameEn}</small></h3><p><b>Cách đi:</b> {lesson.movement}</p><p><b>Cách bắt:</b> {lesson.capture}</p><div className="chess-exercise"><strong>Thử tài</strong><p>{lesson.exercise.prompt}</p><output role="status">{feedback || "Các chấm tròn là những ô hợp lệ."}</output></div></div>
      <LessonBoard key={lesson.piece} fen={lesson.exampleFen} from={lesson.exercise.from} interactive onTry={(_, valid) => setFeedback(valid ? "Chính xác! Bé đã tìm được một nước hợp lệ. ✨" : `Chưa đúng. ${lesson.movement}`)} />
    </article>
  </section>;
}
