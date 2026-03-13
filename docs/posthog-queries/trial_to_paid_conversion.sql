-- trial_to_paid_conversion.sql
-- Trial to paid conversion rate by plan_key and signup cohort week
-- Requires Stripe data source connected to PostHog warehouse

SELECT
    toStartOfWeek(trial_activated_at) AS cohort_week,
    properties.plan_key               AS plan_key,
    count(DISTINCT distinct_id)       AS trials_started,

    -- Paid conversion: subscription_activated event from Stripe source
    -- (replace 'subscription_activated' with actual Stripe-sourced event name)
    countDistinctIf(
        distinct_id,
        event = 'subscription_activated'
    )                                 AS converted_to_paid,

    round(100.0 * countDistinctIf(
        distinct_id,
        event = 'subscription_activated'
    ) / nullIf(count(DISTINCT distinct_id), 0), 1) AS conversion_rate_pct

FROM (
    SELECT
        distinct_id,
        properties.plan_key,
        min(timestamp) AS trial_activated_at
    FROM events
    WHERE
        event = 'trial_activated'
        AND timestamp >= now() - INTERVAL 90 DAY
    GROUP BY distinct_id, properties.plan_key
) trials
LEFT JOIN events ON trials.distinct_id = events.distinct_id
    AND events.event = 'subscription_activated'
    AND events.timestamp > trials.trial_activated_at

GROUP BY cohort_week, plan_key
ORDER BY cohort_week DESC, trials_started DESC
