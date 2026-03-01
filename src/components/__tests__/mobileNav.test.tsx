import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { MobileNav } from "@/components/MobileNav";

describe("MobileNav", () => {
  it("toggles aria-expanded when opening and closing", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MobileNav />
      </MemoryRouter>
    );

    const trigger = screen.getByRole("button", { name: /open menu/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("link", { name: "Start Free Trial" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("closes the drawer with Escape and hides nav links", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MobileNav />
      </MemoryRouter>
    );

    const trigger = screen.getByRole("button", { name: /open menu/i });
    await user.click(trigger);

    expect(await screen.findByRole("link", { name: "Pricing" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "Pricing" })).not.toBeInTheDocument();
    });
  });

  it("renders Hear It Live and keeps Pricing as the last link before Sign In", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MobileNav />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /open menu/i }));

    const hearItLive = await screen.findByRole("link", { name: "Hear It Live" });
    expect(hearItLive).toHaveAttribute("href", "/#live-demo");

    const pricingLink = screen.getByRole("link", { name: "Pricing" });
    const signInLink = screen.getByRole("link", { name: "Sign In" });
    expect(pricingLink.compareDocumentPosition(signInLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
