/**
 * Debug Bundle Utilities
 *
 * Collects and formats debugging information for LLM analysis.
 * Automatically sanitizes PII (emails, phones) before bundling.
 */

import { getCorrelationId } from './correlationId';

// Maximum number of step logs to include in debug bundle
const MAX_STEP_LOGS = 30;

// Session storage key for step logs
const STEP_LOGS_KEY = 'ringsnap_step_logs';

/**
 * Step log entry captured on the frontend
 */
export interface StepLog {
  timestamp: string;
  step: string;
  event_type: 'step_start' | 'step_end' | 'error';
  duration_ms?: number;
  result?: 'success' | 'failure' | 'partial';
  error?: string;
  context?: Record<string, unknown>;
}

/**
 * Debug bundle format for sharing with support or Claude
 */
export interface DebugBundle {
  trace_id: string;
  timestamp: string;
  route: string;
  action?: string;
  error?: {
    message: string;
    code?: string;
    reason_code?: string;
    stack?: string;
  };
  user_agent: string;
  viewport: {
    width: number;
    height: number;
  };
  recent_steps: StepLog[];
  network_status: 'online' | 'offline';
  metadata?: Record<string, unknown>;
}

/**
 * Mask email address for safe logging
 */
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;

  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local.charAt(0)}***@${domain}`;
  }
  return `${local.substring(0, 2)}***@${domain}`;
}

/**
 * Mask phone number to show only last 4 digits
 */
function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length < 4) return '***';

  return `***${digitsOnly.slice(-4)}`;
}

/**
 * Recursively sanitize object to remove/mask PII
 */
function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    // Mask email patterns
    if (value.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return maskEmail(value);
    }

    // Mask phone patterns (basic detection)
    if (/^[\d\s\-\+\(\)]{10,}$/.test(value)) {
      return maskPhone(value);
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      // Skip sensitive keys entirely
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key')
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (lowerKey.includes('email')) {
        sanitized[key] = typeof val === 'string' ? maskEmail(val) : sanitizeValue(val);
      } else if (lowerKey.includes('phone')) {
        sanitized[key] = typeof val === 'string' ? maskPhone(val) : sanitizeValue(val);
      } else {
        sanitized[key] = sanitizeValue(val);
      }
    }
    return sanitized;
  }

  return value;
}

/**
 * Log a frontend step to session storage
 */
export function logFrontendStep(log: StepLog): void {
  try {
    const existingLogs = getStepLogs();
    const newLogs = [...existingLogs, log].slice(-MAX_STEP_LOGS); // Keep only last N logs
    sessionStorage.setItem(STEP_LOGS_KEY, JSON.stringify(newLogs));
  } catch (error) {
    // Silently fail if session storage is unavailable
    console.warn('Failed to log frontend step:', error);
  }
}

/**
 * Retrieve all step logs from session storage
 */
export function getStepLogs(): StepLog[] {
  try {
    const logs = sessionStorage.getItem(STEP_LOGS_KEY);
    return logs ? JSON.parse(logs) : [];
  } catch (error) {
    console.warn('Failed to retrieve step logs:', error);
    return [];
  }
}

/**
 * Clear all step logs from session storage
 */
export function clearStepLogs(): void {
  try {
    sessionStorage.removeItem(STEP_LOGS_KEY);
  } catch (error) {
    console.warn('Failed to clear step logs:', error);
  }
}

/**
 * Create a debug bundle from current state
 */
export function createDebugBundle(error?: Error, metadata?: Record<string, unknown>): DebugBundle {
  const trace_id = getCorrelationId();
  const route = window.location.pathname;
  const recent_steps = getStepLogs();

  const bundle: DebugBundle = {
    trace_id,
    timestamp: new Date().toISOString(),
    route,
    user_agent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    network_status: navigator.onLine ? 'online' : 'offline',
    recent_steps: recent_steps.map(log => sanitizeValue(log) as StepLog),
    metadata: metadata ? sanitizeValue(metadata) as Record<string, unknown> : undefined,
  };

  if (error) {
    bundle.error = {
      message: error.message,
      stack: error.stack,
    };

    // Extract reason_code if present in error cause
    if (error.cause && typeof error.cause === 'object') {
      const cause = error.cause as Record<string, unknown>;
      if (cause.reason_code) {
        bundle.error.reason_code = String(cause.reason_code);
      }
      if (cause.trace_id) {
        bundle.trace_id = String(cause.trace_id);
      }
    }
  }

  return bundle;
}

/**
 * Format debug bundle as pretty JSON string
 */
export function formatDebugBundle(bundle: DebugBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/**
 * Copy debug bundle to clipboard
 */
export async function copyDebugBundleToClipboard(bundle: DebugBundle): Promise<boolean> {
  const formatted = formatDebugBundle(bundle);

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(formatted);
      return true;
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = formatted;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  } catch (error) {
    console.error('Failed to copy debug bundle to clipboard:', error);
    return false;
  }
}

/**
 * Download debug bundle as JSON file
 */
export function downloadDebugBundle(bundle: DebugBundle): void {
  const formatted = formatDebugBundle(bundle);
  const blob = new Blob([formatted], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ringsnap-debug-${bundle.trace_id.substring(0, 8)}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate user-friendly debug instructions
 */
export function getDebugInstructions(bundle: DebugBundle): string {
  return `
🔍 Debug Information

Trace ID: ${bundle.trace_id}
Timestamp: ${bundle.timestamp}
Route: ${bundle.route}

To share this debug bundle:
1. Click "Copy Debug Bundle" below
2. Paste into your support ticket or message to Claude
3. Include a brief description of what happened

This bundle contains sanitized debugging information (no passwords, full emails, or phone numbers).
`.trim();
}
