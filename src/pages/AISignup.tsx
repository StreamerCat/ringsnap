import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { useStripe, useElements, CardElement } from "@stripe/react-stripe-js";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { captureSignupLead } from "@/lib/api/leads";
import { ChatMessage, TypingIndicator, MessageRole } from "@/components/onboarding-chat/ChatMessage";
import { ChatButtons } from "@/components/onboarding-chat/ChatButtons";
import { ChatInput } from "@/components/onboarding-chat/ChatInput";

type SignupStep =
  | "loading"
  | "welcome"
  | "name"
  | "email"
  | "phone"
  | "company_name"
  | "trade"
  | "website"
  | "primary_goal"
  | "payment"
  | "processing"
  | "success";

interface Message {
  id: string;
  role: MessageRole;
  content: string | React.ReactNode;
  timestamp: Date;
}

interface SignupData {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  trade: string;
  companyWebsite: string;
  primaryGoal: string;
  planType: "starter";
  paymentMethodId: string;
}

export default function AISignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stripe = useStripe();
  const elements = useElements();

  const [step, setStep] = useState<SignupStep>("loading");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  // Collected data
  const [signupData, setSignupData] = useState<Partial<SignupData>>({
    planType: "starter", // Always starter for MVP
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // User already signed up, redirect to dashboard or onboarding
          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_status")
            .eq("id", user.id)
            .single();

          if (profile?.onboarding_status === "active") {
            navigate("/dashboard");
          } else {
            navigate("/onboarding-chat");
          }
          return;
        }

        // Not authenticated, start the flow
        setStep("welcome");
        await showTypingDelay(1000);
        addMessage(
          "assistant",
          <>
            <p className="mb-2">👋 Welcome to RingSnap!</p>
            <p className="mb-2">I'm here to help you get your Virtual Receptionist up and running in just 2 minutes.</p>
            <p>Ready to start your free trial?</p>
          </>
        );
      } catch (error) {
        console.error("Auth check error:", error);
        setStep("welcome");
      }
    };

    checkAuth();
  }, [navigate]);

  const addMessage = (role: MessageRole, content: string | React.ReactNode) => {
    const message: Message = {
      id: `${Date.now()}-${Math.random()}`,
      role,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const showTypingDelay = (ms: number = 1500) => {
    setIsTyping(true);
    return new Promise(resolve => {
      setTimeout(() => {
        setIsTyping(false);
        resolve(true);
      }, ms);
    });
  };

  const updateSignupData = (updates: Partial<SignupData>) => {
    setSignupData(prev => ({ ...prev, ...updates }));
  };

  // Step handlers
  const handleWelcome = async () => {
    addMessage("user", "Yes, let's get started!");
    setStep("name");
    await showTypingDelay();
    addMessage("assistant", "Great! First, what's your name?");
  };

  const handleName = async (value: string) => {
    addMessage("user", value);
    updateSignupData({ name: value });
    setStep("email");
    await showTypingDelay();
    addMessage("assistant", "Perfect! What's your email address?");
  };

  const handleEmail = async (value: string) => {
    // Basic email validation
    if (!value.includes("@") || !value.includes(".")) {
      toast.error("Please enter a valid email address");
      return;
    }

    addMessage("user", value);
    updateSignupData({ email: value });

    // Infer company name and website from email
    const emailDomain = value.split("@")[1];
    const isGeneric = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"].includes(emailDomain);

    setStep("phone");
    await showTypingDelay();

    if (!isGeneric) {
      // Suggest company website
      const suggestedWebsite = `https://www.${emailDomain}`;
      updateSignupData({ companyWebsite: suggestedWebsite });
      addMessage(
        "assistant",
        <>
          <p className="mb-2">Great! And what's your mobile phone number?</p>
          <p className="text-xs opacity-75">(I noticed your email is @{emailDomain}, so I'll suggest https://www.{emailDomain} as your website later.)</p>
        </>
      );
    } else {
      addMessage("assistant", "Great! And what's your mobile phone number?");
    }
  };

  const handlePhone = async (value: string) => {
    // Basic phone validation
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length < 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    const formatted = cleaned.length === 11 && cleaned[0] === "1" ? cleaned : `1${cleaned.slice(-10)}`;
    addMessage("user", value);
    updateSignupData({ phone: formatted });

    setStep("company_name");
    await showTypingDelay();
    addMessage("assistant", "Perfect! What's your business name?");
  };

  const handleCompanyName = async (value: string) => {
    addMessage("user", value);
    updateSignupData({ companyName: value });

    setStep("trade");
    await showTypingDelay();
    addMessage("assistant", "Excellent! What type of business are you in? (e.g., plumber, HVAC, roofing, landscaping)");
  };

  const handleTrade = async (value: string) => {
    addMessage("user", value);
    updateSignupData({ trade: value });

    setStep("website");
    await showTypingDelay();

    // If we already inferred a website, confirm it
    if (signupData.companyWebsite) {
      addMessage(
        "assistant",
        <>
          <p className="mb-2">Is your business website <strong>{signupData.companyWebsite}</strong>?</p>
          <p className="text-xs opacity-75">(Or enter a different URL, or leave blank if you don't have one yet)</p>
        </>
      );
    } else {
      addMessage("assistant", "Do you have a business website? (Enter the URL, or leave blank if not)");
    }
  };

  const handleWebsite = async (value: string) => {
    const finalWebsite = value || signupData.companyWebsite || "";
    addMessage("user", finalWebsite || "No website yet");
    updateSignupData({ companyWebsite: finalWebsite });

    setStep("primary_goal");
    await showTypingDelay();
    addMessage(
      "assistant",
      "Great! What's your main goal for your Voice Agent?"
    );
  };

  const handlePrimaryGoal = async (value: string) => {
    const goalLabels: Record<string, string> = {
      book_appointments: "Book appointments",
      capture_leads: "Capture leads",
      answer_questions: "Answer common questions",
      take_orders: "Take orders"
    };
    addMessage("user", goalLabels[value] || value);
    updateSignupData({ primaryGoal: value });

    setStep("payment");
    await showTypingDelay();
    addMessage(
      "assistant",
      <>
        <p className="mb-3">Perfect! You're almost done.</p>
        <p className="mb-2">We'll start you on our <strong>Night & Weekend plan ($59/mo)</strong> with a <strong>3-day free trial</strong>. You can upgrade to Lite, Core, or Pro anytime.</p>
        <p className="text-sm opacity-75">Enter your payment details below to activate your trial. You won't be charged until after the trial ends.</p>
      </>
    );
  };

  const handlePaymentSubmit = async () => {
    if (!stripe || !elements || !cardComplete) {
      toast.error("Please complete your payment information");
      return;
    }

    setStep("processing");
    addMessage("user", "Payment information provided");
    await showTypingDelay(500);
    addMessage("assistant", "Processing your signup... This should only take a moment.");

    try {
      // Create payment method with Stripe
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Card element not found");
      }

      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
        billing_details: {
          name: signupData.name,
          email: signupData.email,
          phone: signupData.phone,
        },
      });

      if (pmError) {
        throw new Error(pmError.message || "Failed to create payment method");
      }

      if (!paymentMethod) {
        throw new Error("Payment method not created");
      }

      updateSignupData({ paymentMethodId: paymentMethod.id });

      // Call create-trial edge function
      const payload = {
        name: signupData.name,
        email: signupData.email,
        phone: signupData.phone,
        companyName: signupData.companyName,
        trade: signupData.trade,
        website: signupData.companyWebsite || undefined,
        primaryGoal: signupData.primaryGoal,
        planType: "starter",
        paymentMethodId: paymentMethod.id,
        source: "website",
        assistantGender: "female", // Default
      };

      const { data, error } = await supabase.functions.invoke("create-trial", {
        body: payload,
      });

      if (error) {
        console.error("create-trial error:", error);
        throw new Error(error.message || "Signup failed");
      }

      if (!data || !data.success) {
        throw new Error(data?.message || "Signup failed");
      }

      // Success!
      setStep("success");
      await showTypingDelay(500);
      addMessage(
        "assistant",
        <>
          <p className="mb-3 text-lg">🎉 <strong>Welcome to RingSnap!</strong></p>
          <p className="mb-2">Your account is being set up right now. We're provisioning your Virtual Receptionist - this usually takes less than a minute.</p>
          <p>Click below to continue to your setup dashboard.</p>
        </>
      );

      // Redirect after a short delay
      setTimeout(() => {
        navigate("/setup-status");
      }, 3000);

    } catch (error: any) {
      console.error("Signup error:", error);
      setStep("payment"); // Go back to payment step
      toast.error(error.message || "Signup failed. Please try again.");

      // Capture lead for failed signup
      try {
        const leadPayload = {
          email: signupData.email,
          full_name: signupData.name,
          phone: signupData.phone,
          source: "website",
          signup_flow: "ai-assisted",
          metadata: {
            companyName: signupData.companyName,
            trade: signupData.trade,
            website: signupData.companyWebsite,
            primaryGoal: signupData.primaryGoal,
            planType: "starter",
          },
          failure_reason: error.message || "Unknown error",
          failure_phase: "create-trial",
        };

        await captureSignupLead(leadPayload);

        console.log("Lead captured for failed signup");
      } catch (leadError) {
        console.error("[AI Signup] signup lead insert failed", leadError);
        // Don't show error to user - lead capture is best-effort
      }
    }
  };

  const handleSwitchToForm = () => {
    // Navigate to traditional form with prefilled data
    navigate("/signup/form");
  };

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="border-b p-4 flex items-center justify-between bg-muted/50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="font-semibold text-lg">Start Your Free Trial</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSwitchToForm}
            className="text-xs"
          >
            Use form instead
          </Button>
        </div>

        <CardContent className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {messages.map(msg => (
              <ChatMessage key={msg.id} {...msg} />
            ))}

            {isTyping && <TypingIndicator />}

            {/* Interactive elements based on step */}
            {step === "welcome" && !isTyping && (
              <ChatButtons
                options={[
                  { label: "Yes, let's get started!", value: "yes" }
                ]}
                onSelect={handleWelcome}
              />
            )}

            {step === "name" && !isTyping && (
              <ChatInput
                onSubmit={handleName}
                placeholder="Enter your full name..."
                type="text"
              />
            )}

            {step === "email" && !isTyping && (
              <ChatInput
                onSubmit={handleEmail}
                placeholder="you@company.com"
                type="email"
              />
            )}

            {step === "phone" && !isTyping && (
              <ChatInput
                onSubmit={handlePhone}
                placeholder="(555) 123-4567"
                type="tel"
              />
            )}

            {step === "company_name" && !isTyping && (
              <ChatInput
                onSubmit={handleCompanyName}
                placeholder="Your Business Name"
                type="text"
              />
            )}

            {step === "trade" && !isTyping && (
              <ChatInput
                onSubmit={handleTrade}
                placeholder="e.g., Plumber, HVAC, Roofing"
                type="text"
              />
            )}

            {step === "website" && !isTyping && (
              <ChatInput
                onSubmit={handleWebsite}
                placeholder={signupData.companyWebsite || "https://www.example.com"}
                type="url"
                allowEmpty={true}
              />
            )}

            {step === "primary_goal" && !isTyping && (
              <ChatButtons
                options={[
                  { label: "Book appointments", value: "book_appointments" },
                  { label: "Capture leads", value: "capture_leads" },
                  { label: "Answer common questions", value: "answer_questions" },
                  { label: "Take orders", value: "take_orders" }
                ]}
                onSelect={handlePrimaryGoal}
                layout="vertical"
              />
            )}

            {step === "payment" && !isTyping && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-4">
                <div className="bg-background p-3 rounded border">
                  <CardElement
                    options={{
                      style: {
                        base: {
                          fontSize: "16px",
                          color: "hsl(var(--foreground))",
                          "::placeholder": {
                            color: "hsl(var(--muted-foreground))",
                          },
                        },
                      },
                    }}
                    onChange={(e) => {
                      setCardComplete(e.complete);
                      if (e.error) {
                        toast.error(e.error.message);
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={handlePaymentSubmit}
                  disabled={!cardComplete || !stripe}
                  className="w-full"
                  size="lg"
                >
                  Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  🔒 Secure payment processing by Stripe
                </p>
              </div>
            )}

            {step === "success" && !isTyping && (
              <Button
                onClick={() => navigate("/setup-status")}
                className="w-full"
                size="lg"
              >
                Continue to Setup Dashboard
              </Button>
            )}

            <div ref={messagesEndRef} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
