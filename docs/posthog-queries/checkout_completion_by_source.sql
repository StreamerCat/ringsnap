-- checkout_completion_by_source.sql
-- Checkout completion rate broken down by acquisition source (UTM)
-- Shows which channels drive the highest-converting signups

SELECT
    properties.utm_source AS source,
    properties.utm_medium AS medium,
    properties.utm_campaign AS campaign,
    countIf(event = 'checkout_started')   AS started,
    countIf(event = 'checkout_completed') AS completed,
    round(100.0 * countIf(event = 'checkout_completed')
          / nullIf(countIf(event = 'checkout_started'), 0), 1) AS completion_rate_pct
FROM events
WHERE
    event IN ('checkout_started', 'checkout_completed')
    AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY source, medium, campaign
ORDER BY started DESC
LIMIT 50
