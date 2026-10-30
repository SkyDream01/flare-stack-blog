-- uniqueKeyOf (src/lib/unicode-text) now folds case fully (ẞ equals ß equals
-- ss) and ignores Default_Ignorable characters (a variation selector after an
-- emoji, a Hangul filler). Keys the app computed under the old rules for
-- values outside printable ASCII and CJK ideographs can differ from what it
-- computes now, so they are cleared: NULL means "compute me", and the app
-- fills them in before its next uniqueness check (unique-keys.ts), parking a
-- value whose new key another row already holds, as it does for any duplicate
-- found that way.
--
-- Keys of printable ASCII and CJK ideograph values are untouched: those are
-- lower() of the value under both rules, which migration 0029 computed in SQL.
-- That includes the parked keys 0029 gave to duplicates among them.
--
-- A parked key of a value cleared here is cleared with it. Rows are settled
-- in id order, so of values that now fold together the oldest keeps the key,
-- and a printable ASCII or CJK row holding it keeps it first.

UPDATE `tags`
SET `name_key` = NULL
WHERE `name` GLOB '*[^ -~一-鿿]*';
--> statement-breakpoint
UPDATE `categories`
SET `name_key` = NULL
WHERE `name` GLOB '*[^ -~一-鿿]*';
--> statement-breakpoint
UPDATE `posts`
SET `slug_key` = NULL
WHERE `slug` GLOB '*[^ -~一-鿿]*';
--> statement-breakpoint
UPDATE `posts`
SET `public_slug_key` = NULL
WHERE `public_slug` IS NOT NULL AND `public_slug` GLOB '*[^ -~一-鿿]*';
