import type { Square } from "chess.js";
import { readVersionedStorage, writeVersionedStorage } from "../lib/versioned-storage";
import { createChessGame, makeChessMove, type ChessGame, type ChessMoveInput, type PromotionPiece } from "./chess-game";
import type { StockfishLevel } from "./stockfish-levels";

const STORAGE_KEY = "sunshinson-chess-history";
const STORAGE_VERSION = 1;
const MAX_RECORDS = 50;

export type ChessGameRecord = {
  id: string;
  startedAt: string;
  completedAt: string;
  players: { white: string; black: string };
  mode: "local" | "computer";
  difficulty?: StockfishLevel;
  result: "white" | "black" | "draw";
  reason: string;
  clockInitialMs: number | null;
  pgn: string;
  moves: readonly ChessMoveInput[];
  san: readonly string[];
  initialFen: string;
  finalFen: string;
};

function isMove(value: unknown): value is ChessMoveInput {
  if (!value || typeof value !== "object") return false;
  const move = value as { from?: unknown; to?: unknown; promotion?: unknown };
  const square = (item: unknown) => typeof item === "string" && /^[a-h][1-8]$/.test(item);
  return square(move.from) && square(move.to) && (move.promotion === undefined || ["q", "r", "b", "n"].includes(move.promotion as PromotionPiece));
}

function isRecord(value: unknown): value is ChessGameRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ChessGameRecord>;
  const validShape = typeof record.id === "string" && typeof record.startedAt === "string" && typeof record.completedAt === "string" &&
    Boolean(record.players && typeof record.players.white === "string" && typeof record.players.black === "string") &&
    (record.mode === "local" || record.mode === "computer") && ["white", "black", "draw"].includes(record.result ?? "") &&
    typeof record.reason === "string" && (record.clockInitialMs === null || typeof record.clockInitialMs === "number") &&
    typeof record.pgn === "string" && record.pgn.length < 200_000 && Array.isArray(record.moves) && record.moves.length <= 1000 && record.moves.every(isMove) &&
    Array.isArray(record.san) && record.san.length === record.moves.length && record.san.every((move) => typeof move === "string") &&
    typeof record.initialFen === "string" && typeof record.finalFen === "string";
  if (!validShape) return false;
  const candidate = record as ChessGameRecord;

  try {
    let reconstructed = createChessGame(candidate.initialFen);
    for (const move of candidate.moves) reconstructed = makeChessMove(reconstructed, move);
    return reconstructed.fen === candidate.finalFen && reconstructed.pgn === candidate.pgn &&
      reconstructed.san.length === candidate.san.length && reconstructed.san.every((move, index) => move === candidate.san[index]);
  } catch {
    return false;
  }
}

export function loadChessHistory() {
  const values = readVersionedStorage<unknown[]>(STORAGE_KEY, STORAGE_VERSION, (value): value is unknown[] => Array.isArray(value) && value.length <= 100);
  return (values ?? []).filter(isRecord).slice(0, MAX_RECORDS);
}

export function saveChessHistory(records: readonly ChessGameRecord[]) {
  return writeVersionedStorage(STORAGE_KEY, STORAGE_VERSION, records.slice(0, MAX_RECORDS));
}

export function recordChessGame(record: ChessGameRecord) {
  const records = [record, ...loadChessHistory().filter((item) => item.id !== record.id)].slice(0, MAX_RECORDS);
  return { records, saved: saveChessHistory(records) };
}

export function deleteChessGame(id: string) {
  const records = loadChessHistory().filter((record) => record.id !== id);
  return { records, saved: saveChessHistory(records) };
}

export function clearChessHistory() {
  const records: ChessGameRecord[] = [];
  return { records, saved: saveChessHistory(records) };
}

export function replayChessPly(record: ChessGameRecord, ply: number): ChessGame | null {
  try {
    let game = createChessGame(record.initialFen);
    for (const move of record.moves.slice(0, Math.max(0, Math.min(ply, record.moves.length)))) game = makeChessMove(game, move);
    return game;
  } catch {
    return null;
  }
}

export function uciMove(value: string): ChessMoveInput | null {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(value);
  return match ? { from: match[1] as Square, to: match[2] as Square, ...(match[3] ? { promotion: match[3] as PromotionPiece } : {}) } : null;
}
