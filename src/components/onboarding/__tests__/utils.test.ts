/**
 * Unit tests for onboarding utility functions
 */

import { describe, it, expect } from "vitest";
import {
  formatPhoneE164,
  formatPhoneDisplay,
  getForwardingDigits,
  isValidEmail,
  isValidZipCode,
  getPlanPrice,
  getPlanName,
  getVoiceLabel,
  sanitizeBusinessName,
  generateAssistantName,
  isProvisioningComplete,
  isProvisioningFailed,
  isProvisioningInProgress,
  getSignupErrorMessage,
} from "../utils";

describe("Phone formatting utilities", () => {
  describe("formatPhoneE164", () => {
    it("formats 10-digit US number", () => {
      expect(formatPhoneE164("5551234567")).toBe("+15551234567");
    });

    it("formats number with separators", () => {
      expect(formatPhoneE164("(555) 123-4567")).toBe("+15551234567");
    });

    it("handles 11-digit number starting with 1", () => {
      expect(formatPhoneE164("15551234567")).toBe("+15551234567");
    });

    it("preserves already formatted E.164", () => {
      expect(formatPhoneE164("+15551234567")).toBe("+15551234567");
    });
  });

  describe("formatPhoneDisplay", () => {
    it("formats 10-digit number", () => {
      expect(formatPhoneDisplay("5551234567")).toBe("(555) 123-4567");
    });

    it("formats 11-digit number with leading 1", () => {
      expect(formatPhoneDisplay("15551234567")).toBe("(555) 123-4567");
    });

    it("handles number with existing formatting", () => {
      expect(formatPhoneDisplay("+1 (555) 123-4567")).toBe("(555) 123-4567");
    });
  });

  describe("getForwardingDigits", () => {
    it("removes +1 prefix", () => {
      expect(getForwardingDigits("+15551234567")).toBe("5551234567");
    });

    it("removes leading 1", () => {
      expect(getForwardingDigits("15551234567")).toBe("5551234567");
    });

    it("returns 10 digits for clean number", () => {
      expect(getForwardingDigits("5551234567")).toBe("5551234567");
    });
  });
});

describe("Validation utilities", () => {
  describe("isValidEmail", () => {
    it("validates correct email", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
    });

    it("rejects invalid email", () => {
      expect(isValidEmail("not-an-email")).toBe(false);
      expect(isValidEmail("missing@domain")).toBe(false);
      expect(isValidEmail("@example.com")).toBe(false);
    });
  });

  describe("isValidZipCode", () => {
    it("validates 5-digit ZIP", () => {
      expect(isValidZipCode("12345")).toBe(true);
    });

    it("rejects invalid ZIP codes", () => {
      expect(isValidZipCode("1234")).toBe(false);
      expect(isValidZipCode("123456")).toBe(false);
      expect(isValidZipCode("abcde")).toBe(false);
    });
  });
});

describe("Plan utilities", () => {
  describe("getPlanPrice", () => {
    it("returns correct prices", () => {
      expect(getPlanPrice("starter")).toBe(297);
      expect(getPlanPrice("professional")).toBe(497);
      expect(getPlanPrice("premium")).toBe(797);
    });
  });

  describe("getPlanName", () => {
    it("returns correct names", () => {
      expect(getPlanName("starter")).toBe("Starter");
      expect(getPlanName("professional")).toBe("Professional");
      expect(getPlanName("premium")).toBe("Premium");
    });
  });
});

describe("Voice utilities", () => {
  describe("getVoiceLabel", () => {
    it("returns correct labels", () => {
      expect(getVoiceLabel("male")).toBe("Male Voice");
      expect(getVoiceLabel("female")).toBe("Female Voice");
    });
  });
});

describe("Business name utilities", () => {
  describe("sanitizeBusinessName", () => {
    it("removes special characters", () => {
      expect(sanitizeBusinessName("Joe's HVAC & Plumbing!")).toBe(
        "Joes HVAC  Plumbing"
      );
    });

    it("trims whitespace", () => {
      expect(sanitizeBusinessName("  ACME Corp  ")).toBe("ACME Corp");
    });

    it("limits length to 50 characters", () => {
      const longName = "A".repeat(100);
      expect(sanitizeBusinessName(longName).length).toBe(50);
    });
  });

  describe("generateAssistantName", () => {
    it("generates correct name with female voice", () => {
      expect(generateAssistantName("ACME Plumbing", "female")).toBe(
        "ACME Plumbing AI Receptionist (Female)"
      );
    });

    it("generates correct name with male voice", () => {
      expect(generateAssistantName("Joe's HVAC", "male")).toBe(
        "Joes HVAC AI Receptionist (Male)"
      );
    });

    it("sanitizes business name", () => {
      expect(generateAssistantName("Joe's HVAC & Co.!", "female")).toBe(
        "Joes HVAC  Co AI Receptionist (Female)"
      );
    });
  });
});

describe("Provisioning status utilities", () => {
  describe("isProvisioningComplete", () => {
    it("returns true for active status", () => {
      expect(isProvisioningComplete("active")).toBe(true);
    });

    it("returns false for other statuses", () => {
      expect(isProvisioningComplete("pending")).toBe(false);
      expect(isProvisioningComplete("provisioning")).toBe(false);
      expect(isProvisioningComplete("failed")).toBe(false);
    });
  });

  describe("isProvisioningFailed", () => {
    it("returns true for failed status", () => {
      expect(isProvisioningFailed("failed")).toBe(true);
    });

    it("returns false for other statuses", () => {
      expect(isProvisioningFailed("active")).toBe(false);
      expect(isProvisioningFailed("pending")).toBe(false);
    });
  });

  describe("isProvisioningInProgress", () => {
    it("returns true for pending/provisioning", () => {
      expect(isProvisioningInProgress("pending")).toBe(true);
      expect(isProvisioningInProgress("provisioning")).toBe(true);
    });

    it("returns false for completed/failed", () => {
      expect(isProvisioningInProgress("active")).toBe(false);
      expect(isProvisioningInProgress("failed")).toBe(false);
    });
  });
});

describe("Error handling utilities", () => {
  describe("getSignupErrorMessage", () => {
    it("extracts message from Error object", () => {
      const error = new Error("Something went wrong");
      expect(getSignupErrorMessage(error)).toBe("Something went wrong");
    });

    it("returns string error as is", () => {
      expect(getSignupErrorMessage("Custom error")).toBe("Custom error");
    });

    it("returns default message for unknown errors", () => {
      expect(getSignupErrorMessage(null)).toBe(
        "An unexpected error occurred. Please try again."
      );
      expect(getSignupErrorMessage(undefined)).toBe(
        "An unexpected error occurred. Please try again."
      );
    });
  });
});
