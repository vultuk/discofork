-- Legacy workers update exact full_name keys and acknowledge jobs even if an
-- update matches no row. An ordinary rolling deployment must not rewrite keys.
-- After verified backup/isolated restore and draining ALL legacy consumers,
-- the recovery operator applies this migration in one explicit transaction:
--   SET LOCAL discofork.legacy_workers_drained = 'verified';
-- and records this filename in schema_migrations in that same transaction.
-- Do not add this acknowledgement to deployment environment/configuration.
DO $$
BEGIN
  IF current_setting('discofork.legacy_workers_drained', true) IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'Canonical repository migration requires a verified legacy-worker drain'
      USING HINT = 'Keep migration unapplied until backup/restore and all legacy consumers are verified stopped; use a session-local acknowledgement only in the operator transaction.';
  END IF;
END
$$;

LOCK TABLE repo_reports IN ACCESS EXCLUSIVE MODE;

WITH ranked_repo_reports AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY lower(full_name)
      ORDER BY
        CASE
          WHEN status = 'ready' AND report_json IS NOT NULL THEN 3
          WHEN status = 'processing' THEN 2
          WHEN status = 'queued' THEN 1
          ELSE 0
        END DESC,
        updated_at DESC,
        created_at DESC,
        full_name ASC
    ) AS duplicate_rank
  FROM repo_reports
)
DELETE FROM repo_reports
WHERE ctid IN (
  SELECT ctid
  FROM ranked_repo_reports
  WHERE duplicate_rank > 1
);

UPDATE repo_reports
SET
  full_name = lower(full_name),
  owner = lower(owner),
  repo = lower(repo),
  github_url = 'https://github.com/' || lower(full_name)
WHERE
  full_name <> lower(full_name)
  OR owner <> lower(owner)
  OR repo <> lower(repo)
  OR github_url <> 'https://github.com/' || lower(full_name);

CREATE UNIQUE INDEX IF NOT EXISTS repo_reports_full_name_lower_idx
  ON repo_reports ((lower(full_name)));
