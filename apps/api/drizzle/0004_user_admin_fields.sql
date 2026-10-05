ALTER TABLE `users` ADD `role` text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `disabled_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `deleted_at` integer;--> statement-breakpoint
-- bootstrap: the earliest account becomes the first admin (existing installs keep a way in)
UPDATE `users` SET `role` = 'admin' WHERE `id` = (SELECT `id` FROM `users` ORDER BY `created_at` ASC LIMIT 1);
