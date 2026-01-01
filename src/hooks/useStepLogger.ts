/**
 * React hook for frontend step logging
 *
 * Provides convenient functions to log user actions and operations
 * on the frontend, making it easier to debug issues by capturing
 * the sequence of events leading to an error.
 */

import { useCallback, useRef } from 'react';
import { logFrontendStep, type StepLog } from '@/lib/debugBundle';

export interface UseStepLoggerReturn {
  /**
   * Log the start of a step
   */
  logStepStart: (step: string, context?: Record<string, unknown>) => void;

  /**
   * Log the successful completion of a step
   */
  logStepEnd: (step: string, context?: Record<string, unknown>) => void;

  /**
   * Log a step failure
   */
  logStepError: (step: string, error: Error | string, context?: Record<string, unknown>) => void;

  /**
   * Log a step with custom event type
   */
  logStep: (log: Omit<StepLog, 'timestamp'>) => void;
}

/**
 * Hook to simplify frontend step logging
 *
 * @example
 * ```tsx
 * function TrialSignupForm() {
 *   const { logStepStart, logStepEnd, logStepError } = useStepLogger();
 *
 *   const handleSubmit = async (data) => {
 *     logStepStart('submit_trial_form', { plan: data.planType });
 *
 *     try {
 *       const response = await createTrial(data);
 *       logStepEnd('submit_trial_form', { account_id: response.accountId });
 *     } catch (error) {
 *       logStepError('submit_trial_form', error);
 *       throw error;
 *     }
 *   };
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useStepLogger(): UseStepLoggerReturn {
  // Track step start times for duration calculation
  const stepTimings = useRef<Map<string, number>>(new Map());

  const logStepStart = useCallback((step: string, context?: Record<string, unknown>) => {
    const startTime = Date.now();
    stepTimings.current.set(step, startTime);

    logFrontendStep({
      timestamp: new Date().toISOString(),
      step,
      event_type: 'step_start',
      context,
    });
  }, []);

  const logStepEnd = useCallback((step: string, context?: Record<string, unknown>) => {
    const startTime = stepTimings.current.get(step);
    const duration_ms = startTime ? Date.now() - startTime : undefined;

    logFrontendStep({
      timestamp: new Date().toISOString(),
      step,
      event_type: 'step_end',
      duration_ms,
      result: 'success',
      context,
    });

    // Clean up timing
    stepTimings.current.delete(step);
  }, []);

  const logStepError = useCallback(
    (step: string, error: Error | string, context?: Record<string, unknown>) => {
      const startTime = stepTimings.current.get(step);
      const duration_ms = startTime ? Date.now() - startTime : undefined;

      const errorMessage = error instanceof Error ? error.message : String(error);

      logFrontendStep({
        timestamp: new Date().toISOString(),
        step,
        event_type: 'error',
        duration_ms,
        result: 'failure',
        error: errorMessage,
        context,
      });

      // Clean up timing
      stepTimings.current.delete(step);
    },
    []
  );

  const logStep = useCallback((log: Omit<StepLog, 'timestamp'>) => {
    logFrontendStep({
      ...log,
      timestamp: new Date().toISOString(),
    });
  }, []);

  return {
    logStepStart,
    logStepEnd,
    logStepError,
    logStep,
  };
}

/**
 * Auto-log hook that automatically logs step start/end based on async operation
 *
 * @example
 * ```tsx
 * const { execute } = useAutoLoggedStep('create_trial');
 *
 * const result = await execute(async () => {
 *   return await createTrial(data);
 * }, { plan: data.planType });
 * ```
 */
export function useAutoLoggedStep(stepName: string) {
  const { logStepStart, logStepEnd, logStepError } = useStepLogger();

  const execute = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      context?: Record<string, unknown>
    ): Promise<T> => {
      logStepStart(stepName, context);

      try {
        const result = await operation();
        logStepEnd(stepName, context);
        return result;
      } catch (error) {
        logStepError(stepName, error as Error, context);
        throw error;
      }
    },
    [stepName, logStepStart, logStepEnd, logStepError]
  );

  return { execute };
}
