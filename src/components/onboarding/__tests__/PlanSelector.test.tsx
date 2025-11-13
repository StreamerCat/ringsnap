/**
 * Component tests for PlanSelector
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
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
      planType: undefined,
    },
  });

  return (
    <PlanSelector form={form} variant={variant} highlight={highlight} />
  );
}

describe("PlanSelector", () => {
  it("renders all three plans", () => {
    render(<TestWrapper />);

    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Professional")).toBeInTheDocument();
    expect(screen.getByText("Premium")).toBeInTheDocument();
  });

  it("shows pricing for all plans", () => {
    render(<TestWrapper />);

    expect(screen.getByText("$297")).toBeInTheDocument();
    expect(screen.getByText("$497")).toBeInTheDocument();
    expect(screen.getByText("$797")).toBeInTheDocument();
  });

  it("marks Professional as popular by default", () => {
    render(<TestWrapper />);

    expect(screen.getByText("Most Popular")).toBeInTheDocument();
  });

  it("shows detailed features in detailed variant", () => {
    render(<TestWrapper variant="detailed" />);

    expect(screen.getByText("AI phone receptionist")).toBeInTheDocument();
    expect(screen.getByText("Call forwarding")).toBeInTheDocument();
    expect(screen.getByText("24/7 availability")).toBeInTheDocument();
  });

  it("shows compact layout in compact variant", () => {
    const { container } = render(<TestWrapper variant="compact" />);

    const planCards = container.querySelectorAll('[role="radio"]');
    expect(planCards.length).toBe(3);
  });

  it("highlights specified plan", () => {
    render(<TestWrapper highlight="premium" />);

    const premiumCard = screen.getByText("Premium").closest("div");
    expect(premiumCard?.classList.contains("ring-primary")).toBe(true);
  });
});
