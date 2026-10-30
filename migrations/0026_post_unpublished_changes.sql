-- Unpublished Changes are decided by content: a fingerprint of the draft's
-- title, summary, slug, content, publication date, cover, Category and Tags
-- (not pin) is compared with the one taken when the Post was published, so
-- undoing an edit clears them, and the comparison runs in SQL for the list
-- filter. Publishing writes both columns together with the snapshot; every
-- other write that can change those fields sets `draft_fingerprint` to NULL.
--
-- The fingerprints are SHA-256 hashes computed in the app, which SQLite cannot
-- reproduce, so this migration cannot fill them in. It leaves NULL on every
-- Post, which the app reads as "not computed yet": the first Admin read of a
-- published Post, or of the Post list, computes the draft fingerprint from the
-- current draft and the published fingerprint from the Post's latest publish
-- Post Revision, which holds the draft as it was published. Nothing is lost
-- or guessed by leaving NULL: a Post never shows Unpublished Changes until
-- both are computed.
ALTER TABLE `posts` ADD `draft_fingerprint` text;
--> statement-breakpoint
ALTER TABLE `posts` ADD `published_fingerprint` text;
