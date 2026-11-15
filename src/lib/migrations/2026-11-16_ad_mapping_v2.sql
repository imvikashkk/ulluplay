-- Ad Mapping v2: one row holds ad id + adset id + campaign id (each optional, at least one).
-- The most specific id filled in (ad → adset → campaign) is what gets matched; the others record
-- which adset / campaign the ad belongs to and are saved on the lead + payment when the URL lacks them.
-- Step 1 of 2 — keeps the old match_type / meta_id columns so the currently deployed code keeps working.
ALTER TABLE ad_slug_mappings ADD COLUMN IF NOT EXISTS ad_id       VARCHAR(40);
ALTER TABLE ad_slug_mappings ADD COLUMN IF NOT EXISTS adset_id    VARCHAR(40);
ALTER TABLE ad_slug_mappings ADD COLUMN IF NOT EXISTS campaign_id VARCHAR(40);
UPDATE ad_slug_mappings SET ad_id       = meta_id WHERE match_type = 'ad'       AND ad_id IS NULL;
UPDATE ad_slug_mappings SET adset_id    = meta_id WHERE match_type = 'adset'    AND adset_id IS NULL;
UPDATE ad_slug_mappings SET campaign_id = meta_id WHERE match_type = 'campaign' AND campaign_id IS NULL;
ALTER TABLE ad_slug_mappings ALTER COLUMN match_type DROP NOT NULL, ALTER COLUMN meta_id DROP NOT NULL;
ALTER TABLE ad_slug_mappings DROP CONSTRAINT IF EXISTS ad_slug_mappings_any_id;
ALTER TABLE ad_slug_mappings ADD CONSTRAINT ad_slug_mappings_any_id CHECK (ad_id IS NOT NULL OR adset_id IS NOT NULL OR campaign_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS ad_slug_mappings_ids_key
  ON ad_slug_mappings (COALESCE(ad_id, ''), COALESCE(adset_id, ''), COALESCE(campaign_id, ''));

-- zenz-cp2 ad: also record its adset (seen in the nginx log for payment #3823)
UPDATE ad_slug_mappings SET adset_id = '120248366307590144', campaign_id = '120248347529370144'
 WHERE ad_id = '120248366307600144' AND adset_id IS NULL AND campaign_id IS NULL;
