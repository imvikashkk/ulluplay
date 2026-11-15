-- Ad Mapping v2, step 2 of 2 — run AFTER the new code is deployed: drop the old single-id columns
ALTER TABLE ad_slug_mappings DROP COLUMN IF EXISTS match_type, DROP COLUMN IF EXISTS meta_id;
