import { readVersionedStorage, removeVersionedStorage, writeVersionedStorage } from "../lib/versioned-storage";
import type {
  BoardSize,
  Coord,
  Difficulty,
  GameMode,
  GomokuConfig,
  Move,
  PlayerConfig,
  Stone,
} from "./gomoku-types";

export const GOMOKU_HISTORY_KEY = "sunshinson-gomoku-history";
export const GOMOKU_HISTORY_VERSION = 1;
const MAX_RECORDS = 50;

export type GomokuGameRecord = {
  id: string;
  completedAt: string;
  mode: GameMode;
  difficulty?: Difficulty;
  players: readonly [PlayerConfig, PlayerConfig];
  startingPlayer: Stone;
  result: Stone | "draw";
  size: BoardSize;
  moves: readonly Move[];
  winningCells: readonly Coord[];
};

export type PairPlayerStats = {
  name: string;
  wins: number;
  losses: number;
  currentWinStreak: number;
  bestWinStreak: number;
};

export type PairStats = {
  pairKey: string;
  games: number;
  draws: number;
  players: readonly [PairPlayerStats, PairPlayerStats];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isCoord(value: unknown): value is Coord {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isInteger);
}

function isPlayer(value: unknown): value is PlayerConfig {
  return isObject(value)
    && (value.id === "p1" || value.id === "p2")
    && typeof value.name === "string"
    && typeof value.color === "string"
    && typeof value.piece === "string";
}

function isMove(value: unknown): value is Move {
  return isObject(value)
    && isCoord(value.coord)
    && (value.stone === "p1" || value.stone === "p2")
    && typeof value.playedAt === "number";
}

function isRecord(value: unknown): value is GomokuGameRecord {
  if (!isObject(value)) return false;
  return typeof value.id === "string"
    && typeof value.completedAt === "string"
    && (value.mode === "local" || value.mode === "computer")
    && (value.difficulty === undefined || value.difficulty === "easy" || value.difficulty === "medium" || value.difficulty === "hard")
    && Array.isArray(value.players) && value.players.length === 2 && value.players.every(isPlayer)
    && (value.startingPlayer === "p1" || value.startingPlayer === "p2")
    && (value.result === "p1" || value.result === "p2" || value.result === "draw")
    && (value.size === 20 || value.size === 30 || value.size === 40 || value.size === 50)
    && Array.isArray(value.moves) && value.moves.every(isMove)
    && Array.isArray(value.winningCells) && value.winningCells.every(isCoord);
}

function isHistory(value: unknown): value is readonly GomokuGameRecord[] {
  return Array.isArray(value) && value.every(isRecord);
}

export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").normalize("NFKC").toLocaleLowerCase("vi");
}

function compareNormalizedNames(a: string, b: string) {
  const baseOrder = a.localeCompare(b, "vi", { sensitivity: "base" });
  if (baseOrder !== 0) return baseOrder;
  return a === b ? 0 : a < b ? -1 : 1;
}

export function normalizePair(first: string, second: string) {
  return [normalizeName(first), normalizeName(second)]
    .sort(compareNormalizedNames)
    .join("::");
}

export function loadGomokuHistory() {
  return [...(readVersionedStorage(GOMOKU_HISTORY_KEY, GOMOKU_HISTORY_VERSION, isHistory) ?? [])]
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, MAX_RECORDS);
}

export function saveGomokuHistory(records: readonly GomokuGameRecord[]) {
  const newest = [...records]
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, MAX_RECORDS);
  return writeVersionedStorage(GOMOKU_HISTORY_KEY, GOMOKU_HISTORY_VERSION, newest);
}

export function recordCompletedGame(record: GomokuGameRecord) {
  const records = [record, ...loadGomokuHistory().filter((item) => item.id !== record.id)].slice(0, MAX_RECORDS);
  saveGomokuHistory(records);
  return records;
}

export function deleteCompletedGame(id: string) {
  const records = loadGomokuHistory().filter((record) => record.id !== id);
  saveGomokuHistory(records);
  return records;
}

export function clearGomokuHistory() {
  removeVersionedStorage(GOMOKU_HISTORY_KEY);
  return [] as GomokuGameRecord[];
}

export function createCompletedRecord(
  config: GomokuConfig,
  state: { size: BoardSize; moves: readonly Move[]; winner: { stone: Stone; cells: readonly Coord[] } | null; draw: boolean },
): GomokuGameRecord {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    completedAt: new Date().toISOString(),
    mode: config.mode,
    difficulty: config.mode === "computer" ? config.difficulty : undefined,
    players: config.players,
    startingPlayer: config.startingPlayer,
    result: state.winner?.stone ?? "draw",
    size: state.size,
    moves: state.moves,
    winningCells: state.winner?.cells ?? [],
  };
}

export function getPairStats(records: readonly GomokuGameRecord[], first: string, second: string): PairStats {
  const pairKey = normalizePair(first, second);
  const normalizedNames = pairKey.split("::") as [string, string];
  const stats: [PairPlayerStats, PairPlayerStats] = normalizedNames.map((name) => ({
    name,
    wins: 0,
    losses: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
  })) as [PairPlayerStats, PairPlayerStats];
  let draws = 0;

  const matching = records
    .filter((record) => record.mode === "local" && normalizePair(record.players[0].name, record.players[1].name) === pairKey)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  function statIndexFor(player: PlayerConfig): 0 | 1 {
    const playerName = normalizeName(player.name);
    if (normalizedNames[0] === normalizedNames[1]) return player.id === "p1" ? 0 : 1;
    return playerName === normalizedNames[0] ? 0 : 1;
  }

  for (const record of matching) {
    if (record.result === "draw") {
      draws += 1;
      stats[0].currentWinStreak = 0;
      stats[1].currentWinStreak = 0;
      continue;
    }
    const winner = record.players.find((player) => player.id === record.result);
    if (!winner) continue;
    const winnerIndex = statIndexFor(winner);
    const loserIndex = winnerIndex === 0 ? 1 : 0;
    stats[winnerIndex].wins += 1;
    stats[winnerIndex].currentWinStreak += 1;
    stats[winnerIndex].bestWinStreak = Math.max(stats[winnerIndex].bestWinStreak, stats[winnerIndex].currentWinStreak);
    stats[loserIndex].losses += 1;
    stats[loserIndex].currentWinStreak = 0;
  }

  return { pairKey, games: matching.length, draws, players: stats };
}
