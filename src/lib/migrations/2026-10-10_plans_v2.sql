-- New plan lineup: 2 Days / 15 Days / 1 Month / 1 Year. Safe to re-run.
BEGIN;

-- Old plans are deactivated, not deleted — payments/subscriptions still reference them
INSERT INTO plans (name, original_price, price, duration_days, description)
SELECT v.name, v.original_price, v.price, v.duration_days, v.description
FROM (VALUES
  ('2 Days',   299,  149, 2,   'Do din ka full access'),
  ('15 Days',  499,  199, 15,  'Aadhe mahine ka mazza'),
  ('1 Month',  699,  299, 30,  'Poora mahine ka mazza'),
  ('1 Year',   1499, 399, 365, 'Poore saal ka unlimited mazza')
) AS v(name, original_price, price, duration_days, description)
WHERE NOT EXISTS (
  SELECT 1 FROM plans p
  WHERE p.name = v.name AND p.price = v.price AND p.duration_days = v.duration_days
);

UPDATE plans SET is_active = (name, price, duration_days) IN (
  ('2 Days', 149, 2), ('15 Days', 199, 15), ('1 Month', 299, 30), ('1 Year', 399, 365)
);

COMMIT;

SELECT id, name, price, original_price, duration_days, is_active FROM plans ORDER BY is_active DESC, price;
