-- Where a lead / payment got its pixel from: url (?c=) | mapping (Ad Mapping row) | history | default | manual
ALTER TABLE payments           ADD COLUMN IF NOT EXISTS attribution_via VARCHAR(10);
ALTER TABLE payments           ADD COLUMN IF NOT EXISTS ad_mapping_id   INTEGER;
ALTER TABLE phone_attributions ADD COLUMN IF NOT EXISTS attribution_via VARCHAR(10);
ALTER TABLE phone_attributions ADD COLUMN IF NOT EXISTS ad_mapping_id   INTEGER;
CREATE INDEX IF NOT EXISTS idx_payments_ad_mapping ON payments(ad_mapping_id) WHERE ad_mapping_id IS NOT NULL;

-- #3823 / #3824 were attributed by hand (nginx log) before this existed
UPDATE payments SET attribution_via = 'manual' WHERE id IN (3823, 3824) AND attribution_via IS NULL;
