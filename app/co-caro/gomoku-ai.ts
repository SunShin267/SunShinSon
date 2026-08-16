import { isLegalMove, playMove } from "./gomoku-engine";
import { coordKey, otherStone, type Coord, type Difficulty, type GomokuState, type Stone } from "./gomoku-types";

type AiOptions = {
  signal?: AbortSignal;
  random?: () => number;
  budgetMs?: number;
};

type ScoredMove = { coord: Coord; score: number };

function assertActive(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Computer move cancelled", "AbortError");
}

function nearbyCandidates(state: GomokuState) {
  if (!state.moves.length) {
    const center = Math.floor(state.size / 2);
    return [[center, center] as Coord];
  }

  const keys = new Set<string>();
  const candidates: Coord[] = [];
  for (const move of state.moves) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const coord: Coord = [move.coord[0] + dx, move.coord[1] + dy];
        const key = coordKey(coord);
        if (!keys.has(key) && isLegalMove(state, coord)) {
          keys.add(key);
          candidates.push(coord);
        }
      }
    }
  }
  return candidates;
}

function stateForStone(state: GomokuState, stone: Stone): GomokuState {
  return { ...state, turn: stone, winner: null, draw: false };
}

function isWinningMove(state: GomokuState, coord: Coord, stone: Stone) {
  return Boolean(playMove(stateForStone(state, stone), coord, 0).winner);
}

function directionalPotential(state: GomokuState, coord: Coord, stone: Stone) {
  const axes: readonly Coord[] = [[1, 0], [0, 1], [1, 1], [1, -1]];
  let score = 0;
  for (const [dx, dy] of axes) {
    let chain = 1;
    let open = 0;
    for (const direction of [-1, 1]) {
      for (let step = 1; step <= 4; step += 1) {
        const target: Coord = [coord[0] + dx * step * direction, coord[1] + dy * step * direction];
        const occupant = state.cells[coordKey(target)];
        if (occupant === stone) chain += 1;
        else {
          if (!occupant) open += 1;
          break;
        }
      }
    }
    score += chain * chain * 12 + open * 3;
  }
  return score;
}

function rankCandidates(state: GomokuState, stone: Stone) {
  const opponent = otherStone(stone);
  return nearbyCandidates(state)
    .map((coord): ScoredMove => {
      if (isWinningMove(state, coord, stone)) return { coord, score: 1_000_000 };
      if (isWinningMove(state, coord, opponent)) return { coord, score: 500_000 };
      const attack = directionalPotential(state, coord, stone);
      const defense = directionalPotential(state, coord, opponent);
      const center = (state.size - 1) / 2;
      const distance = Math.abs(coord[0] - center) + Math.abs(coord[1] - center);
      return { coord, score: attack + defense * 0.88 - distance * 0.05 };
    })
    .sort((a, b) => b.score - a.score);
}

function terminalScore(state: GomokuState, computer: Stone, depth: number) {
  if (!state.winner) return 0;
  return state.winner.stone === computer ? 10_000_000 + depth : -10_000_000 - depth;
}

function negamax(
  state: GomokuState,
  computer: Stone,
  depth: number,
  alpha: number,
  beta: number,
  deadline: number,
  signal?: AbortSignal,
): number {
  assertActive(signal);
  if (performance.now() >= deadline) throw new DOMException("Computer search deadline", "TimeoutError");
  if (state.winner || state.draw) return terminalScore(state, computer, depth);
  if (depth === 0) {
    const best = rankCandidates(state, computer)[0]?.score ?? 0;
    const threat = rankCandidates(state, otherStone(computer))[0]?.score ?? 0;
    return best - threat * 0.92;
  }

  let value = -Infinity;
  const candidates = rankCandidates(state, state.turn).slice(0, depth >= 2 ? 8 : 10);
  for (const candidate of candidates) {
    const child = playMove(state, candidate.coord, 0);
    const score = -negamax(child, computer, depth - 1, -beta, -alpha, deadline, signal);
    value = Math.max(value, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  return Number.isFinite(value) ? value : 0;
}

export async function chooseComputerMove(
  state: GomokuState,
  level: Difficulty,
  options: AiOptions = {},
): Promise<Coord> {
  const { signal, random = Math.random } = options;
  assertActive(signal);
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
  assertActive(signal);

  const ranked = rankCandidates(state, state.turn);
  if (!ranked.length) throw new Error("No legal computer move is available");
  const immediateWin = ranked.find((move) => move.score >= 1_000_000);
  const immediateBlock = ranked.find((move) => move.score >= 500_000);

  let choice: Coord;
  if (level === "easy") {
    const pool = ranked.slice(0, Math.min(10, ranked.length));
    const tactical = random() < 0.45 ? immediateWin ?? immediateBlock : undefined;
    choice = tactical?.coord ?? pool[Math.floor(random() * pool.length)]?.coord ?? ranked[0].coord;
  } else if (immediateWin || immediateBlock) {
    choice = (immediateWin ?? immediateBlock)!.coord;
  } else if (level === "medium") {
    choice = ranked.slice(0, Math.min(4, ranked.length))[Math.floor(random() * Math.min(4, ranked.length))].coord;
  } else {
    const deadline = performance.now() + Math.min(900, Math.max(120, options.budgetMs ?? 700));
    let best = ranked[0];
    for (const candidate of ranked.slice(0, 12)) {
      assertActive(signal);
      if (performance.now() >= deadline) break;
      try {
        const stateAfterMove = playMove(state, candidate.coord, 0);
        const score = -negamax(stateAfterMove, state.turn, 2, -Infinity, Infinity, deadline, signal);
        if (score > best.score) best = { coord: candidate.coord, score };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        break;
      }
    }
    choice = best.coord;
  }

  assertActive(signal);
  if (!isLegalMove(state, choice)) throw new Error("Computer selected an illegal move");
  return choice;
}
