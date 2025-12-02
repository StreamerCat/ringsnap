import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AuthLogin from "../AuthLogin";
import PasswordReset from "../PasswordReset";
import * as redirects from "@/lib/auth/redirects";

vi.mock("@/lib/auth/redirects", () => ({
  redirectToRoleDashboard: vi.fn(),
}));

describe("AuthLogin", () => {
  it("renders the login form", async () => {
    render(
      <MemoryRouter>
        <AuthLogin />
      </MemoryRouter>
    );

    expect(await screen.findByText("Welcome Back")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });
});

describe("PasswordReset", () => {
  it("renders the password reset form", () => {
    render(
      <MemoryRouter>
        <PasswordReset />
      </MemoryRouter>
    );

    expect(screen.getByText("Reset Your Password")).toBeInTheDocument();
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
  });
});
