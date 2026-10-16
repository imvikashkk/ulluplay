-- Landing page A/B test (/auth). Safe to re-run.
CREATE TABLE IF NOT EXISTS app_settings (
  key        VARCHAR(50) PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO app_settings (key, value)
VALUES ('landing_ab', '{"enabled": false, "splitB": 50, "run": 1, "fallback": "a", "startedAt": null}')
ON CONFLICT (key) DO NOTHING;

-- One row per visitor per test run; restarting the test bumps `run` so everyone is re-counted
CREATE TABLE IF NOT EXISTS landing_visits (
  run        INTEGER     NOT NULL,
  visitor_id VARCHAR(40) NOT NULL,
  variant    CHAR(1)     NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run, visitor_id)
);

-- Variant a user saw when they entered their number (first touch within a run)
ALTER TABLE users ADD COLUMN IF NOT EXISTS lp_run     INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lp_variant CHAR(1);
ALTER TABLE users ADD COLUMN IF NOT EXISTS lp_at      TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_lp_run ON users(lp_run) WHERE lp_run IS NOT NULL;
