import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PhoneCall } from "lucide-react";

export const MobileFooterCTA = () => {
  const [showCTA, setShowCTA] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > window.innerHeight * 0.5;
      const footer = document.querySelector('footer');
      const footerVisible = footer && footer.getBoundingClientRect().top < window.innerHeight;
      setShowCTA(scrolled && !footerVisible);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!showCTA) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur border-t shadow-lg animate-in slide-in-from-bottom">
      <div className="container mx-auto px-4 py-3 flex gap-2">
        <Button size="sm" className="flex-1 h-11" aria-label="Start free trial">
          Start 14-day free trial
        </Button>
        <Button size="sm" variant="outline" className="h-11 px-4" aria-label="Hear a real call">
          <PhoneCall className="w-4 h-4" />
          <span className="ml-2">Hear call</span>
        </Button>
      </div>
    </div>
  );
};
