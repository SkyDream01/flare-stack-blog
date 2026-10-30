-- Tag and Category names, Post slugs and public slugs are unique ignoring
-- case and Unicode compatibility forms (NFKC), and the database now enforces
-- it: each gets a key column, the value as uniqueKeyOf (src/lib/unicode-text)
-- computes it, under a unique index. Writes set the key with the value.
--
-- SQL has no NFKC, so this migration fills the key only where SQLite's
-- lower() is that key: values of printable ASCII and CJK ideographs alone.
-- Any other value is left NULL, which means "compute me", and the app fills
-- it in before its next uniqueness check (unique-keys.data.ts).
--
-- Duplicates in existing data, compared with lower() as the app used to:
--   * Tags and Categories differing only in case are merged into the oldest
--     (lowest id): their Posts, draft and public, move to it, and the others
--     are deleted. Those Posts get their fingerprints computed again and a new
--     saveToken, as deleting a Tag does.
--   * Post slugs and public slugs are not renamed: a rename would move a live
--     page or change a draft behind the Admin's back. The oldest Post holds
--     the key; each later one keeps its slug and gets a parked key (the key, a
--     U+0001 and its id), which no real key can equal. It can be saved with
--     that slug unchanged, as before, but no other Post can take the slug.
-- The app parks values that turn out to be duplicates only under NFKC in the
-- same way when it computes their keys.

ALTER TABLE `tags` ADD `name_key` text;
--> statement-breakpoint
ALTER TABLE `categories` ADD `name_key` text;
--> statement-breakpoint
ALTER TABLE `posts` ADD `slug_key` text;
--> statement-breakpoint
ALTER TABLE `posts` ADD `public_slug_key` text;
--> statement-breakpoint
-- Lookups by lower() while deduplicating, dropped at the end.
CREATE INDEX `tags_lower_name_tmp` ON `tags` (lower(`name`), `id`);
--> statement-breakpoint
CREATE INDEX `categories_lower_name_tmp` ON `categories` (lower(`name`), `id`);
--> statement-breakpoint
CREATE INDEX `posts_lower_slug_tmp` ON `posts` (lower(`slug`), `id`);
--> statement-breakpoint
CREATE INDEX `posts_lower_public_slug_tmp` ON `posts` (lower(`public_slug`), `id`);
--> statement-breakpoint
-- Tags: Posts carrying a Tag that is merged away are touched first.
UPDATE `posts`
SET `draft_fingerprint` = NULL,
	`published_fingerprint` = NULL,
	`save_token` = lower(hex(randomblob(16)))
WHERE `id` IN (
	SELECT `post_id` FROM `post_tags` WHERE `tag_id` IN (
		SELECT `t`.`id` FROM `tags` AS `t`
		WHERE EXISTS (SELECT 1 FROM `tags` AS `k` WHERE lower(`k`.`name`) = lower(`t`.`name`) AND `k`.`id` < `t`.`id`)
	)
	UNION
	SELECT `post_id` FROM `post_public_tags` WHERE `tag_id` IN (
		SELECT `t`.`id` FROM `tags` AS `t`
		WHERE EXISTS (SELECT 1 FROM `tags` AS `k` WHERE lower(`k`.`name`) = lower(`t`.`name`) AND `k`.`id` < `t`.`id`)
	)
);
--> statement-breakpoint
INSERT OR IGNORE INTO `post_tags` (`post_id`, `tag_id`)
SELECT `pt`.`post_id`, (SELECT min(`k`.`id`) FROM `tags` AS `k` WHERE lower(`k`.`name`) = lower(`t`.`name`))
FROM `post_tags` AS `pt`
JOIN `tags` AS `t` ON `t`.`id` = `pt`.`tag_id`
WHERE EXISTS (SELECT 1 FROM `tags` AS `k` WHERE lower(`k`.`name`) = lower(`t`.`name`) AND `k`.`id` < `t`.`id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `post_public_tags` (`post_id`, `tag_id`)
SELECT `pt`.`post_id`, (SELECT min(`k`.`id`) FROM `tags` AS `k` WHERE lower(`k`.`name`) = lower(`t`.`name`))
FROM `post_public_tags` AS `pt`
JOIN `tags` AS `t` ON `t`.`id` = `pt`.`tag_id`
WHERE EXISTS (SELECT 1 FROM `tags` AS `k` WHERE lower(`k`.`name`) = lower(`t`.`name`) AND `k`.`id` < `t`.`id`);
--> statement-breakpoint
DELETE FROM `post_tags`
WHERE `tag_id` IN (
	SELECT `t`.`id` FROM `tags` AS `t`
	WHERE EXISTS (SELECT 1 FROM `tags` AS `k` WHERE lower(`k`.`name`) = lower(`t`.`name`) AND `k`.`id` < `t`.`id`)
);
--> statement-breakpoint
DELETE FROM `post_public_tags`
WHERE `tag_id` IN (
	SELECT `t`.`id` FROM `tags` AS `t`
	WHERE EXISTS (SELECT 1 FROM `tags` AS `k` WHERE lower(`k`.`name`) = lower(`t`.`name`) AND `k`.`id` < `t`.`id`)
);
--> statement-breakpoint
DELETE FROM `tags`
WHERE `id` IN (
	SELECT `t`.`id` FROM `tags` AS `t`
	WHERE EXISTS (SELECT 1 FROM `tags` AS `k` WHERE lower(`k`.`name`) = lower(`t`.`name`) AND `k`.`id` < `t`.`id`)
);
--> statement-breakpoint
-- Categories, the same way.
UPDATE `posts`
SET `draft_fingerprint` = NULL,
	`published_fingerprint` = NULL,
	`save_token` = lower(hex(randomblob(16)))
WHERE `category_id` IN (
	SELECT `c`.`id` FROM `categories` AS `c`
	WHERE EXISTS (SELECT 1 FROM `categories` AS `k` WHERE lower(`k`.`name`) = lower(`c`.`name`) AND `k`.`id` < `c`.`id`)
) OR `public_category_id` IN (
	SELECT `c`.`id` FROM `categories` AS `c`
	WHERE EXISTS (SELECT 1 FROM `categories` AS `k` WHERE lower(`k`.`name`) = lower(`c`.`name`) AND `k`.`id` < `c`.`id`)
);
--> statement-breakpoint
UPDATE `posts`
SET `category_id` = (
	SELECT min(`k`.`id`) FROM `categories` AS `k`
	WHERE lower(`k`.`name`) = (SELECT lower(`c`.`name`) FROM `categories` AS `c` WHERE `c`.`id` = `posts`.`category_id`)
)
WHERE `category_id` IN (
	SELECT `c`.`id` FROM `categories` AS `c`
	WHERE EXISTS (SELECT 1 FROM `categories` AS `k` WHERE lower(`k`.`name`) = lower(`c`.`name`) AND `k`.`id` < `c`.`id`)
);
--> statement-breakpoint
UPDATE `posts`
SET `public_category_id` = (
	SELECT min(`k`.`id`) FROM `categories` AS `k`
	WHERE lower(`k`.`name`) = (SELECT lower(`c`.`name`) FROM `categories` AS `c` WHERE `c`.`id` = `posts`.`public_category_id`)
)
WHERE `public_category_id` IN (
	SELECT `c`.`id` FROM `categories` AS `c`
	WHERE EXISTS (SELECT 1 FROM `categories` AS `k` WHERE lower(`k`.`name`) = lower(`c`.`name`) AND `k`.`id` < `c`.`id`)
);
--> statement-breakpoint
DELETE FROM `categories`
WHERE `id` IN (
	SELECT `c`.`id` FROM `categories` AS `c`
	WHERE EXISTS (SELECT 1 FROM `categories` AS `k` WHERE lower(`k`.`name`) = lower(`c`.`name`) AND `k`.`id` < `c`.`id`)
);
--> statement-breakpoint
-- Keys. `NOT GLOB '*[^ -~一-鿿]*'`: every character is printable ASCII or a
-- CJK ideograph (U+4E00 to U+9FFF), whose NFKC is itself and whose only case
-- is ASCII's.
UPDATE `tags`
SET `name_key` = lower(`name`)
WHERE `name` NOT GLOB '*[^ -~一-鿿]*';
--> statement-breakpoint
UPDATE `categories`
SET `name_key` = lower(`name`)
WHERE `name` NOT GLOB '*[^ -~一-鿿]*';
--> statement-breakpoint
UPDATE `posts`
SET `slug_key` = CASE
	WHEN EXISTS (SELECT 1 FROM `posts` AS `k` WHERE lower(`k`.`slug`) = lower(`posts`.`slug`) AND `k`.`id` < `posts`.`id`)
	THEN lower(`slug`) || char(1) || `id`
	ELSE lower(`slug`)
END
WHERE `slug` NOT GLOB '*[^ -~一-鿿]*';
--> statement-breakpoint
UPDATE `posts`
SET `public_slug_key` = CASE
	WHEN EXISTS (SELECT 1 FROM `posts` AS `k` WHERE lower(`k`.`public_slug`) = lower(`posts`.`public_slug`) AND `k`.`id` < `posts`.`id`)
	THEN lower(`public_slug`) || char(1) || `id`
	ELSE lower(`public_slug`)
END
WHERE `public_slug` IS NOT NULL AND `public_slug` NOT GLOB '*[^ -~一-鿿]*';
--> statement-breakpoint
DROP INDEX `tags_lower_name_tmp`;
--> statement-breakpoint
DROP INDEX `categories_lower_name_tmp`;
--> statement-breakpoint
DROP INDEX `posts_lower_slug_tmp`;
--> statement-breakpoint
DROP INDEX `posts_lower_public_slug_tmp`;
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_key_unique` ON `tags` (`name_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_key_unique` ON `categories` (`name_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_key_unique` ON `posts` (`slug_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_public_slug_key_unique` ON `posts` (`public_slug_key`);
