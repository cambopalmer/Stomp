CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`default_id` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`default_id`) REFERENCES `default_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_categories_user` ON `categories` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_categories_live_name` ON `categories` (`user_id`,`name`) WHERE "categories"."archived_at" is null;--> statement-breakpoint
CREATE TABLE `day_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`body` text NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `day_notes_user_id_date_unique` ON `day_notes` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `default_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `time_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text,
	`date` text NOT NULL,
	`start_min` integer NOT NULL,
	`end_min` integer NOT NULL,
	`planned_start_min` integer,
	`planned_end_min` integer,
	`title` text,
	`notes` text,
	`category_id` text,
	`todo_id` text,
	`anchor_event_id` text,
	`anchor_offset_min` integer,
	`anchor_lost` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`anchor_event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_time_blocks_user_date` ON `time_blocks` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_time_blocks_todo` ON `time_blocks` (`todo_id`);--> statement-breakpoint
CREATE INDEX `idx_time_blocks_anchor` ON `time_blocks` (`anchor_event_id`);--> statement-breakpoint
-- hub default categories (ADR-0006); ids match SEED_DEFAULT_CATEGORIES in packages/shared/src/planner.ts
INSERT INTO `default_categories` (`id`, `name`, `color`, `icon`, `sort_order`) VALUES
  ('0d9a1f10-0000-4000-8000-000000000001', 'Work', 'blue', 'briefcase', 0),
  ('0d9a1f10-0000-4000-8000-000000000002', 'Focus', 'violet', 'target', 1),
  ('0d9a1f10-0000-4000-8000-000000000003', 'Admin & errands', 'amber', 'clipboard', 2),
  ('0d9a1f10-0000-4000-8000-000000000004', 'Chores', 'orange', 'home', 3),
  ('0d9a1f10-0000-4000-8000-000000000005', 'Family', 'rose', 'users', 4),
  ('0d9a1f10-0000-4000-8000-000000000006', 'Personal', 'teal', 'user', 5),
  ('0d9a1f10-0000-4000-8000-000000000007', 'Health', 'green', 'heart-pulse', 6),
  ('0d9a1f10-0000-4000-8000-000000000008', 'Travel', 'sky', 'car', 7);