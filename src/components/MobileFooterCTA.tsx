import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PhoneCall, Calculator } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

export const MobileFooterCTA = () => {
  const [showCTA, setShowCTA] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSignup = () => {
    navigate({
      pathname: '/start',
      search: searchParams.toString()
    });
  };

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
    <div
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden backdrop-blur-xl border-t animate-in slide-in-from-bottom"
      style={{
        background: 'linear-gradient(to top, white 0%, hsl(var(--cream) / 0.3) 100%)',
        borderTopColor: 'hsl(var(--cream))',
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.05)',
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0))'
      }}
    >
      <div className="container mx-auto px-4 pt-4 pb-4 flex gap-3">
        <Button
          className="flex-1 h-12 rounded-full bg-primary text-white active:scale-95 transition-transform shadow-md text-sm font-semibold"
          aria-label="Start your free 3-day trial with RingSnap Virtual Receptionist"
          onClick={handleSignup}
        >
          <PhoneCall className="w-4 h-4" />
          <span className="ml-1.5">Start Trial</span>
        </Button>
        <Button
          className="flex-1 h-12 rounded-full bg-white border-2 active:scale-95 transition-transform shadow-sm text-sm font-semibold"
          style={{ borderColor: 'hsl(var(--charcoal) / 0.3)', color: 'hsl(var(--charcoal))' }}
          aria-label="Calculate potential revenue from missed calls with RingSnap"
          onClick={() => document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <Calculator className="w-4 h-4" />
          <span className="ml-1.5">Calculate</span>
        </Button>
      </div>
    </div>
  );
};
