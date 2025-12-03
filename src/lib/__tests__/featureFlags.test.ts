/**
 * Tests for Feature Flags
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Feature Flags", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("default values", () => {
    it("twoStepSignup defaults to true", async () => {
      // Import fresh module to test defaults
      const { featureFlags } = await import("../featureFlags");
      expect(featureFlags.twoStepSignup).toBe(true);
    });

    it("debugSignup defaults to false", async () => {
      const { featureFlags } = await import("../featureFlags");
      expect(featureFlags.debugSignup).toBe(false);
    });
  });

  describe("FeatureFlags interface", () => {
    it("has the expected shape", async () => {
      const { featureFlags } = await import("../featureFlags");

      expect(featureFlags).toHaveProperty("twoStepSignup");
      expect(featureFlags).toHaveProperty("debugSignup");
      expect(typeof featureFlags.twoStepSignup).toBe("boolean");
      expect(typeof featureFlags.debugSignup).toBe("boolean");
    });
  });

  describe("logFeatureFlags", () => {
    it("is a function", async () => {
      const { logFeatureFlags } = await import("../featureFlags");
      expect(typeof logFeatureFlags).toBe("function");
    });

    it("does not throw when called", async () => {
      const { logFeatureFlags } = await import("../featureFlags");
      expect(() => logFeatureFlags()).not.toThrow();
    });
  });
});
