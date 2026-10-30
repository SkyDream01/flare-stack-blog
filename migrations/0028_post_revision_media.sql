-- Media a Post Revision uses (its body images and its Post Cover) stays in use,
-- so restoring the revision never brings back an image that was deleted. A
-- revision never changes after it is written, so its references are taken
-- once, by the trigger below, whatever code inserts it; deleting the revision
-- (or its Post) drops them through the foreign key. Media usage queries then
-- read this indexed table instead of scanning revision JSON.
CREATE TABLE `post_revision_media` (
	`revision_id` integer NOT NULL,
	`media_id` integer NOT NULL,
	PRIMARY KEY(`revision_id`, `media_id`),
	FOREIGN KEY (`revision_id`) REFERENCES `post_revisions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_revision_media_media_idx` ON `post_revision_media` (`media_id`);
--> statement-breakpoint
-- An image's key is its src path after `/images/`, without query or fragment,
-- as extractImageKey reads it. Triggers cannot use WITH, so the expression is
-- written out in both statements.
INSERT OR IGNORE INTO `post_revision_media` (`revision_id`, `media_id`)
SELECT `post_revisions`.`id`, `media`.`id`
FROM `post_revisions`
JOIN `media` ON `media`.`id` = json_extract(`post_revisions`.`snapshot_json`, '$.coverMediaId')
UNION
SELECT `revision_id`, `media`.`id`
FROM (
	SELECT `revision_id`,
		CASE WHEN instr(`path`, '#') > 0 THEN substr(`path`, 1, instr(`path`, '#') - 1) ELSE `path` END AS `key`
	FROM (
		SELECT `revision_id`,
			CASE WHEN instr(`rest`, '?') > 0 THEN substr(`rest`, 1, instr(`rest`, '?') - 1) ELSE `rest` END AS `path`
		FROM (
			SELECT `post_revisions`.`id` AS `revision_id`,
				substr(json_extract(`node`.`value`, '$.attrs.src'), instr(json_extract(`node`.`value`, '$.attrs.src'), '/images/') + 8) AS `rest`
			FROM `post_revisions`, json_tree(`post_revisions`.`snapshot_json`, '$.contentJson') AS `node`
			WHERE `node`.`type` = 'object'
				AND json_extract(`node`.`value`, '$.type') = 'image'
				AND instr(json_extract(`node`.`value`, '$.attrs.src'), '/images/') > 0
		)
	)
) AS `image`
JOIN `media` ON `media`.`key` = `image`.`key`;
--> statement-breakpoint
CREATE TRIGGER `post_revisions_media_ai` AFTER INSERT ON `post_revisions` BEGIN
	INSERT OR IGNORE INTO `post_revision_media` (`revision_id`, `media_id`)
	SELECT NEW.`id`, `media`.`id`
	FROM `media`
	WHERE `media`.`id` = json_extract(NEW.`snapshot_json`, '$.coverMediaId')
	UNION
	SELECT NEW.`id`, `media`.`id`
	FROM (
		SELECT CASE WHEN instr(`path`, '#') > 0 THEN substr(`path`, 1, instr(`path`, '#') - 1) ELSE `path` END AS `key`
		FROM (
			SELECT CASE WHEN instr(`rest`, '?') > 0 THEN substr(`rest`, 1, instr(`rest`, '?') - 1) ELSE `rest` END AS `path`
			FROM (
				SELECT substr(json_extract(`node`.`value`, '$.attrs.src'), instr(json_extract(`node`.`value`, '$.attrs.src'), '/images/') + 8) AS `rest`
				FROM json_tree(NEW.`snapshot_json`, '$.contentJson') AS `node`
				WHERE `node`.`type` = 'object'
					AND json_extract(`node`.`value`, '$.type') = 'image'
					AND instr(json_extract(`node`.`value`, '$.attrs.src'), '/images/') > 0
			)
		)
	) AS `image`
	JOIN `media` ON `media`.`key` = `image`.`key`;
END;
