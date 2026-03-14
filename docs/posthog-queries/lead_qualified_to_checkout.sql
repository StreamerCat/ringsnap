-- lead_qualified_to_checkout.sql
-- Conversion from lead_qualified (booked call) to checkout_started
-- within a 2-hour window — the "lead gone cold" funnel
-- This is the trigger basis for the lead_gone_cold PostHog workflow

SELECT
    toStartOfDay(lq.timestamp)            AS day,
    count(DISTINCT lq.properties.call_id) AS calls_qualified,

    -- checkout_started within 2 hours of lead_qualified
    countDistinctIf(
        lq.properties.call_id,
        cs.checkout_at IS NOT NULL
    )                                     AS converted_to_checkout,

    round(100.0 * countDistinctIf(
        lq.properties.call_id,
        cs.checkout_at IS NOT NULL
    ) / nullIf(count(DISTINCT lq.properties.call_id), 0), 1) AS checkout_conversion_pct,

    -- Cold leads (no checkout within 2h)
    countDistinctIf(
        lq.properties.call_id,
        cs.checkout_at IS NULL
    )                                     AS cold_leads
FROM events lq
LEFT JOIN (
    SELECT
        distinct_id,
        min(timestamp) AS checkout_at
    FROM events
    WHERE event = 'checkout_started'
    GROUP BY distinct_id
) cs ON lq.distinct_id = cs.distinct_id
    AND cs.checkout_at BETWEEN lq.timestamp AND lq.timestamp + INTERVAL 2 HOUR

WHERE
    lq.event = 'lead_qualified'
    AND lq.timestamp >= now() - INTERVAL 30 DAY

GROUP BY day
ORDER BY day DESC
