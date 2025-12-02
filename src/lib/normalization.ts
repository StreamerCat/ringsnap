/**
 * Data normalization utilities for signup and onboarding
 */

/**
 * List of free email domains (not business domains)
 */
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'aol.com',
  'icloud.com',
  'protonmail.com',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'gmx.com',
]);

/**
 * Normalize website URL
 * - Ensures https:// protocol
 * - Handles www prefix
 */
export function normalizeWebsite(website: string): string {
  if (!website || website.trim() === '') return '';

  let normalized = website.trim().toLowerCase();

  // Remove any existing protocol
  normalized = normalized.replace(/^https?:\/\//, '');

  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '');

  // Add https://
  return `https://${normalized}`;
}

/**
 * Infer website from email domain
 * Returns empty string if email is from a free provider
 */
export function inferWebsiteFromEmail(email: string): string {
  if (!email || !email.includes('@')) return '';

  const domain = email.split('@')[1].toLowerCase();

  // Don't infer from free email providers
  if (FREE_EMAIL_DOMAINS.has(domain)) {
    return '';
  }

  // Return normalized website
  return normalizeWebsite(domain);
}

/**
 * Canonical trade names mapping
 */
const TRADE_MAPPINGS: Record<string, string> = {
  // Plumbing
  'plumb': 'plumbing',
  'plumber': 'plumbing',
  'plumbing': 'plumbing',
  'plumbin': 'plumbing',
  'pipe': 'plumbing',
  'pipefitter': 'plumbing',

  // HVAC
  'hvac': 'HVAC',
  'heating': 'HVAC',
  'cooling': 'HVAC',
  'air conditioning': 'HVAC',
  'ac': 'HVAC',
  'hvac tech': 'HVAC',
  'climate': 'HVAC',

  // Electrical
  'electric': 'electrical',
  'electrical': 'electrical',
  'electrician': 'electrical',
  'electric contractor': 'electrical',
  'electrical contractor': 'electrical',
  'wiring': 'electrical',

  // Roofing
  'roof': 'roofing',
  'roofer': 'roofing',
  'roofing': 'roofing',
  'roofing contractor': 'roofing',

  // Landscaping
  'landscape': 'landscaping',
  'landscaping': 'landscaping',
  'landscaper': 'landscaping',
  'lawn care': 'landscaping',
  'lawn': 'landscaping',

  // Carpentry
  'carpenter': 'carpentry',
  'carpentry': 'carpentry',
  'woodwork': 'carpentry',
  'framing': 'carpentry',

  // General Contractor
  'gc': 'general contracting',
  'general': 'general contracting',
  'general contractor': 'general contracting',
  'general contracting': 'general contracting',
  'construction': 'general contracting',

  // Painting
  'paint': 'painting',
  'painter': 'painting',
  'painting': 'painting',

  // Flooring
  'floor': 'flooring',
  'flooring': 'flooring',
  'tile': 'flooring',

  // Handyman
  'handyman': 'handyman',
  'handyperson': 'handyman',
  'repair': 'handyman',
};

/**
 * Normalize trade to canonical name
 */
export function normalizeTrade(trade: string): string {
  if (!trade) return '';

  const normalized = trade.trim().toLowerCase();

  // Direct match
  if (TRADE_MAPPINGS[normalized]) {
    return TRADE_MAPPINGS[normalized];
  }

  // Partial match (find first key that includes the input)
  for (const [key, value] of Object.entries(TRADE_MAPPINGS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // No match - return capitalized input
  return trade.trim();
}

/**
 * Business hours patterns
 */
const HOURS_PATTERNS = {
  '24/7': 'Available 24/7',
  '24-7': 'Available 24/7',
  'always': 'Available 24/7',
  'all day': 'Available 24/7',
};

/**
 * Normalize business hours to clean format
 * Returns JSON structure for structured hours, or clean text
 */
export function normalizeBusinessHours(hours: string): string | object {
  if (!hours || hours.trim() === '') {
    return 'Monday-Friday 8am-5pm'; // Default
  }

  const normalized = hours.trim().toLowerCase();

  // Check for 24/7 patterns
  for (const [pattern, value] of Object.entries(HOURS_PATTERNS)) {
    if (normalized.includes(pattern)) {
      return value;
    }
  }

  // Common patterns to clean up
  const cleanedHours = hours
    .replace(/\bm-f\b/gi, 'Monday-Friday')
    .replace(/\bmon-fri\b/gi, 'Monday-Friday')
    .replace(/\bmtwtf\b/gi, 'Monday-Friday')
    .replace(/\bm-th\b/gi, 'Monday-Thursday')
    .replace(/\bsat\b/gi, 'Saturday')
    .replace(/\bsun\b/gi, 'Sunday');

  return cleanedHours.trim();
}

/**
 * Normalize emergency policy to clean format
 */
export function normalizeEmergencyPolicy(policy: string): string {
  if (!policy || policy.trim() === '') {
    return 'Available 24/7 for emergencies';
  }

  const normalized = policy.trim().toLowerCase();

  // Detect emergency availability
  if (normalized.includes('24') || normalized.includes('always') || normalized.includes('anytime')) {
    return 'Available 24/7 for emergencies';
  }

  if (normalized.includes('no emergency') || normalized.includes('business hours only')) {
    return 'Emergency services available during business hours only';
  }

  // Return cleaned version
  return policy.trim();
}

/**
 * Validate and normalize phone number
 * Note: Actual validation is done server-side
 * This just cleans up the format for display
 */
export function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return phone; // Return as-is if not matching
}

/**
 * Get form data for Step 1 (create-trial payload)
 */
export interface Step1FormData {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  trade: string;
  website?: string;
  zipCode?: string;
  paymentMethodId: string;
  planType?: string;
  source?: string;
  leadId?: string;
}

/**
 * Build normalized Step 1 payload for create-trial
 */
export function buildStep1Payload(formData: Step1FormData): Record<string, any> {
  const payload: Record<string, any> = {
    name: formData.name.trim(),
    email: formData.email.trim().toLowerCase(),
    phone: formData.phone.trim(),
    companyName: formData.companyName.trim(),
    trade: normalizeTrade(formData.trade),
    paymentMethodId: formData.paymentMethodId,
    planType: formData.planType || 'starter',
    source: formData.source || 'website',
  };

  // Normalize website if provided
  if (formData.website) {
    payload.website = normalizeWebsite(formData.website);
  } else {
    // Try to infer from email
    const inferredWebsite = inferWebsiteFromEmail(formData.email);
    if (inferredWebsite) {
      payload.website = inferredWebsite;
    }
  }

  // Add zipCode if provided
  if (formData.zipCode && formData.zipCode.trim() !== '') {
    payload.zipCode = formData.zipCode.trim();
  }

  // Add leadId if provided
  if (formData.leadId) {
    payload.leadId = formData.leadId;
  }

  return payload;
}

/**
 * Get form data for Step 2 (assistant configuration)
 */
export interface Step2FormData {
  businessHours?: string;
  emergencyPolicy?: string;
  serviceArea?: string;
  assistantGender?: 'male' | 'female';
  primaryGoal?: 'book_appointments' | 'capture_leads' | 'answer_questions' | 'take_orders';
  wantsAdvancedVoice?: boolean;
  bookingMode?: 'sms_only' | 'direct_calendar';
  calendarProvider?: 'google' | 'microsoft' | 'apple' | 'external_link';
  calendarExternalLink?: string;
  assistantTone?: 'formal' | 'friendly' | 'casual';
  destinationPhone?: string;
}

/**
 * Build normalized Step 2 payload for account updates
 */
export function buildStep2Payload(formData: Step2FormData): Record<string, any> {
  const payload: Record<string, any> = {};

  if (formData.businessHours !== undefined) {
    payload.business_hours = normalizeBusinessHours(formData.businessHours);
  }

  if (formData.emergencyPolicy !== undefined) {
    payload.emergency_policy = normalizeEmergencyPolicy(formData.emergencyPolicy);
  }

  if (formData.serviceArea !== undefined) {
    payload.service_area = formData.serviceArea.trim();
  }

  if (formData.assistantGender !== undefined) {
    payload.assistant_gender = formData.assistantGender;
  }

  if (formData.primaryGoal !== undefined) {
    // This might go into metadata or a specific column
    payload.primary_goal = formData.primaryGoal;
  }

  if (formData.wantsAdvancedVoice !== undefined) {
    payload.wants_advanced_voice = formData.wantsAdvancedVoice;
  }

  if (formData.bookingMode !== undefined) {
    payload.booking_mode = formData.bookingMode;
  }

  if (formData.calendarProvider !== undefined) {
    payload.calendar_provider = formData.calendarProvider;
  }

  if (formData.calendarExternalLink !== undefined) {
    payload.calendar_external_link = formData.calendarExternalLink.trim();
  }

  if (formData.assistantTone !== undefined) {
    payload.assistant_tone = formData.assistantTone;
  }

  if (formData.destinationPhone !== undefined) {
    payload.destination_phone = formData.destinationPhone.trim();
  }

  return payload;
}
