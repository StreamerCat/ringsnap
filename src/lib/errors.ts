/**
 * Error handling utilities for RingSnap
 * Defensive - handles both legacy and structured error formats
 */

export interface AppError {
    code: string;
    userMessage: string;
    debugMessage?: string;
    retryable: boolean;
    suggestedAction?: string;
}

/**
 * Extract user-friendly error from backend response
 * DEFENSIVE: Handles both old and new error formats
 */
export function extractUserError(error: any): AppError {
    // New structured error response
    if (error?.errorCode && error?.userMessage) {
        return {
            code: error.errorCode,
            userMessage: error.userMessage,
            debugMessage: error.debugMessage,
            retryable: error.retryable ?? false,
            suggestedAction: error.suggestedAction
        };
    }

    // Legacy error format (error.error or error.message)
    const errorMessage = error?.error || error?.message || 'An unexpected error occurred';

    // Try to make legacy errors more user-friendly based on content
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('does not support this type of purchase')) {
        return {
            code: 'CARD_NOT_SUPPORTED',
            userMessage: 'This card was declined by your bank. Please try a different card or contact your bank.',
            debugMessage: errorMessage,
            retryable: true,
            suggestedAction: 'Try a different payment method'
        };
    }

    if (lowerMessage.includes('card') && (lowerMessage.includes('declined') || lowerMessage.includes('card_declined'))) {
        return {
            code: 'CARD_DECLINED',
            userMessage: 'Your card was declined. Please try a different card.',
            debugMessage: errorMessage,
            retryable: true,
            suggestedAction: 'Try a different payment method'
        };
    }

    if (lowerMessage.includes('insufficient') || lowerMessage.includes('funds')) {
        return {
            code: 'INSUFFICIENT_FUNDS',
            userMessage: 'Your card was declined due to insufficient funds. Please try a different card.',
            debugMessage: errorMessage,
            retryable: true,
            suggestedAction: 'Try a different payment method'
        };
    }

    if (lowerMessage.includes('expired')) {
        return {
            code: 'CARD_EXPIRED',
            userMessage: 'Your card has expired. Please use a valid card.',
            debugMessage: errorMessage,
            retryable: true,
            suggestedAction: 'Update your payment method'
        };
    }

    if (lowerMessage.includes('cvc') || lowerMessage.includes('security code')) {
        return {
            code: 'INCORRECT_CVC',
            userMessage: 'The security code (CVC) was incorrect. Please check and try again.',
            debugMessage: errorMessage,
            retryable: true,
            suggestedAction: 'Verify your card security code'
        };
    }

    // Generic fallback
    return {
        code: 'UNKNOWN_ERROR',
        userMessage: 'We could not process your card. Please check the details and try again.',
        debugMessage: errorMessage,
        retryable: true,
        suggestedAction: 'Try again or contact support'
    };
}

/**
 * Log error details for debugging (client-side)
 */
export function logClientError(context: string, error: any, metadata?: Record<string, any>) {
    console.error(`[${context}]`, {
        error,
        metadata,
        timestamp: new Date().toISOString()
    });
}

/**
 * Default error messages by category
 */
export const ERROR_MESSAGES = {
    PAYMENT: {
        GENERIC: 'We could not process your payment. Please try again or use a different card.',
        CARD_DECLINED: 'Your card was declined. Please try a different card.',
        NETWORK: 'We could not reach the payment processor. Please try again in a moment.'
    },
    ACCOUNT: {
        GENERIC: 'We could not create your account. Please try again.',
        EXISTS: 'An account with this email already exists. Please log in instead.'
    },
    SYSTEM: {
        GENERIC: 'Something went wrong. Please try again.',
        UNAVAILABLE: 'Our service is temporarily unavailable. Please try again in a few minutes.'
    }
} as const;
