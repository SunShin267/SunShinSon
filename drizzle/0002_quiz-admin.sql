CREATE TABLE `coloring_drawings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`art_id` text NOT NULL,
	`title` text NOT NULL,
	`child_name` text NOT NULL,
	`drive_file_id` text NOT NULL,
	`mime_type` text DEFAULT 'image/png' NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `google_drive_connections`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coloring_drawings_drive_file_unique` ON `coloring_drawings` (`drive_file_id`);--> statement-breakpoint
CREATE INDEX `coloring_drawings_user_updated_idx` ON `coloring_drawings` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `google_drive_connections` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`encrypted_refresh_token` text NOT NULL,
	`encrypted_access_token` text,
	`access_token_expires_at` integer,
	`folder_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
