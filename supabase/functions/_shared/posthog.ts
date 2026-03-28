import { PostHog } from "npm:posthog-node";

const posthogApiKey = Deno.env.get("POSTHOG_API_KEY");
const posthogHost = Deno.env.get("POSTHOG_HOST") ?? "https://us.i.posthog.com";

export const posthog = posthogApiKey
  ? new PostHog(posthogApiKey, { host: posthogHost })
  : null;
