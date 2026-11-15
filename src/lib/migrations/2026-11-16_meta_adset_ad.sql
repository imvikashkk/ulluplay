-- Meta adset / ad tracking (URL params meta_adset_* / meta_ad_*, or Meta's utm_term / utm_content)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS meta_adset_id   VARCHAR(50);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS meta_adset_name VARCHAR(200);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS meta_ad_id      VARCHAR(50);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS meta_ad_name    VARCHAR(200);
ALTER TABLE phone_attributions ADD COLUMN IF NOT EXISTS meta_adset_id   VARCHAR(50);
ALTER TABLE phone_attributions ADD COLUMN IF NOT EXISTS meta_adset_name VARCHAR(200);
ALTER TABLE phone_attributions ADD COLUMN IF NOT EXISTS meta_ad_id      VARCHAR(50);
ALTER TABLE phone_attributions ADD COLUMN IF NOT EXISTS meta_ad_name    VARCHAR(200);
