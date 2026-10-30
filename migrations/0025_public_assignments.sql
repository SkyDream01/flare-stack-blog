-- A Post's Category and Tags publish with it (ADR 0033): the public site reads
-- these public assignments, written together with the Public Content Snapshot,
-- instead of the draft's `category_id` and `post_tags`. Deleting a Category or
-- Tag still removes it from the public site at once, through the foreign keys.
ALTER TABLE `posts` ADD `public_category_id` integer REFERENCES categories(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX `posts_public_category_id_idx` ON `posts` (`public_category_id`);
--> statement-breakpoint
CREATE TABLE `post_public_tags` (
	`post_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`post_id`, `tag_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_public_tags_tag_idx` ON `post_public_tags` (`tag_id`);
--> statement-breakpoint
-- Published Posts showed their current assignments until now, so those become
-- their public ones and the public site does not change. The snapshot's own
-- copy of the ids is brought in line with them as well.
UPDATE `posts` SET
	`public_category_id` = `category_id`,
	`public_snapshot_json` = json_set(
		`public_snapshot_json`,
		'$.categoryId', `category_id`,
		'$.tagIds', json((
			SELECT json_group_array(`tag_id`)
			FROM (
				SELECT `tag_id` FROM `post_tags`
				WHERE `post_tags`.`post_id` = `posts`.`id`
				ORDER BY `tag_id`
			)
		))
	)
WHERE `public_snapshot_json` IS NOT NULL;
--> statement-breakpoint
INSERT INTO `post_public_tags` (`post_id`, `tag_id`)
SELECT `post_tags`.`post_id`, `post_tags`.`tag_id`
FROM `post_tags`
JOIN `posts` ON `posts`.`id` = `post_tags`.`post_id`
WHERE `posts`.`public_snapshot_json` IS NOT NULL;
