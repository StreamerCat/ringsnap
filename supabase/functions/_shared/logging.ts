export type LogLevel = 'info' | 'warn' | 'error';

export interface LogOptions {
  functionName: string;
  correlationId: string;
  accountId?: string | null;
  context?: Record<string, unknown> | undefined;
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
      return maskEmail(value);
    }

    if (key.includes('phone') || isLikelyPhoneNumber(value)) {
      return maskPhone(value);
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

function maskEmail(value: string): string {
  const [localPart, domain] = value.split('@');
  if (!domain) {
    return maskString(value);
  }
  const maskedLocal = localPart.length <= 2 ? '*'.repeat(localPart.length) : `${localPart[0]}***${localPart[localPart.length - 1]}`;
  return `${maskedLocal}@${domain}`;
}

function maskPhone(value: string): string {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length < 4) {
    return '***';
  }
  const maskedDigits = `${digits.slice(0, 2)}***${digits.slice(-2)}`;
  return value.replace(/[^0-9]/g, '').length === value.length ? maskedDigits : value.replace(digits, maskedDigits);
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
