CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
	`last_seen_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
	`user_agent` text,
	`ip` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `google_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);