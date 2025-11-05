-- Supporting views for admin monitoring dashboard

create or replace view admin_provisioning_status_counts as
select
  coalesce(provisioning_status, 'unknown') as provisioning_status,
  count(*)::bigint as account_count,
  count(*) filter (where provisioning_error is not null)::bigint as accounts_with_errors,
  max(updated_at) filter (where provisioning_error is not null) as last_failure_at
from accounts
group by coalesce(provisioning_status, 'unknown');

create or replace view admin_provisioning_failures as
select
  a.id as account_id,
  a.company_name,
  coalesce(a.provisioning_status, 'unknown') as provisioning_status,
  a.provisioning_error,
  greatest(a.updated_at, a.created_at) as updated_at
from accounts a
where a.provisioning_error is not null
   or coalesce(a.provisioning_status, '') in ('failed', 'provisioning');

create or replace view admin_daily_call_stats as
select
  (date_trunc('day', created_at))::date as call_date,
  count(*)::bigint as call_count,
  coalesce(sum(call_duration_seconds), 0)::bigint as total_call_seconds,
  (coalesce(sum(call_duration_seconds), 0)::numeric / 60) as total_call_minutes,
  coalesce(sum(call_cost_cents), 0)::bigint as total_cost_cents
from usage_logs
where created_at is not null
group by (date_trunc('day', created_at))::date;

create or replace view admin_edge_function_error_feed as
select
  cpa.id,
  cpa.created_at,
  cpa.alert_type,
  cpa.severity,
  cpa.auto_flagged,
  cpa.reviewed,
  cpa.account_id,
  a.company_name,
  cpa.alert_details,
  coalesce(cpa.alert_details ->> 'function_name', cpa.alert_details ->> 'function') as function_name,
  coalesce(cpa.alert_details ->> 'error_message', cpa.alert_details ->> 'message') as error_message,
  cpa.alert_details ->> 'request_id' as request_id
from call_pattern_alerts cpa
left join accounts a on a.id = cpa.account_id
where cpa.alert_type is not null
  and lower(cpa.alert_type) like 'edge_function%';

create or replace view admin_flagged_accounts as
select
  a.id as account_id,
  a.company_name,
  a.plan_type,
  a.provisioning_status,
  a.provisioning_error,
  a.account_status,
  a.is_flagged_for_review,
  a.flagged_reason,
  a.monthly_minutes_used,
  a.monthly_minutes_limit,
  a.created_at,
  a.updated_at,
  coalesce(alerts.total_alerts, 0)::bigint as total_alerts,
  alerts.last_alert_at,
  alerts.alert_types
from accounts a
left join (
  select
    account_id,
    count(*)::bigint as total_alerts,
    max(created_at) as last_alert_at,
    array_remove(array_agg(distinct alert_type), null) as alert_types
  from call_pattern_alerts
  group by account_id
) alerts on alerts.account_id = a.id
where coalesce(a.is_flagged_for_review, false) = true
   or a.flagged_reason is not null
   or a.provisioning_error is not null
   or (a.account_status is not null and a.account_status <> 'active')
   or coalesce(alerts.total_alerts, 0) > 0;

-- Allow authenticated dashboard users to read the monitoring views
grant select on admin_provisioning_status_counts to authenticated, service_role;
grant select on admin_provisioning_failures to authenticated, service_role;
grant select on admin_daily_call_stats to authenticated, service_role;
grant select on admin_edge_function_error_feed to authenticated, service_role;
grant select on admin_flagged_accounts to authenticated, service_role;
