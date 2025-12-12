import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

// Initialize Sentry for error tracking
Sentry.init({
  dsn: "https://1f6b5bec7383a2bdc6f65ec86bf977f0@o4510524163096576.ingest.us.sentry.io/4510524183609344",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
    // Capture console errors automatically
    Sentry.consoleLoggingIntegration({ levels: ["error", "warn"] }),
  ],
  // Logging
  _experiments: {
    enableLogs: true,
  },
  // Performance Monitoring
  tracesSampleRate: 0.02, // Sample 2% of transactions for performance monitoring
  // Session Replay
  replaysSessionSampleRate: 0.1, // Sample 10% of sessions
  replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with errors
});

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
      <App />
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
