import '@testing-library/jest-dom';

// Mock IntersectionObserver
const intersectionObserverMock = () => ({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = vi.fn().mockImplementation(intersectionObserverMock);

// Mock ResizeObserver
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock environment variables
const MOCK_ENV = {
  VITE_SUPABASE_URL: "https://your-supabase-url.supabase.co",
  VITE_SUPABASE_ANON_KEY:"your-supabase-anon-key",
  VITE_STRIPE_PUBLISHABLE_KEY: "your-stripe-publishable-key",
  VITE_POSTHOG_KEY: "your-posthog-key",
  VITE_POSTHOG_HOST: "https://your-posthog-host.com",
};

vi.stubGlobal('import.meta.env', MOCK_ENV);
