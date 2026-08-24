CREATE TABLE `xiangqi_games` (
	`id` text PRIMARY KEY NOT NULL,
	`red_session_id` text NOT NULL,
	`black_session_id` text NOT NULL,
	`variant` text NOT NULL,
	`time_control_ms` integer NOT NULL,
	`state_json` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`active_side` text,
	`red_clock_ms` integer NOT NULL,
	`black_clock_ms` integer NOT NULL,
	`active_clock_started_at` integer,
	`red_ready` integer DEFAULT false NOT NULL,
	`black_ready` integer DEFAULT false NOT NULL,
	`pending_draw_by` text,
	`red_rematch` integer DEFAULT false NOT NULL,
	`black_rematch` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`result_kind` text,
	`winner_side` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`red_session_id`) REFERENCES `xiangqi_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`black_session_id`) REFERENCES `xiangqi_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pending_draw_by`) REFERENCES `xiangqi_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "xiangqi_games_players_check" CHECK("xiangqi_games"."red_session_id" <> "xiangqi_games"."black_session_id"),
	CONSTRAINT "xiangqi_games_variant_check" CHECK("xiangqi_games"."variant" IN ('bright', 'blind')),
	CONSTRAINT "xiangqi_games_time_control_check" CHECK("xiangqi_games"."time_control_ms" IN (300000, 600000, 900000)),
	CONSTRAINT "xiangqi_games_revision_check" CHECK("xiangqi_games"."revision" >= 0),
	CONSTRAINT "xiangqi_games_active_side_check" CHECK("xiangqi_games"."active_side" IS NULL OR "xiangqi_games"."active_side" IN ('red', 'black')),
	CONSTRAINT "xiangqi_games_clock_check" CHECK("xiangqi_games"."red_clock_ms" >= 0 AND "xiangqi_games"."black_clock_ms" >= 0),
	CONSTRAINT "xiangqi_games_ready_check" CHECK("xiangqi_games"."red_ready" IN (0, 1) AND "xiangqi_games"."black_ready" IN (0, 1)),
	CONSTRAINT "xiangqi_games_rematch_check" CHECK("xiangqi_games"."red_rematch" IN (0, 1) AND "xiangqi_games"."black_rematch" IN (0, 1)),
	CONSTRAINT "xiangqi_games_status_check" CHECK("xiangqi_games"."status" IN ('active', 'finished')),
	CONSTRAINT "xiangqi_games_result_check" CHECK("xiangqi_games"."result_kind" IS NULL OR "xiangqi_games"."result_kind" IN ('checkmate', 'no-legal-move', 'repetition', 'timeout', 'resignation', 'draw-agreed')),
	CONSTRAINT "xiangqi_games_winner_check" CHECK("xiangqi_games"."winner_side" IS NULL OR "xiangqi_games"."winner_side" IN ('red', 'black'))
);
--> statement-breakpoint
CREATE INDEX `xiangqi_games_red_status_idx` ON `xiangqi_games` (`red_session_id`,`status`);--> statement-breakpoint
CREATE INDEX `xiangqi_games_black_status_idx` ON `xiangqi_games` (`black_session_id`,`status`);--> statement-breakpoint
CREATE INDEX `xiangqi_games_status_updated_idx` ON `xiangqi_games` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `xiangqi_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`from_session_id` text NOT NULL,
	`to_session_id` text,
	`room_code` text,
	`variant` text NOT NULL,
	`clock_minutes` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`game_id` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`from_session_id`) REFERENCES `xiangqi_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_session_id`) REFERENCES `xiangqi_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`game_id`) REFERENCES `xiangqi_games`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "xiangqi_invites_kind_check" CHECK("xiangqi_invites"."kind" IN ('link', 'direct')),
	CONSTRAINT "xiangqi_invites_variant_check" CHECK("xiangqi_invites"."variant" IN ('bright', 'blind')),
	CONSTRAINT "xiangqi_invites_clock_check" CHECK("xiangqi_invites"."clock_minutes" IN (5, 10, 15)),
	CONSTRAINT "xiangqi_invites_status_check" CHECK("xiangqi_invites"."status" IN ('pending', 'accepted', 'declined', 'canceled', 'expired')),
	CONSTRAINT "xiangqi_invites_target_check" CHECK(("xiangqi_invites"."kind" = 'link' AND "xiangqi_invites"."to_session_id" IS NULL AND "xiangqi_invites"."room_code" IS NOT NULL) OR ("xiangqi_invites"."kind" = 'direct' AND "xiangqi_invites"."to_session_id" IS NOT NULL AND "xiangqi_invites"."room_code" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `xiangqi_invites_room_code_unique` ON `xiangqi_invites` (`room_code`);--> statement-breakpoint
CREATE INDEX `xiangqi_invites_from_status_idx` ON `xiangqi_invites` (`from_session_id`,`status`);--> statement-breakpoint
CREATE INDEX `xiangqi_invites_to_status_idx` ON `xiangqi_invites` (`to_session_id`,`status`);--> statement-breakpoint
CREATE INDEX `xiangqi_invites_status_expiry_idx` ON `xiangqi_invites` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `xiangqi_moves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` text NOT NULL,
	`ply` integer NOT NULL,
	`side` text NOT NULL,
	`from_x` integer NOT NULL,
	`from_y` integer NOT NULL,
	`to_x` integer NOT NULL,
	`to_y` integer NOT NULL,
	`revealed_role` text,
	`red_clock_ms` integer NOT NULL,
	`black_clock_ms` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `xiangqi_games`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "xiangqi_moves_ply_check" CHECK("xiangqi_moves"."ply" > 0),
	CONSTRAINT "xiangqi_moves_side_check" CHECK("xiangqi_moves"."side" IN ('red', 'black')),
	CONSTRAINT "xiangqi_moves_coords_check" CHECK("xiangqi_moves"."from_x" BETWEEN 0 AND 8 AND "xiangqi_moves"."to_x" BETWEEN 0 AND 8 AND "xiangqi_moves"."from_y" BETWEEN 0 AND 9 AND "xiangqi_moves"."to_y" BETWEEN 0 AND 9),
	CONSTRAINT "xiangqi_moves_revealed_role_check" CHECK("xiangqi_moves"."revealed_role" IS NULL OR "xiangqi_moves"."revealed_role" IN ('advisor', 'elephant', 'horse', 'rook', 'cannon', 'soldier')),
	CONSTRAINT "xiangqi_moves_clock_check" CHECK("xiangqi_moves"."red_clock_ms" >= 0 AND "xiangqi_moves"."black_clock_ms" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `xiangqi_moves_game_ply_unique` ON `xiangqi_moves` (`game_id`,`ply`);--> statement-breakpoint
CREATE INDEX `xiangqi_moves_game_created_idx` ON `xiangqi_moves` (`game_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `xiangqi_presence` (
	`session_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`invite_id` text,
	`game_id` text,
	`last_heartbeat_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `xiangqi_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invite_id`) REFERENCES `xiangqi_invites`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`game_id`) REFERENCES `xiangqi_games`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "xiangqi_presence_status_check" CHECK("xiangqi_presence"."status" IN ('available', 'waiting', 'playing'))
);
--> statement-breakpoint
CREATE INDEX `xiangqi_presence_status_heartbeat_idx` ON `xiangqi_presence` (`status`,`last_heartbeat_at`);--> statement-breakpoint
CREATE INDEX `xiangqi_presence_invite_idx` ON `xiangqi_presence` (`invite_id`);--> statement-breakpoint
CREATE INDEX `xiangqi_presence_game_idx` ON `xiangqi_presence` (`game_id`);--> statement-breakpoint
CREATE TABLE `xiangqi_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `xiangqi_sessions_last_seen_idx` ON `xiangqi_sessions` (`last_seen_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `xiangqi_invites_one_pending_sender_idx`
	ON `xiangqi_invites` (`from_session_id`)
	WHERE `status` = 'pending';--> statement-breakpoint
CREATE TRIGGER `xiangqi_games_participants_insert_guard`
BEFORE INSERT ON `xiangqi_games`
WHEN NEW.`status` = 'active' AND EXISTS (
	SELECT 1 FROM `xiangqi_games`
	WHERE `status` = 'active'
		AND (
			`red_session_id` IN (NEW.`red_session_id`, NEW.`black_session_id`)
			OR `black_session_id` IN (NEW.`red_session_id`, NEW.`black_session_id`)
		)
)
BEGIN
	SELECT RAISE(ABORT, 'xiangqi participant already active');
END;--> statement-breakpoint
CREATE TRIGGER `xiangqi_games_participants_update_guard`
BEFORE UPDATE OF `status`, `red_session_id`, `black_session_id` ON `xiangqi_games`
WHEN NEW.`status` = 'active' AND EXISTS (
	SELECT 1 FROM `xiangqi_games`
	WHERE `id` <> NEW.`id`
		AND `status` = 'active'
		AND (
			`red_session_id` IN (NEW.`red_session_id`, NEW.`black_session_id`)
			OR `black_session_id` IN (NEW.`red_session_id`, NEW.`black_session_id`)
		)
)
BEGIN
	SELECT RAISE(ABORT, 'xiangqi participant already active');
END;
