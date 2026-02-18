CREATE TABLE `daily_logs` (
	`date` text PRIMARY KEY NOT NULL,
	`water_intake` integer DEFAULT 0,
	`routine_completed` integer DEFAULT false,
	`daily_bloat_score` integer,
	`sodium_status` text DEFAULT 'safe'
);
--> statement-breakpoint
CREATE TABLE `face_scans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`score` integer NOT NULL,
	`feedback` text,
	`flagged_areas` text,
	`local_image_uri` text
);
--> statement-breakpoint
CREATE TABLE `food_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`log_date` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`food_name` text,
	`sodium_estimate_mg` integer,
	`bloat_risk_level` text,
	`ai_reasoning` text,
	`local_image_uri` text,
	FOREIGN KEY (`log_date`) REFERENCES `daily_logs`(`date`) ON UPDATE no action ON DELETE no action
);
