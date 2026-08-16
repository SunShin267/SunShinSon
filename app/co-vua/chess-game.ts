import { Chess, type Color, type Move, type Square } from "chess.js";

export type PromotionPiece = "q" | "r" | "b" | "n";
export type ChessMoveInput = { from: Square; to: Square; promotion?: PromotionPiece };

export type ChessGame = {
  initialFen: string;
  fen: string;
  pgn: string;
  history: readonly ChessMoveInput[];
  san: readonly string[];
};

export type ChessStatus = {
  turn: Color;
  check: boolean;
  gameOver: boolean;
  result: "white" | "black" | "draw" | null;
  reason: "checkmate" | "stalemate" | "repetition" | "insufficient" | "fifty-move" | "draw" | null;
};

export function hydrateChess(game: Pick<ChessGame, "initialFen" | "history">) {
  const chess = new Chess(game.initialFen);
  for (const move of game.history) chess.move(move);
  return chess;
}

export function createChessGame(fen = new Chess().fen()): ChessGame {
  const chess = new Chess(fen);
  return { initialFen: fen, fen: chess.fen(), pgn: "", history: [], san: [] };
}

export function legalMoves(game: ChessGame, square: Square): Move[] {
  return hydrateChess(game).moves({ square, verbose: true });
}

export function makeChessMove(game: ChessGame, input: ChessMoveInput): ChessGame {
  const chess = hydrateChess(game);
  const candidates = chess.moves({ square: input.from, verbose: true }).filter((move) => move.to === input.to);
  if (candidates.some((move) => move.isPromotion()) && !input.promotion) throw new Error("PROMOTION_REQUIRED");
  const applied = chess.move(input);
  const normalized = { from: applied.from, to: applied.to, ...(applied.promotion ? { promotion: applied.promotion as PromotionPiece } : {}) };
  return {
    initialFen: game.initialFen,
    fen: chess.fen(),
    pgn: chess.pgn(),
    history: [...game.history, normalized],
    san: [...game.san, applied.san],
  };
}

export function getChessStatus(game: ChessGame): ChessStatus {
  const chess = hydrateChess(game);
  let reason: ChessStatus["reason"] = null;
  if (chess.isCheckmate()) reason = "checkmate";
  else if (chess.isStalemate()) reason = "stalemate";
  else if (chess.isThreefoldRepetition()) reason = "repetition";
  else if (chess.isInsufficientMaterial()) reason = "insufficient";
  else if (chess.isDrawByFiftyMoves()) reason = "fifty-move";
  else if (chess.isDraw()) reason = "draw";
  const gameOver = chess.isGameOver();
  return {
    turn: chess.turn(),
    check: chess.isCheck(),
    gameOver,
    result: !gameOver ? null : chess.isCheckmate() ? (chess.turn() === "w" ? "black" : "white") : "draw",
    reason,
  };
}

export function lastMove(game: ChessGame) {
  const history = hydrateChess(game).history({ verbose: true });
  return history.at(-1) ?? null;
}

export function checkedKingSquare(game: ChessGame): Square | null {
  const chess = hydrateChess(game);
  if (!chess.isCheck()) return null;
  return chess.findPiece({ type: "k", color: chess.turn() })[0] ?? null;
}

export function hasMatingMaterial(game: ChessGame, color: Color) {
  const board = hydrateChess(game).board().flat().filter((piece) => piece !== null);
  const pieces = board.filter((piece) => piece.color === color).map((piece) => piece.type);
  if (pieces.some((piece) => piece === "q" || piece === "r" || piece === "p")) return true;
  const bishops = pieces.filter((piece) => piece === "b").length;
  const knights = pieces.filter((piece) => piece === "n").length;
  if (bishops >= 2 || (bishops >= 1 && knights >= 1) || knights >= 2) return true;
  const opponentHasHelperMaterial = board.some((piece) => piece.color !== color && piece.type !== "k");
  return opponentHasHelperMaterial && bishops + knights >= 1;
}
