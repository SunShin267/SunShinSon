import { useMemo, useRef, useState } from "react";
import { clampZoom, sizeForZoom } from "./board-viewport";
import { coordKey, sameCoord, type BoardSize, type Coord, type GomokuState, type PlayerConfig } from "./gomoku-types";

const CELL_SIZE = 28;

type GomokuBoardProps = {
  state: GomokuState;
  players: readonly [PlayerConfig, PlayerConfig];
  disabled?: boolean;
  blinking?: boolean;
  onPlay: (coord: Coord) => void;
  onExpand: (size: BoardSize) => void;
};

type Point = { x: number; y: number };

export function GomokuBoard({ state, players, disabled = false, blinking = false, onPlay, onExpand }: GomokuBoardProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [focusCoord, setFocusCoord] = useState<Coord>(() => {
    const center = Math.floor(state.size / 2);
    return [state.origin[0] + center, state.origin[1] + center];
  });
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ startPan: Point; startPoint: Point; pinchDistance?: number; startZoom: number } | null>(null);
  const dragged = useRef(false);
  const latest = state.moves[state.moves.length - 1]?.coord;
  const winning = state.winner?.cells ?? [];
  const playerByStone = { p1: players[0], p2: players[1] };

  const cells = useMemo(() => {
    const result: Coord[] = [];
    for (let row = 0; row < state.size; row += 1) {
      for (let column = 0; column < state.size; column += 1) {
        result.push([state.origin[0] + column, state.origin[1] + row]);
      }
    }
    return result;
  }, [state.origin, state.size]);

  function updateZoom(nextZoom: number) {
    const next = clampZoom(nextZoom);
    setZoom(next);
    onExpand(sizeForZoom(next));
  }

  function pointerDistance() {
    const points = [...pointers.current.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragged.current = false;
    gesture.current = {
      startPan: pan,
      startPoint: { x: event.clientX, y: event.clientY },
      startZoom: zoom,
      pinchDistance: pointers.current.size > 1 ? pointerDistance() : undefined,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size > 1 && gesture.current.pinchDistance) {
      const distance = pointerDistance();
      if (Math.abs(distance - gesture.current.pinchDistance) <= 3 && !dragged.current) return;
      if (!dragged.current) {
        dragged.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      updateZoom(gesture.current.startZoom * distance / gesture.current.pinchDistance);
      return;
    }
    const x = gesture.current.startPan.x + event.clientX - gesture.current.startPoint.x;
    const y = gesture.current.startPan.y + event.clientY - gesture.current.startPoint.y;
    if (Math.hypot(x - gesture.current.startPan.x, y - gesture.current.startPan.y) <= 5 && !dragged.current) return;
    if (!dragged.current) {
      dragged.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setPan({ x, y });
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (!pointers.current.size) gesture.current = null;
  }

  function choose(coord: Coord) {
    if (dragged.current || disabled) return;
    onPlay(coord);
  }

  function moveFocus(coord: Coord, dx: number, dy: number) {
    const maxX = state.origin[0] + state.size - 1;
    const maxY = state.origin[1] + state.size - 1;
    const next: Coord = [
      Math.min(maxX, Math.max(state.origin[0], coord[0] + dx)),
      Math.min(maxY, Math.max(state.origin[1], coord[1] + dy)),
    ];
    setFocusCoord(next);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-gomoku-key="${coordKey(next)}"]`)?.focus({ preventScroll: true });
    });
  }

  const line = winning.length === 5 ? (() => {
    const first = winning[0];
    const last = winning[4];
    const x1 = (first[0] - state.origin[0]) * CELL_SIZE + CELL_SIZE / 2;
    const y1 = (first[1] - state.origin[1]) * CELL_SIZE + CELL_SIZE / 2;
    const x2 = (last[0] - state.origin[0]) * CELL_SIZE + CELL_SIZE / 2;
    const y2 = (last[1] - state.origin[1]) * CELL_SIZE + CELL_SIZE / 2;
    return { left: x1, top: y1, width: Math.hypot(x2 - x1, y2 - y1), transform: `rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)` };
  })() : null;

  return (
    <div className="gomoku-board-section">
      <div className="gomoku-zoom-controls" aria-label="Điều khiển bàn cờ">
        <button type="button" onClick={() => updateZoom(zoom - 0.1)} disabled={zoom <= 0.5} aria-label="Thu nhỏ">−</button>
        <output>{Math.round(zoom * 100)}% · {state.size} × {state.size}</output>
        <button type="button" onClick={() => updateZoom(zoom + 0.1)} disabled={zoom >= 2} aria-label="Phóng to">＋</button>
      </div>
      <div
        className="gomoku-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onWheel={(event) => { event.preventDefault(); updateZoom(zoom + (event.deltaY > 0 ? -0.1 : 0.1)); }}
      >
        <div
          className="gomoku-board"
          style={{
            width: state.size * CELL_SIZE,
            height: state.size * CELL_SIZE,
            gridTemplateColumns: `repeat(${state.size}, ${CELL_SIZE}px)`,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
          role="grid"
          aria-label={`Bàn cờ caro ${state.size} nhân ${state.size}`}
        >
          {cells.map((coord) => {
            const stone = state.cells[coordKey(coord)];
            const isLatest = latest ? sameCoord(latest, coord) : false;
            const isWinning = winning.some((item) => sameCoord(item, coord));
            const column = coord[0] - state.origin[0] + 1;
            const row = coord[1] - state.origin[1] + 1;
            return (
              <button
                type="button"
                role="gridcell"
                key={coordKey(coord)}
                data-gomoku-key={coordKey(coord)}
                data-testid={isWinning ? "winning-stone" : undefined}
                tabIndex={sameCoord(focusCoord, coord) ? 0 : -1}
                className={`gomoku-cell${isLatest ? " is-latest" : ""}${isWinning ? " is-winning" : ""}${isWinning && blinking ? " is-blinking" : ""}`}
                aria-label={`Cột ${column}, hàng ${row}${stone ? `, ${playerByStone[stone].name}` : ", còn trống"}`}
                aria-disabled={disabled || Boolean(stone)}
                onClick={() => choose(coord)}
                onFocus={() => setFocusCoord(coord)}
                onKeyDown={(event) => {
                  const movements: Record<string, Coord> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
                  const movement = movements[event.key];
                  if (movement) { event.preventDefault(); moveFocus(coord, movement[0], movement[1]); }
                }}
              >
                {stone ? <span style={{ color: playerByStone[stone].color }}>{playerByStone[stone].piece}</span> : null}
              </button>
            );
          })}
          {line ? <span className="gomoku-winning-line" style={line} aria-hidden="true" /> : null}
        </div>
      </div>
      <p className="gomoku-board-hint">Cuộn hoặc chụm để thu phóng · kéo để di chuyển bàn cờ</p>
    </div>
  );
}
