import { posthog } from "./posthog.ts";
import { logInfo, logWarn, type LogOptions } from "./logging.ts";

const POSTHOG_FLAG_KEY = "vapi-provisioning-enabled";
const FLAG_CHECK_TIMEOUT_MS = 3000;

/**
 * Single source of truth for whether live Vapi/Twilio provisioning may run
 * right now. Used by every entry point that can enqueue or execute a
 * provisioning job (create-trial, provision-vapi, create-sales-account,
 * finalize-trial) so they can never disagree about provisioning state.
 *
 * Fail closed at every layer:
 *   - ENABLE_VAPI_PROVISIONING must be explicitly "true". This is the
 *     primary opt-in gate operations flips after verifying providers are
 *     healthy again; a missing or malformed value never spends provider
 *     resources.
 *   - When the env var is on, the PostHog release flag
 *     ("vapi-provisioning-enabled") must also independently agree. This
 *     gives operations a fast, no-deploy kill switch with an audit trail,
 *     without ever being the sole thing standing between a bad state and
 *     live provider calls.
 *   - A PostHog outage, timeout, or missing API key falls back to paused,
 *     never to enabled.
 */
export async function isVapiProvisioningEnabled(
  distinctId: string,
  logOptions: LogOptions,
): Promise<boolean> {
  if (Deno.env.get("ENABLE_VAPI_PROVISIONING") !== "true") {
    return false;
  }

  if (!posthog) {
    logWarn(
      "POSTHOG_API_KEY not configured; provisioning stays paused",
      logOptions,
    );
    return false;
  }

  try {
    const enabled = await Promise.race([
      posthog.isFeatureEnabled(POSTHOG_FLAG_KEY, distinctId),
      new Promise<boolean>((_, reject) => {
        setTimeout(
          () => reject(new Error("PostHog feature flag check timed out")),
          FLAG_CHECK_TIMEOUT_MS,
        );
      }),
    ]);

    if (enabled !== true) {
      logInfo(
        `Provisioning paused: PostHog flag "${POSTHOG_FLAG_KEY}" is off`,
        logOptions,
      );
      return false;
    }

    return true;
  } catch (error) {
    logWarn(
      "PostHog feature flag check failed; provisioning stays paused",
      { ...logOptions, error },
    );
    return false;
  }
}
