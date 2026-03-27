import { useEffect, useMemo, useState } from 'react';
import { getFeatureFlag, posthog } from '@/lib/analytics';

type ExperimentState<TPayload> = {
  isReady: boolean;
  payload: TPayload;
  variant: string;
};

type UseCopyExperimentOptions = {
  defaultVariant?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function useCopyExperiment<TPayload extends Record<string, unknown>>(
  flagKey: string,
  fallbackPayload: TPayload,
  options?: UseCopyExperimentOptions,
): ExperimentState<TPayload> {
  const defaultVariant = options?.defaultVariant ?? 'control';
  const hasPosthogKey = Boolean(import.meta.env.VITE_POSTHOG_KEY);

  const [state, setState] = useState<ExperimentState<TPayload>>({
    isReady: !hasPosthogKey,
    payload: fallbackPayload,
    variant: defaultVariant,
  });

  const resolveExperiment = useMemo(
    () => () => {
      const featureFlag = getFeatureFlag(flagKey);
      const variant = typeof featureFlag === 'string' && featureFlag.trim().length > 0
        ? featureFlag
        : defaultVariant;

      const payload = posthog.getFeatureFlagPayload(flagKey);
      const nextPayload = isObject(payload)
        ? { ...fallbackPayload, ...(payload as Partial<TPayload>) }
        : fallbackPayload;

      setState({
        isReady: true,
        payload: nextPayload,
        variant,
      });
    },
    [defaultVariant, fallbackPayload, flagKey],
  );

  useEffect(() => {
    if (!hasPosthogKey) return;

    resolveExperiment();

    const unsubscribe = posthog.onFeatureFlags(() => {
      resolveExperiment();
    });

    return () => {
      unsubscribe();
    };
  }, [hasPosthogKey, resolveExperiment]);

  return state;
}
