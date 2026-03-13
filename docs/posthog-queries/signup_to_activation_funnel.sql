-- signup_to_activation_funnel.sql
-- Full funnel from first page view to first_value_reached (activation)
-- Run in PostHog SQL Editor (HogQL / ClickHouse compatible)
--
-- Funnel steps:
--   1. form_started        (signup intent)
--   2. form_submitted      (lead captured)
--   3. checkout_started    (payment intent)
--   4. checkout_completed  (trial started)
--   5. trial_activated     (account created)
--   6. first_value_reached (test call completed)

SELECT
    countIf(step >= 1) AS form_started,
    countIf(step >= 2) AS form_submitted,
    countIf(step >= 3) AS checkout_started,
    countIf(step >= 4) AS checkout_completed,
    countIf(step >= 5) AS trial_activated,
    countIf(step >= 6) AS first_value_reached,

    -- Conversion rates between each step
    round(100.0 * countIf(step >= 2) / nullIf(countIf(step >= 1), 0), 1) AS pct_lead_captured,
    round(100.0 * countIf(step >= 3) / nullIf(countIf(step >= 2), 0), 1) AS pct_checkout_intent,
    round(100.0 * countIf(step >= 4) / nullIf(countIf(step >= 3), 0), 1) AS pct_checkout_completed,
    round(100.0 * countIf(step >= 5) / nullIf(countIf(step >= 4), 0), 1) AS pct_trial_activated,
    round(100.0 * countIf(step >= 6) / nullIf(countIf(step >= 5), 0), 1) AS pct_first_value,

    -- End-to-end
    round(100.0 * countIf(step >= 6) / nullIf(countIf(step >= 1), 0), 1) AS pct_end_to_end
FROM (
    SELECT
        distinct_id,
        maxIf(1, event = 'form_started')        +
        maxIf(1, event = 'form_submitted')       +
        maxIf(1, event = 'checkout_started')     +
        maxIf(1, event = 'checkout_completed')   +
        maxIf(1, event = 'trial_activated')      +
        maxIf(1, event = 'first_value_reached')  AS step
    FROM events
    WHERE
        event IN ('form_started', 'form_submitted', 'checkout_started',
                  'checkout_completed', 'trial_activated', 'first_value_reached')
        AND timestamp >= now() - INTERVAL 30 DAY
    GROUP BY distinct_id
)
