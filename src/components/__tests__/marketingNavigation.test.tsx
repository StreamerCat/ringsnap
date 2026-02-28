import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ContractorFooter } from "@/components/ContractorFooter";
import { CompetitorComparison } from "@/components/CompetitorComparison";
import { SolutionDemo } from "@/components/SolutionDemo";
import { CallValueCalculator } from "@/components/CallValueCalculator";

describe("marketing navigation anchors", () => {
  it("uses the correct footer anchor targets", () => {
    render(
      <MemoryRouter>
        <ContractorFooter />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute("href", "/#features");
    expect(screen.getByRole("link", { name: "Hear it in action" })).toHaveAttribute("href", "/#live-demo");
    expect(screen.getByRole("link", { name: "ROI Calculator" })).toHaveAttribute("href", "/#roi-calculator");
  });

  it("renders stable section ids for feature, live demo, and roi calculator targets", () => {
    const { container } = render(
      <MemoryRouter>
        <>
          <CompetitorComparison />
          <SolutionDemo />
          <CallValueCalculator />
        </>
      </MemoryRouter>
    );

    expect(container.querySelectorAll("#features")).toHaveLength(1);
    expect(container.querySelectorAll("#live-demo")).toHaveLength(1);
    expect(container.querySelectorAll("#roi-calculator")).toHaveLength(1);
  });
});
