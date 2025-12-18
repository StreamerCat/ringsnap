import { useMemo, useCallback } from 'react';

/**
 * Hook for managing "activation seen" state in localStorage.
 * Uses localStorage keyed by accountId to implement show-once behavior.
 * Fails open: if localStorage is unavailable, returns false (show activation).
 */
export function useActivationSeen(accountId: string | null) {
    const key = accountId ? `activationSeen:${accountId}` : null;

    const seen = useMemo(() => {
        if (!key) return false;
        try {
            return localStorage.getItem(key) === 'true';
        } catch {
            return false; // Fail open - show activation if localStorage fails
        }
    }, [key]);

    const markSeen = useCallback(() => {
        if (!key) return;
        try {
            localStorage.setItem(key, 'true');
        } catch {
            // Fail open - don't block user if localStorage fails
        }
    }, [key]);

    return { seen, markSeen };
}
