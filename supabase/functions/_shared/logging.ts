export type LogLevel = 'info' | 'warn' | 'error';
export type EventType = 'step_start' | 'step_end' | 'info' | 'error';
export type StepResult = 'success' | 'failure' | 'partial';

export interface LogOptions {
  functionName: string;
  correlationId: string;
  accountId?: string | null;
  context?: Record<string, unknown> | undefined;
  error?: unknown;
}

export interface BaseLogContext {
  functionName: string;
  traceId: string;
  accountId?: string | null;
  userId?: string | null;
}

const SENSITIVE_KEYWORDS = [
  'token',
  'secret',
  'password',
  'authorization',
  'apikey',
  'api_key',
  'api-key',
  'stripe',
  'resend',
  'vapi',
  'phone',
  'email'
];

const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  /bearer\s.+/i,
  /sk_live_[0-9a-z]+/i,
  /sk_test_[0-9a-z]+/i
];

function sanitizeValue(value: unknown, keyPath: string[]): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  const key = keyPath[keyPath.length - 1]?.toLowerCase() ?? '';

  if (typeof value === 'string') {
    if (
      SENSITIVE_VALUE_PATTERNS.some(pattern => pattern.test(value)) ||
      SENSITIVE_KEYWORDS.some(keyword => key.includes(keyword))
    ) {
      return maskString(value);
    }

    if (key.includes('id') && value.length > 64) {
      return `${value.substring(0, 12)}…`;
    }

    if (isLikelyEmail(value)) {
      return maskEmailForLogs(value);
    }

    if (key.includes('phone') || isLikelyPhoneNumber(value)) {
      return maskPhoneForLogs(value);
    }

    return value;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, keyPath));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      result[childKey] = sanitizeValue(childValue, [...keyPath, childKey]);
    }
    return result;
  }

  return value;
}

function maskString(value: string): string {
  if (value.length <= 6) {
    return '***';
  }
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function maskEmailForLogs(value: string): string {
  const [localPart, domain] = value.split('@');
  if (!domain) {
    return maskString(value);
  }
  const maskedLocal = localPart.length <= 2 ? '*'.repeat(localPart.length) : `${localPart[0]}***${localPart[localPart.length - 1]}`;
  return `${maskedLocal}@${domain}`;
}

function maskPhoneForLogs(value: string): string {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length < 4) {
    return '***';
  }
  // Show ONLY last 4 digits (no leading digits revealed)
  return `***${digits.slice(-4)}`;
}

function isLikelyEmail(value: string): boolean {
  return /.+@.+\..+/.test(value);
}

function isLikelyPhoneNumber(value: string): boolean {
  return /\d{3}[\s\-)]?\d{3}/.test(value);
}

function sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;
  return sanitizeValue(context, []) as Record<string, unknown>;
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack
    };
  }

  if (typeof error === 'object' && error !== null) {
    return sanitizeValue(error, []) as Record<string, unknown>;
  }

  return { message: String(error) };
}

function emit(level: LogLevel, message: string, options: LogOptions): void {
  const { functionName, correlationId, accountId, context } = options;
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    functionName,
    correlationId,
    accountId: accountId ?? null,
    message,
    context: sanitizeContext(context)
  };

  if (level === 'error') {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === 'warn') {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}

export function logInfo(message: string, options: LogOptions): void {
  emit('info', message, options);
}

export function logWarn(message: string, options: LogOptions): void {
  emit('warn', message, options);
}

export function logError(message: string, options: LogOptions & { error?: unknown }): void {
  const { error, ...rest } = options;
  const context = {
    ...rest.context,
    ...(error ? { error: serializeError(error) } : {})
  };
  emit('error', message, { ...rest, context });
}

export function extractCorrelationId(req: Request): string {
  const headerCandidates = [
    'requestid',
    'x-request-id',
    'x-correlation-id',
    'traceparent'
  ];

  for (const header of headerCandidates) {
    const value = req.headers.get(header);
    if (value) {
      return value;
    }
  }

  return crypto.randomUUID();
}

/**
 * Extract trace ID from request headers, preferring x-rs-trace-id.
 * Falls back to generating a new UUID if not present.
 */
export function extractTraceId(req: Request): string {
  // Prefer RingSnap-specific trace ID header
  const rsTraceId = req.headers.get('x-rs-trace-id');
  if (rsTraceId) {
    return rsTraceId;
  }

  // Fall back to other correlation headers
  const headerCandidates = [
    'x-correlation-id',
    'x-request-id',
    'requestid',
    'traceparent'
  ];

  for (const header of headerCandidates) {
    const value = req.headers.get(header);
    if (value) {
      return value;
    }
  }

  return crypto.randomUUID();
}

export function withLogContext(base: Omit<LogOptions, 'context'>) {
  return {
    info: (message: string, context?: Record<string, unknown>) =>
      logInfo(message, { ...base, context }),
    warn: (message: string, context?: Record<string, unknown>) =>
      logWarn(message, { ...base, context }),
    error: (message: string, error?: unknown, context?: Record<string, unknown>) =>
      logError(message, { ...base, context, error })
  };
}

// ============================================================================
// LLM-NATIVE STEP LOGGING
// ============================================================================

/**
 * Log the start of a step in a critical flow.
 * Emits a single-line JSON log event optimized for LLM consumption.
 */
export function stepStart(
  step: string,
  base: BaseLogContext,
  context?: Record<string, unknown>
): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level: 'info' as LogLevel,
    event_type: 'step_start' as EventType,
    trace_id: base.traceId,
    function_name: base.functionName,
    step,
    message: `Step started: ${step}`,
    account_id: base.accountId ?? null,
    user_id: base.userId ?? null,
    context: sanitizeContext(context)
  };

  console.log(JSON.stringify(payload));
}

/**
 * Log the end of a step in a critical flow.
 * Automatically calculates duration_ms from startTime.
 */
export function stepEnd(
  step: string,
  base: BaseLogContext,
  context: Record<string, unknown> & { result?: StepResult } = {},
  startTime?: number
): void {
  const durationMs = startTime ? Date.now() - startTime : undefined;

  const payload = {
    timestamp: new Date().toISOString(),
    level: 'info' as LogLevel,
    event_type: 'step_end' as EventType,
    trace_id: base.traceId,
    function_name: base.functionName,
    step,
    message: `Step completed: ${step}`,
    account_id: base.accountId ?? null,
    user_id: base.userId ?? null,
    duration_ms: durationMs,
    result: context.result ?? 'success',
    context: sanitizeContext(context)
  };

  console.log(JSON.stringify(payload));
}

/**
 * Log a step error in a critical flow.
 */
export function stepError(
  step: string,
  base: BaseLogContext,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level: 'error' as LogLevel,
    event_type: 'error' as EventType,
    trace_id: base.traceId,
    function_name: base.functionName,
    step,
    message: `Step failed: ${step}`,
    account_id: base.accountId ?? null,
    user_id: base.userId ?? null,
    error: serializeError(error),
    context: sanitizeContext(context)
  };

  console.error(JSON.stringify(payload));
}

// ============================================================================
// EXPORTED MASKING UTILITIES (FOR LOGS ONLY - DO NOT USE IN OPERATIONAL CODE)
// ============================================================================

/**
 * Mask an email address for safe logging.
 *
 * ⚠️ FOR LOGS ONLY - Do NOT use in:
 * - Database writes
 * - API payloads to external services (Stripe, Twilio, Vapi)
 * - Operational/business logic
 *
 * Example: "user@example.com" => "u***r@example.com"
 */
export { maskEmailForLogs };

/**
 * Mask a phone number for safe logging.
 *
 * ⚠️ FOR LOGS ONLY - Do NOT use in:
 * - Database writes
 * - API payloads to external services (Stripe, Twilio, Vapi)
 * - Operational/business logic
 *
 * Reveals ONLY last 4 digits.
 * Examples:
 * - "+14155551234" => "***1234"
 * - "415-555-1234" => "***1234"
 * - "123" => "***"
 */
export { maskPhoneForLogs };

/**
 * Manually redact/sanitize an object for safe logging.
 * Automatically masks emails, phones, and sensitive keys.
 *
 * ⚠️ FOR LOGS ONLY - Do NOT use in operational code.
 */
export function redact(obj: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(obj, []) as Record<string, unknown>;
}
