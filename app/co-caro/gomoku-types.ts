export type Stone = "p1" | "p2";
export type BoardSize = 20 | 30 | 40 | 50;
export type GameMode = "local" | "computer";
export type Difficulty = "easy" | "medium" | "hard";
export type PieceTheme = "classic" | "sky" | "garden";
export type Coord = readonly [x: number, y: number];

export type Move = {
  coord: Coord;
  stone: Stone;
  playedAt: number;
};

export type WinningLine = {
  stone: Stone;
  cells: readonly Coord[];
};

export type PlayerConfig = {
  id: Stone;
  name: string;
  color: string;
  piece: string;
};

export type GomokuConfig = {
  mode: GameMode;
  difficulty?: Difficulty;
  theme: PieceTheme;
  players: readonly [PlayerConfig, PlayerConfig];
  startingPlayer: Stone;
};

export type GomokuState = {
  size: BoardSize;
  cells: Readonly<Record<string, Stone>>;
  moves: readonly Move[];
  turn: Stone;
  winner: WinningLine | null;
  draw: boolean;
};

export const BOARD_SIZES: readonly BoardSize[] = [20, 30, 40, 50];

export const PIECE_THEMES: Record<PieceTheme, readonly [string, string]> = {
  classic: ["X", "O"],
  sky: ["☀", "☾"],
  garden: ["✿", "❧"],
};

export const PLAYER_COLORS = ["#e45f4f", "#277b5a", "#4267b2", "#a14ea0"] as const;

export function otherStone(stone: Stone): Stone {
  return stone === "p1" ? "p2" : "p1";
}

export function coordKey([x, y]: Coord) {
  return `${x}:${y}`;
}

export function sameCoord(a: Coord, b: Coord) {
  return a[0] === b[0] && a[1] === b[1];
}
