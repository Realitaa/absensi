CREATE TABLE `attendance_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`session_id` integer NOT NULL,
	`room_id` integer NOT NULL,
	`latitude` real,
	`longitude` real,
	`accuracy` real,
	`calculated_distance` real,
	`validation_policy` text,
	`result` text NOT NULL,
	`rejection_reason` text,
	`attempted_at` integer NOT NULL,
	`attendance_id` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`attendance_id`) REFERENCES `attendances`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `attendance_attempts_student_id_idx` ON `attendance_attempts` (`student_id`);--> statement-breakpoint
CREATE INDEX `attendance_attempts_session_id_idx` ON `attendance_attempts` (`session_id`);--> statement-breakpoint
CREATE INDEX `attendance_attempts_room_id_idx` ON `attendance_attempts` (`room_id`);--> statement-breakpoint
CREATE INDEX `attendance_attempts_attendance_id_idx` ON `attendance_attempts` (`attendance_id`);--> statement-breakpoint
CREATE INDEX `attendance_attempts_result_idx` ON `attendance_attempts` (`result`);--> statement-breakpoint
CREATE INDEX `attendance_attempts_attempted_at_idx` ON `attendance_attempts` (`attempted_at`);--> statement-breakpoint
CREATE TABLE `attendance_corrections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attendance_id` integer NOT NULL,
	`lecturer_id` integer NOT NULL,
	`previous_status` text NOT NULL,
	`new_status` text NOT NULL,
	`reason` text NOT NULL,
	`corrected_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`attendance_id`) REFERENCES `attendances`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`lecturer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `attendance_corrections_attendance_id_idx` ON `attendance_corrections` (`attendance_id`);--> statement-breakpoint
CREATE INDEX `attendance_corrections_lecturer_id_idx` ON `attendance_corrections` (`lecturer_id`);--> statement-breakpoint
CREATE TABLE `attendances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`session_id` integer NOT NULL,
	`status` text NOT NULL,
	`attendance_timestamp` integer NOT NULL,
	`latitude` real,
	`longitude` real,
	`accuracy` real,
	`calculated_distance` real,
	`validation_policy` text NOT NULL,
	`photo_path` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendances_student_session_unique` ON `attendances` (`student_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `attendances_student_id_idx` ON `attendances` (`student_id`);--> statement-breakpoint
CREATE INDEX `attendances_session_id_idx` ON `attendances` (`session_id`);--> statement-breakpoint
CREATE INDEX `attendances_status_idx` ON `attendances` (`status`);--> statement-breakpoint
CREATE INDEX `attendances_timestamp_idx` ON `attendances` (`attendance_timestamp`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`role` text NOT NULL,
	`nim` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_nim_unique` ON `users` (`nim`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `users_deleted_at_idx` ON `users` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`radius` real NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rooms_name_idx` ON `rooms` (`name`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lecturer_id` integer NOT NULL,
	`room_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`starts_at` integer NOT NULL,
	`late_threshold_at` integer NOT NULL,
	`closes_at` integer NOT NULL,
	`manually_closed_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`lecturer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `sessions_lecturer_id_idx` ON `sessions` (`lecturer_id`);--> statement-breakpoint
CREATE INDEX `sessions_room_id_idx` ON `sessions` (`room_id`);--> statement-breakpoint
CREATE INDEX `sessions_starts_at_idx` ON `sessions` (`starts_at`);--> statement-breakpoint
CREATE INDEX `sessions_closes_at_idx` ON `sessions` (`closes_at`);--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gps_validation_policy` text NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	CONSTRAINT "system_settings_singleton_check" CHECK("system_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `photo_uploads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`photo_path` text NOT NULL,
	`status` text NOT NULL,
	`uploaded_at` integer NOT NULL,
	`consumed_at` integer,
	`attendance_id` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`attendance_id`) REFERENCES `attendances`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `photo_uploads_user_id_idx` ON `photo_uploads` (`user_id`);--> statement-breakpoint
CREATE INDEX `photo_uploads_status_idx` ON `photo_uploads` (`status`);--> statement-breakpoint
CREATE INDEX `photo_uploads_attendance_id_idx` ON `photo_uploads` (`attendance_id`);--> statement-breakpoint
CREATE INDEX `photo_uploads_uploaded_at_idx` ON `photo_uploads` (`uploaded_at`);