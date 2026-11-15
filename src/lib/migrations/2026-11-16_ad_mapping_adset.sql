-- Ad Mapping: also allow mapping by Meta adset id (utm_term / meta_adset_id)
ALTER TABLE ad_slug_mappings DROP CONSTRAINT IF EXISTS ad_slug_mappings_match_type_check;
ALTER TABLE ad_slug_mappings ADD CONSTRAINT ad_slug_mappings_match_type_check CHECK (match_type IN ('ad', 'adset', 'campaign'));
