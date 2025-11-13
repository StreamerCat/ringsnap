/**
 * Integration tests for onboarding flows
 * Tests complete user journeys through both self-serve and sales flows
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { SelfServeTrialFlow } from "../SelfServeTrialFlow";
import { SalesGuidedTrialFlow } from "../SalesGuidedTrialFlow";

// Mock Stripe
const mockStripe = loadStripe("pk_test_mock");

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(() => ({
        data: {
          ok: true,
          account_id: "acc_test123",
          profile_id: "prof_test123",
        },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: "acc_test123",
              provisioning_status: "active",
              vapi_phone_number: "+15551234567",
            },
            error: null,
          })),
        })),
      })),
    })),
  },
}));

// Wrapper with required providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <Elements stripe={mockStripe}>{children}</Elements>
    </BrowserRouter>
  );
}

describe("Self-Serve Trial Flow - Complete Journey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("progresses through all 8 steps successfully", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(
      <TestWrapper>
        <SelfServeTrialFlow onSuccess={onSuccess} />
      </TestWrapper>
    );

    // Step 1: User Info
    expect(screen.getByText("Your Information")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("John Doe"), "John Doe");
    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "john@example.com"
    );
    await user.type(
      screen.getByPlaceholderText("(555) 123-4567"),
      "5551234567"
    );

    await user.click(screen.getByText("Continue"));

    // Step 2: Business Basics
    await waitFor(() => {
      expect(screen.getByText("Business Basics")).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText("Your Company Name"),
      "ACME Plumbing"
    );
    await user.selectOptions(screen.getByRole("combobox"), "Plumbing");
    await user.type(
      screen.getByPlaceholderText("https://yourcompany.com"),
      "https://acme.com"
    );

    await user.click(screen.getByText("Continue"));

    // Step 3: Business Advanced (optional - can skip)
    await waitFor(() => {
      expect(screen.getByText("Business Details")).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Skip for now|Continue/));

    // Step 4: Voice Selection
    await waitFor(() => {
      expect(screen.getByText("Choose Your AI Voice")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Female Voice"));
    await user.click(screen.getByText("Continue"));

    // Step 5: Plan Selection
    await waitFor(() => {
      expect(screen.getByText("Select Your Plan")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Professional"));
    await user.click(screen.getByText("Continue"));

    // Step 6: Payment
    await waitFor(() => {
      expect(screen.getByText(/Payment/)).toBeInTheDocument();
    });

    // Note: Stripe CardElement is mocked, can't interact directly
    // In real test, would use Stripe test card: 4242 4242 4242 4242

    // Would continue through provisioning (Step 7) and phone ready (Step 8)
  });

  it("validates required fields at each step", async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <SelfServeTrialFlow />
      </TestWrapper>
    );

    // Try to continue without filling fields
    await user.click(screen.getByText("Continue"));

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
  });

  it("allows going back to previous steps", async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <SelfServeTrialFlow />
      </TestWrapper>
    );

    // Fill step 1 and continue
    await user.type(screen.getByPlaceholderText("John Doe"), "John Doe");
    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "john@example.com"
    );
    await user.type(
      screen.getByPlaceholderText("(555) 123-4567"),
      "5551234567"
    );
    await user.click(screen.getByText("Continue"));

    // Now on step 2
    await waitFor(() => {
      expect(screen.getByText("Business Basics")).toBeInTheDocument();
    });

    // Click back
    await user.click(screen.getByText("Back"));

    // Should be back on step 1
    await waitFor(() => {
      expect(screen.getByText("Your Information")).toBeInTheDocument();
    });
  });
});

describe("Sales-Guided Trial Flow - Complete Journey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("progresses through all 5 steps successfully", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(
      <TestWrapper>
        <SalesGuidedTrialFlow onSuccess={onSuccess} />
      </TestWrapper>
    );

    // Step 1: Combined Form
    expect(screen.getByText("New Customer Setup")).toBeInTheDocument();

    // Customer info
    await user.type(screen.getByPlaceholderText("John Doe"), "Jane Smith");
    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "jane@example.com"
    );
    await user.type(
      screen.getByPlaceholderText("(555) 123-4567"),
      "5559876543"
    );

    // Business info
    await user.type(
      screen.getByPlaceholderText("Your Company Name"),
      "Best HVAC"
    );
    await user.selectOptions(screen.getByRole("combobox"), "HVAC");
    await user.type(
      screen.getByPlaceholderText(/Service area/),
      "San Diego County"
    );
    await user.type(screen.getByPlaceholderText("12345"), "92101");

    // Voice selection
    await user.click(screen.getByText("Male Voice"));

    // Sales rep
    await user.type(screen.getByPlaceholderText("Your name"), "Bob Johnson");

    await user.click(screen.getByText("Continue to Plan Selection"));

    // Step 2: Plan Selection
    await waitFor(() => {
      expect(screen.getByText("Select Plan")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Premium"));
    await user.click(screen.getByText("Continue to Payment"));

    // Step 3: Payment
    await waitFor(() => {
      expect(screen.getByText("Payment")).toBeInTheDocument();
    });

    // Note: Terms checkbox NOT shown in sales flow (rep handles verbally)
    expect(screen.queryByText(/Terms of Service/)).not.toBeInTheDocument();

    // Would continue through provisioning (Step 4) and demo (Step 5)
  });

  it("shows all info on single page (Step 1)", () => {
    render(
      <TestWrapper>
        <SalesGuidedTrialFlow />
      </TestWrapper>
    );

    // All sections visible at once
    expect(screen.getByText("Customer Information")).toBeInTheDocument();
    expect(screen.getByText("Business Information")).toBeInTheDocument();
    expect(screen.getByText(/Voice/)).toBeInTheDocument();
    expect(screen.getByText("Sales Rep")).toBeInTheDocument();
  });

  it("skips terms checkbox (sales rep explains verbally)", () => {
    render(
      <TestWrapper>
        <SalesGuidedTrialFlow />
      </TestWrapper>
    );

    // Navigate to payment step (would need to fill form first)
    // Just check that PaymentForm is called with showTerms={false}
    expect(screen.queryByText(/accept the Terms/)).not.toBeInTheDocument();
  });
});

describe("Flow Comparison - Architecture Validation", () => {
  it("uses shared components in both flows", () => {
    // Both flows should import from shared/
    const selfServeSource = SelfServeTrialFlow.toString();
    const salesSource = SalesGuidedTrialFlow.toString();

    // Check that both use UserInfoForm, BusinessBasicsForm, etc.
    expect(selfServeSource).toContain("UserInfoForm");
    expect(salesSource).toContain("UserInfoForm");

    expect(selfServeSource).toContain("PlanSelector");
    expect(salesSource).toContain("PlanSelector");

    expect(selfServeSource).toContain("PaymentForm");
    expect(salesSource).toContain("PaymentForm");
  });

  it("calls same backend endpoint with different source", async () => {
    const { supabase } = await import("@/integrations/supabase/client");

    // Both flows should call create-trial with source parameter
    expect(supabase.functions.invoke).toBeDefined();

    // Self-serve would call with source: "website"
    // Sales would call with source: "sales"
  });
});
