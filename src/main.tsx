import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global error handler to catch any unhandled errors
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Check environment variables before rendering
const env = import.meta.env as Record<string, string | undefined>;
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  env.VITE_SUPABASE_ANON_KEY;

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
  console.error(
    "🚨 DEPLOYMENT ERROR: Supabase environment variables are missing!\n" +
    "The app cannot function without these variables.\n" +
    "Please set the following in your deployment platform:\n" +
    "  - VITE_SUPABASE_URL\n" +
    "  - VITE_SUPABASE_ANON_KEY"
  );
}

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
          <h1 style="color: #dc2626; font-size: 24px; margin-bottom: 16px;">⚠️ Configuration Error</h1>
          <p style="color: #374151; margin-bottom: 24px;">The application failed to start. This is usually caused by missing environment variables in your deployment.</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; text-align: left; margin-bottom: 24px;">
            <p style="color: #991b1b; font-weight: 600; margin-bottom: 8px;">Missing Configuration:</p>
            <ul style="color: #7f1d1d; margin: 0; padding-left: 20px;">
              <li>VITE_SUPABASE_URL</li>
              <li>VITE_SUPABASE_ANON_KEY</li>
            </ul>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Check the browser console for more details.</p>
        </div>
      </div>
    `;
  }
}
