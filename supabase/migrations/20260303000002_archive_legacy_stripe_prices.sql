-- Archive legacy Stripe-priced plans by clearly labeling them as OLD
-- Keeps stripe_price_id values unchanged.

UPDATE public.plan_definitions
SET name = CASE plan_type
  WHEN 'starter' THEN 'Starter OLD'
  WHEN 'professional' THEN 'Professional OLD'
  WHEN 'premium' THEN 'Premium OLD'
  ELSE name
END
WHERE plan_type IN ('starter', 'professional', 'premium');
