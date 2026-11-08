CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted` integer NOT NULL,
	`rev` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `goals_rev_idx` ON `goals` (`rev`);--> statement-breakpoint
CREATE TABLE `steps` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted` integer NOT NULL,
	`rev` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `steps_rev_idx` ON `steps` (`rev`);