import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function read(file: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

describe('Go-live contract checks (edge functions + schema map)', () => {
  it('create-trial keeps async provisioning semantics and idempotency headers', () => {
    const src = read('supabase/functions/create-trial/index.ts');
    expect(src).toContain('idempotency-key');
    expect(src).toContain('provisioning_status');
    expect(src).toContain('provisioning_jobs');
    expect(src).toContain('pending');
    expect(src).toContain('posthog.flush()');
    expect(src).not.toContain('posthog.shutdown()');
    expect(src).toContain('Provisioning paused; durable job remains queued');
    expect(src).toMatch(/await capturePostHogEvent\('trial_activated'/);
    expect(src).toContain('billing_status: \'trial\'');
    expect(src).toContain('stripeCustomerIdempotencyKey');
    expect(src).toContain('stripeSubscriptionIdempotencyKey');
  });

  it('the signup UI sends a stable request idempotency key', () => {
    const frontend = read('src/pages/OnboardingChat.tsx');

    expect(frontend).toContain('leadData.id ?? signupRequestIdRef.current');
  });

  it('captures trial activation only on the server after core signup', () => {
    const backend = read('supabase/functions/create-trial/index.ts');
    const frontend = read('src/pages/OnboardingChat.tsx');

    expect(backend.match(/capturePostHogEvent\('trial_activated'/g)).toHaveLength(1);
    expect(frontend).not.toMatch(/capture\('trial_activated'/);
    expect(backend).toContain('}, currentAccountId);');
  });

  it('pauses queue consumption without burning retries and persists retry timing', () => {
    const worker = read('supabase/functions/provision-vapi/index.ts');

    expect(worker).toContain('ENABLE_VAPI_PROVISIONING');
    expect(worker).toContain('!== "true"');
    expect(worker).toContain('paused: true, processed: 0');
    expect(worker).toContain('retry_after: retryAfter');
    expect(worker).toContain('if (job.retry_after)');
    expect(worker).toContain('Provisioning job already claimed by another worker');
    expect(worker).toContain('WORKER_LEASE_EXPIRED');
  });

  it('enforces one active provisioning job per account and type', () => {
    const migration = read('supabase/migrations/20260831150000_durable_provisioning_job_uniqueness.sql');

    expect(migration).toContain('CREATE UNIQUE INDEX');
    expect(migration).toContain('(account_id, job_type)');
    expect(migration).toContain("status IN ('queued', 'processing', 'failed')");
  });

  it('stripe-webhook enforces signature verification and idempotency persistence', () => {
    const src = read('supabase/functions/stripe-webhook/index.ts');
    expect(src).toContain('stripe-signature');
    expect(src).toContain('crypto.subtle.sign');
    expect(src).toMatch(/webhook_events|processed_events|event\.id/);
  });

  it('provisioning path links phone + assistant and marks completed status', () => {
    const src = read('supabase/functions/provision-account/index.ts') + '\n' + read('supabase/functions/provision-resources/index.ts');
    expect(src).toMatch(/vapi_assistant_id|vapi_number_id|phone_number_e164/);
    expect(src).toContain('provisioning_status');
    expect(src).toContain('completed');
  });

  it('VAPI booking tool is resilient to optional fields and supports idempotent insert', () => {
    const src = read('supabase/functions/vapi-tools-appointments/index.ts');
    expect(src).toContain('Missing required arguments');
    expect(src).toContain('23505');
    expect(src).toContain('toolCallId');
  });

  it('ER map export includes intended relationships for launch assertions', () => {
    const graph = JSON.parse(read('account_graph_analysis.json'));
    expect(graph.level_1_happy_state?.checklist?.length).toBeGreaterThan(5);
    expect(graph.level_2_happy_state?.checklist?.length).toBeGreaterThan(5);
    expect(graph.relationships?.profile_to_account).toContain('accounts.id');
    expect(graph.relationships?.account_to_phone_numbers).toContain('phone_numbers.account_id');
  });
});
