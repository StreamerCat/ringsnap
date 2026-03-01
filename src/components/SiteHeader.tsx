import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SiteNavigation } from "@/components/SiteNavigation";
import logo from "@/assets/RS_logo_color.svg";

export const SiteHeader = () => {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="site-container flex items-center justify-between h-14">
        <Link to="/">
          <img
            src={logo}
            alt="RingSnap"
            className="h-8 w-auto"
          />
        </Link>
        <nav className="flex items-center gap-4">
          <div className="hidden md:block">
            <SiteNavigation />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/auth/login')}
            className="font-medium"
          >
            Sign In
          </Button>
        </nav>
      </div>
    </header>
  );
};
