"use client";

import type { Color, Square } from "chess.js";
import { hydrateChess, type ChessGame } from "./chess-game";

const glyphs: Record<string, string> = { wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙", bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟" };
const names: Record<string, string> = { k: "Vua", q: "Hậu", r: "Xe", b: "Tượng", n: "Mã", p: "Tốt" };
const allFiles = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export function ChessBoard({ game, orientation, selected, legalTargets, lastMove, checkedKing, disabled = false, onSquare, label = "Bàn cờ đang chơi" }: {
  game: ChessGame;
  orientation: Color;
  selected?: Square | null;
  legalTargets?: readonly Square[];
  lastMove?: { from: Square; to: Square } | null;
  checkedKing?: Square | null;
  disabled?: boolean;
  onSquare?: (square: Square) => void;
  label?: string;
}) {
  const chess = hydrateChess(game);
  const files = orientation === "w" ? [...allFiles] : [...allFiles].reverse();
  const ranks = orientation === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const targets = new Set(legalTargets ?? []);

  return <div className="chess-board" role="grid" aria-label={label} aria-disabled={disabled}>
    {ranks.flatMap((rank, rankIndex) => files.map((file, fileIndex) => {
      const square = `${file}${rank}` as Square;
      const piece = chess.get(square);
      const isLegal = targets.has(square);
      const isLast = lastMove?.from === square || lastMove?.to === square;
      const state = [selected === square ? "đang chọn" : "", isLegal ? "nước đi hợp lệ" : "", isLast ? "thuộc nước vừa đi" : "", checkedKing === square ? "Vua đang bị chiếu" : ""].filter(Boolean).join(", ");
      const pieceLabel = piece ? `${names[piece.type]} ${piece.color === "w" ? "trắng" : "đen"}` : "ô trống";
      return <button
        key={square}
        type="button"
        role="gridcell"
        className={`${(allFiles.indexOf(file) + rank) % 2 ? "dark" : "light"} ${selected === square ? "is-selected" : ""} ${isLegal ? "is-legal" : ""} ${isLegal && piece ? "is-capture" : ""} ${isLast ? "is-last" : ""} ${checkedKing === square ? "is-check" : ""}`}
        aria-label={`Ô ${square}, ${pieceLabel}${state ? `, ${state}` : ""}`}
        data-legal={isLegal || undefined}
        disabled={disabled || !onSquare}
        onClick={() => onSquare?.(square)}
      >
        {fileIndex === 0 ? <small className="rank-label" aria-hidden="true">{rank}</small> : null}
        {rankIndex === 7 ? <small className="file-label" aria-hidden="true">{file}</small> : null}
        <span aria-hidden="true">{piece ? glyphs[`${piece.color}${piece.type}`] : ""}</span>
        {isLegal ? <i aria-hidden="true" /> : null}
      </button>;
    }))}
  </div>;
}
