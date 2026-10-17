-- 2 Days plan price 149 → 169. Safe to re-run.
BEGIN;

-- Old row is deactivated, not updated — existing subscriptions keep showing ₹149
INSERT INTO plans (name, original_price, price, duration_days, description)
SELECT '2 Days', 299, 169, 2, 'Do din ka full access'
WHERE NOT EXISTS (
  SELECT 1 FROM plans WHERE name = '2 Days' AND price = 169 AND duration_days = 2
);

UPDATE plans SET is_active = (price = 169) WHERE name = '2 Days' AND duration_days = 2;

COMMIT;

SELECT id, name, price, original_price, duration_days, is_active FROM plans ORDER BY is_active DESC, price;
