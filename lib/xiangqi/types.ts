export const BOARD_WIDTH = 9;
export const BOARD_HEIGHT = 10;

export type Coord = readonly [x: number, y: number];
export type Side = "red" | "black";
export type PieceRole = "general" | "advisor" | "elephant" | "horse" | "rook" | "cannon" | "soldier";
export type XiangqiVariant = "bright" | "blind";
export type Difficulty = "easy" | "medium" | "hard";

export type Piece = {
  id: string;
  side: Side;
  /** Hidden blind pieces keep their identity exclusively in XiangqiState.concealedPieces. */
  role: PieceRole | null;
  /** The starting-square role used by an unrevealed blind piece for its first move. */
  coverRole: PieceRole | null;
  revealed: boolean;
};

export type Move = {
  from: Coord;
  to: Coord;
};

export type MoveRecord = Move & {
  side: Side;
  pieceId: string;
  capturedPieceId?: string;
  capturedRole?: PieceRole;
  revealedRole?: PieceRole;
};

export type StoredOutcome =
  | { kind: "timeout" | "resignation"; winner: Side }
  | { kind: "draw-agreed"; winner: null };

type SharedXiangqiState = {
  version: 1;
  variant: XiangqiVariant;
  board: Readonly<Record<string, Piece>>;
  turn: Side;
  moves: readonly MoveRecord[];
  /** Counts stable public board positions, including the side to move. */
  positionCounts: Readonly<Record<string, number>>;
  /** Set by the clock/command layer for terminal events that are not board-derived. */
  outcome: StoredOutcome | null;
};

/** Authoritative, serializable state. Never send this shape directly to a blind-game client. */
export type XiangqiState = SharedXiangqiState & {
  seed: string;
  concealedPieces: Readonly<Record<string, PieceRole>>;
};

/** Safe client/AI state. It intentionally omits both the concealed mapping and its seed. */
export type PublicXiangqiState = SharedXiangqiState;

export type GameStatus =
  | { kind: "active"; winner: null; inCheck: boolean }
  | { kind: "checkmate" | "no-legal-move"; winner: Side; inCheck: boolean }
  | { kind: "repetition" | "draw-agreed"; winner: null; inCheck: boolean }
  | { kind: "timeout" | "resignation"; winner: Side; inCheck: boolean };

export type AiOptions = {
  signal?: AbortSignal;
  random?: () => number;
  budgetMs?: number;
};

export function otherSide(side: Side): Side {
  return side === "red" ? "black" : "red";
}

export function coordKey([x, y]: Coord): string {
  return `${x},${y}`;
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export function isBoardCoord(value: unknown): value is Coord {
  return Array.isArray(value)
    && value.length === 2
    && Number.isInteger(value[0])
    && Number.isInteger(value[1])
    && value[0] >= 0
    && value[0] < BOARD_WIDTH
    && value[1] >= 0
    && value[1] < BOARD_HEIGHT;
}
