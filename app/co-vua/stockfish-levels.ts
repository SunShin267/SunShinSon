export const STOCKFISH_LEVELS = {
  easy: { label: "Dễ", skill: 0, movetimeMs: 150 },
  medium: { label: "Vừa", skill: 5, movetimeMs: 500 },
  hard: { label: "Khó", skill: 10, movetimeMs: 1200 },
} as const;

export type StockfishLevel = keyof typeof STOCKFISH_LEVELS;
