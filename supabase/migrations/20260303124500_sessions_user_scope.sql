-- Scope initialized session uniqueness by user for URL ingestion flows.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS user_id text;

CREATE INDEX IF NOT EXISTS idx_sessions_user_state
  ON sessions(user_id, state);
