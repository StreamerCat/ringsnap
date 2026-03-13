/**
 * Admin data hooks — centralized data fetching for the admin control center.
 * All hooks are admin-only; they should only be called after auth verification.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Plan pricing from DB (authoritative source) ────────────────────────────

export interface Plan {
  plan_key: string;
  display_name: string;
  base_price_cents: number;
  included_minutes: number;
  overage_rate_cents: number;
  stripe_price_id: string;
  trial_days: number;
  trial_minutes: number;
  is_active: boolean;
  sort_order: number;
}

export function useAdminPlans() {
  return useQuery<Plan[]>({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Account overview (for KPI cards) ───────────────────────────────────────

export interface AccountSummaryRow {
  id: string;
  company_name: string;
  plan_type: string | null;
  plan_key: string | null;
  subscription_status: string | null;
  account_status: string | null;
  trial_active: boolean;
  trial_end_date: string | null;
  trial_minutes_used: number;
  trial_minutes_limit: number;
  monthly_minutes_used: number | null;
  minutes_used_current_period: number;
  created_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
}

export function useAdminAccounts() {
  return useQuery<AccountSummaryRow[]>({
    queryKey: ["admin-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select(
          "id, company_name, plan_type, plan_key, subscription_status, account_status, " +
          "trial_active, trial_end_date, trial_minutes_used, trial_minutes_limit, " +
          "monthly_minutes_used, minutes_used_current_period, created_at, " +
          "stripe_customer_id, stripe_subscription_id, current_period_end"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        company_name: row.company_name as string,
        plan_type: (row.plan_type as string | null) ?? null,
        plan_key: (row.plan_key as string | null) ?? null,
        subscription_status: (row.subscription_status as string | null) ?? null,
        account_status: (row.account_status as string | null) ?? null,
        trial_active: Boolean(row.trial_active),
        trial_end_date: (row.trial_end_date as string | null) ?? null,
        trial_minutes_used: Number(row.trial_minutes_used) || 0,
        trial_minutes_limit: Number(row.trial_minutes_limit) || 50,
        monthly_minutes_used: row.monthly_minutes_used != null ? Number(row.monthly_minutes_used) : null,
        minutes_used_current_period: Number(row.minutes_used_current_period) || 0,
        created_at: (row.created_at as string | null) ?? null,
        stripe_customer_id: (row.stripe_customer_id as string | null) ?? null,
        stripe_subscription_id: (row.stripe_subscription_id as string | null) ?? null,
        current_period_end: (row.current_period_end as string | null) ?? null,
      }));
    },
    staleTime: 60_000,
  });
}

export interface AccountDetailRow extends AccountSummaryRow {
  trade: string | null;
  phone_number_area_code: string | null;
  provisioning_status: string | null;
  provisioning_error: string | null;
  is_flagged_for_review: boolean | null;
  flagged_reason: string | null;
  monthly_minutes_limit: number | null;
  overage_minutes_used: number | null;
  sales_rep_name: string | null;
  onboarding_completed: boolean | null;
  profiles: Array<{
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    is_primary: boolean | null;
  }>;
}

export function useAdminAccountDetail(accountId: string | null) {
  return useQuery<AccountDetailRow | null>({
    queryKey: ["admin-account-detail", accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data, error } = await supabase
        .from("accounts")
        .select(
          "id, company_name, plan_type, plan_key, subscription_status, account_status, " +
          "trial_active, trial_end_date, trial_minutes_used, trial_minutes_limit, " +
          "monthly_minutes_used, minutes_used_current_period, created_at, " +
          "stripe_customer_id, stripe_subscription_id, current_period_end, " +
          "trade, phone_number_area_code, provisioning_status, provisioning_error, " +
          "is_flagged_for_review, flagged_reason, monthly_minutes_limit, " +
          "overage_minutes_used, sales_rep_name, onboarding_completed, " +
          "profiles!left(id, name, email, phone, is_primary)"
        )
        .eq("id", accountId)
        .single();
      if (error) throw error;
      if (!data) return null;
      const row = data as Record<string, unknown>;
      const profiles = Array.isArray(row.profiles) ? row.profiles : [];
      return {
        id: row.id as string,
        company_name: row.company_name as string,
        plan_type: (row.plan_type as string | null) ?? null,
        plan_key: (row.plan_key as string | null) ?? null,
        subscription_status: (row.subscription_status as string | null) ?? null,
        account_status: (row.account_status as string | null) ?? null,
        trial_active: Boolean(row.trial_active),
        trial_end_date: (row.trial_end_date as string | null) ?? null,
        trial_minutes_used: Number(row.trial_minutes_used) || 0,
        trial_minutes_limit: Number(row.trial_minutes_limit) || 50,
        monthly_minutes_used: row.monthly_minutes_used != null ? Number(row.monthly_minutes_used) : null,
        minutes_used_current_period: Number(row.minutes_used_current_period) || 0,
        created_at: (row.created_at as string | null) ?? null,
        stripe_customer_id: (row.stripe_customer_id as string | null) ?? null,
        stripe_subscription_id: (row.stripe_subscription_id as string | null) ?? null,
        current_period_end: (row.current_period_end as string | null) ?? null,
        trade: (row.trade as string | null) ?? null,
        phone_number_area_code: (row.phone_number_area_code as string | null) ?? null,
        provisioning_status: (row.provisioning_status as string | null) ?? null,
        provisioning_error: (row.provisioning_error as string | null) ?? null,
        is_flagged_for_review: row.is_flagged_for_review as boolean | null,
        flagged_reason: (row.flagged_reason as string | null) ?? null,
        monthly_minutes_limit: row.monthly_minutes_limit != null ? Number(row.monthly_minutes_limit) : null,
        overage_minutes_used: row.overage_minutes_used != null ? Number(row.overage_minutes_used) : null,
        sales_rep_name: (row.sales_rep_name as string | null) ?? null,
        onboarding_completed: row.onboarding_completed as boolean | null,
        profiles: profiles.map((p: Record<string, unknown>) => ({
          id: p.id as string,
          name: (p.name as string | null) ?? null,
          email: (p.email as string | null) ?? null,
          phone: (p.phone as string | null) ?? null,
          is_primary: p.is_primary as boolean | null,
        })),
      };
    },
    enabled: !!accountId,
    staleTime: 30_000,
  });
}

// ─── Daily call stats ────────────────────────────────────────────────────────

export interface DailyCallStat {
  call_date: string;
  call_count: number;
  total_call_seconds: number;
  total_call_minutes: number;
  total_cost_cents: number;
}

export function useAdminCallStats() {
  return useQuery<DailyCallStat[]>({
    queryKey: ["admin-call-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_daily_call_stats" as "accounts")
        .select("*")
        .order("call_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        call_date: row.call_date as string,
        call_count: Number(row.call_count) || 0,
        total_call_seconds: Number(row.total_call_seconds) || 0,
        total_call_minutes: Number(row.total_call_minutes) || 0,
        total_cost_cents: Number(row.total_cost_cents) || 0,
      }));
    },
    staleTime: 60_000,
  });
}

// ─── Flagged accounts ────────────────────────────────────────────────────────

export interface FlaggedAccount {
  account_id: string;
  company_name: string;
  plan_type: string | null;
  provisioning_status: string | null;
  provisioning_error: string | null;
  account_status: string | null;
  is_flagged_for_review: boolean | null;
  flagged_reason: string | null;
  monthly_minutes_used: number | null;
  monthly_minutes_limit: number | null;
  created_at: string | null;
  updated_at: string | null;
  total_alerts: number;
  last_alert_at: string | null;
  alert_types: string[] | null;
}

export function useAdminFlaggedAccounts() {
  return useQuery<FlaggedAccount[]>({
    queryKey: ["admin-flagged-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_flagged_accounts" as "accounts")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        account_id: row.account_id as string,
        company_name: row.company_name as string,
        plan_type: (row.plan_type as string | null) ?? null,
        provisioning_status: (row.provisioning_status as string | null) ?? null,
        provisioning_error: (row.provisioning_error as string | null) ?? null,
        account_status: (row.account_status as string | null) ?? null,
        is_flagged_for_review: row.is_flagged_for_review as boolean | null,
        flagged_reason: (row.flagged_reason as string | null) ?? null,
        monthly_minutes_used: row.monthly_minutes_used != null ? Number(row.monthly_minutes_used) : null,
        monthly_minutes_limit: row.monthly_minutes_limit != null ? Number(row.monthly_minutes_limit) : null,
        created_at: (row.created_at as string | null) ?? null,
        updated_at: (row.updated_at as string | null) ?? null,
        total_alerts: Number(row.total_alerts) || 0,
        last_alert_at: (row.last_alert_at as string | null) ?? null,
        alert_types: row.alert_types as string[] | null,
      }));
    },
    staleTime: 60_000,
  });
}

// ─── Provisioning failures ───────────────────────────────────────────────────

export interface ProvisioningFailure {
  account_id: string;
  company_name: string;
  provisioning_status: string | null;
  provisioning_error: string | null;
  updated_at: string | null;
}

export function useAdminProvisioningFailures() {
  return useQuery<ProvisioningFailure[]>({
    queryKey: ["admin-provisioning-failures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_provisioning_failures" as "accounts")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ProvisioningFailure[];
    },
    staleTime: 60_000,
  });
}

// ─── Analytics events (system health) ───────────────────────────────────────

export interface AnalyticsEvent {
  id: string;
  event_type: string;
  account_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export function useAdminRecentEvents(hours = 24) {
  return useQuery<AnalyticsEvent[]>({
    queryKey: ["admin-recent-events", hours],
    queryFn: async () => {
      const threshold = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("analytics_events")
        .select("id, event_type, account_id, created_at, metadata")
        .gte("created_at", threshold)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AnalyticsEvent[];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

// ─── Edge function errors ────────────────────────────────────────────────────

export interface EdgeFunctionError {
  id: string;
  created_at: string | null;
  alert_type: string | null;
  severity: string | null;
  account_id: string | null;
  company_name: string | null;
  alert_details: Record<string, unknown> | null;
  function_name: string | null;
  error_message: string | null;
  request_id: string | null;
}

export function useAdminEdgeFunctionErrors() {
  return useQuery<EdgeFunctionError[]>({
    queryKey: ["admin-edge-errors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_edge_function_error_feed" as "accounts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as EdgeFunctionError[];
    },
    staleTime: 30_000,
  });
}

// ─── Usage alerts ────────────────────────────────────────────────────────────

export interface UsageAlert {
  id: string;
  account_id: string;
  alert_type: string;
  sent_at: string;
  period_start: string | null;
  metadata: Record<string, unknown> | null;
}

export function useAdminUsageAlerts() {
  return useQuery<UsageAlert[]>({
    queryKey: ["admin-usage-alerts"],
    queryFn: async () => {
      // NOTE: usage_alerts has service_role-only RLS — may not return data for authenticated users.
      // If this returns empty, it needs a service-role edge function or an admin view.
      const { data, error } = await supabase
        .from("usage_alerts")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(100);
      if (error) {
        console.warn("usage_alerts query failed (likely RLS):", error.message);
        return [];
      }
      return (data ?? []) as UsageAlert[];
    },
    staleTime: 60_000,
  });
}

// ─── Staff users ─────────────────────────────────────────────────────────────

export interface StaffUser {
  id: string;
  email: string;
  role: string;
  name: string;
  phone: string;
  created_at: string;
}

export function useAdminStaffUsers() {
  return useQuery<StaffUser[]>({
    queryKey: ["admin-staff-users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-staff-users");
      if (error) throw error;
      return (data?.users ?? []) as StaffUser[];
    },
    staleTime: 5 * 60_000,
  });
}
