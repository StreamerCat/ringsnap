/**
 * call-classifier.ts
 *
 * Shared module for classifying inbound calls as:
 *   live        — billable handled call from a real customer
 *   verification — non-billable setup call from an allowlisted internal number
 *   excluded    — not billable (spam, silent hangup, failed connect, duplicate, etc.)
 *
 * Also writes to call_billing_ledger (idempotent via unique constraint on
 * account_id + provider_call_id) and increments calls_used_current_period.
 *
 * Billable call definition:
 *   Count 1 billable call when an inbound customer call is answered and
 *   meaningfully handled by the AI.
 *   Exclude:
 *     - spam-blocked calls
 *     - failed connects
 *     - internal test calls (verification allowlist)
 *     - provider retries / duplicate events
 *     - silent hangups under 10 seconds
 *     - clearly broken calls with no meaningful handling
 *   If AI answers then transfers: count once, not twice.
 *   Dedup key: stable provider call ID (vapi_call_id).
 */

export type CallKind = 'live' | 'verification' | 'excluded';

export interface ClassifyCallInput {
  accountId: string;
  providerCallId: string;          // Vapi call ID — used as dedupe key
  callerNumber: string | null;
  durationSeconds: number;
  endedReason?: string | null;     // Vapi endedReason field
  isTransfer?: boolean;
  callLogId?: string | null;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
}

export interface CallClassification {
  callKind: CallKind;
  billable: boolean;
  billableReason?: string;
  excludedReason?: string;
  estimatedCogsCents?: number;
}

/**
 * Classify a completed call.
 * Does NOT write to the DB — caller handles the write.
 */
export function classifyCall(
  input: ClassifyCallInput,
  isVerificationNumber: boolean,
  isTrial: boolean,
): CallClassification {
  const { durationSeconds, endedReason, callerNumber, isTransfer } = input;

  // 1. Verification call (from allowlisted owner/admin/staff number)
  if (isVerificationNumber) {
    return { callKind: 'verification', billable: false, excludedReason: 'verification_call' };
  }

  // 2. Silent hangup under 10 seconds
  if (durationSeconds < 10) {
    return {
      callKind: 'excluded',
      billable: false,
      excludedReason: 'silent_hangup_under_10s',
    };
  }

  // 3. Failed connect / voicemail drop
  if (endedReason && ['no-answer', 'busy', 'failed', 'machine_detected_greeting_ended'].includes(endedReason)) {
    return {
      callKind: 'excluded',
      billable: false,
      excludedReason: `failed_connect:${endedReason}`,
    };
  }

  // 4. Meaningful call — billable
  // Rough COGS estimate based on duration.
  // Average AI call cost ~ $0.15–$0.25/min; use $0.20/min as baseline.
  const estimatedCogsCents = Math.round((durationSeconds / 60) * 20);

  return {
    callKind: 'live',
    billable: true,
    billableReason: 'handled_call',
    estimatedCogsCents,
  };
}

/**
 * Margin monitoring thresholds.
 * Log/flag if avg duration or call patterns exceed these.
 */
export const MARGIN_FLAGS = {
  avgDurationWarnMinutes: 2.7,
  avgDurationAlertMinutes: 3.0,
  proAccountMonthlyCallsWarn: 540,
} as const;

/**
 * Write a call to the billing ledger and update usage counters.
 * Idempotent: ON CONFLICT DO UPDATE only refreshes metadata, does not
 * re-increment counters if counted_in_usage is already true.
 *
 * Returns { inserted: boolean, alreadyCounted: boolean }
 */
export async function writeBillingLedgerEntry(
  supabase: any,
  input: {
    accountId: string;
    providerCallId: string;
    callLogId: string | null;
    callStartedAt: string;
    callEndedAt: string | null;
    durationSeconds: number;
    classification: CallClassification;
    planSnapshot: {
      planKey: string;
      planVersion: number;
      billingUnit: string;
      includedCalls: number;
      overageRateCents: number;
      maxOverageCalls: number;
      overflowMode: string;
    };
    billingPeriodStart: string | null;
    billingPeriodEnd: string | null;
    callsUsedBefore: number;
  }
): Promise<{ inserted: boolean; alreadyCounted: boolean; error?: string }> {
  const {
    accountId, providerCallId, callLogId,
    callStartedAt, callEndedAt, durationSeconds,
    classification, planSnapshot, billingPeriodStart, billingPeriodEnd, callsUsedBefore,
  } = input;

  // Check existing entry first for idempotency
  const { data: existing } = await supabase
    .from('call_billing_ledger')
    .select('id, counted_in_usage')
    .eq('account_id', accountId)
    .eq('provider_call_id', providerCallId)
    .maybeSingle();

  if (existing?.counted_in_usage) {
    return { inserted: false, alreadyCounted: true };
  }

  const callsUsedAfter = classification.billable ? callsUsedBefore + 1 : callsUsedBefore;

  const ledgerRow = {
    account_id: accountId,
    provider_call_id: providerCallId,
    call_log_id: callLogId,
    call_started_at: callStartedAt,
    call_ended_at: callEndedAt,
    duration_seconds: durationSeconds,

    call_kind: classification.callKind,
    billable: classification.billable,
    billable_reason: classification.billableReason ?? null,
    excluded_reason: classification.excludedReason ?? null,
    blocked_over_limit: false,

    plan_key_snapshot: planSnapshot.planKey,
    plan_version_snapshot: planSnapshot.planVersion,
    billing_unit_snapshot: planSnapshot.billingUnit,
    included_calls_snapshot: planSnapshot.includedCalls,
    overage_rate_cents_snapshot: planSnapshot.overageRateCents,
    max_overage_calls_snapshot: planSnapshot.maxOverageCalls,
    overflow_mode_snapshot: planSnapshot.overflowMode,

    calls_used_before: callsUsedBefore,
    calls_used_after: callsUsedAfter,

    billing_period_start: billingPeriodStart,
    billing_period_end: billingPeriodEnd,

    counted_in_usage: classification.billable,
    counted_at: classification.billable ? new Date().toISOString() : null,

    estimated_cogs_cents: classification.estimatedCogsCents ?? null,
  };

  const { error } = await supabase
    .from('call_billing_ledger')
    .upsert(ledgerRow, { onConflict: 'account_id,provider_call_id' });

  if (error) {
    return { inserted: false, alreadyCounted: false, error: error.message };
  }

  // If billable, increment calls_used_current_period atomically
  if (classification.billable && !existing) {
    await supabase.rpc('increment_calls_used', {
      p_account_id: accountId,
      p_delta: 1,
    });
  }

  return { inserted: true, alreadyCounted: false };
}
