import { render, screen } from "@testing-library/react";
import { SelfServeTrialFlow } from "../SelfServeTrialFlow";
import { BrowserRouter } from "react-router-dom";
import { vi } from "vitest";

vi.mock("@stripe/react-stripe-js", () => ({
  useStripe: () => ({}),
  useElements: () => ({}),
  CardElement: () => null,
}));

describe("SelfServeTrialFlow", () => {
  it("renders without crashing", () => {
    render(
      <BrowserRouter>
        <SelfServeTrialFlow open={true} onOpenChange={() => {}} />
      </BrowserRouter>
    );
    expect(screen.getByText("Agent Setup")).toBeInTheDocument();
  });
});
