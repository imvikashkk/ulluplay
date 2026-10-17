-- Lifetime plan at 599 (36500 days ≈ 100 years). Safe to re-run.
INSERT INTO plans (name, original_price, price, duration_days, description)
SELECT 'Lifetime', 2999, 599, 36500, 'Ek baar lo, hamesha ka mazza'
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Lifetime' AND price = 599);

SELECT id, name, price, original_price, duration_days, is_active FROM plans ORDER BY is_active DESC, price;
