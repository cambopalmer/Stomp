DROP INDEX `uq_incoming_source`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_incoming_email` ON `incoming_items` (`for_user_id`,`source_ref`) WHERE "incoming_items"."kind" = 'email';