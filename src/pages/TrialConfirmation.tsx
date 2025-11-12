import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Mail, Clock, Phone, Sparkles } from "lucide-react";

export default function TrialConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get("email");
  const password = searchParams.get("password");
  const [countdown, setCountdown] = useState(15);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        {/* Success Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900">
            Welcome to RingSnap! 🎉
          </h1>
          <p className="text-xl text-gray-600">
            Your AI assistant is being set up right now
          </p>
        </div>

        {/* Main Info Card */}
        <Card>
          <CardContent className="p-8 space-y-6">
            {/* Status */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Sparkles className="h-6 w-6 text-blue-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Setup in Progress</h2>
                <p className="text-gray-600">
                  We're personalizing your AI assistant based on your business details.
                  This usually takes about 5-10 minutes.
                </p>
              </div>
            </div>

            {/* What's Happening */}
            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4 text-gray-900">What's happening now:</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-gray-600">
                  <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                  Assigning your dedicated phone number
                </li>
                <li className="flex items-center gap-3 text-gray-600">
                  <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                  Training your AI on your business information
                </li>
                <li className="flex items-center gap-3 text-gray-600">
                  <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                  Setting up call forwarding instructions
                </li>
              </ul>
            </div>

            {/* Email Notification */}
            <div className="border-t pt-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900">Check your email</h3>
                  <p className="text-gray-600">
                    We'll send setup instructions to <span className="font-medium">{email}</span> within the next 15 minutes.
                    The email will include your RingSnap number and forwarding instructions.
                  </p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="border-t pt-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900">
                    Ready in ~15 minutes
                  </h3>
                  <p className="text-gray-600">
                    Your assistant will be live and ready to answer calls
                  </p>
                </div>
              </div>
            </div>

            {/* Login Credentials (if available) */}
            {password && (
              <div className="border-t pt-6 bg-green-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3 text-gray-900">Your Login Credentials</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <p className="font-mono font-medium text-gray-900 bg-white px-3 py-2 rounded mt-1">
                      {email}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Temporary Password:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="font-mono font-medium text-gray-900 bg-white px-3 py-2 rounded flex-1">
                        {showPassword ? password : '••••••••••••••••'}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 pt-2 border-t">
                    💡 Save these credentials! You'll need them to log in. We recommend changing your password after logging in.
                  </p>
                </div>
              </div>
            )}

            {/* Trial Info */}
            <div className="border-t pt-6 bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-gray-900">Your 3-Day Free Trial</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Full access to all features
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  No charges for 3 days
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Cancel anytime before trial ends
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  First charge: {new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* CTA Button */}
        <div className="text-center space-y-4">
          <Button
            size="lg"
            className="px-8"
            onClick={() => navigate("/auth/login")}
          >
            Go to Dashboard
          </Button>
          <p className="text-sm text-gray-500">
            Questions? Email us at support@getringsnap.com
          </p>
        </div>
      </div>
    </div>
  );
}
