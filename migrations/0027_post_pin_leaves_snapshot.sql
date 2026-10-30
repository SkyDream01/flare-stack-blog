-- Pinning takes effect at once and no longer lives in the Public Content
-- Snapshot (ADR 0033): the public site orders by posts.pinned_at. Until now a
-- list toggle only wrote the draft's pinned_at while the site read the
-- snapshot's, so the two can differ. Make each published Post's pinned_at what
-- the site shows today, so public ordering is unchanged on deploy. The
-- snapshot stores an ISO timestamp, the column unix seconds. Drafts keep
-- their pinned_at. Raw SQL leaves save_token and updated_at alone.
UPDATE `posts`
SET `pinned_at` = CAST(
  strftime('%s', json_extract(`public_snapshot_json`, '$.pinnedAt')) AS integer
)
WHERE `public_snapshot_json` IS NOT NULL;
