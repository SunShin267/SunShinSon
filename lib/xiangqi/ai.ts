import { isInCheck, legalMoves, positionKey } from "./rules";
import {
  coordKey,
  otherSide,
  sameCoord,
  type AiOptions,
  type Difficulty,
  type Move,
  type MoveRecord,
  type Piece,
  type PieceRole,
  type PublicXiangqiState,
  type Side,
} from "./types";

const PIECE_VALUES: Readonly<Record<PieceRole, number>> = {
  general: 100_000,
  advisor: 220,
  elephant: 220,
  horse: 410,
  rook: 900,
  cannon: 460,
  soldier: 110,
};

const BLIND_POOL: Readonly<Record<Exclude<PieceRole, "general">, number>> = {
  advisor: 2,
  elephant: 2,
  horse: 2,
  rook: 2,
  cannon: 2,
  soldier: 5,
};

const SEARCH_LIMITS: Readonly<Record<Difficulty, { budgetMs: number; depth: number; branches: number }>> = {
  easy: { budgetMs: 90, depth: 1, branches: 10 },
  medium: { budgetMs: 320, depth: 2, branches: 12 },
  hard: { budgetMs: 950, depth: 3, branches: 16 },
};

type RoleCounts = Record<Exclude<PieceRole, "general">, number>;
type Hypothesis = Readonly<Record<string, PieceRole>>;
type SearchContext = {
  root: Side;
  deadline: number;
  signal?: AbortSignal;
  branches: number;
  hypothesis: Hypothesis;
};

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Computer move cancelled", "AbortError");
}

function assertWithinBudget(context: Pick<SearchContext, "deadline" | "signal">): void {
  assertActive(context.signal);
  if (now() >= context.deadline) throw new DOMException("Computer search deadline", "TimeoutError");
}

function roleCountsFor(state: PublicXiangqiState, side: Side): RoleCounts {
  const counts: RoleCounts = { ...BLIND_POOL };
  const known = new Map<string, PieceRole>();
  for (const move of state.moves) {
    if (move.side === side && move.revealedRole) known.set(move.pieceId, move.revealedRole);
  }
  for (const piece of Object.values(state.board)) {
    if (piece.side === side && piece.revealed && piece.role && piece.role !== "general") {
      known.set(piece.id, piece.role);
    }
  }
  for (const role of known.values()) counts[role as Exclude<PieceRole, "general">] = Math.max(0, counts[role as Exclude<PieceRole, "general">] - 1);
  return counts;
}

function roleBag(state: PublicXiangqiState, side: Side): PieceRole[] {
  const counts = roleCountsFor(state, side);
  return (Object.entries(counts) as [Exclude<PieceRole, "general">, number][])
    .flatMap(([role, count]) => Array.from({ length: count }, () => role));
}

function expectedValue(state: PublicXiangqiState, side: Side): number {
  const bag = roleBag(state, side);
  if (!bag.length) return PIECE_VALUES.soldier;
  return bag.reduce((sum, role) => sum + PIECE_VALUES[role], 0) / bag.length;
}

function representativeRole(state: PublicXiangqiState, side: Side): PieceRole {
  const bag = roleBag(state, side);
  if (!bag.length) return "soldier";
  const average = bag.reduce((sum, role) => sum + PIECE_VALUES[role], 0) / bag.length;
  return bag.reduce((best, role) => (
    Math.abs(PIECE_VALUES[role] - average) < Math.abs(PIECE_VALUES[best] - average) ? role : best
  ), bag[0]);
}

function pieceValue(state: PublicXiangqiState, piece: Piece): number {
  return piece.revealed && piece.role ? PIECE_VALUES[piece.role] : expectedValue(state, piece.side);
}

function positionalBonus(piece: Piece, x: number, y: number): number {
  const role = piece.revealed ? piece.role : piece.coverRole;
  const center = Math.max(0, 4 - Math.abs(4 - x));
  if (role === "soldier") {
    const advancement = piece.side === "red" ? 9 - y : y;
    return advancement * 8 + center * 2;
  }
  if (role === "horse" || role === "cannon") return center * 6;
  if (role === "rook") return center * 2;
  return 0;
}

function evaluate(state: PublicXiangqiState, root: Side): number {
  let score = 0;
  for (const [key, piece] of Object.entries(state.board)) {
    const [x, y] = key.split(",").map(Number);
    const value = pieceValue(state, piece) + positionalBonus(piece, x, y);
    score += piece.side === root ? value : -value;
  }
  if (isInCheck(state, root)) score -= 85;
  if (isInCheck(state, otherSide(root))) score += 85;
  const mobility = legalMoves(state).length;
  score += state.turn === root ? mobility * 1.5 : -mobility * 1.5;
  return score;
}

function hypothesizedRole(state: PublicXiangqiState, piece: Piece, hypothesis: Hypothesis): PieceRole {
  return hypothesis[piece.id] ?? representativeRole(state, piece.side);
}

function simulateMove(state: PublicXiangqiState, move: Move, hypothesis: Hypothesis): PublicXiangqiState {
  const sourceKey = coordKey(move.from);
  const targetKey = coordKey(move.to);
  const movingPiece = state.board[sourceKey];
  if (!movingPiece) throw new Error("AI simulation source is empty");
  const capturedPiece = state.board[targetKey];
  const revealedRole = !movingPiece.revealed ? hypothesizedRole(state, movingPiece, hypothesis) : undefined;
  const movedPiece: Piece = revealedRole
    ? { ...movingPiece, role: revealedRole, revealed: true }
    : movingPiece;
  const board = { ...state.board, [targetKey]: movedPiece };
  delete board[sourceKey];
  const record: MoveRecord = {
    from: move.from,
    to: move.to,
    side: state.turn,
    pieceId: movingPiece.id,
    ...(capturedPiece ? { capturedPieceId: capturedPiece.id } : {}),
    ...(capturedPiece?.revealed && capturedPiece.role ? { capturedRole: capturedPiece.role } : {}),
    ...(revealedRole ? { revealedRole } : {}),
  };
  const next: PublicXiangqiState = {
    ...state,
    board,
    turn: otherSide(state.turn),
    moves: [...state.moves, record],
  };
  const key = positionKey(next);
  return { ...next, positionCounts: { ...state.positionCounts, [key]: (state.positionCounts[key] ?? 0) + 1 } };
}

function captureValue(state: PublicXiangqiState, move: Move): number {
  const target = state.board[coordKey(move.to)];
  return target ? pieceValue(state, target) : 0;
}

function orderedMoves(state: PublicXiangqiState, hypothesis: Hypothesis): Move[] {
  return legalMoves(state)
    .map((move) => {
      const child = simulateMove(state, move, hypothesis);
      const checkBonus = isInCheck(child, child.turn) ? 180 : 0;
      const centerBonus = 4 - Math.abs(4 - move.to[0]);
      return { move, score: captureValue(state, move) * 10 + checkBonus + centerBonus };
    })
    .sort((left, right) => right.score - left.score)
    .map(({ move }) => move);
}

function terminalScore(state: PublicXiangqiState, root: Side, depth: number): number | null {
  if ((state.positionCounts[positionKey(state)] ?? 0) >= 3) return 0;
  const moves = legalMoves(state);
  if (moves.length) return null;
  return state.turn === root ? -1_000_000 - depth : 1_000_000 + depth;
}

function alphaBeta(
  state: PublicXiangqiState,
  depth: number,
  alpha: number,
  beta: number,
  context: SearchContext,
): number {
  assertWithinBudget(context);
  const terminal = terminalScore(state, context.root, depth);
  if (terminal !== null) return terminal;
  if (depth === 0) return evaluate(state, context.root);

  const maximizing = state.turn === context.root;
  let value = maximizing ? -Infinity : Infinity;
  const moves = orderedMoves(state, context.hypothesis).slice(0, context.branches);
  for (const move of moves) {
    const child = simulateMove(state, move, context.hypothesis);
    const score = alphaBeta(child, depth - 1, alpha, beta, context);
    if (maximizing) {
      value = Math.max(value, score);
      alpha = Math.max(alpha, score);
    } else {
      value = Math.min(value, score);
      beta = Math.min(beta, score);
    }
    if (alpha >= beta) break;
  }
  return Number.isFinite(value) ? value : evaluate(state, context.root);
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomValue = Math.min(0.999999999, Math.max(0, random()));
    const swapIndex = Math.floor(randomValue * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function sampleHypothesis(state: PublicXiangqiState, random: () => number): Hypothesis {
  const hypothesis: Record<string, PieceRole> = {};
  for (const side of ["red", "black"] as const) {
    const hidden = Object.values(state.board).filter((piece) => piece.side === side && !piece.revealed);
    const bag = shuffle(roleBag(state, side), random);
    hidden.forEach((piece, index) => {
      hypothesis[piece.id] = bag[index] ?? representativeRole(state, side);
    });
  }
  return hypothesis;
}

function scoreMove(
  state: PublicXiangqiState,
  move: Move,
  depth: number,
  context: SearchContext,
): number {
  const child = simulateMove(state, move, context.hypothesis);
  const terminal = terminalScore(child, context.root, depth);
  if (terminal !== null) return terminal;
  return alphaBeta(child, Math.max(0, depth - 1), -Infinity, Infinity, context);
}

function expectedBlindMoveScore(
  state: PublicXiangqiState,
  move: Move,
  depth: number,
  baseContext: SearchContext,
): number {
  const piece = state.board[coordKey(move.from)];
  if (!piece || piece.revealed) return scoreMove(state, move, depth, baseContext);
  const counts = roleCountsFor(state, piece.side);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (!total) return scoreMove(state, move, depth, baseContext);

  let weighted = 0;
  for (const [role, count] of Object.entries(counts) as [Exclude<PieceRole, "general">, number][]) {
    if (!count) continue;
    assertWithinBudget(baseContext);
    const context = { ...baseContext, hypothesis: { ...baseContext.hypothesis, [piece.id]: role } };
    weighted += scoreMove(state, move, depth, context) * count;
  }
  return weighted / total;
}

function containsMove(moves: readonly Move[], candidate: Move): boolean {
  return moves.some((move) => sameCoord(move.from, candidate.from) && sameCoord(move.to, candidate.to));
}

export async function chooseComputerMove(
  state: PublicXiangqiState,
  difficulty: Difficulty,
  options: AiOptions = {},
): Promise<Move> {
  if (!(difficulty in SEARCH_LIMITS)) throw new Error("Unknown Xiangqi AI difficulty");
  assertActive(options.signal);
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
  assertActive(options.signal);

  const limits = SEARCH_LIMITS[difficulty];
  const requestedBudget = options.budgetMs ?? limits.budgetMs;
  const budgetMs = Math.max(16, Math.min(limits.budgetMs, requestedBudget));
  const deadline = now() + budgetMs;
  const random = options.random ?? Math.random;
  const root = state.turn;
  const initialContext: SearchContext = {
    root,
    deadline,
    signal: options.signal,
    branches: limits.branches,
    hypothesis: {},
  };
  const moves = orderedMoves(state, initialContext.hypothesis);
  if (!moves.length) throw new Error("No legal computer move is available");

  if (difficulty === "easy") {
    const pool = moves.slice(0, Math.min(8, moves.length));
    const randomValue = Math.min(0.999999999, Math.max(0, random()));
    return pool[Math.floor(randomValue * pool.length)] ?? moves[0];
  }

  const scores = new Map<Move, number>(moves.map((move) => [move, 0]));
  const evaluations = new Map<Move, number>(moves.map((move) => [move, 0]));
  try {
    if (state.variant === "blind" && difficulty === "hard") {
      for (let sample = 0; sample < 16; sample += 1) {
        assertWithinBudget(initialContext);
        const context = { ...initialContext, hypothesis: sampleHypothesis(state, random) };
        let evaluated = 0;
        for (const move of moves.slice(0, limits.branches)) {
          assertWithinBudget(context);
          scores.set(move, (scores.get(move) ?? 0) + scoreMove(state, move, 2, context));
          evaluations.set(move, (evaluations.get(move) ?? 0) + 1);
          evaluated += 1;
        }
        if (evaluated === 0) break;
      }
    } else {
      let evaluated = 0;
      for (const move of moves.slice(0, limits.branches)) {
        assertWithinBudget(initialContext);
        const score = state.variant === "blind"
          ? expectedBlindMoveScore(state, move, limits.depth, initialContext)
          : scoreMove(state, move, limits.depth, initialContext);
        scores.set(move, score);
        evaluations.set(move, 1);
        evaluated += 1;
      }
      if (evaluated === 0) scores.set(moves[0], 0);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    if (!(error instanceof DOMException) || error.name !== "TimeoutError") throw error;
  }

  const averageScore = (move: Move) => {
    const count = evaluations.get(move) ?? 0;
    return count > 0 ? (scores.get(move) ?? 0) / count : -Infinity;
  };
  const choice = moves.reduce((best, move) => averageScore(move) > averageScore(best) ? move : best, moves[0]);
  assertActive(options.signal);
  if (!containsMove(legalMoves(state), choice)) throw new Error("Computer selected an illegal Xiangqi move");
  return choice;
}
