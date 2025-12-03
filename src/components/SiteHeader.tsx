import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logo from "@/assets/RS_logo_color.svg";

export const SiteHeader = () => {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto flex items-center justify-between h-14 px-4 max-w-screen-xl">
        <Link to="/">
          <img 
            src={logo} 
            alt="RingSnap" 
            className="h-8 w-auto"
          />
        </Link>
        <Button 
          variant="outline"
          size="sm"
          onClick={() => navigate('/auth/login')}
          className="font-medium"
        >
          Sign In
        </Button>
      </div>
    </header>
  );
};
