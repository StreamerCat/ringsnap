import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import * as Sentry from "@sentry/react";
import { initAnalytics } from "./lib/analytics";
import App from "./App.tsx";
import "./index.css";

// Get environment and release info
const environment = import.meta.env.MODE || "production";
const release = import.meta.env.VITE_SENTRY_RELEASE || "unknown";

// Initialize Sentry for error tracking
Sentry.init({
  // Use environment variable for DSN if available, otherwise fallback to hardcoded
  dsn: import.meta.env.VITE_SENTRY_DSN || "https://1f6b5bec7383a2bdc6f65ec86bf977f0@o4510524163096576.ingest.us.sentry.io/4510524183609344",
  environment,
  release,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      // Mask all text and input content by default for privacy
      maskAllText: true,
      maskAllInputs: true,
      // Block all media (images, videos, etc) for privacy
      blockAllMedia: true,
    }),
    // Capture console errors automatically
    Sentry.consoleLoggingIntegration({ levels: ["error"] }), // Only errors, not warns
  ],

  // Logging
  _experiments: {
    enableLogs: true,
  },

  // Performance Monitoring - Low sampling for minimal overhead
  tracesSampleRate: 0.03, // Sample 3% of transactions

  // Session Replay - Error-only to minimize noise and storage costs
  replaysSessionSampleRate: 0, // Do not capture normal sessions
  replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with errors

  // Redact sensitive data before sending to Sentry
  beforeSend(event, hint) {
    // Redact sensitive fields from all contexts
    const sensitivePatterns = [
      "email",
      "phone",
      "token",
      "secret",
      "authorization",
      "cookie",
      "transcript",
      "raw_audio",
      "card",
      "password",
      "apikey",
      "api_key",
      "stripe_key",
      "publishable_key",
    ];

    const redactObject = (obj: any): any => {
      if (!obj || typeof obj !== "object") return obj;

      if (Array.isArray(obj)) {
        return obj.map(item => redactObject(item));
      }

      const redacted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const keyLower = key.toLowerCase();
        const shouldRedact = sensitivePatterns.some(pattern => keyLower.includes(pattern));

        if (shouldRedact) {
          redacted[key] = "[REDACTED]";
        } else if (value && typeof value === "object") {
          redacted[key] = redactObject(value);
        } else {
          redacted[key] = value;
        }
      }
      return redacted;
    };

    // Redact request data
    if (event.request) {
      event.request = redactObject(event.request);
    }

    // Redact extra context
    if (event.extra) {
      event.extra = redactObject(event.extra);
    }

    // Redact user data (keep only id)
    if (event.user) {
      const userId = event.user.id;
      event.user = { id: userId };
    }

    // Redact breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => ({
        ...breadcrumb,
        data: redactObject(breadcrumb.data),
      }));
    }

    return event;
  },

  // Ignore common non-actionable errors
  ignoreErrors: [
    // Network errors (often not actionable)
    "NetworkError",
    "Network request failed",
    "Failed to fetch",
    "Load failed",

    // Aborted requests (user navigated away)
    "AbortError",
    "The operation was aborted",

    // ResizeObserver loop errors (benign browser quirk)
    "ResizeObserver loop",

    // Browser extension errors
    "Extension context invalidated",
    "chrome-extension://",
    "moz-extension://",

    // Permissions errors (expected in some cases)
    "NotAllowedError",

    // Non-errors
    "Non-Error",
  ],

  // Ignore errors from third-party scripts
  denyUrls: [
    // Browser extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,
  ],
});

// Initialize PostHog analytics (non-blocking, additive alongside Sentry)
// No-op if VITE_POSTHOG_KEY is not set
initAnalytics();

// Global error handler to catch any unhandled errors
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  Sentry.captureException(event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  Sentry.captureException(event.reason);
});

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }

  createRoot(rootElement).render(
    <StrictMode>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </StrictMode>
  );
} catch (error) {
  console.error("Failed to render app:", error);
  // Show a visible error message in the DOM
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; font-family: system-ui, -apple-system, sans-serif; background: linear-gradient(to bottom, #ffffff, #f3f4f6);">
        <div style="max-width: 600px; text-align: center;">
          <h1 style="color: #dc2626; font-size: 24px; margin-bottom: 16px;">⚠️ Application Error</h1>
          <p style="color: #374151; margin-bottom: 24px;">The application failed to start. Check the browser console for details.</p>
        </div>
      </div>
    `;
  }
}
