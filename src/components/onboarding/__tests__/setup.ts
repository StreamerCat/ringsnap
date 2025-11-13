/**
 * Test setup and configuration
 * Configures testing library, mocks, and global test utilities
 */

import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock window.matchMedia (required for some components)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
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

// Mock window.open (used in test call functionality)
Object.defineProperty(window, "open", {
  writable: true,
  value: vi.fn(),
});

// Mock IntersectionObserver (required for some UI components)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock environment variables
process.env.VITE_STRIPE_PUBLISHABLE_KEY = "pk_test_mock";
process.env.VITE_STRIPE_PRICE_STARTER = "price_starter_test";
process.env.VITE_STRIPE_PRICE_PROFESSIONAL = "price_professional_test";
process.env.VITE_STRIPE_PRICE_PREMIUM = "price_premium_test";
process.env.VITE_SUPABASE_URL = "https://test.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = "test_anon_key";

// Helper: Wait for async operations
export function waitForAsync() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Helper: Create mock form data
export function createMockSelfServeData() {
  return {
    name: "John Doe",
    email: "john@example.com",
    phone: "5551234567",
    companyName: "ACME Plumbing",
    trade: "Plumbing",
    website: "https://acme.com",
    serviceArea: "Greater Los Angeles",
    zipCode: "90210",
    assistantGender: "female" as const,
    primaryGoal: "book_appointments" as const,
    planType: "professional" as const,
  };
}

export function createMockSalesData() {
  return {
    name: "Jane Smith",
    email: "jane@example.com",
    phone: "5559876543",
    companyName: "Best HVAC",
    trade: "HVAC",
    serviceArea: "San Diego County",
    zipCode: "92101",
    assistantGender: "male" as const,
    planType: "premium" as const,
    salesRepName: "Bob Johnson",
  };
}
