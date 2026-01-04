/**
 * Validation utilities for anti-abuse and security
 */

/**
 * Sanitize custom instructions to prevent prompt injection
 * Max 500 characters, blocks common injection patterns
 */
export function sanitizeCustomInstructions(input: string): string {
  if (!input) return '';

  // Trim and limit to 500 chars
  let sanitized = input.trim().substring(0, 500);

  // Block common prompt injection patterns
  const forbiddenPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/gi,
    /disregard\s+.*instructions/gi,
    /forget\s+.*instructions/gi,
    /new\s+instructions:/gi,
    /system\s+prompt:/gi,
    /override\s+.*settings/gi,
    /<\|.*?\|>/g, // Special tokens
    /{{.*?}}/g, // Template variables
    /<script/gi,
    /<iframe/gi,
    /javascript:/gi,
  ];

  forbiddenPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Remove excessive punctuation that might confuse the AI
  sanitized = sanitized.replace(/[!?]{3,}/g, '!');
  sanitized = sanitized.replace(/\.{4,}/g, '...');

  return sanitized.trim();
}

/**
 * Validate US ZIP code format
 */
export function isValidZipCode(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip);
}

/**
 * Validate US phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Accept formats: (555) 123-4567, 555-123-4567, 5551234567
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || cleaned.length === 11;
}

/**
 * Format phone number to E.164 format (+15551234567)
 * Handles various input formats and ensures valid E.164 output
 * CRITICAL: Vapi requires STRICT E.164 - only '+' followed by digits
 * 
 * @returns Valid E.164 string or null if normalization fails
 */
export function formatPhoneE164(phone: string | null | undefined): string | null {
  if (!phone || phone.trim() === '') {
    return null;
  }

  // ALWAYS strip to just digits first, regardless of input format
  const digitsOnly = phone.replace(/\D/g, '');

  // If no digits found at all, return null
  if (digitsOnly.length === 0) {
    return null;
  }

  // Handle 10-digit US number (no country code provided)
  // e.g., 5551234567 -> +15551234567
  if (digitsOnly.length === 10) {
    // US area codes cannot start with 0 or 1
    if (digitsOnly[0] === '0' || digitsOnly[0] === '1') {
      // Invalid US area code - could be international or malformed
      return null;
    }
    return `+1${digitsOnly}`;
  }

  // Handle 11-digit US number starting with 1 (e.g., 15551234567)
  if (digitsOnly.length === 11 && digitsOnly[0] === '1') {
    // Validate area code (2nd digit can't be 0 or 1)
    if (digitsOnly[1] === '0' || digitsOnly[1] === '1') {
      return null;
    }
    return `+${digitsOnly}`;
  }

  // Handle international numbers (12-15 digits, already has country code)
  if (digitsOnly.length >= 12 && digitsOnly.length <= 15) {
    return `+${digitsOnly}`;
  }

  // Cannot normalize - return null
  return null;
}

/**
 * Try to format phone to E.164, with logging for failures.
 * Use this in contexts where you have accountId available for diagnostics.
 * 
 * @param phone Raw phone input
 * @param context Optional context for logging (accountId, jobId)
 * @returns Valid E.164 string or null
 */
export function tryFormatPhoneE164(
  phone: string | null | undefined,
  context?: { accountId?: string; jobId?: string }
): string | null {
  const result = formatPhoneE164(phone);

  if (result === null && phone) {
    // Log failure with masked value for diagnostics
    const masked = phone.length > 6 ? phone.substring(0, 6) + '***' : phone.substring(0, 3) + '***';
    console.warn(`[tryFormatPhoneE164] Normalization failed`, {
      rawPhoneMasked: masked,
      rawLength: phone.length,
      accountId: context?.accountId || 'unknown',
      jobId: context?.jobId || 'unknown',
    });
  }

  return result;
}

/**
 * Generate secure random referral code
 * 8 characters, uppercase alphanumeric
 */
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars (0, O, I, 1)
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Check if IP address is valid
 */
export function isValidIP(ip: string): boolean {
  // IPv4
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Pattern.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => parseInt(part) <= 255);
  }

  // IPv6 (basic check)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;
  return ipv6Pattern.test(ip);
}

/**
 * Extract client IP from request headers
 */
export function getClientIP(req: Request): string {
  // Check common proxy headers
  const headers = req.headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') || // Cloudflare
    'unknown'
  );
}

/**
 * Rate limit check helper
 * Returns true if rate limit exceeded
 */
export function checkRateLimit(
  attempts: number,
  maxAttempts: number,
  windowMinutes: number,
  oldestAttemptTime: string
): boolean {
  if (attempts < maxAttempts) return false;

  const oldestTime = new Date(oldestAttemptTime);
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  return oldestTime > windowStart;
}
