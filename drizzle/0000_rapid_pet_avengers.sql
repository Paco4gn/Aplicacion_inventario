CREATE TABLE `asset_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`employee_id` text,
	`assigned_at` text NOT NULL,
	`returned_at` text,
	`notes` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `asset_assignments_asset_idx` ON `asset_assignments` (`asset_id`);--> statement-breakpoint
CREATE INDEX `asset_assignments_employee_idx` ON `asset_assignments` (`employee_id`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`serial_number` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`asset_type` text DEFAULT 'Other' NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`purchase_date` text,
	`purchase_value` real,
	`warranty_expiry` text,
	`end_of_life` text,
	`operating_system` text DEFAULT '' NOT NULL,
	`ip_address` text DEFAULT '' NOT NULL,
	`mac_address` text DEFAULT '' NOT NULL,
	`processor` text DEFAULT '' NOT NULL,
	`ram_gb` real,
	`storage_gb` real,
	`last_inventory_at` text,
	`parent_asset_id` text,
	`screen_size` text DEFAULT '' NOT NULL,
	`resolution` text DEFAULT '' NOT NULL,
	`connection_type` text DEFAULT '' NOT NULL,
	`toner_model` text DEFAULT '' NOT NULL,
	`imei` text DEFAULT '' NOT NULL,
	`sim_number` text DEFAULT '' NOT NULL,
	`assigned_position` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_serial_number_uidx` ON `assets` (`serial_number`);--> statement-breakpoint
CREATE INDEX `assets_status_idx` ON `assets` (`status`);--> statement-breakpoint
CREATE INDEX `assets_parent_asset_idx` ON `assets` (`parent_asset_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`entity_name` text DEFAULT '' NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`performed_by` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `component_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`component_id` text NOT NULL,
	`movement_type` text NOT NULL,
	`quantity` integer NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`asset_id` text,
	`moved_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `component_movements_component_idx` ON `component_movements` (`component_id`);--> statement-breakpoint
CREATE TABLE `components` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`component_type` text DEFAULT '' NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`min_stock` integer DEFAULT 0 NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`unit_cost` real,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `components_name_idx` ON `components` (`name`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`department` text DEFAULT '' NOT NULL,
	`position` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `employees_name_idx` ON `employees` (`name`);--> statement-breakpoint
CREATE INDEX `employees_active_idx` ON `employees` (`active`);--> statement-breakpoint
CREATE TABLE `incident_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`incident_id` text NOT NULL,
	`author_name` text DEFAULT 'informatica' NOT NULL,
	`body` text NOT NULL,
	`internal` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `incident_comments_incident_idx` ON `incident_comments` (`incident_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `incident_notification_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `incident_recipients_email_uidx` ON `incident_notification_recipients` (`email`);--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`asset_id` text,
	`employee_id` text,
	`assigned_to_id` text,
	`assigned_to_email` text,
	`assigned_to_name` text,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`resolution` text DEFAULT '' NOT NULL,
	`due_at` text,
	`started_at` text,
	`resolved_at` text,
	`opened_at` text NOT NULL,
	`closed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `incidents_status_idx` ON `incidents` (`status`);--> statement-breakpoint
CREATE INDEX `incidents_asset_idx` ON `incidents` (`asset_id`);--> statement-breakpoint
CREATE INDEX `incidents_due_at_idx` ON `incidents` (`due_at`);--> statement-breakpoint
CREATE INDEX `incidents_assigned_email_idx` ON `incidents` (`assigned_to_email`);--> statement-breakpoint
CREATE TABLE `license_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`license_id` text NOT NULL,
	`employee_id` text,
	`asset_id` text,
	`assigned_at` text NOT NULL,
	`returned_at` text,
	`notes` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `license_assignments_license_idx` ON `license_assignments` (`license_id`);--> statement-breakpoint
CREATE INDEX `license_assignments_employee_idx` ON `license_assignments` (`employee_id`);--> statement-breakpoint
CREATE INDEX `license_assignments_asset_idx` ON `license_assignments` (`asset_id`);--> statement-breakpoint
CREATE TABLE `licenses` (
	`id` text PRIMARY KEY NOT NULL,
	`software_id` text NOT NULL,
	`license_key` text DEFAULT '' NOT NULL,
	`license_type` text DEFAULT 'commercial' NOT NULL,
	`seats` integer DEFAULT 1 NOT NULL,
	`seats_used` integer DEFAULT 0 NOT NULL,
	`purchase_date` text,
	`expiry_date` text,
	`cost` real,
	`vendor_contact` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `licenses_software_idx` ON `licenses` (`software_id`);--> statement-breakpoint
CREATE INDEX `licenses_expiry_idx` ON `licenses` (`expiry_date`);--> statement-breakpoint
CREATE TABLE `software` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`vendor` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`version` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `software_name_idx` ON `software` (`name`);