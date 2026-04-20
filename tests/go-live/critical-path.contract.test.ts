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
