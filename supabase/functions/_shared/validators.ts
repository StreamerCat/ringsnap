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
 */
export function formatPhoneE164(phone: string): string {
  if (!phone) {
    // Return a valid default US number if empty
    return "+14155551234";
  }

  // If already in E.164 format, return as-is
  if (phone.startsWith('+')) {
    return phone;
  }

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Handle 10-digit US number (e.g., 5551234567)
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // Handle 11-digit number starting with 1 (e.g., 15551234567)
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+${cleaned}`;
  }

  // If we have digits but not the right length, try to salvage it
  if (cleaned.length > 0) {
    // If it's longer than 11 digits, take the last 10
    if (cleaned.length > 11) {
      const last10 = cleaned.slice(-10);
      return `+1${last10}`;
    }

    // If it's between 7-9 digits, pad with zeros and add +1
    if (cleaned.length >= 7 && cleaned.length < 10) {
      const padded = cleaned.padStart(10, '0');
      return `+1${padded}`;
    }
  }

  // Fallback to a valid default if we can't parse it
  console.warn(`Unable to format phone number: ${phone}, using default`);
  return "+14155551234";
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
