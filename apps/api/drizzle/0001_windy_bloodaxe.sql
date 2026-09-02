PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`created_at` integer DEFAULT (cast(strftime('%s','now') as integer) * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tags`("id", "workspace_id", "owner_id", "name", "color", "created_at") SELECT "id", "workspace_id", "owner_id", "name", "color", "created_at" FROM `tags`;--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint
ALTER TABLE `__new_tags` RENAME TO `tags`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tags_personal` ON `tags` (`owner_id`,`name`) WHERE "tags"."workspace_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tags_workspace` ON `tags` (`workspace_id`,`name`) WHERE "tags"."workspace_id" is not null;