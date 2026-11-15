-- Ad Mapping: names for the adset and ad too (saved on the lead + payment when the URL lacks them)
ALTER TABLE ad_slug_mappings ADD COLUMN IF NOT EXISTS adset_name VARCHAR(200);
ALTER TABLE ad_slug_mappings ADD COLUMN IF NOT EXISTS ad_name    VARCHAR(200);
