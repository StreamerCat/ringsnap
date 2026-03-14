-- activation_by_plan.sql
-- Activation rate (trial → first_value_reached) broken down by plan_key
-- and median hours-to-activation

SELECT
    plan_key,
    count(DISTINCT distinct_id)           AS trials,
    countDistinctIf(
        distinct_id,
        reached_first_value = 1
    )                                     AS activated,
    round(100.0 * countDistinctIf(
        distinct_id,
        reached_first_value = 1
    ) / nullIf(count(DISTINCT distinct_id), 0), 1) AS activation_rate_pct,

    -- Median hours from trial_activated to first_value_reached
    median(hours_to_activation)           AS median_hours_to_activation,
    round(avg(hours_to_activation), 1)    AS avg_hours_to_activation
FROM (
    SELECT
        t.distinct_id,
        t.plan_key,
        t.trial_at,
        if(f.first_value_at IS NOT NULL, 1, 0) AS reached_first_value,
        dateDiff('hour', t.trial_at, f.first_value_at) AS hours_to_activation
    FROM (
        SELECT
            distinct_id,
            properties.plan_key AS plan_key,
            min(timestamp) AS trial_at
        FROM events
        WHERE event = 'trial_activated'
          AND timestamp >= now() - INTERVAL 90 DAY
        GROUP BY distinct_id, plan_key
    ) t
    LEFT JOIN (
        SELECT distinct_id, min(timestamp) AS first_value_at
        FROM events
        WHERE event = 'first_value_reached'
          AND timestamp >= now() - INTERVAL 90 DAY
        GROUP BY distinct_id
    ) f ON t.distinct_id = f.distinct_id
)
GROUP BY plan_key
ORDER BY trials DESC
