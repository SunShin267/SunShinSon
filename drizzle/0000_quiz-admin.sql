CREATE TABLE `admin_login_attempts` (
	`client_key` text PRIMARY KEY NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`window_started_at` integer NOT NULL,
	`blocked_until` integer
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic` text NOT NULL,
	`age` text NOT NULL,
	`tag` text NOT NULL,
	`question_text` text NOT NULL,
	`normalized_question` text NOT NULL,
	`option_a` text NOT NULL,
	`option_b` text NOT NULL,
	`option_c` text NOT NULL,
	`option_d` text NOT NULL,
	`correct_index` integer NOT NULL,
	`explanation` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `questions_topic_check` CHECK (`topic` IN ('dongvat', 'tunhien', 'toanhoc', 'domeo', 'vanhoa')),
	CONSTRAINT `questions_age_check` CHECK (`age` IN ('de', 'vua', 'kho')),
	CONSTRAINT `questions_tag_check` CHECK (`tag` IN ('đố vui', 'đố mẹo')),
	CONSTRAINT `questions_correct_index_check` CHECK (`correct_index` BETWEEN 0 AND 3),
	CONSTRAINT `questions_is_active_check` CHECK (`is_active` IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `questions_active_idx` ON `questions` (`is_active`);--> statement-breakpoint
CREATE INDEX `questions_topic_age_active_idx` ON `questions` (`topic`,`age`,`is_active`);--> statement-breakpoint
CREATE UNIQUE INDEX `questions_normalized_unique` ON `questions` (`normalized_question`);
