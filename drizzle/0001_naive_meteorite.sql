PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_components` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`component_type` text DEFAULT '' NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`min_stock` integer DEFAULT 1 NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`unit_cost` real,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_components`("id", "name", "component_type", "brand", "model", "stock", "min_stock", "location", "unit_cost", "notes", "created_at", "updated_at") SELECT "id", "name", "component_type", "brand", "model", "stock", "min_stock", "location", "unit_cost", "notes", "created_at", "updated_at" FROM `components`;--> statement-breakpoint
DROP TABLE `components`;--> statement-breakpoint
ALTER TABLE `__new_components` RENAME TO `components`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `components_name_idx` ON `components` (`name`);