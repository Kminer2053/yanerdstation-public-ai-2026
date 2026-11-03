ALTER TABLE `commons_players` ADD `floor` text DEFAULT '2F' NOT NULL;--> statement-breakpoint
ALTER TABLE `commons_players` ADD `transit` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `commons_players` ADD `moved_at` integer DEFAULT 0 NOT NULL;