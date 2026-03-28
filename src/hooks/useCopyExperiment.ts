import { useEffect, useState } from 'react';
import { posthog } from '@/lib/analytics';

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

function deepMerge<TPayload extends Record<string, unknown>>(
  fallbackPayload: TPayload,
  payloadOverride: Partial<TPayload>,
): TPayload {
  const merged: Record<string, unknown> = { ...fallbackPayload };

  for (const [key, value] of Object.entries(payloadOverride)) {
    if (value === undefined) continue;

    const currentValue = merged[key];
    if (isObject(currentValue) && isObject(value)) {
      merged[key] = deepMerge(
        currentValue as Record<string, unknown>,
        value as Record<string, unknown>,
      );
      continue;
    }

    merged[key] = value;
  }

  return merged as TPayload;
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

  useEffect(() => {
    if (!hasPosthogKey) return;

    console.log('[useCopyExperiment] hook mounted, posthog.__loaded:', (posthog as { __loaded?: boolean }).__loaded);

    setState((current) => ({
      ...current,
      isReady: false,
    }));

    // Feature flags are fetched asynchronously after posthog.init();
    // synchronous getFeatureFlag/getFeatureFlagPayload reads can be undefined before this callback runs.
    const unsubscribe = posthog.onFeatureFlags(() => {
      const featureFlag = posthog.getFeatureFlag(flagKey);
      const rawPayload = posthog.getFeatureFlagPayload(flagKey);
      console.log('[useCopyExperiment] onFeatureFlags fired', { variant: featureFlag, rawPayload });
      const variant = featureFlag === undefined
        ? defaultVariant
        : String(featureFlag);
      const payloadOverride = isObject(rawPayload) ? rawPayload as Partial<TPayload> : {};

      setState({
        isReady: true,
        payload: deepMerge(fallbackPayload, payloadOverride),
        variant,
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, [defaultVariant, fallbackPayload, flagKey, hasPosthogKey]);

  return state;
}
