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
    // onFeatureFlags is async — flags are not available on first render.
    // We must wait for this callback before reading any flag values.
    const unsubscribe = posthog.onFeatureFlags(() => {
      const variant = (posthog.getFeatureFlag(flagKey) as string) ?? 'control';
      const rawPayload = (posthog.getFeatureFlagPayload(flagKey) as Partial<TPayload>) ?? {};

      if (!rawPayload || Object.keys(rawPayload).length === 0) {
        console.warn('[useCopyExperiment] No payload for variant:', variant);
      }

      console.log('[useCopyExperiment] onFeatureFlags fired', { variant, rawPayload });

      setState({
        isReady: true,
        variant,
        payload: { ...fallbackPayload, ...rawPayload },
      });
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [flagKey]);

  return state;
}
