import * as Sentry from '@sentry/react';

/**
 * Test button component to verify Sentry error tracking is working.
 * Add this to any page temporarily to test error capture.
 * 
 * Usage: <ErrorButton />
 * 
 * This will:
 * 1. Log an info message to Sentry
 * 2. Increment a test counter metric
 * 3. Throw a test error that should appear in your Sentry dashboard
 */
export function ErrorButton() {
    return (
        <button
            onClick={() => {
                // Send a log before throwing the error
                const { logger } = Sentry;
                logger.info('User triggered test error', {
                    action: 'test_error_button_click',
                });

                // Send a test metric before throwing the error
                Sentry.metrics.increment('test_counter', 1);

                // Throw test error - this will be caught by ErrorBoundary
                throw new Error('This is your first Sentry test error!');
            }}
            className="rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600 transition-colors"
        >
            🔥 Test Sentry Error
        </button>
    );
}

export default ErrorButton;
