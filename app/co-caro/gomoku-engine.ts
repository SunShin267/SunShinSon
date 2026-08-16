import {
  coordKey,
  otherStone,
  type BoardSize,
  type Coord,
  type GomokuConfig,
  type GomokuState,
  type Move,
  type Stone,
  type WinningLine,
} from "./gomoku-types";

const AXES: readonly Coord[] = [[1, 0], [0, 1], [1, 1], [1, -1]];

export function createGomokuGame(config: Pick<GomokuConfig, "startingPlayer">): GomokuState {
  return { size: 20, origin: [0, 0], cells: {}, moves: [], turn: config.startingPlayer, winner: null, draw: false };
}

export function isInBounds(state: Pick<GomokuState, "size" | "origin">, [x, y]: Coord) {
  const [originX, originY] = state.origin;
  return Number.isInteger(x) && Number.isInteger(y)
    && x >= originX && y >= originY
    && x < originX + state.size && y < originY + state.size;
}

export function isLegalMove(state: GomokuState, coord: Coord) {
  return !state.winner && !state.draw && isInBounds(state, coord) && !state.cells[coordKey(coord)];
}

function lineFrom(state: GomokuState, origin: Coord, stone: Stone, [dx, dy]: Coord) {
  const before: Coord[] = [];
  const after: Coord[] = [];

  for (let step = 1; step < 6; step += 1) {
    const coord: Coord = [origin[0] - dx * step, origin[1] - dy * step];
    if (state.cells[coordKey(coord)] !== stone) break;
    before.unshift(coord);
  }
  for (let step = 1; step < 6; step += 1) {
    const coord: Coord = [origin[0] + dx * step, origin[1] + dy * step];
    if (state.cells[coordKey(coord)] !== stone) break;
    after.push(coord);
  }

  return [...before, origin, ...after] as readonly Coord[];
}

function findWinningLine(state: GomokuState, move: Move): WinningLine | null {
  const opponent = otherStone(move.stone);

  for (const axis of AXES) {
    const cells = lineFrom(state, move.coord, move.stone, axis);
    if (cells.length !== 5) continue;

    const first = cells[0];
    const last = cells[cells.length - 1];
    const before: Coord = [first[0] - axis[0], first[1] - axis[1]];
    const after: Coord = [last[0] + axis[0], last[1] + axis[1]];
    const blockedBefore = state.cells[coordKey(before)] === opponent;
    const blockedAfter = state.cells[coordKey(after)] === opponent;
    if (!(blockedBefore && blockedAfter)) return { stone: move.stone, cells };
  }

  return null;
}

export function playMove(state: GomokuState, coord: Coord, playedAt = Date.now()): GomokuState {
  if (!isLegalMove(state, coord)) return state;

  const move: Move = { coord: [coord[0], coord[1]], stone: state.turn, playedAt };
  const next: GomokuState = {
    ...state,
    cells: { ...state.cells, [coordKey(coord)]: state.turn },
    moves: [...state.moves, move],
    turn: otherStone(state.turn),
  };
  const winner = findWinningLine(next, move);
  return { ...next, winner, draw: !winner && next.moves.length === next.size * next.size };
}

export function undoTurn(state: GomokuState, plies = 1): GomokuState {
  const keep = Math.max(0, state.moves.length - Math.max(1, plies));
  const moves = state.moves.slice(0, keep);
  const cells: Record<string, Stone> = {};
  for (const move of moves) cells[coordKey(move.coord)] = move.stone;
  const turn = state.moves[0]?.stone ?? state.turn;
  return {
    ...state,
    cells,
    moves,
    turn: moves.length % 2 === 0 ? turn : otherStone(turn),
    winner: null,
    draw: false,
  };
}

export function replayMoves(
  config: Pick<GomokuConfig, "startingPlayer">,
  moves: readonly Move[],
  size: BoardSize = 20,
  origin: Coord = [0, 0],
) {
  let state = { ...createGomokuGame(config), size, origin };
  for (const move of moves) {
    if (state.turn !== move.stone) break;
    const next = playMove(state, move.coord, move.playedAt);
    if (next === state) break;
    state = next;
  }
  return state;
}
