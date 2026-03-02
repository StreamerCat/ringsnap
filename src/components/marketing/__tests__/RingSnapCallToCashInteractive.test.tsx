import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/react";
import { RingSnapCallToCashInteractive } from "@/components/marketing/RingSnapCallToCashInteractive";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("RingSnapCallToCashInteractive", () => {
  it("renders updated framing copy and default emergency messaging", () => {
    render(<RingSnapCallToCashInteractive />);

    expect(screen.getByRole("heading", { name: "From First Ring to Booked Job—Automatically" })).toBeInTheDocument();
    expect(screen.getByText("Pick a scenario. See the call, the decision, and the result.")).toBeInTheDocument();
    expect(screen.getByText("What's happening behind the scenes")).toBeInTheDocument();
    expect(screen.getByText("The call is controlled immediately. No panic. No lost time.")).toBeInTheDocument();
  });

  it("updates story copy when scenario and phase change", async () => {
    const user = userEvent.setup();
    render(<RingSnapCallToCashInteractive />);

    await user.click(screen.getByRole("tab", { name: "Price Shopper" }));
    await user.click(screen.getByRole("button", { name: /Phase 3/i }));

    expect(screen.getByText("Close the Job")).toBeInTheDocument();
    expect(screen.getByText("Appointment locked. Context saved. Higher close rate.")).toBeInTheDocument();
    expect(screen.getByText("Service type and unit details")).toBeInTheDocument();
  });

  it("restores full legacy panel details when the rollback flag is enabled", async () => {
    vi.stubEnv("VITE_USE_LEGACY_DIFFERENCE_INTERACTIVE", "true");
    const user = userEvent.setup();
    const { RingSnapCallToCashInteractive: LegacyInteractive } = await import("@/components/marketing/RingSnapCallToCashInteractive");

    render(<LegacyInteractive />);

    expect(screen.getByText("Legacy module enabled via VITE_USE_LEGACY_DIFFERENCE_INTERACTIVE=true.")).toBeInTheDocument();
    expect(screen.getByText("My basement is flooding and it keeps rising.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resolve Concerns" }));
    expect(screen.getByText("You're being prioritized as an active emergency. I'm connecting dispatch now.")).toBeInTheDocument();
    expect(screen.getByText("Concern resolved with clear timing expectations and confidence-building language.")).toBeInTheDocument();
  });
});
