ALTER TABLE `events` ADD `integration_account_id` text REFERENCES integration_accounts(id) ON DELETE set null;--> statement-breakpoint
-- backfill: existing Google mirrors belong to their owner's (single, pre-0008) calendar connection
UPDATE `events` SET `integration_account_id` = (
  SELECT `a`.`id` FROM `integration_accounts` `a`
  WHERE `a`.`user_id` = `events`.`created_by` AND `a`.`provider` = 'google_calendar'
  ORDER BY `a`.`created_at` LIMIT 1
) WHERE `external_provider` = 'google' AND `integration_account_id` IS NULL;
