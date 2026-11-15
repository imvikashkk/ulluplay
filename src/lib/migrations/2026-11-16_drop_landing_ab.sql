-- Landing A/B test removed (variant B deleted) — run AFTER the new code is deployed
DROP INDEX IF EXISTS idx_users_lp_run;
ALTER TABLE users DROP COLUMN IF EXISTS lp_run, DROP COLUMN IF EXISTS lp_variant, DROP COLUMN IF EXISTS lp_at;
DROP TABLE IF EXISTS landing_visits;
DROP TABLE IF EXISTS app_settings;
