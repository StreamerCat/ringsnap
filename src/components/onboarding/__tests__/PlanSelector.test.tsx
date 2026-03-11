/**
 * Component tests for PlanSelector
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { PlanSelector } from "../shared/PlanSelector";

// Wrapper component to provide form context
function TestWrapper({
  variant = "detailed",
  highlight,
}: {
  variant?: "detailed" | "compact";
  highlight?: "starter" | "professional" | "premium";
}) {
  const form = useForm({
    defaultValues: {
      planType: "professional",
    },
  });

  return (
    <Form {...form}>
      <form>
        <PlanSelector form={form} variant={variant} highlight={highlight} />
      </form>
    </Form>
  );
}

describe("PlanSelector", () => {
  it("renders all three plans", () => {
    render(<TestWrapper />);

    expect(screen.getByText("Night & Weekend")).toBeInTheDocument();
    expect(screen.getByText("Lite")).toBeInTheDocument();
    expect(screen.getByText("Core")).toBeInTheDocument();
  });

  it("shows pricing for all plans", () => {
    render(<TestWrapper />);

    expect(screen.getByText(/59/)).toBeInTheDocument();
    expect(screen.getByText(/129/)).toBeInTheDocument();
    expect(screen.getByText(/229/)).toBeInTheDocument();
  });

  // it("shows detailed features in detailed variant", () => {
  //   render(<TestWrapper variant="detailed" />);

  //   expect(
  //     screen.getByText(/Includes \d+ minutes per month/)
  //   ).toBeInTheDocument();
  // });

  it("shows compact layout in compact variant", () => {
    render(<TestWrapper variant="compact" />);

    expect(
      screen.queryByText(/Includes \d+ minutes per month/)
    ).not.toBeInTheDocument();
  });

  // it("highlights specified plan", () => {
  //   render(<TestWrapper highlight="premium" />);

  //   const premiumPlan = screen.getByText("Premium").closest("div");
  //   // This is a bit brittle, but checks for a highlighting class
  //   expect(premiumPlan?.className).toContain("border-primary");
  // });
});
