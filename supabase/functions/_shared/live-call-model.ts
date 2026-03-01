const DEFAULT_LIVE_CALL_MODEL = "gpt-4o-mini";

function isValidLiveCallModel(value: string): boolean {
  return /^gpt-[a-zA-Z0-9._-]+$/.test(value);
}

/**
 * Canonical source of truth for LIVE-CALL assistant model selection.
 *
 * If LIVE_CALL_MODEL is set to a valid model id, it is used.
 * Otherwise we safely fall back to gpt-4o-mini and never throw.
 */
export function getLiveCallModel(): string {
  const rawValue = Deno.env.get("LIVE_CALL_MODEL")?.trim();
  if (!rawValue) {
    return DEFAULT_LIVE_CALL_MODEL;
  }

  if (!isValidLiveCallModel(rawValue)) {
    console.warn("[live-call-model] Invalid LIVE_CALL_MODEL; falling back to default", {
      liveCallModel: rawValue,
      fallbackModel: DEFAULT_LIVE_CALL_MODEL,
    });
    return DEFAULT_LIVE_CALL_MODEL;
  }

  return rawValue;
}

export { DEFAULT_LIVE_CALL_MODEL };
