/**
 * Component tests for UserInfoForm
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { UserInfoForm } from "../shared/UserInfoForm";

// Wrapper component to provide form context
function TestWrapper({
  requiredFields,
  showLabels = true,
  compact = false,
}: {
  requiredFields?: ("name" | "email" | "phone")[];
  showLabels?: boolean;
  compact?: boolean;
}) {
  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
    },
  });

  return (
    <UserInfoForm
      form={form}
      requiredFields={requiredFields}
      showLabels={showLabels}
      compact={compact}
    />
  );
}

describe("UserInfoForm", () => {
  it("renders all fields by default", () => {
    render(<TestWrapper />);

    expect(screen.getByPlaceholderText("John Doe")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("you@example.com")
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("(555) 123-4567")).toBeInTheDocument();
  });

  it("renders only required fields when specified", () => {
    render(<TestWrapper requiredFields={["name", "email"]} />);

    expect(screen.getByPlaceholderText("John Doe")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("you@example.com")
    ).toBeInTheDocument();
  });

  it("shows labels when showLabels is true", () => {
    render(<TestWrapper showLabels={true} />);

    expect(screen.getByText("Full Name")).toBeInTheDocument();
    expect(screen.getByText("Email Address")).toBeInTheDocument();
    expect(screen.getByText("Phone Number")).toBeInTheDocument();
  });

  it("hides labels when showLabels is false", () => {
    render(<TestWrapper showLabels={false} />);

    expect(screen.queryByText("Full Name")).not.toBeInTheDocument();
    expect(screen.queryByText("Email Address")).not.toBeInTheDocument();
    expect(screen.queryByText("Phone Number")).not.toBeInTheDocument();
  });

  it("applies compact styling when compact is true", () => {
    const { container } = render(<TestWrapper compact={true} />);

    const inputs = container.querySelectorAll("input");
    inputs.forEach((input) => {
      expect(input.classList.contains("h-9")).toBe(true);
    });
  });
});
