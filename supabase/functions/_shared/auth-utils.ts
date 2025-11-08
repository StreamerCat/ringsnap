import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { createHash, randomBytes } from 'node:crypto';

export interface AuthToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface RateLimitConfig {
  maxAttempts: number;
  windowMinutes: number;
}

/**
 * Generate a secure random token and its hash
 */
export function generateToken(length: number = 32): AuthToken {
  const token = randomBytes(length).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash, expiresAt: new Date() };
}

/**
 * Hash a token for storage
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Create a magic link token
 */
export async function createMagicLinkToken(
  supabaseClient: SupabaseClient,
  email: string,
  userId: string | null,
  ttlMinutes: number = 20,
  deviceNonce?: string
): Promise<AuthToken> {
  const { token, tokenHash } = generateToken();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  const { error } = await supabaseClient
    .from('auth_tokens')
    .insert({
      token_type: 'magic_link',
      token_hash: tokenHash,
      email: email.toLowerCase(),
      user_id: userId,
      expires_at: expiresAt.toISOString(),
      device_nonce: deviceNonce,
      meta: {}
    });

  if (error) {
    console.error('Failed to create magic link token:', error);
    throw new Error('Failed to create authentication token');
  }

  return { token, tokenHash, expiresAt };
}

/**
 * Create an invite token
 */
export async function createInviteToken(
  supabaseClient: SupabaseClient,
  email: string,
  accountId: string,
  role: string,
  invitedBy: string,
  ttlHours: number = 48
): Promise<AuthToken> {
  const { token, tokenHash } = generateToken();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const { error } = await supabaseClient
    .from('auth_tokens')
    .insert({
      token_type: 'invite',
      token_hash: tokenHash,
      email: email.toLowerCase(),
      account_id: accountId,
      expires_at: expiresAt.toISOString(),
      created_by: invitedBy,
      meta: { role }
    });

  if (error) {
    console.error('Failed to create invite token:', error);
    throw new Error('Failed to create invite token');
  }

  return { token, tokenHash, expiresAt };
}

/**
 * Create a password reset token
 */
export async function createPasswordResetToken(
  supabaseClient: SupabaseClient,
  email: string,
  userId: string,
  ttlMinutes: number = 60
): Promise<AuthToken> {
  const { token, tokenHash } = generateToken();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  const { error } = await supabaseClient
    .from('auth_tokens')
    .insert({
      token_type: 'password_reset',
      token_hash: tokenHash,
      email: email.toLowerCase(),
      user_id: userId,
      expires_at: expiresAt.toISOString(),
      meta: {}
    });

  if (error) {
    console.error('Failed to create password reset token:', error);
    throw new Error('Failed to create password reset token');
  }

  return { token, tokenHash, expiresAt };
}

/**
 * Validate and consume a token
 */
export async function validateAndConsumeToken(
  supabaseClient: SupabaseClient,
  token: string,
  tokenType: string,
  deviceNonce?: string
): Promise<{ valid: boolean; data?: any; error?: string }> {
  const tokenHash = hashToken(token);

  // Fetch the token
  const { data: tokenData, error: fetchError } = await supabaseClient
    .from('auth_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .eq('token_type', tokenType)
    .is('used_at', null)
    .single();

  if (fetchError || !tokenData) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  // Check expiration
  if (new Date(tokenData.expires_at) < new Date()) {
    return { valid: false, error: 'Token has expired' };
  }

  // Check device nonce if provided
  if (tokenData.device_nonce && deviceNonce && tokenData.device_nonce !== deviceNonce) {
    return { valid: false, error: 'Token was issued for a different device' };
  }

  // Mark token as used
  const { error: updateError } = await supabaseClient
    .from('auth_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenData.id);

  if (updateError) {
    console.error('Failed to mark token as used:', updateError);
    return { valid: false, error: 'Token validation failed' };
  }

  return { valid: true, data: tokenData };
}

/**
 * Check rate limit
 */
export async function checkRateLimit(
  supabaseClient: SupabaseClient,
  identifier: string,
  action: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining?: number }> {
  const { data, error } = await supabaseClient
    .rpc('check_rate_limit', {
      p_identifier: identifier,
      p_action: action,
      p_max_count: config.maxAttempts,
      p_window_minutes: config.windowMinutes
    });

  if (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow the request if rate limit check fails
    return { allowed: true };
  }

  return { allowed: data as boolean };
}

/**
 * Log an auth event
 */
export async function logAuthEvent(
  supabaseClient: SupabaseClient,
  userId: string | null,
  accountId: string | null,
  eventType: string,
  eventData: Record<string, any> = {},
  ipAddress?: string,
  userAgent?: string,
  success: boolean = true
): Promise<void> {
  const { error } = await supabaseClient
    .rpc('log_auth_event', {
      p_user_id: userId,
      p_account_id: accountId,
      p_event_type: eventType,
      p_event_data: eventData,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_success: success
    });

  if (error) {
    console.error('Failed to log auth event:', error);
  }
}

/**
 * Extract IP address from request
 */
export function getIpAddress(req: Request): string | undefined {
  const headers = req.headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    undefined
  );
}

/**
 * Extract user agent from request
 */
export function getUserAgent(req: Request): string | undefined {
  return req.headers.get('user-agent') || undefined;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate a device nonce from localStorage or create new
 */
export function getOrCreateDeviceNonce(): string {
  if (typeof localStorage !== 'undefined') {
    let nonce = localStorage.getItem('device_nonce');
    if (!nonce) {
      nonce = randomBytes(16).toString('base64url');
      localStorage.setItem('device_nonce', nonce);
    }
    return nonce;
  }
  return randomBytes(16).toString('base64url');
}

/**
 * Check if step-up auth is required (refresh within last 15 minutes)
 */
export async function requiresStepUp(
  supabaseClient: SupabaseClient,
  userId: string,
  maxAgeMinutes: number = 15
): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('last_step_up_at')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return true; // Require step-up if we can't verify
  }

  if (!data.last_step_up_at) {
    return true;
  }

  const lastStepUp = new Date(data.last_step_up_at);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastStepUp.getTime()) / (1000 * 60);

  return diffMinutes > maxAgeMinutes;
}

/**
 * Update step-up auth timestamp
 */
export async function updateStepUpTimestamp(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabaseClient
    .from('profiles')
    .update({ last_step_up_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.error('Failed to update step-up timestamp:', error);
  }
}

/**
 * Verify 2FA code (TOTP)
 */
export async function verify2FACode(
  supabaseClient: SupabaseClient,
  userId: string,
  code: string
): Promise<boolean> {
  // This is a placeholder - actual TOTP verification would use a library like `otpauth`
  // For now, we'll just check backup codes
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('totp_backup_codes')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  // Check if code matches a backup code
  if (data.totp_backup_codes && Array.isArray(data.totp_backup_codes)) {
    const hashedCode = createHash('sha256').update(code).digest('hex');
    return data.totp_backup_codes.includes(hashedCode);
  }

  return false;
}

/**
 * Build a complete URL for auth links
 */
export function buildAuthUrl(baseUrl: string, path: string, params?: Record<string, string>): string {
  const url = new URL(path, baseUrl);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return url.toString();
}

/**
 * Create Supabase Admin Client
 */
export function createAdminClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
