-- ₹199 plan: 15 Days → 7 Days (1 week). Safe to re-run.
BEGIN;

-- Old row is deactivated, not updated — existing subscriptions keep showing 15 Days
INSERT INTO plans (name, original_price, price, duration_days, description)
SELECT '7 Days', 499, 199, 7, 'Poore hafte ka mazza'
WHERE NOT EXISTS (
  SELECT 1 FROM plans WHERE name = '7 Days' AND price = 199 AND duration_days = 7
);

UPDATE plans SET is_active = false WHERE name = '15 Days' AND price = 199 AND duration_days = 15;

COMMIT;

SELECT id, name, price, original_price, duration_days, is_active FROM plans ORDER BY is_active DESC, price;
