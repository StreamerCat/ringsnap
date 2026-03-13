-- cogs_signal_summary.sql
-- Daily COGS signal summary: call volume by bucket, average duration,
-- accounts with high long-call patterns (input for high_cogs_pattern workflow)
-- cogs_bucket: short (<60s), medium (60-179s), long (>=180s)

-- Part 1: Daily call volume by COGS bucket
SELECT
    toStartOfDay(timestamp)           AS day,
    properties.cogs_bucket            AS cogs_bucket,
    count()                           AS calls,
    round(avg(properties.duration_seconds), 0) AS avg_duration_seconds,
    sum(properties.duration_seconds)  AS total_duration_seconds
FROM events
WHERE
    event = 'call_ended'
    AND timestamp >= now() - INTERVAL 30 DAY
    AND properties.cogs_bucket IS NOT NULL
GROUP BY day, cogs_bucket
ORDER BY day DESC, cogs_bucket

;

-- Part 2: Accounts with high long-call count in last 7 days
-- (mirrors the high_cogs_pattern workflow trigger)
SELECT
    properties.account_id             AS account_id,
    count()                           AS long_call_count,
    round(avg(properties.duration_seconds), 0) AS avg_long_duration_seconds,
    min(timestamp)                    AS first_long_call,
    max(timestamp)                    AS last_long_call
FROM events
WHERE
    event = 'call_ended'
    AND properties.cogs_bucket = 'long'
    AND timestamp >= now() - INTERVAL 7 DAY
    AND properties.account_id IS NOT NULL
GROUP BY account_id
HAVING long_call_count > 3  -- lower threshold than the 5-call workflow trigger for early visibility
ORDER BY long_call_count DESC
LIMIT 50
