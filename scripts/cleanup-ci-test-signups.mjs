import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const args = new Set(process.argv.slice(2));
const execute = args.has('--execute');
const runIdArg = process.argv.find((arg) => arg.startsWith('--run-id='));
const expiredHoursArg = process.argv.find((arg) => arg.startsWith('--expired-hours='));
const runId = runIdArg?.slice('--run-id='.length) || null;
const expiredHours = expiredHoursArg ? Number(expiredHoursArg.slice('--expired-hours='.length)) : null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}
if (!runId && !(Number.isFinite(expiredHours) && expiredHours > 0)) {
  throw new Error('Provide an exact --run-id=<id> or --expired-hours=<hours> scope');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listAllUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

function isInScope(user) {
  const metadata = user.app_metadata || {};
  if (metadata.is_ci_test !== true || typeof metadata.ci_run_id !== 'string') return false;
  if (runId) return metadata.ci_run_id === runId;

  const expiresAt = Date.parse(metadata.ci_expires_at || '');
  const ageCutoff = Date.now() - expiredHours * 60 * 60 * 1000;
  return Number.isFinite(expiresAt)
    ? expiresAt <= Date.now()
    : Date.parse(user.created_at) <= ageCutoff;
}

async function deleteRows(table, column, value) {
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (error) throw new Error(`${table}.${column} cleanup failed: ${error.message}`);
}

async function cleanupAccount(accountId) {
  for (const table of [
    'phone_number_assignments',
    'call_pattern_alerts',
    'account_credits',
    'sms_messages',
    'provisioning_jobs',
    'vapi_assistants',
  ]) {
    await deleteRows(table, 'account_id', accountId);
  }

  const { error: referralError } = await supabase
    .from('referrals')
    .delete()
    .or(`referrer_account_id.eq.${accountId},referee_account_id.eq.${accountId}`);
  if (referralError) throw new Error(`referrals cleanup failed: ${referralError.message}`);

  const { error: phoneError } = await supabase
    .from('phone_numbers')
    .delete()
    .or(`account_id.eq.${accountId},assigned_account_id.eq.${accountId}`);
  if (phoneError) throw new Error(`phone_numbers cleanup failed: ${phoneError.message}`);

  const { error: accountError, count } = await supabase
    .from('accounts')
    .delete({ count: 'exact' })
    .eq('id', accountId);
  if (accountError) throw new Error(`accounts cleanup failed: ${accountError.message}`);
  if (count !== 1) throw new Error(`Expected to delete one CI account ${accountId}, deleted ${count ?? 0}`);
}

async function resolveAccountId(user) {
  const metadataAccountId = user.app_metadata?.ci_account_id;
  if (typeof metadataAccountId === 'string' && metadataAccountId.length > 0) return metadataAccountId;

  const { data, error } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw new Error(`Could not resolve CI account for ${user.id}: ${error.message}`);
  return data?.account_id || null;
}

const users = (await listAllUsers()).filter(isInScope);
if (users.length > 100) {
  throw new Error(`Safety limit exceeded: refusing to clean ${users.length} CI users`);
}

console.log(`${execute ? 'Cleaning' : 'Would clean'} ${users.length} authenticated CI signup(s)`);
for (const user of users) {
  const accountId = await resolveAccountId(user);
  console.log(`${execute ? 'Cleaning' : 'Candidate'} run=${user.app_metadata.ci_run_id} user=${user.id} account=${accountId}`);
  if (!execute) continue;

  if (accountId) await cleanupAccount(accountId);
  const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
  if (authError) throw new Error(`Auth cleanup failed for ${user.id}: ${authError.message}`);
}

if (execute) {
  const remaining = (await listAllUsers()).filter(isInScope);
  if (remaining.length > 0) {
    throw new Error(`Cleanup verification failed: ${remaining.length} scoped CI user(s) remain`);
  }
  console.log('CI signup cleanup verified');
}
