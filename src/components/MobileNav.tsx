import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { topLevelNavItems, tradeNavItems } from "@/components/siteNavConfig";

const mobileMenuId = "mobile-site-navigation";

export const MobileNav = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => setIsOpen(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          aria-expanded={isOpen}
          aria-controls={mobileMenuId}
          className="md:hidden"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>

      <SheetContent
        id={mobileMenuId}
        side="right"
        className="w-[82vw] max-w-[20rem] border-l border-border/70 bg-background/95 p-0 backdrop-blur-sm"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-border/70 px-4 py-3 pr-12">
            <SheetTitle className="text-sm font-semibold tracking-normal">Menu</SheetTitle>
            <SheetDescription className="sr-only">
              Mobile site navigation links and actions.
            </SheetDescription>
          </div>

          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-2 py-2">
            <ul className="space-y-1">
              {tradeNavItems.map((trade) => {
                const isActive = location.pathname === trade.href;

                return (
                  <li key={trade.href}>
                    <Link
                      to={trade.href}
                      onClick={closeMenu}
                      className={cn(
                        "flex min-h-11 items-center rounded-md px-3 text-[15px] font-medium leading-6 tracking-normal text-foreground transition-colors hover:bg-muted",
                        isActive && "bg-primary/10 text-primary"
                      )}
                    >
                      {trade.title}
                    </Link>
                  </li>
                );
              })}

              {topLevelNavItems.map((item) => {
                const isActive = item.href === "/resources"
                  ? location.pathname.startsWith("/resources")
                  : item.href.startsWith("/#")
                    ? location.pathname === "/"
                  : location.pathname === item.href;

                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      onClick={closeMenu}
                      className={cn(
                        "flex min-h-11 items-center rounded-md px-3 text-[15px] font-medium leading-6 tracking-normal text-foreground transition-colors hover:bg-muted",
                        isActive && "bg-primary/10 text-primary"
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 border-t pt-4">
              <Link
                to="/auth/login"
                onClick={closeMenu}
                className="flex min-h-11 items-center rounded-md px-3 text-[15px] font-medium leading-6 tracking-normal text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Sign In
              </Link>
            </div>
          </nav>

          <div className="border-t border-border/70 bg-background/95 px-3 py-3 backdrop-blur-sm">
            <Button asChild className="h-11 w-full text-[15px] font-semibold">
              <Link to="/start" onClick={closeMenu}>
                Start Free Trial
              </Link>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
