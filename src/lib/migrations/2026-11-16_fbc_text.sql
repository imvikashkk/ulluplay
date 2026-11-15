-- fbc = "fb.1.<ms>.<fbclid>" — Meta's fbclid regularly pushes it past 200 chars,
-- which made the payments INSERT fail with "value too long". varchar → text is metadata-only (no rewrite).
ALTER TABLE payments           ALTER COLUMN fbc TYPE TEXT, ALTER COLUMN fbp TYPE TEXT;
ALTER TABLE phone_attributions ALTER COLUMN fbc TYPE TEXT, ALTER COLUMN fbp TYPE TEXT;
