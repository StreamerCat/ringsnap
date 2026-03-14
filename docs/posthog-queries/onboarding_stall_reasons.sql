-- onboarding_stall_reasons.sql
-- For users who reached trial_activated but NOT first_value_reached within 48h,
-- shows the last onboarding_step_completed before they stalled
-- Helps identify which onboarding step is the biggest drop-off

SELECT
    last_step_completed,
    count(DISTINCT distinct_id)   AS users_stalled,
    round(100.0 * count(DISTINCT distinct_id)
          / sum(count(DISTINCT distinct_id)) OVER (), 1) AS pct_of_stalled
FROM (
    SELECT
        t.distinct_id,
        coalesce(
            argMax(s.properties.step_name, s.timestamp),
            'no_step_completed'
        ) AS last_step_completed
    FROM (
        -- Users who activated but did not reach first_value_reached within 48h
        SELECT DISTINCT t.distinct_id
        FROM events t
        LEFT JOIN events fv
            ON t.distinct_id = fv.distinct_id
            AND fv.event = 'first_value_reached'
            AND fv.timestamp BETWEEN t.timestamp AND t.timestamp + INTERVAL 48 HOUR
        WHERE
            t.event = 'trial_activated'
            AND t.timestamp >= now() - INTERVAL 30 DAY
            AND t.timestamp <= now() - INTERVAL 48 HOUR  -- Only count after 48h window
            AND fv.distinct_id IS NULL
    ) t
    LEFT JOIN events s
        ON t.distinct_id = s.distinct_id
        AND s.event = 'onboarding_step_completed'
        AND s.timestamp >= now() - INTERVAL 30 DAY
    GROUP BY t.distinct_id
)
GROUP BY last_step_completed
ORDER BY users_stalled DESC
