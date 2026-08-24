import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  coordKey,
  isBoardCoord,
  otherSide,
  sameCoord,
  type Coord,
  type GameStatus,
  type Move,
  type MoveRecord,
  type Piece,
  type PieceRole,
  type PublicXiangqiState,
  type Side,
  type StoredOutcome,
  type XiangqiState,
  type XiangqiVariant,
} from "./types";

type ReadableState = XiangqiState | PublicXiangqiState;

const SIDES: readonly Side[] = ["red", "black"];
const ROLES: readonly PieceRole[] = ["general", "advisor", "elephant", "horse", "rook", "cannon", "soldier"];
const NON_GENERAL_ROLES: readonly PieceRole[] = ["advisor", "advisor", "elephant", "elephant", "horse", "horse", "rook", "rook", "cannon", "cannon", "soldier", "soldier", "soldier", "soldier", "soldier"];

type StartingPiece = { coord: Coord; role: PieceRole };

const BLACK_START: readonly StartingPiece[] = [
  { coord: [0, 0], role: "rook" },
  { coord: [1, 0], role: "horse" },
  { coord: [2, 0], role: "elephant" },
  { coord: [3, 0], role: "advisor" },
  { coord: [4, 0], role: "general" },
  { coord: [5, 0], role: "advisor" },
  { coord: [6, 0], role: "elephant" },
  { coord: [7, 0], role: "horse" },
  { coord: [8, 0], role: "rook" },
  { coord: [1, 2], role: "cannon" },
  { coord: [7, 2], role: "cannon" },
  { coord: [0, 3], role: "soldier" },
  { coord: [2, 3], role: "soldier" },
  { coord: [4, 3], role: "soldier" },
  { coord: [6, 3], role: "soldier" },
  { coord: [8, 3], role: "soldier" },
];

const RED_START: readonly StartingPiece[] = BLACK_START.map(({ coord: [x, y], role }) => ({
  coord: [x, BOARD_HEIGHT - 1 - y] as Coord,
  role,
}));

function isRole(value: unknown): value is PieceRole {
  return typeof value === "string" && ROLES.includes(value as PieceRole);
}

function isSide(value: unknown): value is Side {
  return value === "red" || value === "black";
}

function isVariant(value: unknown): value is XiangqiVariant {
  return value === "bright" || value === "blind";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function seedText(seed: string | number): string {
  if (typeof seed === "number" && !Number.isFinite(seed)) throw new Error("Xiangqi seed must be finite");
  return String(seed);
}

function seededRandom(seed: string): () => number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function positionKey(state: Pick<ReadableState, "variant" | "board" | "turn">): string {
  const pieces = Object.entries(state.board)
    .sort(([left], [right]) => {
      const [leftX, leftY] = left.split(",").map(Number);
      const [rightX, rightY] = right.split(",").map(Number);
      return leftY - rightY || leftX - rightX;
    })
    .map(([square, piece]) => [
      square,
      piece.side,
      piece.revealed ? piece.role : "hidden",
      piece.coverRole ?? "none",
      piece.revealed ? "1" : "0",
    ].join(":"));
  return `${state.variant}|${state.turn}|${pieces.join("|")}`;
}

export function createGame(variant: XiangqiVariant, seed: string | number): XiangqiState {
  if (!isVariant(variant)) throw new Error("Unknown Xiangqi variant");
  const normalizedSeed = seedText(seed);
  const random = seededRandom(normalizedSeed);
  const board: Record<string, Piece> = {};
  const concealedPieces: Record<string, PieceRole> = {};

  for (const side of SIDES) {
    const startingPieces = side === "red" ? RED_START : BLACK_START;
    const hiddenRoles = shuffled(NON_GENERAL_ROLES, random);
    let hiddenIndex = 0;
    for (const { coord, role: startingRole } of startingPieces) {
      const id = `${side}-${coord[0]}-${coord[1]}`;
      const blindAndHidden = variant === "blind" && startingRole !== "general";
      const piece: Piece = {
        id,
        side,
        role: blindAndHidden ? null : startingRole,
        coverRole: variant === "blind" ? startingRole : null,
        revealed: !blindAndHidden,
      };
      board[coordKey(coord)] = piece;
      if (blindAndHidden) {
        concealedPieces[id] = hiddenRoles[hiddenIndex];
        hiddenIndex += 1;
      }
    }
  }

  const state: XiangqiState = {
    version: 1,
    variant,
    seed: normalizedSeed,
    board,
    turn: "red",
    moves: [],
    concealedPieces,
    positionCounts: {},
    outcome: null,
  };
  return { ...state, positionCounts: { [positionKey(state)]: 1 } };
}

function insideBoard([x, y]: Coord): boolean {
  return x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT;
}

function inPalace(side: Side, [x, y]: Coord): boolean {
  return x >= 3 && x <= 5 && (side === "red" ? y >= 7 && y <= 9 : y >= 0 && y <= 2);
}

function crossedRiver(side: Side, y: number): boolean {
  return side === "red" ? y <= 4 : y >= 5;
}

function effectiveRole(piece: Piece): PieceRole | null {
  return piece.revealed ? piece.role : piece.coverRole;
}

function addDestination(state: ReadableState, piece: Piece, coord: Coord, result: Coord[]): boolean {
  if (!insideBoard(coord)) return false;
  const occupant = state.board[coordKey(coord)];
  if (!occupant) {
    result.push(coord);
    return true;
  }
  if (occupant.side !== piece.side) result.push(coord);
  return false;
}

function slidingDestinations(state: ReadableState, from: Coord, piece: Piece, cannon: boolean): Coord[] {
  const result: Coord[] = [];
  const directions: readonly Coord[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of directions) {
    let screenFound = false;
    for (let step = 1; step < BOARD_HEIGHT; step += 1) {
      const target: Coord = [from[0] + dx * step, from[1] + dy * step];
      if (!insideBoard(target)) break;
      const occupant = state.board[coordKey(target)];
      if (!cannon) {
        if (!addDestination(state, piece, target, result)) break;
        continue;
      }
      if (!screenFound) {
        if (occupant) screenFound = true;
        else result.push(target);
      } else if (occupant) {
        if (occupant.side !== piece.side) result.push(target);
        break;
      }
    }
  }
  return result;
}

function pseudoDestinations(state: ReadableState, from: Coord, piece: Piece): Coord[] {
  const role = effectiveRole(piece);
  if (!role) return [];
  if (role === "rook" || role === "cannon") return slidingDestinations(state, from, piece, role === "cannon");

  const result: Coord[] = [];
  if (role === "general") {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const target: Coord = [from[0] + dx, from[1] + dy];
      if (inPalace(piece.side, target)) addDestination(state, piece, target, result);
    }
    for (const dy of [-1, 1]) {
      for (let y = from[1] + dy; y >= 0 && y < BOARD_HEIGHT; y += dy) {
        const target: Coord = [from[0], y];
        const occupant = state.board[coordKey(target)];
        if (!occupant) continue;
        if (occupant.side !== piece.side && occupant.role === "general") result.push(target);
        break;
      }
    }
    return result;
  }

  if (role === "advisor") {
    const palaceRestricted = state.variant === "bright" || !piece.revealed;
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const target: Coord = [from[0] + dx, from[1] + dy];
      if ((!palaceRestricted || inPalace(piece.side, target)) && insideBoard(target)) {
        addDestination(state, piece, target, result);
      }
    }
    return result;
  }

  if (role === "elephant") {
    const riverRestricted = state.variant === "bright" || !piece.revealed;
    for (const [dx, dy] of [[2, 2], [2, -2], [-2, 2], [-2, -2]] as const) {
      const target: Coord = [from[0] + dx, from[1] + dy];
      const eye: Coord = [from[0] + dx / 2, from[1] + dy / 2];
      const onOwnSide = piece.side === "red" ? target[1] >= 5 : target[1] <= 4;
      if (insideBoard(target) && (!riverRestricted || onOwnSide) && !state.board[coordKey(eye)]) {
        addDestination(state, piece, target, result);
      }
    }
    return result;
  }

  if (role === "horse") {
    const jumps = [
      [2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0],
      [1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1],
    ] as const;
    for (const [dx, dy, legX, legY] of jumps) {
      const leg: Coord = [from[0] + legX, from[1] + legY];
      const target: Coord = [from[0] + dx, from[1] + dy];
      if (!state.board[coordKey(leg)]) addDestination(state, piece, target, result);
    }
    return result;
  }

  const forward = piece.side === "red" ? -1 : 1;
  addDestination(state, piece, [from[0], from[1] + forward], result);
  if (crossedRiver(piece.side, from[1])) {
    addDestination(state, piece, [from[0] - 1, from[1]], result);
    addDestination(state, piece, [from[0] + 1, from[1]], result);
  }
  return result;
}

function boardAfterMove(state: ReadableState, move: Move, revealRole?: PieceRole): Record<string, Piece> {
  const sourceKey = coordKey(move.from);
  const targetKey = coordKey(move.to);
  const movingPiece = state.board[sourceKey];
  if (!movingPiece) return { ...state.board };
  const movedPiece = revealRole && !movingPiece.revealed
    ? { ...movingPiece, role: revealRole, revealed: true }
    : movingPiece;
  const board = { ...state.board, [targetKey]: movedPiece };
  delete board[sourceKey];
  return board;
}

function generalCoord(state: ReadableState, side: Side): Coord | null {
  for (const [key, piece] of Object.entries(state.board)) {
    if (piece.side === side && piece.revealed && piece.role === "general") {
      const [x, y] = key.split(",").map(Number);
      return [x, y];
    }
  }
  return null;
}

export function isInCheck(state: ReadableState, side: Side = state.turn): boolean {
  const general = generalCoord(state, side);
  if (!general) return true;
  const attacker = otherSide(side);
  for (const [key, piece] of Object.entries(state.board)) {
    if (piece.side !== attacker) continue;
    const [x, y] = key.split(",").map(Number);
    if (pseudoDestinations(state, [x, y], piece).some((target) => sameCoord(target, general))) return true;
  }
  return false;
}

export function legalMoves(state: ReadableState, from?: Coord): Move[] {
  if (state.outcome || (state.positionCounts[positionKey(state)] ?? 0) >= 3) return [];
  const candidates: Move[] = [];
  const sources = from ? [[coordKey(from), state.board[coordKey(from)]] as const] : Object.entries(state.board);
  for (const [key, piece] of sources) {
    if (!piece || piece.side !== state.turn) continue;
    const [x, y] = key.split(",").map(Number);
    const source: Coord = [x, y];
    for (const to of pseudoDestinations(state, source, piece)) {
      const board = boardAfterMove(state, { from: source, to });
      if (!isInCheck({ ...state, board }, piece.side)) candidates.push({ from: source, to });
    }
  }
  return candidates;
}

export function applyMove(state: XiangqiState, move: Move): XiangqiState {
  const status = getGameStatus(state);
  if (status.kind !== "active") throw new Error(`Cannot move after game ended: ${status.kind}`);
  const legal = legalMoves(state, move.from).find((candidate) => sameCoord(candidate.to, move.to));
  if (!legal) throw new Error("Illegal Xiangqi move");

  const sourceKey = coordKey(legal.from);
  const targetKey = coordKey(legal.to);
  const movingPiece = state.board[sourceKey];
  const capturedPiece = state.board[targetKey];
  if (!movingPiece) throw new Error("Moving piece is missing");

  const concealedPieces = { ...state.concealedPieces };
  let revealedRole: PieceRole | undefined;
  if (!movingPiece.revealed) {
    revealedRole = concealedPieces[movingPiece.id];
    if (!revealedRole) throw new Error("Concealed identity is missing");
    delete concealedPieces[movingPiece.id];
  }
  if (capturedPiece) delete concealedPieces[capturedPiece.id];

  const record: MoveRecord = {
    from: legal.from,
    to: legal.to,
    side: state.turn,
    pieceId: movingPiece.id,
    ...(capturedPiece ? { capturedPieceId: capturedPiece.id } : {}),
    ...(capturedPiece?.revealed && capturedPiece.role ? { capturedRole: capturedPiece.role } : {}),
    ...(revealedRole ? { revealedRole } : {}),
  };
  const next: XiangqiState = {
    ...state,
    board: boardAfterMove(state, legal, revealedRole),
    concealedPieces,
    turn: otherSide(state.turn),
    moves: [...state.moves, record],
  };
  const key = positionKey(next);
  return {
    ...next,
    positionCounts: { ...state.positionCounts, [key]: (state.positionCounts[key] ?? 0) + 1 },
  };
}

export function getGameStatus(state: ReadableState): GameStatus {
  const inCheck = isInCheck(state, state.turn);
  if (state.outcome) return { ...state.outcome, inCheck };
  if ((state.positionCounts[positionKey(state)] ?? 0) >= 3) {
    return { kind: "repetition", winner: null, inCheck };
  }
  if (legalMoves(state).length > 0) return { kind: "active", winner: null, inCheck };
  return {
    kind: inCheck ? "checkmate" : "no-legal-move",
    winner: otherSide(state.turn),
    inCheck,
  };
}

export function toPublicState(state: XiangqiState): PublicXiangqiState {
  const board: Record<string, Piece> = {};
  for (const [key, piece] of Object.entries(state.board)) {
    board[key] = state.variant === "blind" && !piece.revealed
      ? { ...piece, role: null }
      : { ...piece };
  }
  return {
    version: 1,
    variant: state.variant,
    board,
    turn: state.turn,
    moves: state.moves.map((move) => ({ ...move, from: [...move.from] as Coord, to: [...move.to] as Coord })),
    positionCounts: { ...state.positionCounts },
    outcome: state.outcome ? { ...state.outcome } : null,
  };
}

function hydratePiece(value: unknown, variant: XiangqiVariant): Piece {
  if (!isRecord(value)) throw new Error("Invalid Xiangqi piece");
  const { id, side, role, coverRole, revealed } = value;
  if (typeof id !== "string" || !id || id.length > 80 || !isSide(side) || typeof revealed !== "boolean") {
    throw new Error("Invalid Xiangqi piece fields");
  }
  if (role !== null && !isRole(role)) throw new Error("Invalid Xiangqi piece identity");
  if (coverRole !== null && !isRole(coverRole)) throw new Error("Invalid Xiangqi cover role");
  if (variant === "bright" && (!revealed || role === null || coverRole !== null)) {
    throw new Error("Invalid bright Xiangqi piece");
  }
  if (variant === "blind" && (coverRole === null || (revealed ? role === null : role !== null))) {
    throw new Error("Invalid blind Xiangqi piece");
  }
  if (variant === "blind" && role === "general" && coverRole !== "general") {
    throw new Error("Invalid blind general");
  }
  return { id, side, role, coverRole, revealed };
}

function hydrateMove(value: unknown): MoveRecord {
  if (!isRecord(value) || !isBoardCoord(value.from) || !isBoardCoord(value.to) || !isSide(value.side)) {
    throw new Error("Invalid Xiangqi move record");
  }
  if (typeof value.pieceId !== "string" || !value.pieceId) throw new Error("Invalid Xiangqi move piece");
  const optionalId = value.capturedPieceId;
  if (optionalId !== undefined && (typeof optionalId !== "string" || !optionalId)) {
    throw new Error("Invalid captured Xiangqi piece");
  }
  const capturedRole = value.capturedRole;
  const revealedRole = value.revealedRole;
  if (capturedRole !== undefined && !isRole(capturedRole)) throw new Error("Invalid captured Xiangqi role");
  if (revealedRole !== undefined && (!isRole(revealedRole) || revealedRole === "general")) {
    throw new Error("Invalid revealed Xiangqi role");
  }
  return {
    from: [value.from[0], value.from[1]],
    to: [value.to[0], value.to[1]],
    side: value.side,
    pieceId: value.pieceId,
    ...(optionalId ? { capturedPieceId: optionalId } : {}),
    ...(capturedRole ? { capturedRole } : {}),
    ...(revealedRole ? { revealedRole } : {}),
  };
}

function hydrateOutcome(value: unknown): StoredOutcome | null {
  if (value === null) return null;
  if (!isRecord(value) || typeof value.kind !== "string") throw new Error("Invalid Xiangqi outcome");
  if (value.kind === "draw-agreed" && value.winner === null) return { kind: "draw-agreed", winner: null };
  if ((value.kind === "timeout" || value.kind === "resignation") && isSide(value.winner)) {
    return { kind: value.kind, winner: value.winner };
  }
  throw new Error("Invalid Xiangqi outcome");
}

function sameStringRecord<T extends string | number>(
  left: Readonly<Record<string, T>>,
  right: Readonly<Record<string, T>>,
): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

function samePiece(left: Piece, right: Piece): boolean {
  return left.id === right.id
    && left.side === right.side
    && left.role === right.role
    && left.coverRole === right.coverRole
    && left.revealed === right.revealed;
}

function sameBoard(left: Readonly<Record<string, Piece>>, right: Readonly<Record<string, Piece>>): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && samePiece(left[key], right[key]));
}

function sameMoveRecord(left: MoveRecord, right: MoveRecord): boolean {
  return sameCoord(left.from, right.from)
    && sameCoord(left.to, right.to)
    && left.side === right.side
    && left.pieceId === right.pieceId
    && left.capturedPieceId === right.capturedPieceId
    && left.capturedRole === right.capturedRole
    && left.revealedRole === right.revealedRole;
}

export function hydrateState(value: unknown): XiangqiState {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      throw new Error("Invalid serialized Xiangqi state");
    }
  }
  if (!isRecord(parsed) || parsed.version !== 1 || !isVariant(parsed.variant) || typeof parsed.seed !== "string") {
    throw new Error("Invalid Xiangqi state header");
  }
  if (!isSide(parsed.turn) || !isRecord(parsed.board) || !Array.isArray(parsed.moves)
      || !isRecord(parsed.concealedPieces) || !isRecord(parsed.positionCounts)) {
    throw new Error("Invalid Xiangqi state fields");
  }

  const board: Record<string, Piece> = {};
  const pieceIds = new Set<string>();
  const generalCounts: Record<Side, number> = { red: 0, black: 0 };
  for (const [key, valueAtSquare] of Object.entries(parsed.board)) {
    const coord = key.split(",").map(Number);
    if (!isBoardCoord(coord) || coordKey(coord) !== key) throw new Error("Invalid Xiangqi board square");
    const piece = hydratePiece(valueAtSquare, parsed.variant);
    if (pieceIds.has(piece.id)) throw new Error("Duplicate Xiangqi piece id");
    pieceIds.add(piece.id);
    if (piece.role === "general") generalCounts[piece.side] += 1;
    board[key] = piece;
  }
  if (Object.keys(board).length > 32 || generalCounts.red > 1 || generalCounts.black > 1) {
    throw new Error("Invalid Xiangqi board population");
  }

  const concealedPieces: Record<string, PieceRole> = {};
  for (const [pieceId, role] of Object.entries(parsed.concealedPieces)) {
    if (!pieceId || !isRole(role) || role === "general") throw new Error("Invalid concealed Xiangqi identity");
    concealedPieces[pieceId] = role;
  }
  const hiddenIds = Object.values(board).filter((piece) => !piece.revealed).map((piece) => piece.id).sort();
  const concealedIds = Object.keys(concealedPieces).sort();
  if (hiddenIds.length !== concealedIds.length || hiddenIds.some((id, index) => id !== concealedIds[index])) {
    throw new Error("Concealed Xiangqi identities do not match hidden pieces");
  }
  if (parsed.variant === "bright" && concealedIds.length > 0) throw new Error("Bright game cannot conceal pieces");

  const positionCounts: Record<string, number> = {};
  for (const [key, count] of Object.entries(parsed.positionCounts)) {
    if (!key || !Number.isInteger(count) || (count as number) < 1) throw new Error("Invalid Xiangqi repetition count");
    positionCounts[key] = count as number;
  }
  const state: XiangqiState = {
    version: 1,
    variant: parsed.variant,
    seed: parsed.seed,
    board,
    turn: parsed.turn,
    moves: parsed.moves.map(hydrateMove),
    concealedPieces,
    positionCounts,
    outcome: hydrateOutcome(parsed.outcome),
  };
  if (!state.positionCounts[positionKey(state)]) throw new Error("Current Xiangqi position is not counted");

  let replayed = createGame(state.variant, state.seed);
  for (const serializedMove of state.moves) {
    if (serializedMove.side !== replayed.turn) throw new Error("Invalid Xiangqi move order");
    replayed = applyMove(replayed, serializedMove);
    const canonicalMove = replayed.moves[replayed.moves.length - 1];
    if (!canonicalMove || !sameMoveRecord(canonicalMove, serializedMove)) {
      throw new Error("Xiangqi move history is inconsistent");
    }
  }
  if (state.turn !== replayed.turn
      || !sameBoard(state.board, replayed.board)
      || !sameStringRecord(state.concealedPieces, replayed.concealedPieces)
      || !sameStringRecord(state.positionCounts, replayed.positionCounts)) {
    throw new Error("Xiangqi state does not match its move history");
  }
  return { ...replayed, outcome: state.outcome };
}
