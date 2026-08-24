import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const questions = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  topic: text("topic").notNull(),
  age: text("age").notNull(),
  tag: text("tag").notNull(),
  questionText: text("question_text").notNull(),
  normalizedQuestion: text("normalized_question").notNull(),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c").notNull(),
  optionD: text("option_d").notNull(),
  correctIndex: integer("correct_index").notNull(),
  explanation: text("explanation").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("questions_active_idx").on(table.isActive),
  index("questions_topic_age_active_idx").on(table.topic, table.age, table.isActive),
  uniqueIndex("questions_normalized_unique").on(table.normalizedQuestion),
]);

export const adminLoginAttempts = sqliteTable("admin_login_attempts", {
  clientKey: text("client_key").primaryKey(),
  failedCount: integer("failed_count").notNull().default(0),
  windowStartedAt: integer("window_started_at").notNull(),
  blockedUntil: integer("blocked_until"),
});

export const xiangqiSessions = sqliteTable("xiangqi_sessions", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: integer("created_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
}, (table) => [
  index("xiangqi_sessions_last_seen_idx").on(table.lastSeenAt),
]);

export const xiangqiGames = sqliteTable("xiangqi_games", {
  id: text("id").primaryKey(),
  redSessionId: text("red_session_id").notNull().references(() => xiangqiSessions.id),
  blackSessionId: text("black_session_id").notNull().references(() => xiangqiSessions.id),
  variant: text("variant").notNull(),
  timeControlMs: integer("time_control_ms").notNull(),
  stateJson: text("state_json").notNull(),
  revision: integer("revision").notNull().default(0),
  activeSide: text("active_side"),
  redClockMs: integer("red_clock_ms").notNull(),
  blackClockMs: integer("black_clock_ms").notNull(),
  activeClockStartedAt: integer("active_clock_started_at"),
  redReady: integer("red_ready", { mode: "boolean" }).notNull().default(false),
  blackReady: integer("black_ready", { mode: "boolean" }).notNull().default(false),
  pendingDrawBy: text("pending_draw_by").references(() => xiangqiSessions.id),
  redRematch: integer("red_rematch", { mode: "boolean" }).notNull().default(false),
  blackRematch: integer("black_rematch", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("active"),
  resultKind: text("result_kind"),
  winnerSide: text("winner_side"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  finishedAt: integer("finished_at"),
}, (table) => [
  index("xiangqi_games_red_status_idx").on(table.redSessionId, table.status),
  index("xiangqi_games_black_status_idx").on(table.blackSessionId, table.status),
  index("xiangqi_games_status_updated_idx").on(table.status, table.updatedAt),
  check("xiangqi_games_players_check", sql`${table.redSessionId} <> ${table.blackSessionId}`),
  check("xiangqi_games_variant_check", sql`${table.variant} IN ('bright', 'blind')`),
  check("xiangqi_games_time_control_check", sql`${table.timeControlMs} IN (300000, 600000, 900000)`),
  check("xiangqi_games_revision_check", sql`${table.revision} >= 0`),
  check("xiangqi_games_active_side_check", sql`${table.activeSide} IS NULL OR ${table.activeSide} IN ('red', 'black')`),
  check("xiangqi_games_clock_check", sql`${table.redClockMs} >= 0 AND ${table.blackClockMs} >= 0`),
  check("xiangqi_games_ready_check", sql`${table.redReady} IN (0, 1) AND ${table.blackReady} IN (0, 1)`),
  check("xiangqi_games_rematch_check", sql`${table.redRematch} IN (0, 1) AND ${table.blackRematch} IN (0, 1)`),
  check("xiangqi_games_status_check", sql`${table.status} IN ('active', 'finished')`),
  check("xiangqi_games_result_check", sql`${table.resultKind} IS NULL OR ${table.resultKind} IN ('checkmate', 'no-legal-move', 'repetition', 'timeout', 'resignation', 'draw-agreed')`),
  check("xiangqi_games_winner_check", sql`${table.winnerSide} IS NULL OR ${table.winnerSide} IN ('red', 'black')`),
]);

export const xiangqiInvites = sqliteTable("xiangqi_invites", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  fromSessionId: text("from_session_id").notNull().references(() => xiangqiSessions.id),
  toSessionId: text("to_session_id").references(() => xiangqiSessions.id),
  roomCode: text("room_code"),
  variant: text("variant").notNull(),
  clockMinutes: integer("clock_minutes").notNull(),
  status: text("status").notNull().default("pending"),
  gameId: text("game_id").references(() => xiangqiGames.id),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("xiangqi_invites_room_code_unique").on(table.roomCode),
  index("xiangqi_invites_from_status_idx").on(table.fromSessionId, table.status),
  index("xiangqi_invites_to_status_idx").on(table.toSessionId, table.status),
  index("xiangqi_invites_status_expiry_idx").on(table.status, table.expiresAt),
  check("xiangqi_invites_kind_check", sql`${table.kind} IN ('link', 'direct')`),
  check("xiangqi_invites_variant_check", sql`${table.variant} IN ('bright', 'blind')`),
  check("xiangqi_invites_clock_check", sql`${table.clockMinutes} IN (5, 10, 15)`),
  check("xiangqi_invites_status_check", sql`${table.status} IN ('pending', 'accepted', 'declined', 'canceled', 'expired')`),
  check("xiangqi_invites_target_check", sql`(${table.kind} = 'link' AND ${table.toSessionId} IS NULL AND ${table.roomCode} IS NOT NULL) OR (${table.kind} = 'direct' AND ${table.toSessionId} IS NOT NULL AND ${table.roomCode} IS NULL)`),
]);

export const xiangqiPresence = sqliteTable("xiangqi_presence", {
  sessionId: text("session_id").primaryKey().references(() => xiangqiSessions.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("available"),
  inviteId: text("invite_id").references(() => xiangqiInvites.id, { onDelete: "set null" }),
  gameId: text("game_id").references(() => xiangqiGames.id, { onDelete: "set null" }),
  lastHeartbeatAt: integer("last_heartbeat_at").notNull(),
}, (table) => [
  index("xiangqi_presence_status_heartbeat_idx").on(table.status, table.lastHeartbeatAt),
  index("xiangqi_presence_invite_idx").on(table.inviteId),
  index("xiangqi_presence_game_idx").on(table.gameId),
  check("xiangqi_presence_status_check", sql`${table.status} IN ('available', 'waiting', 'playing')`),
]);

export const xiangqiMoves = sqliteTable("xiangqi_moves", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: text("game_id").notNull().references(() => xiangqiGames.id, { onDelete: "cascade" }),
  gameRevision: integer("game_revision").notNull(),
  ply: integer("ply").notNull(),
  side: text("side").notNull(),
  fromX: integer("from_x").notNull(),
  fromY: integer("from_y").notNull(),
  toX: integer("to_x").notNull(),
  toY: integer("to_y").notNull(),
  revealedRole: text("revealed_role"),
  redClockMs: integer("red_clock_ms").notNull(),
  blackClockMs: integer("black_clock_ms").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("xiangqi_moves_game_revision_unique").on(table.gameId, table.gameRevision),
  uniqueIndex("xiangqi_moves_game_ply_unique").on(table.gameId, table.ply),
  index("xiangqi_moves_game_created_idx").on(table.gameId, table.createdAt),
  check("xiangqi_moves_game_revision_check", sql`${table.gameRevision} > 0`),
  check("xiangqi_moves_ply_check", sql`${table.ply} > 0`),
  check("xiangqi_moves_side_check", sql`${table.side} IN ('red', 'black')`),
  check("xiangqi_moves_coords_check", sql`${table.fromX} BETWEEN 0 AND 8 AND ${table.toX} BETWEEN 0 AND 8 AND ${table.fromY} BETWEEN 0 AND 9 AND ${table.toY} BETWEEN 0 AND 9`),
  check("xiangqi_moves_revealed_role_check", sql`${table.revealedRole} IS NULL OR ${table.revealedRole} IN ('advisor', 'elephant', 'horse', 'rook', 'cannon', 'soldier')`),
  check("xiangqi_moves_clock_check", sql`${table.redClockMs} >= 0 AND ${table.blackClockMs} >= 0`),
]);
