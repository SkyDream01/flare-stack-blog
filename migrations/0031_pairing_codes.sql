-- Pairing Codes (ADR 0035): each Admin's current code, one row per Admin, so
-- generating a code replaces the older one. Only a SHA-256 hash of the code is
-- kept. Exchanging it sets paired_at, agent_name and api_key_id; the key itself
-- lives in `apikey`, and deleting it there leaves this record as it is.
CREATE TABLE `pairing_codes` (
	`user_id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`cancelled_at` integer,
	`paired_at` integer,
	`agent_name` text,
	`api_key_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pairing_codes_code_hash_unique` ON `pairing_codes` (`code_hash`);
