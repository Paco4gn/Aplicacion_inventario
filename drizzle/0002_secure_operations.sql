CREATE TABLE `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`token_hash` text NOT NULL,
	`token_hint` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_email_uidx` ON `app_users` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_token_hash_uidx` ON `app_users` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `app_users_active_idx` ON `app_users` (`active`,`role`);
--> statement-breakpoint
CREATE TABLE `inventory_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`data_json` text NOT NULL,
	`counts_json` text DEFAULT '{}' NOT NULL,
	`automatic` integer DEFAULT false NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inventory_snapshots_created_idx` ON `inventory_snapshots` (`created_at`);
--> statement-breakpoint
CREATE TABLE `recycle_bin` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`record_json` text NOT NULL,
	`deleted_by` text DEFAULT '' NOT NULL,
	`deleted_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recycle_bin_deleted_idx` ON `recycle_bin` (`deleted_at`);
--> statement-breakpoint
CREATE INDEX `recycle_bin_record_idx` ON `recycle_bin` (`table_name`,`record_id`);
