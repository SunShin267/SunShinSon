import { useMemo, useState } from "react";

import { getGameStatus } from "../../lib/xiangqi/rules";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  coordKey,
  sameCoord,
  type Coord,
  type Piece,
  type PieceRole,
  type PublicXiangqiState,
  type Side,
} from "../../lib/xiangqi/types";

type XiangqiBoardProps = {
  state: PublicXiangqiState;
  playerSide: Side;
  selectedSquare: Coord | null;
  legalTargets: readonly Coord[];
  onSquareClick: (coord: Coord) => void;
  disabled?: boolean;
};

const ROLE_LABELS: Record<PieceRole, string> = {
  general: "Tướng",
  advisor: "Sĩ",
  elephant: "Tượng",
  horse: "Mã",
  rook: "Xe",
  cannon: "Pháo",
  soldier: "Tốt",
};

const PIECE_GLYPHS: Record<Side, Record<PieceRole, string>> = {
  red: { general: "帥", advisor: "仕", elephant: "相", horse: "傌", rook: "俥", cannon: "炮", soldier: "兵" },
  black: { general: "將", advisor: "士", elephant: "象", horse: "馬", rook: "車", cannon: "砲", soldier: "卒" },
};

function pieceLabel(piece: Piece): string {
  const side = piece.side === "red" ? "Đỏ" : "Đen";
  if (!piece.revealed || !piece.role) return `quân úp bên ${side}`;
  return `${ROLE_LABELS[piece.role]} ${side}`;
}

function positionLabel([x, y]: Coord): string {
  return `cột ${x + 1}, hàng ${y + 1}`;
}

function visualCoords(side: Side): Coord[] {
  const result: Coord[] = [];
  for (let row = 0; row < BOARD_HEIGHT; row += 1) {
    for (let column = 0; column < BOARD_WIDTH; column += 1) {
      result.push(side === "red" ? [column, row] : [BOARD_WIDTH - 1 - column, BOARD_HEIGHT - 1 - row]);
    }
  }
  return result;
}

export function XiangqiBoard({ state, playerSide, selectedSquare, legalTargets, onSquareClick, disabled = false }: XiangqiBoardProps) {
  const ownGeneral: Coord = playerSide === "red" ? [4, 9] : [4, 0];
  const [focusCoord, setFocusCoord] = useState<Coord>(ownGeneral);
  const coords = useMemo(() => visualCoords(playerSide), [playerSide]);
  const lastMove = state.moves.at(-1) ?? null;
  const status = getGameStatus(state);
  const checkedGeneralKey = status.inCheck
    ? Object.entries(state.board).find(([, piece]) => piece.side === state.turn && piece.revealed && piece.role === "general")?.[0] ?? null
    : null;

  function moveFocus(coord: Coord, visualDx: number, visualDy: number) {
    const direction = playerSide === "red" ? 1 : -1;
    const next: Coord = [
      Math.max(0, Math.min(BOARD_WIDTH - 1, coord[0] + visualDx * direction)),
      Math.max(0, Math.min(BOARD_HEIGHT - 1, coord[1] + visualDy * direction)),
    ];
    setFocusCoord(next);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-xiangqi-square="${coordKey(next)}"]`)?.focus({ preventScroll: true });
    });
  }

  return (
    <div className={`xiangqi-board-frame xiangqi-board-frame--${playerSide}`}>
      <div className="xiangqi-board" role="grid" aria-label={`Bàn Cờ tướng, nhìn từ phía quân ${playerSide === "red" ? "Đỏ" : "Đen"}`}>
        <svg className="xiangqi-board-lines" viewBox="0 0 900 1000" aria-hidden="true" preserveAspectRatio="none">
          <rect x="50" y="50" width="800" height="900" rx="4" />
          {Array.from({ length: 10 }, (_, index) => <line key={`h-${index}`} x1="50" y1={50 + index * 100} x2="850" y2={50 + index * 100} />)}
          {Array.from({ length: 9 }, (_, index) => {
            const x = 50 + index * 100;
            return index === 0 || index === 8
              ? <line key={`v-${index}`} x1={x} y1="50" x2={x} y2="950" />
              : <g key={`v-${index}`}><line x1={x} y1="50" x2={x} y2="450" /><line x1={x} y1="550" x2={x} y2="950" /></g>;
          })}
          <line x1="350" y1="50" x2="550" y2="250" />
          <line x1="550" y1="50" x2="350" y2="250" />
          <line x1="350" y1="750" x2="550" y2="950" />
          <line x1="550" y1="750" x2="350" y2="950" />
          <text x="250" y="515">楚 河 · SỞ HÀ</text>
          <text x="650" y="515">HÁN GIỚI · 漢 界</text>
        </svg>

        <div className="xiangqi-board-squares">
          {coords.map((coord) => {
            const key = coordKey(coord);
            const piece = state.board[key];
            const isSelected = selectedSquare ? sameCoord(selectedSquare, coord) : false;
            const isLegal = legalTargets.some((target) => sameCoord(target, coord));
            const isLast = lastMove ? sameCoord(lastMove.from, coord) || sameCoord(lastMove.to, coord) : false;
            const isJustRevealed = Boolean(lastMove?.revealedRole && sameCoord(lastMove.to, coord));
            const isChecked = checkedGeneralKey === key;
            const details = [
              positionLabel(coord),
              piece ? pieceLabel(piece) : "ô trống",
              isSelected ? "đang chọn" : "",
              isLegal ? (piece ? "có thể bắt quân" : "đích hợp lệ") : "",
              isChecked ? "đang bị chiếu" : "",
            ].filter(Boolean).join(", ");

            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                data-xiangqi-square={key}
                tabIndex={sameCoord(focusCoord, coord) ? 0 : -1}
                aria-label={details}
                aria-selected={isSelected}
                aria-disabled={disabled}
                className={`xiangqi-square${isSelected ? " is-selected" : ""}${isLegal ? " is-legal" : ""}${isLegal && piece ? " is-capture" : ""}${isLast ? " is-last" : ""}${isChecked ? " is-check" : ""}${isJustRevealed ? " is-just-revealed" : ""}`}
                onClick={() => { setFocusCoord(coord); if (!disabled) onSquareClick(coord); }}
                onFocus={() => setFocusCoord(coord)}
                onKeyDown={(event) => {
                  const movements: Record<string, Coord> = {
                    ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
                  };
                  const movement = movements[event.key];
                  if (!movement) return;
                  event.preventDefault();
                  moveFocus(coord, movement[0], movement[1]);
                }}
              >
                {isLegal ? <i className="xiangqi-target" aria-hidden="true" /> : null}
                {piece ? (
                  <span className={`xiangqi-piece xiangqi-piece--${piece.side}${piece.revealed ? " is-revealed" : " is-concealed"}`} aria-hidden="true">
                    {piece.revealed && piece.role ? PIECE_GLYPHS[piece.side][piece.role] : <b>☯<small>ÚP</small></b>}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <p className="xiangqi-orientation-note"><span aria-hidden="true">↕</span> Phía quân {playerSide === "red" ? "Đỏ" : "Đen"} ở gần bé</p>
    </div>
  );
}
