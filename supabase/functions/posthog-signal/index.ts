/**
 * PostHog Signal Bridge — Supabase Edge Function
 *
 * Receives POST requests from PostHog workflow webhooks and writes them to the
 * posthog_signals table as a durable queue for CrewAI consumption.
 *
 * PostHog → this function → posthog_signals table → CrewAI polls (max 15 min)
 *
 * Security: validates x-posthog-secret header against POSTHOG_SIGNAL_SECRET env var
 * Dedup: skips insert if same dedup_key (signal_type:entity_id) within 30 minutes
 * Rate limit: max 20 signals of same signal_type per hour; returns 429 if exceeded
 *
 * Phase 1 workflows (all inactive — require PostHog UI configuration to activate):
 *   - checkout_failed_spike  → recovery_crew        (max ~3/day)
 *   - onboarding_stalled     → onboarding_crew      (max ~10/day)
 *   - lead_gone_cold         → recovery_crew        (max ~15/day)
 *   - conversion_rate_anomaly → founder_reporting_crew (max 1/day)
 *   - high_cogs_pattern      → abuse_detection_crew (max ~5/day)
 *
 * Total expected daily signals under normal operation: ≤ 34 (well under 50/workflow cap)
 */

import { createClient } from "supabase";

// Declare Deno for TypeScript
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: { get(key: string): string | undefined };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-posthog-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // =========================================================================
  // 1. Authentication — validate shared secret
  // =========================================================================
  const expectedSecret = Deno.env.get('POSTHOG_SIGNAL_SECRET');
  const incomingSecret = req.headers.get('x-posthog-secret');

  if (!expectedSecret) {
    console.error('[posthog-signal] POSTHOG_SIGNAL_SECRET not configured');
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  if (!incomingSecret || incomingSecret !== expectedSecret) {
    console.warn('[posthog-signal] Unauthorized: invalid or missing x-posthog-secret');
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // =========================================================================
  // 2. Parse and validate request body
  // =========================================================================
  let body: {
    signal_type?: string;
    crew_target?: string;
    payload?: Record<string, unknown>;
    entity_id?: string;
    entity_type?: string;
  };

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { signal_type, crew_target, payload, entity_id, entity_type } = body;

  if (!signal_type || typeof signal_type !== 'string') {
    return jsonResponse({ error: 'Missing required field: signal_type' }, 400);
  }
  if (!crew_target || typeof crew_target !== 'string') {
    return jsonResponse({ error: 'Missing required field: crew_target' }, 400);
  }
  if (!payload || typeof payload !== 'object') {
    return jsonResponse({ error: 'Missing required field: payload (must be an object)' }, 400);
  }

  // =========================================================================
  // 3. Initialize Supabase client (service role)
  // =========================================================================
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // =========================================================================
  // 4. Deduplication check
  //    Skip insert if same dedup_key (signal_type:entity_id) within 30 minutes
  // =========================================================================
  const dedupKey = `${signal_type}:${entity_id ?? ''}`;
  const dedupWindowMinutes = 30;
  const dedupWindowISO = new Date(Date.now() - dedupWindowMinutes * 60 * 1000).toISOString();

  const { data: existing, error: dedupError } = await supabase
    .from('posthog_signals')
    .select('id, created_at')
    .eq('dedup_key', dedupKey)
    .gte('created_at', dedupWindowISO)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dedupError) {
    console.error('[posthog-signal] Dedup query error:', dedupError.message);
    // Proceed on query error (fail open for dedup — better to insert than to lose a signal)
  }

  if (existing) {
    console.log(`[posthog-signal] Deduplicated: ${dedupKey} (last seen: ${existing.created_at})`);
    return jsonResponse({ deduplicated: true, existing_id: existing.id });
  }

  // =========================================================================
  // 5. Rate limit check
  //    Max 20 signals of same signal_type per hour
  // =========================================================================
  const rateLimitWindow = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: rateError } = await supabase
    .from('posthog_signals')
    .select('id', { count: 'exact', head: true })
    .eq('signal_type', signal_type)
    .gte('created_at', rateLimitWindow);

  if (rateError) {
    console.error('[posthog-signal] Rate limit query error:', rateError.message);
    // Proceed on error (fail open)
  }

  const MAX_SIGNALS_PER_HOUR = 20;
  if (recentCount !== null && recentCount >= MAX_SIGNALS_PER_HOUR) {
    console.warn(`[posthog-signal] Rate limit exceeded for ${signal_type}: ${recentCount} signals in last hour`);
    return jsonResponse(
      { error: 'Rate limit exceeded', signal_type, count: recentCount, limit: MAX_SIGNALS_PER_HOUR },
      429
    );
  }

  // =========================================================================
  // 6. Insert signal
  // =========================================================================
  const { data: inserted, error: insertError } = await supabase
    .from('posthog_signals')
    .insert({
      signal_type,
      entity_id: entity_id ?? null,
      entity_type: entity_type ?? null,
      payload,
      crew_target,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[posthog-signal] Insert error:', insertError.message);
    return jsonResponse({ error: 'Failed to queue signal', details: insertError.message }, 500);
  }

  console.log(JSON.stringify({
    event: 'posthog_signal_queued',
    id: inserted.id,
    signal_type,
    crew_target,
    entity_id: entity_id ?? null,
    dedup_key: dedupKey,
  }));

  return jsonResponse({ success: true, id: inserted.id });
});
