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
 */
export function formatPhoneE164(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+${cleaned}`;
  }
  return phone;
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
