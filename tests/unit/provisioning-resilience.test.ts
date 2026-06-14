/**
 * Tests for resilient provisioning status helpers and state transitions
 */
import { describe, it, expect } from "vitest";
import {
  isProvisioned,
  isProvisioningInProgress,
  isProvisioningFailed,
  isPartiallyProvisioned,
} from "@/lib/billing/dashboardPlans";

describe("Provisioning Status Helpers", () => {
  describe("isProvisioned", () => {
    it("returns true when provisioning_status is completed", () => {
      expect(isProvisioned({ provisioning_status: "completed" })).toBe(true);
    });

    it("returns true when vapi_phone_number exists", () => {
      expect(isProvisioned({ provisioning_status: "pending", vapi_phone_number: "+15551234567" })).toBe(true);
    });

    it("returns true when phone_numbers array has entries", () => {
      expect(isProvisioned({ provisioning_status: "pending" }, [{ phone_number: "+15551234567" }])).toBe(true);
    });

    it("returns false when pending with no phone", () => {
      expect(isProvisioned({ provisioning_status: "pending" })).toBe(false);
    });

    it("returns false when partially_provisioned", () => {
      expect(isProvisioned({ provisioning_status: "partially_provisioned" })).toBe(false);
    });

    it("returns false when failed_manual_action_required", () => {
      expect(isProvisioned({ provisioning_status: "failed_manual_action_required" })).toBe(false);
    });
  });

  describe("isProvisioningInProgress", () => {
    it("returns true for pending", () => {
      expect(isProvisioningInProgress({ provisioning_status: "pending" })).toBe(true);
    });

    it("returns true for processing", () => {
      expect(isProvisioningInProgress({ provisioning_status: "processing" })).toBe(true);
    });

    it("returns true for failed_retryable (auto-retrying)", () => {
      expect(isProvisioningInProgress({ provisioning_status: "failed_retryable" })).toBe(true);
    });

    it("returns false for completed", () => {
      expect(isProvisioningInProgress({ provisioning_status: "completed" })).toBe(false);
    });

    it("returns false for failed", () => {
      expect(isProvisioningInProgress({ provisioning_status: "failed" })).toBe(false);
    });

    it("returns false for partially_provisioned", () => {
      expect(isProvisioningInProgress({ provisioning_status: "partially_provisioned" })).toBe(false);
    });
  });

  describe("isProvisioningFailed", () => {
    it("returns true for failed", () => {
      expect(isProvisioningFailed({ provisioning_status: "failed" })).toBe(true);
    });

    it("returns true for failed_manual_action_required", () => {
      expect(isProvisioningFailed({ provisioning_status: "failed_manual_action_required" })).toBe(true);
    });

    it("returns false for failed_retryable (still retrying)", () => {
      expect(isProvisioningFailed({ provisioning_status: "failed_retryable" })).toBe(false);
    });

    it("returns false for completed", () => {
      expect(isProvisioningFailed({ provisioning_status: "completed" })).toBe(false);
    });

    it("returns false for partially_provisioned", () => {
      expect(isProvisioningFailed({ provisioning_status: "partially_provisioned" })).toBe(false);
    });
  });

  describe("isPartiallyProvisioned", () => {
    it("returns true for partially_provisioned", () => {
      expect(isPartiallyProvisioned({ provisioning_status: "partially_provisioned" })).toBe(true);
    });

    it("returns false for completed", () => {
      expect(isPartiallyProvisioned({ provisioning_status: "completed" })).toBe(false);
    });

    it("returns false for pending", () => {
      expect(isPartiallyProvisioned({ provisioning_status: "pending" })).toBe(false);
    });

    it("returns false for failed", () => {
      expect(isPartiallyProvisioned({ provisioning_status: "failed" })).toBe(false);
    });

    it("returns false for null", () => {
      expect(isPartiallyProvisioned({ provisioning_status: null })).toBe(false);
    });
  });
});

describe("Provisioning State Machine", () => {
  it("defines correct state transitions for Twilio failure with Vapi success", () => {
    // This tests the expected state flow:
    // pending → processing → partially_provisioned (assistant OK, phone failed)
    const states = ["pending", "processing", "partially_provisioned"];
    expect(isProvisioningInProgress({ provisioning_status: states[0] })).toBe(true);
    expect(isProvisioningInProgress({ provisioning_status: states[1] })).toBe(true);
    expect(isPartiallyProvisioned({ provisioning_status: states[2] })).toBe(true);
    expect(isProvisioningFailed({ provisioning_status: states[2] })).toBe(false);
  });

  it("defines correct state transitions for complete failure", () => {
    // pending → processing → failed_retryable → ... → failed_manual_action_required
    expect(isProvisioningInProgress({ provisioning_status: "failed_retryable" })).toBe(true);
    expect(isProvisioningFailed({ provisioning_status: "failed_manual_action_required" })).toBe(true);
  });

  it("defines correct state transitions for success", () => {
    // pending → processing → completed
    expect(isProvisioningInProgress({ provisioning_status: "pending" })).toBe(true);
    expect(isProvisioned({ provisioning_status: "completed" })).toBe(true);
  });

  it("failed_retryable is treated as in-progress (auto-retry)", () => {
    // User should see "still setting up" not "failed"
    const account = { provisioning_status: "failed_retryable" };
    expect(isProvisioningInProgress(account)).toBe(true);
    expect(isProvisioningFailed(account)).toBe(false);
    expect(isPartiallyProvisioned(account)).toBe(false);
  });
});
