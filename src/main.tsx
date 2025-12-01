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
