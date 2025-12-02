/**
 * Redirect component for legacy /signup route
 * Redirects to the new canonical /start signup page
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function SignupRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    // Replace history so back button works correctly
    navigate('/start', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Redirecting to signup...</p>
      </div>
    </div>
  );
}
