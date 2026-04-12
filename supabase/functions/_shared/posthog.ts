import { PostHog } from "npm:posthog-node";

const posthogApiKey = Deno.env.get("POSTHOG_API_KEY");

export const posthog = posthogApiKey
  ? new PostHog(posthogApiKey, {
    host: "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  })
  : null;
