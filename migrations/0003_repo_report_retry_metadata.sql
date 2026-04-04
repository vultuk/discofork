ALTER TABLE repo_reports
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_state TEXT NOT NULL DEFAULT 'none' CHECK (retry_state IN ('none', 'retrying', 'terminal')),
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error_message TEXT,
  ADD COLUMN IF NOT EXISTS failure_history JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS repo_reports_retry_state_idx
  ON repo_reports(retry_state);

CREATE INDEX IF NOT EXISTS repo_reports_next_retry_at_idx
  ON repo_reports(next_retry_at DESC)
  WHERE next_retry_at IS NOT NULL;
