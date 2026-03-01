import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { RingSnapCallToCashInteractive } from "@/components/marketing/RingSnapCallToCashInteractive";

describe("RingSnapCallToCashInteractive", () => {
  it("renders updated framing copy and default emergency messaging", () => {
    render(<RingSnapCallToCashInteractive />);

    expect(screen.getByRole("heading", { name: "What happens when your phone rings" })).toBeInTheDocument();
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
});
