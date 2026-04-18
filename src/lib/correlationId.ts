/**
 * Correlation ID Utility for Frontend Request Tracking
 *
 * Provides utilities to generate, store, and propagate correlation IDs
 * across API requests for end-to-end traceability.
 *
 * Usage:
 * ```typescript
 * import { generateCorrelationId, withCorrelationId, getCorrelationId } from '@/lib/correlationId';
 *
 * // Generate a new correlation ID for a request
 * const correlationId = generateCorrelationId();
 *
 * // Add correlation ID to fetch headers
 * const headers = withCorrelationId({ 'Content-Type': 'application/json' });
 *
 * // Get current correlation ID from session
 * const currentId = getCorrelationId();
 * ```
 */

// Primary header for RingSnap trace propagation (LLM-native logging)
const TRACE_ID_HEADER = 'x-rs-trace-id';

// Legacy correlation ID header (kept for backward compatibility)
const CORRELATION_ID_HEADER = 'x-correlation-id';

const SESSION_STORAGE_KEY = 'ringsnap_trace_id';
const IS_DEV = import.meta.env.DEV;

/**
 * Generate a new UUID v4 correlation ID
 * @returns UUID string
 */
export function generateCorrelationId(): string {
  // Use crypto.randomUUID() if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Store correlation ID in session storage for multi-step flows
 * @param correlationId - The correlation ID to store
 */
export function storeCorrelationId(correlationId: string): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_STORAGE_KEY, correlationId);
    }
  } catch (error) {
    console.warn('[correlationId] Failed to store correlation ID:', error);
  }
}

/**
 * Retrieve correlation ID from session storage
 * @returns Stored correlation ID or null
 */
export function getStoredCorrelationId(): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(SESSION_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('[correlationId] Failed to retrieve correlation ID:', error);
  }
  return null;
}

/**
 * Clear correlation ID from session storage
 */
export function clearCorrelationId(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('[correlationId] Failed to clear correlation ID:', error);
  }
}

/**
 * Get or generate a correlation ID
 * If one exists in session storage, reuse it. Otherwise, generate a new one.
 * @param persist - Whether to persist the generated ID in session storage (default: false)
 * @returns Correlation ID
 */
export function getCorrelationId(persist: boolean = false): string {
  const stored = getStoredCorrelationId();
  if (stored) {
    return stored;
  }

  const newId = generateCorrelationId();
  if (persist) {
    storeCorrelationId(newId);
  }
  return newId;
}

/**
 * Add correlation ID header to existing headers object
 * Uses x-rs-trace-id as primary header for LLM-native logging.
 * @param headers - Existing headers object (optional)
 * @param correlationId - Correlation ID to use (optional, will generate if not provided)
 * @returns Headers object with correlation ID added
 */
export function withCorrelationId(
  headers: HeadersInit = {},
  correlationId?: string
): HeadersInit {
  const id = correlationId || getCorrelationId();

  // Handle different header types
  if (headers instanceof Headers) {
    headers.set(TRACE_ID_HEADER, id);
    return headers;
  }

  if (Array.isArray(headers)) {
    return [...headers, [TRACE_ID_HEADER, id]];
  }

  // Plain object
  return {
    ...headers,
    [TRACE_ID_HEADER]: id,
  };
}

/**
 * Create a fetch wrapper that automatically adds correlation ID to requests
 * @param options - Fetch options
 * @returns Fetch function with correlation ID
 */
export function createCorrelatedFetch(
  baseOptions: RequestInit = {}
): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const correlationId = getCorrelationId(true); // Persist for multi-step flows

    const headers = withCorrelationId(
      init?.headers || baseOptions.headers,
      correlationId
    );

    const mergedInit: RequestInit = {
      ...baseOptions,
      ...init,
      headers,
    };

    if (IS_DEV) console.log(
      `[correlationId] Request with correlation ID: ${correlationId}`,
      input
    );

    return fetch(input, mergedInit);
  };
}

/**
 * Extract correlation ID from response headers
 * Checks both x-rs-trace-id and legacy x-correlation-id headers.
 * @param response - Fetch Response object
 * @returns Correlation ID from response or null
 */
export function extractCorrelationIdFromResponse(
  response: Response
): string | null {
  return response.headers.get(TRACE_ID_HEADER) || response.headers.get(CORRELATION_ID_HEADER);
}

/**
 * React hook for managing correlation ID in components
 * @param persist - Whether to persist the ID across sessions (default: true)
 * @returns [correlationId, refreshId, clearId]
 */
export function useCorrelationId(persist: boolean = true): [
  string,
  () => void,
  () => void
] {
  // Get or generate correlation ID
  const getId = () => getCorrelationId(persist);
  const [correlationId, setCorrelationId] = React.useState<string>(getId);

  // Refresh correlation ID (generate new one)
  const refreshId = React.useCallback(() => {
    const newId = generateCorrelationId();
    if (persist) {
      storeCorrelationId(newId);
    }
    setCorrelationId(newId);
  }, [persist]);

  // Clear correlation ID
  const clearId = React.useCallback(() => {
    clearCorrelationId();
    const newId = generateCorrelationId();
    setCorrelationId(newId);
  }, []);

  return [correlationId, refreshId, clearId];
}

// React import (conditional - only if React is available)
declare const React: typeof import('react');

/**
 * Correlation ID Context for React applications
 */
export interface CorrelationIdContextValue {
  correlationId: string;
  refreshCorrelationId: () => void;
  clearCorrelationId: () => void;
}

/**
 * Example usage with React Context:
 *
 * ```typescript
 * import { createContext, useContext } from 'react';
 * import { useCorrelationId } from '@/lib/correlationId';
 *
 * const CorrelationIdContext = createContext<CorrelationIdContextValue | null>(null);
 *
 * export function CorrelationIdProvider({ children }) {
 *   const [correlationId, refreshCorrelationId, clearCorrelationId] = useCorrelationId(true);
 *
 *   return (
 *     <CorrelationIdContext.Provider value={{ correlationId, refreshCorrelationId, clearCorrelationId }}>
 *       {children}
 *     </CorrelationIdContext.Provider>
 *   );
 * }
 *
 * export function useCorrelationIdContext() {
 *   const context = useContext(CorrelationIdContext);
 *   if (!context) {
 *     throw new Error('useCorrelationIdContext must be used within CorrelationIdProvider');
 *   }
 *   return context;
 * }
 * ```
 */

/**
 * Utility for Supabase client with correlation ID
 * @param supabaseClient - Supabase client instance
 * @param correlationId - Correlation ID to use (optional)
 * @returns Supabase client with correlation ID in headers
 */
export function withSupabaseCorrelation<T>(
  supabaseClient: T,
  correlationId?: string
): T {
  const id = correlationId || getCorrelationId();

  // Add correlation ID to Supabase client headers
  // Note: This depends on Supabase client API
  // For now, we'll return the client as-is and rely on fetch wrapper

  if (IS_DEV) console.log(`[correlationId] Supabase request with correlation ID: ${id}`);

  return supabaseClient;
}

/**
 * Debug utility: Log correlation ID chain
 * @param action - Action being performed
 * @param correlationId - Correlation ID (optional)
 */
export function logCorrelation(action: string, correlationId?: string): void {
  const id = correlationId || getCorrelationId();
  if (IS_DEV) console.log(
    `[correlation-trace] ${action} | correlation_id: ${id} | timestamp: ${new Date().toISOString()}`
  );
}

/**
 * Helper for signup flows: Generate and persist correlation ID
 * @returns Correlation ID for signup flow
 */
export function startSignupFlow(): string {
  clearCorrelationId(); // Clear any previous flow
  const correlationId = generateCorrelationId();
  storeCorrelationId(correlationId);
  logCorrelation('signup_flow_started', correlationId);
  return correlationId;
}

/**
 * Helper for signup flows: Clear correlation ID after completion
 */
export function endSignupFlow(): void {
  const correlationId = getStoredCorrelationId();
  if (correlationId) {
    logCorrelation('signup_flow_completed', correlationId);
  }
  clearCorrelationId();
}

// Export header names for external use
export { TRACE_ID_HEADER, CORRELATION_ID_HEADER };
