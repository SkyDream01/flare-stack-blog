-- Every write to a Post replaces its save token, so a save that states the
-- token it read can refuse an Edit Conflict (ADR 0031). SQLite cannot add a
-- NOT NULL column with an expression default, so existing Posts are backfilled
-- with a random token after the column is added; the app sets it on insert.
ALTER TABLE `posts` ADD `save_token` text NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE `posts` SET `save_token` = lower(hex(randomblob(16)));
