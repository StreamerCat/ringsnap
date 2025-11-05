# Logging and Observability

## Structured log format

All edge functions emit structured JSON logs via the shared `supabase/functions/_shared/logging.ts` helper. Each entry contains the following top-level fields:

| Field | Description |
| --- | --- |
| `timestamp` | ISO 8601 timestamp generated at log emission time. |
| `level` | `info`, `warn`, or `error`. |
| `functionName` | The Supabase function handling the request (e.g. `provision-resources`). |
| `correlationId` | Request correlation ID sourced from incoming headers (`requestId`, `x-request-id`, `x-correlation-id`, or `traceparent`). A UUID is generated if none are provided. |
| `accountId` | Account identifier related to the log entry, when available; otherwise `null`. |
| `message` | Human-readable summary of what occurred. |
| `context` | Additional structured metadata with sensitive values automatically redacted (API keys, phone numbers, emails, etc.). |

### Redaction safeguards

Sensitive keys (API tokens, secrets, phone numbers, emails) are masked before the payload is stringified. The helper also sanitizes nested objects and array entries.

## Generating correlation IDs

The `extractCorrelationId(req)` helper reads incoming headers. When a caller already supplies a correlation identifier, it flows through unchanged so downstream services can continue tracing. If none exists, the helper generates a random UUID to keep logs linkable.

> **Tip:** If you are invoking the functions from another service, forward your existing request or trace ID in the `requestId` header to maintain end-to-end visibility.

## Querying logs

### Supabase dashboard

1. Open the Supabase project → **Logs** → **Edge Functions**.
2. Use the following filters:
   - `functionName` equals the function you are investigating.
   - `correlationId` equals the known request or trace ID. This immediately narrows the stream to just the relevant call chain.
   - Filter by `accountId` to isolate customer-specific issues.
3. Expand entries to review the `context` object. Values such as `usagePercentage`, `areaCode`, or error stacks are structured for easy scanning.

Example SQL filter for Supabase Log Explorer:

```sql
select *
from edge_logs
where data->>'functionName' = 'provision-resources'
  and data->>'correlationId' = 'REQUEST-ID-HERE'
order by timestamp desc;
```

### Lovable observability dashboards

If you are using Lovable dashboards, add filters for `functionName` and `correlationId` in the log panel. Lovable treats each JSON field as a searchable facet, so you can:

- Filter by `accountId:"123"` to focus on a single customer.
- Search for `message:"Usage warning"` to locate rate-limit alerts.
- Drill into `context.error.message` when triaging failures.

### Alerting patterns

- **Warn-level logs** (e.g. quota thresholds, validation soft failures) surface actionable trends without paging.
- **Error-level logs** capture structured stack traces and the sanitized request context; they should be wired into alerting pipelines.

## Troubleshooting checklist for on-call engineers

1. Start with the correlation ID from the alerting system or client headers.
2. Filter Supabase/Lovable logs using `correlationId` + `functionName` to collect the complete execution trail.
3. Inspect `context.error` objects for stack traces and upstream response payloads.
4. Review surrounding `info` logs for prerequisite operations (e.g. provisioning steps, external API requests).
5. When escalating, copy the JSON payloads (with redactions already applied) directly into tickets for faster reproduction.
