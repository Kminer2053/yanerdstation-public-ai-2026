CREATE TABLE `commons_players` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`joined_at` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`seq` integer NOT NULL,
	`x` real NOT NULL,
	`z` real NOT NULL,
	`yaw` real NOT NULL,
	`pose` text NOT NULL,
	`color` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `commons_player_room_seen` ON `commons_players` (`room_id`,`last_seen`);--> statement-breakpoint
CREATE INDEX `commons_player_seen` ON `commons_players` (`last_seen`);--> statement-breakpoint
CREATE TABLE `commons_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`scene_version` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `commons_room_expiry` ON `commons_rooms` (`expires_at`);--> statement-breakpoint
CREATE INDEX `commons_room_created` ON `commons_rooms` (`created_at`);