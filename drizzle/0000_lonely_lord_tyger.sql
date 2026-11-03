CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`actor` text NOT NULL,
	`saved_at` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `facility_notes` (
	`facility_id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`updated_at` text NOT NULL,
	`actor` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workbench` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`saved_at` text NOT NULL,
	`body` text NOT NULL,
	`operation_id` text NOT NULL
);
