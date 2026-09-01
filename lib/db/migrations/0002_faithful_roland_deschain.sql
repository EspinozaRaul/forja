CREATE TABLE `body_measurements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` integer NOT NULL,
	`weight` real,
	`body_fat` real,
	`chest` real,
	`waist` real,
	`hips` real,
	`arms` real,
	`thighs` real,
	`notes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `progress_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` integer NOT NULL,
	`uri` text NOT NULL,
	`body_part` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `routine_folders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#00F5A0',
	`icon` text DEFAULT '📁',
	`created_at` integer NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_routine_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`routine_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`order` integer NOT NULL,
	`target_sets` integer DEFAULT 3,
	`target_reps` integer DEFAULT 10,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_routine_exercises`("id", "routine_id", "exercise_id", "order", "target_sets", "target_reps") SELECT "id", "routine_id", "exercise_id", "order", "target_sets", "target_reps" FROM `routine_exercises`;--> statement-breakpoint
DROP TABLE `routine_exercises`;--> statement-breakpoint
ALTER TABLE `__new_routine_exercises` RENAME TO `routine_exercises`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_session_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`order` integer NOT NULL,
	`rest_time` integer DEFAULT 60,
	`notes` text,
	`note_type` text,
	`superset_pair_id` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_session_exercises`("id", "session_id", "exercise_id", "order", "rest_time", "notes", "note_type", "superset_pair_id") SELECT "id", "session_id", "exercise_id", "order", "rest_time", "notes", "note_type", "superset_pair_id" FROM `session_exercises`;--> statement-breakpoint
DROP TABLE `session_exercises`;--> statement-breakpoint
ALTER TABLE `__new_session_exercises` RENAME TO `session_exercises`;--> statement-breakpoint
CREATE INDEX `se_session_idx` ON `session_exercises` (`session_id`);--> statement-breakpoint
CREATE INDEX `se_exercise_idx` ON `session_exercises` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`routine_id` integer,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`duration` integer,
	`notes` text,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "routine_id", "started_at", "completed_at", "duration", "notes") SELECT "id", "routine_id", "started_at", "completed_at", "duration", "notes" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
ALTER TABLE `exercises` ADD `equipment` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `target_muscle` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `muscle_group` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `body_part` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `secondary_muscles` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `instructions_es` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `gif_url` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `original_id` text;--> statement-breakpoint
ALTER TABLE `routines` ADD `folder_id` integer REFERENCES routine_folders(id);--> statement-breakpoint
ALTER TABLE `sets` ADD `partial_reps` integer;--> statement-breakpoint
CREATE INDEX `sets_session_exercise_idx` ON `sets` (`session_exercise_id`);