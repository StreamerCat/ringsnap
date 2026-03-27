const ATTRIBUTION_STORAGE_KEY = 'ringsnap_experiment_attribution';

export type ExperimentAttribution = {
  experimentKey: string;
  variant: string;
  page: string;
  section: string;
  ctaText?: string;
};

type AttributionStore = Record<string, ExperimentAttribution>;

function readStore(): AttributionStore {
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as AttributionStore;
    }

    return {};
  } catch {
    return {};
  }
}

function writeStore(store: AttributionStore): void {
  try {
    sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage failures for privacy mode or blocked storage.
  }
}

export function setExperimentAttribution(attribution: ExperimentAttribution): void {
  const store = readStore();
  store[attribution.experimentKey] = attribution;
  writeStore(store);
}

export function getExperimentAttribution(experimentKey: string): ExperimentAttribution | null {
  const store = readStore();
  return store[experimentKey] ?? null;
}
