/**
 * STEP 2: AI Chat Onboarding (Two-Step Signup Flow)
 *
 * This component handles the full chat-based onboarding flow:
 * - For NEW users (with lead_id from Step 1): Collects all info + payment
 * - For EXISTING users (authenticated): Collects assistant config only
 *
 * Chat Flow (New Users):
 * 1. Welcome
 * 2. Phone number (destination for forwarding)
 * 3. Company name
 * 4. Trade/service type
 * 5. Website (optional)
 * 6. Business hours
 * 7. Voice preference
 * 8. Primary goal
 * 9. Plan selection
 * 10. Payment
 * 11. Provisioning status
 * 12. Complete
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import {
  Loader2,
  Phone,
  Building2,
  Globe,
  Clock,
  Mic,
  Target,
  CreditCard,
  CheckCircle2,
  Settings,
  Calendar,
  MessageSquare,
  HelpCircle,
  Copy,
  ExternalLink,
  ArrowRight,
  Shield,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { ChatMessage, TypingIndicator, MessageRole } from "@/components/onboarding-chat/ChatMessage";
import { ChatButtons, ChatButtonOption } from "@/components/onboarding-chat/ChatButtons";
import { ChatInput } from "@/components/onboarding-chat/ChatInput";
import { ServiceHoursEditor, ServiceHoursData } from "@/components/onboarding-chat/ServiceHoursEditor";

// Chat step types
type ChatStep =
  | "loading"
  | "welcome"
  | "phone"
  | "company"
  | "trade"
  | "website"
  | "hours"
  | "hours_custom"
  | "voice"
  | "goal"
  | "plan"
  | "payment"
  | "processing"
  | "provisioning"
  | "complete"
  | "error";

// Check Stripe Key environment
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
if (!STRIPE_KEY) {
  console.error("VITE_STRIPE_PUBLISHABLE_KEY is missing!");
} else {
  console.log("Stripe Key loaded (prefix):", STRIPE_KEY.substring(0, 8) + "...");
}

const stripePromise = loadStripe(STRIPE_KEY!);

// Message type
interface Message {
  id: string;
  role: MessageRole;
  content: string | React.ReactNode;
  timestamp: Date;
}

// Collected data type
interface OnboardingData {
  phone: string;
  companyName: string;
  trade: string;
  website: string;
  businessHours: ServiceHoursData | null; // Changed to match component
  assistantGender: "male" | "female";
  assistantTone: "professional" | "friendly" | "empathetic"; // Updated tones
  primaryGoal: string;
  planType: "starter" | "professional" | "premium";
  zipCode?: string;
}

// Lead data from Step 1
interface LeadData {
  id: string;
  email: string;
  full_name: string | null;
}

// Plan definitions
const PLANS = [
  {
    value: "starter" as const,
    name: "Starter",
    price: 297,
    calls: "~80 calls/mo",
    features: ["AI phone receptionist", "Call forwarding", "24/7 availability", "Email support"],
  },
  {
    value: "professional" as const,
    name: "Professional",
    price: 797,
    calls: "~160 calls/mo",
    features: ["Everything in Starter", "Priority routing", "SMS notifications", "Phone support"],
    popular: true,
  },
  {
    value: "premium" as const,
    name: "Premium",
    price: 1497,
    calls: "160+ calls/mo",
    features: ["Everything in Professional", "Voice cloning", "Dedicated support", "Custom integrations"],
  },
];

// Trade options
const TRADE_OPTIONS: ChatButtonOption[] = [
  { label: "Plumbing", value: "plumbing" },
  { label: "HVAC", value: "hvac" },
  { label: "Electrical", value: "electrical" },
  { label: "Roofing", value: "roofing" },
  { label: "Landscaping", value: "landscaping" },
  { label: "General Contractor", value: "general_contractor" },
  { label: "Other", value: "other" },
];

// Goal options
const GOAL_OPTIONS: ChatButtonOption[] = [
  {
    label: "Book Appointments",
    value: "book_appointments",
    icon: <Calendar className="h-4 w-4" />,
    description: "Schedule appointments directly",
  },
  {
    label: "Capture Leads",
    value: "capture_leads",
    icon: <MessageSquare className="h-4 w-4" />,
    description: "Collect caller info and notify you",
  },
  {
    label: "Answer Questions",
    value: "answer_questions",
    icon: <HelpCircle className="h-4 w-4" />,
    description: "Answer common customer questions",
  },
  {
    label: "Take Orders",
    value: "take_orders",
    icon: <Target className="h-4 w-4" />,
    description: "Process orders and send details",
  },
];

// Stripe card element options
const CARD_ELEMENT_OPTIONS = {
  hidePostalCode: true,
  style: {
    base: {
      color: "#32325d",
      fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
      fontSmoothing: "antialiased",
      fontSize: "16px",
      "::placeholder": {
        color: "#aab7c4",
      },
    },
    invalid: {
      color: "#fa755a",
      iconColor: "#fa755a",
    },
  },
};

// Helper to format phone numbers
function formatPhoneNumber(value: string): string {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
}

// Helper to normalize phone to E.164
function normalizePhone(value: string): string {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (cleaned.length === 11 && cleaned[0] === "1") return `+${cleaned}`;
  return `+1${cleaned.slice(-10)}`;
}

// Inner component with Stripe hooks
function OnboardingChatInner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stripe = useStripe();
  const elements = useElements();

  // State
  const [step, setStep] = useState<ChatStep>("loading");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [leadData, setLeadData] = useState<LeadData | null>(null);
  const [progress, setProgress] = useState(0);

  // Collected data
  const [data, setData] = useState<OnboardingData>({
    phone: "",
    companyName: "",
    trade: "",
    website: "",
    businessHours: null,
    assistantGender: "female",
    assistantTone: "friendly",
    primaryGoal: "",
    planType: "starter",
  });

  // Payment state
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Account result state
  const [accountId, setAccountId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [provisioningStatus, setProvisioningStatus] = useState<string>("pending");

  // Custom trade input
  const [showCustomTrade, setShowCustomTrade] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get lead_id from URL, fallback to localStorage
  const LEAD_ID_KEY = 'ringsnap_signup_lead_id';
  const normalizeLeadId = (value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;
    return trimmed;
  };

  const urlLeadId = normalizeLeadId(searchParams.get("lead_id"));
  const storedLeadId = (() => {
    try { return normalizeLeadId(localStorage.getItem(LEAD_ID_KEY)); } catch { return null; }
  })();
  const lead_id = urlLeadId || storedLeadId;

  // Get email from URL (passed from Step 1)
  const urlEmail = searchParams.get("email");

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Add message helper
  const addMessage = useCallback((role: MessageRole, content: string | React.ReactNode) => {
    const message: Message = {
      id: `${Date.now()}-${Math.random()}`,
      role,
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, message]);
  }, []);

  // Typing delay helper
  const showTypingDelay = useCallback((ms: number = 1000) => {
    setIsTyping(true);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setIsTyping(false);
        resolve();
      }, ms);
    });
  }, []);

  // Calculate progress based on step
  useEffect(() => {
    const stepProgress: Record<ChatStep, number> = {
      loading: 0,
      welcome: 5,
      phone: 15,
      company: 25,
      trade: 35,
      website: 45,
      hours: 55,
      hours_custom: 55,
      voice: 65,
      goal: 75,
      plan: 82,
      payment: 90,
      processing: 95,
      provisioning: 97,
      complete: 100,
      error: 0,
    };
    setProgress(stepProgress[step] || 0);
  }, [step]);

  // Initialize - load lead data
  useEffect(() => {
    const init = async () => {
      // Check for lead_id
      if (!lead_id) {
        // Check if user is already authenticated
        try {
          const { data, error } = await supabase.auth.getUser();

          if (error && error.name !== "AuthSessionMissingError") {
            console.log("[OnboardingChat] auth lookup error", error);
          }

          if (data?.user) {
            const { user } = data;
            // Existing authenticated user - check their status
            const { data: profile } = await supabase
              .from("profiles")
              .select("onboarding_status")
              .eq("id", user.id)
              .single();

            if (profile?.onboarding_status === "active") {
              navigate("/dashboard", { replace: true });
              return;
            }
            // For authenticated users in legacy flow, redirect to old flow behavior
            // This would need the old OnboardingChat logic - for now redirect to dashboard
            navigate("/dashboard", { replace: true });
            return;
          }
        } catch (error) {
          console.log("[OnboardingChat] auth lookup skipped", error);
        }

        // No lead_id and not authenticated - go back to start
        console.log("[OnboardingChat] Resume lookup skipped - no lead id");
        toast.error("Please start the signup process first");
        navigate("/start", { replace: true });
        return;
      }

      // Load lead data
      try {
        console.log("[OnboardingChat] Attempting resume lookup", { leadId: lead_id });
        const { data: lead, error } = await supabase
          .from("signup_leads")
          .select("id, email, full_name, completed_at")
          .eq("id", lead_id)
          .maybeSingle();

        if (error || !lead) {
          console.log("[OnboardingChat] Resume lookup failed - not found", { leadId: lead_id, error });
          toast.error("Could not find your signup. Please start again.");
          navigate("/start", { replace: true });
          return;
        }

        if (lead.completed_at) {
          // Lead already converted
          toast.info("Your account has already been created. Please sign in.");
          navigate("/auth/login", { replace: true });
          return;
        }

        setLeadData({
          id: lead.id,
          email: lead.email,
          full_name: lead.full_name,
        });

        // Start the chat
        setStep("welcome");
        await showTypingDelay(800);
        const userName = lead.full_name?.split(" ")[0] || "there";
        addMessage(
          "assistant",
          `Hi ${userName}! I'm here to get your AI receptionist set up in just a few minutes. Ready to never miss another call?`
        );
      } catch (error) {
        console.error("Init error:", error);
        toast.error("Something went wrong. Please try again.");
        navigate("/start", { replace: true });
      }
    };

    init();
  }, [lead_id, navigate, addMessage, showTypingDelay]);

  // Poll provisioning status
  useEffect(() => {
    if (step !== "provisioning" || !accountId) return;

    const pollInterval = setInterval(async () => {
      try {
        const { data: account } = await supabase
          .from("accounts")
          .select("provisioning_status, vapi_phone_number")
          .eq("id", accountId)
          .single();

        if (account) {
          setProvisioningStatus(account.provisioning_status);
          if (account.vapi_phone_number) {
            setPhoneNumber(account.vapi_phone_number);
          }
          if (account.provisioning_status === "completed" && account.vapi_phone_number) {
            clearInterval(pollInterval);
            setStep("complete");
            await showTypingDelay(500);
            addMessage(
              "assistant",
              <div className="space-y-3">
                <p className="font-semibold text-green-600">Your AI receptionist is ready!</p>
                <p>Your dedicated phone number is:</p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                  <span className="text-xl font-bold text-green-700">{account.vapi_phone_number}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(account.vapi_phone_number);
                      toast.success("Phone number copied!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Forward your business line to this number to start answering calls 24/7.
                </p>
              </div>
            );
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [step, accountId, addMessage, showTypingDelay]);

  // Handle welcome response
  const handleWelcome = async (value: string) => {
    if (value === "questions") {
      addMessage("user", "I have some questions first");
      await showTypingDelay();
      addMessage(
        "assistant",
        "No problem! I'll walk you through everything step by step. You'll have a dedicated AI phone number that answers calls 24/7, books appointments, and never misses a lead. Ready to get started?"
      );
    }

    // Second click - show FAQ
    if (value === "questions_2") {
      addMessage("user", "I still have questions");
      await showTypingDelay();
      addMessage(
        "assistant",
        "I understand. Here are some quick answers to common questions:"
      );
      return;
    }

    // Handle specific FAQ questions
    if (value === "faq_pricing") {
      addMessage("user", "How much does it cost?");
      await showTypingDelay();
      addMessage("assistant", "We have a simple Starter plan at $297/mo which includes ~80 calls. You get a 3-day free trial to test it out completely risk-free!");
      return;
    }

    if (value === "faq_human") {
      addMessage("user", "Is it a real person?");
      await showTypingDelay();
      addMessage("assistant", "It's an advanced AI that sounds just like a human! It can handle multiple calls at once, never sleeps, and follows your instructions perfectly.");
      return;
    }

    if (value === "faq_contract") {
      addMessage("user", "Is there a contract?");
      await showTypingDelay();
      addMessage("assistant", "No long-term contracts! You can cancel anytime. We want you to stay because you love the service, not because you're locked in.");
      return;
    }

    addMessage("user", "Let's do it!");
    setStep("phone");
    await showTypingDelay();
    addMessage(
      "assistant",
      <div className="space-y-2">
        <p>Perfect! First, what's the best phone number to reach you?</p>
        <p className="text-sm text-muted-foreground">
          We'll give you a dedicated RingSnap number, and you'll forward your business line to it. When needed, calls can be forwarded back to this number.
        </p>
      </div>
    );
  };

  // Handle phone input
  const handlePhone = async (value: string) => {
    // Basic validation for 10 digits
    const cleanPhone = value.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit US phone number");
      return;
    }

    addMessage("user", value);
    setData((prev) => ({ ...prev, phone: value }));
    setStep("company");
    await showTypingDelay();
    addMessage("assistant", "Got it. What's the name of your business?");
  };

  // Handle company name
  const handleCompany = async (value: string) => {
    if (value.trim().length < 2) {
      toast.error("Please enter your company name");
      return;
    }

    addMessage("user", value);
    setData((prev) => ({ ...prev, companyName: value.trim() }));

    setStep("trade");
    await showTypingDelay();
    addMessage("assistant", "What type of service do you provide?");
  };

  // Handle trade selection
  const handleTrade = async (value: string) => {
    if (value === "other") {
      setShowCustomTrade(true);
      return;
    }

    const tradeLabel = TRADE_OPTIONS.find((t) => t.value === value)?.label || value;
    addMessage("user", tradeLabel);
    setData((prev) => ({ ...prev, trade: value }));

    setStep("website");
    await showTypingDelay();
    addMessage(
      "assistant",
      "Do you have a website? (This helps me personalize your AI - you can skip if you don't have one)"
    );
  };

  // Handle custom trade
  const handleCustomTrade = async (value: string) => {
    if (value.trim().length < 2) {
      toast.error("Please enter your service type");
      return;
    }

    setShowCustomTrade(false);
    addMessage("user", value);
    setData((prev) => ({ ...prev, trade: value.trim() }));

    setStep("website");
    await showTypingDelay();
    addMessage(
      "assistant",
      "Do you have a website? (This helps me personalize your AI - you can skip if you don't have one)"
    );
  };

  // Handle website
  const handleWebsite = async (value: string, skipped: boolean = false) => {
    if (skipped) {
      addMessage("user", "I don't have one");
      setData((prev) => ({ ...prev, website: "" }));
    } else {
      let url = value.trim();
      if (url && !url.startsWith("http")) {
        url = `https://${url}`;
      }
      addMessage("user", url || "No website");
      setData((prev) => ({ ...prev, website: url }));
    }

    setStep("hours");
    await showTypingDelay();
    addMessage("assistant", "When is your business typically available to take calls?");
  };

  // Handle hours selection
  // Handle hours selection
  const handleHoursChoice = async (value: string) => {
    if (value === "custom") {
      setStep("hours_custom");
      await showTypingDelay(500);
      addMessage("assistant", "Let's set your custom hours:");
      return;
    }

    let hoursText: string;
    let hoursData: ServiceHoursData;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (value === "weekdays_9_5") {
      hoursText = "Weekdays 9am-5pm";
      hoursData = {
        timezone,
        blocks: [
          { day: "monday", start: "09:00", end: "17:00" },
          { day: "tuesday", start: "09:00", end: "17:00" },
          { day: "wednesday", start: "09:00", end: "17:00" },
          { day: "thursday", start: "09:00", end: "17:00" },
          { day: "friday", start: "09:00", end: "17:00" },
        ]
      };
    } else if (value === "everyday_8_6") {
      hoursText = "Every day 8am-6pm";
      hoursData = {
        timezone,
        blocks: [
          { day: "monday", start: "08:00", end: "18:00" },
          { day: "tuesday", start: "08:00", end: "18:00" },
          { day: "wednesday", start: "08:00", end: "18:00" },
          { day: "thursday", start: "08:00", end: "18:00" },
          { day: "friday", start: "08:00", end: "18:00" },
          { day: "saturday", start: "08:00", end: "18:00" },
          { day: "sunday", start: "08:00", end: "18:00" },
        ]
      };
    } else {
      hoursText = "24/7";
      hoursData = {
        timezone,
        blocks: [
          { day: "monday", start: "00:00", end: "23:59" },
          { day: "tuesday", start: "00:00", end: "23:59" },
          { day: "wednesday", start: "00:00", end: "23:59" },
          { day: "thursday", start: "00:00", end: "23:59" },
          { day: "friday", start: "00:00", end: "23:59" },
          { day: "saturday", start: "00:00", end: "23:59" },
          { day: "sunday", start: "00:00", end: "23:59" },
        ]
      };
    }

    addMessage("user", hoursText);
    setData((prev) => ({ ...prev, businessHours: hoursData }));

    setStep("voice");
    await showTypingDelay();
    addMessage("assistant", "What voice would you like your AI receptionist to have?");
  };

  // Handle custom hours
  const handleCustomHours = async (hours: ServiceHoursData) => {
    // hours is already ServiceHoursData, no need to convert
    const daysText =
      hours.blocks.length === 7
        ? "Every day"
        : hours.blocks.map((b) => b.day.charAt(0).toUpperCase() + b.day.slice(1, 3)).join(", ");

    addMessage("user", `Custom hours: ${daysText}`);
    setData((prev) => ({ ...prev, businessHours: hours }));

    setStep("voice");
    await showTypingDelay();
    addMessage("assistant", "What voice would you like your AI receptionist to have?");
  };

  // Handle voice selection
  const handleVoice = async (value: string) => {
    const gender = value as "male" | "female";
    addMessage("user", gender === "male" ? "Male voice" : "Female voice");
    setData((prev) => ({ ...prev, assistantGender: gender }));

    setStep("goal");
    await showTypingDelay();
    addMessage("assistant", "What's the main thing you want your AI receptionist to do?");
  };

  // Handle goal selection
  const handleGoal = async (value: string) => {
    const goalLabel = GOAL_OPTIONS.find((g) => g.value === value)?.label || value;
    addMessage("user", goalLabel);
    setData((prev) => ({ ...prev, primaryGoal: value }));

    setStep("plan");
    await showTypingDelay();
    addMessage(
      "Excellent! You're almost done. We'll set you up on our standard Starter Plan ($297/mo) with a 3-day free trial."
    );

    // Skip plan selection, go straight to payment
    setData((prev) => ({ ...prev, planType: "starter" }));
    setStep("payment");
  };

  /* 
  // Plan selection removed for trial simplification
  // Handle plan selection
  const handlePlan = async (value: string) => {
    const plan = PLANS.find((p) => p.value === value);
    if (!plan) return;

    addMessage("user", `${plan.name} - $${plan.price}/mo`);
    setData((prev) => ({ ...prev, planType: plan.value }));

    setStep("payment");
    await showTypingDelay();
    addMessage(
      "assistant",
      <div className="space-y-2">
        <p>
          Great choice! Your <strong>{plan.name}</strong> plan includes a 3-day free trial with 150
          minutes to try it out.
        </p>
        <p className="text-sm text-muted-foreground">
          Your card won't be charged until after the trial ends.
        </p>
      </div>
    );
  };
  */

  // Handle payment submission
  const handlePayment = async () => {
    if (!stripe || !elements || !leadData) {
      toast.error("Payment system not ready. Please refresh and try again.");
      return;
    }

    if (!cardComplete) {
      toast.error("Please complete your card information");
      return;
    }

    if (!data.zipCode || data.zipCode.length !== 5) {
      toast.error("Please enter a valid 5-digit billing zip code");
      return;
    }

    setIsProcessing(true);
    addMessage("user", "Payment submitted");

    try {
      // Create payment method
      let paymentMethod = { id: "pm_bypass_test" }; // Default for bypass

      const isBypassMode = data.zipCode === "99999";

      if (isBypassMode) {
        console.log("Bypass mode activated: Skipping Stripe frontend calls");
        addMessage("assistant", "Test Mode: Skipping payment verification...");
        await showTypingDelay(500);
      } else {
        // Normal Flow
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
          throw new Error("Card element not found");
        }

        // Tokenize FIRST while CardElement is still mounted
        const { error: pmError, paymentMethod: stripePaymentMethod } = await stripe.createPaymentMethod({
          type: "card",
          card: cardElement,
          billing_details: {
            name: leadData.full_name || undefined,
            email: leadData.email,
            phone: data.phone,
            address: {
              postal_code: data.zipCode,
            }
          },
        });

        if (pmError) {
          throw new Error(pmError.message || "Failed to process payment method");
        }

        if (!stripePaymentMethod) {
          throw new Error("Payment method creation failed");
        }

        paymentMethod = stripePaymentMethod;
      }

      // Now safe to change step (which unmounts CardElement)
      setStep("processing");
      await showTypingDelay(500);
      addMessage("assistant", "Payment method verified. Creating your account...");

      // Convert businessHours object to string for create-trial (expects string)
      const businessHoursStr = data.businessHours
        ? JSON.stringify(data.businessHours)
        : undefined;

      // Call create-trial with leadId
      const { data: result, error: createTrialError } = await supabase.functions.invoke(
        "create-trial",
        {
          body: {
            // Required user info
            name: leadData.full_name || "Customer",
            email: leadData.email,
            phone: data.phone,
            // Required business info
            companyName: data.companyName,
            trade: data.trade,
            // Optional business info
            website: data.website || undefined,
            businessHours: businessHoursStr,
            // AI configuration
            assistantGender: data.assistantGender,
            assistantTone: data.assistantTone, // Ensure assistantTone is passed
            primaryGoal: data.primaryGoal || undefined,
            // Plan & payment
            planType: data.planType,
            paymentMethodId: paymentMethod.id,
            zipCode: data.zipCode, // Pass zip code
            // Source tracking
            source: "website",
            // Link to lead
            leadId: leadData.id,
            // Test Mode Bypass Override
            bypassStripe: isBypassMode,
          },
        }
      );

      if (createTrialError || !result?.success) {
        throw new Error(
          result?.message || createTrialError?.message || "Failed to create account"
        );
      }

      // Success! Sign in the user
      if (result.email && result.password) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: result.email,
          password: result.password,
        });

        if (signInError) {
          console.warn("Auto sign-in failed (non-critical):", signInError);
        }
      }

      setAccountId(result.account_id);
      setStep("provisioning");
      await showTypingDelay(500);
      addMessage(
        "assistant",
        <div className="space-y-3">
          <p className="text-green-600 font-medium">Payment confirmed!</p>
          <p>Setting up your AI phone number now. This usually takes under a minute...</p>
        </div>
      );
    } catch (error: any) {
      console.error("Payment error:", error);

      const userMessage = error.message || "Payment failed";
      let friendlyMessage = "We couldn't process your card. Please check the details and try again.";

      if (userMessage.includes("insufficient funds")) {
        friendlyMessage = "Your card was declined due to insufficient funds. Please try a different card.";
      } else if (userMessage.includes("expired")) {
        friendlyMessage = "Your card has expired. Please use a valid card.";
      } else if (userMessage.includes("incorrect_cvc")) {
        friendlyMessage = "The security code (CVC) was incorrect. Please try again.";
      } else if (userMessage.includes("card_declined")) {
      } else if (userMessage.includes("card_declined")) {
        friendlyMessage = "Your card was declined. Please try a different card.";
      } else if (userMessage.toLowerCase().includes("already registered") || userMessage.toLowerCase().includes("duplicate")) {
        friendlyMessage = "This email is already registered. Please sign in or use a different email.";
      }

      setStep("payment"); // Ensure we stay/return to payment step
      setIsProcessing(false); // Re-enable button

      // Show unified friendly error
      addMessage(
        "assistant",
        <div className="space-y-2 text-red-600">
          <p>{friendlyMessage}</p>
        </div>
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy phone number
  const copyPhoneNumber = () => {
    if (phoneNumber) {
      navigator.clipboard.writeText(phoneNumber);
      toast.success("Phone number copied!");
    }
  };

  // Go to dashboard
  const goToDashboard = () => {
    navigate("/dashboard");
  };

  // Loading state
  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="p-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <span className="font-semibold">RingSnap Setup</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Step {Math.min(Math.ceil(progress / 10), 10)} of 10
            </span>
            <div className="w-24">
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <main className="max-w-2xl mx-auto p-4">
        <Card className="min-h-[60vh] flex flex-col">
          <CardContent className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="space-y-4">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} {...msg} />
              ))}

              {isTyping && <TypingIndicator />}

              {/* Interactive elements based on step */}
              {step === "welcome" && !isTyping && (
                <div className="space-y-2">
                  <ChatButtons
                    options={[
                      { label: "Let's do it!", value: "start" },
                      { label: "I have questions", value: messages.filter(m => m.role === 'user' && m.content === "I have some questions first").length > 0 ? "questions_2" : "questions" },
                    ]}
                    onSelect={handleWelcome}
                  />
                  {/* Show FAQ options if "I still have questions" was triggered */}
                  {messages.some(m => m.content === "I still have questions") && (
                    <div className="pt-2">
                      <p className="text-sm text-muted-foreground mb-2 text-center">Common questions:</p>
                      <ChatButtons
                        options={[
                          { label: "Pricing?", value: "faq_pricing" },
                          { label: "Is it a real person?", value: "faq_human" },
                          { label: "Any contracts?", value: "faq_contract" },
                        ]}
                        onSelect={handleWelcome}
                        layout="grid"
                      />
                    </div>
                  )}
                </div>
              )}

              {step === "phone" && !isTyping && (
                <ChatInput
                  onSubmit={handlePhone}
                  placeholder="(555) 123-4567"
                  type="tel"
                  maxLength={14} // Allow for formatting chars
                  inputMode="numeric"
                />
              )}

              {step === "company" && !isTyping && (
                <ChatInput
                  onSubmit={handleCompany}
                  placeholder="Acme Plumbing"
                  type="text"
                />
              )}

              {step === "trade" && !isTyping && !showCustomTrade && (
                <ChatButtons
                  options={TRADE_OPTIONS}
                  onSelect={handleTrade}
                  layout="grid"
                />
              )}

              {step === "trade" && showCustomTrade && (
                <ChatInput
                  onSubmit={handleCustomTrade}
                  placeholder="Enter your service type..."
                  type="text"
                />
              )}

              {step === "website" && !isTyping && (
                <div className="space-y-3">
                  <ChatInput
                    onSubmit={(v) => handleWebsite(v, false)}
                    placeholder="www.yourcompany.com"
                    type="text"
                    allowEmpty={false}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => handleWebsite("", true)}
                  >
                    Skip - I don't have a website
                  </Button>
                </div>
              )}

              {step === "hours" && !isTyping && (
                <ChatButtons
                  options={[
                    { label: "Weekdays 9am-5pm", value: "weekdays_9_5", icon: <Clock className="h-4 w-4" /> },
                    { label: "Every day 8am-6pm", value: "everyday_8_6", icon: <Clock className="h-4 w-4" /> },
                    { label: "24/7", value: "24_7", icon: <Clock className="h-4 w-4" /> },
                    { label: "Custom hours", value: "custom", icon: <Settings className="h-4 w-4" /> },
                  ]}
                  onSelect={handleHoursChoice}
                  layout="vertical"
                />
              )}

              {step === "hours_custom" && !isTyping && (
                <ServiceHoursEditor onSubmit={handleCustomHours} />
              )}

              {step === "voice" && !isTyping && (
                <ChatButtons
                  options={[
                    { label: "Female", value: "female", icon: <Mic className="h-4 w-4" />, description: "Friendly, clear tone" },
                    { label: "Male", value: "male", icon: <Mic className="h-4 w-4" />, description: "Professional, warm tone" },
                  ]}
                  onSelect={handleVoice}
                  layout="grid"
                />
              )}

              {step === "goal" && !isTyping && (
                <ChatButtons
                  options={GOAL_OPTIONS}
                  onSelect={handleGoal}
                  layout="vertical"
                />
              )}

              {step === "plan" && !isTyping && (
                <div className="space-y-3">
                  {PLANS.map((plan) => (
                    <div
                      key={plan.value}
                      className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-primary ${plan.popular ? "border-primary bg-primary/5" : ""
                        }`}
                    // onClick={() => handlePlan(plan.value)} // This was commented out in the original, keeping it commented
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{plan.name}</h3>
                            {plan.popular && (
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                                Popular
                              </span>
                            )}
                          </div>
                          <div className="text-2xl font-bold mt-1">
                            ${plan.price}
                            <span className="text-sm font-normal text-muted-foreground">/mo</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{plan.calls}</p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <ul className="mt-3 space-y-1">
                        {plan.features.slice(0, 3).map((f, i) => (
                          <li key={i} className="text-sm flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {step === "payment" && !isTyping && (
                <div className="space-y-4 p-4 border rounded-lg bg-card">
                  <div className="space-y-3">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Card Information
                    </label>
                    <div className="border rounded-lg p-3 bg-background">
                      <CardElement
                        options={CARD_ELEMENT_OPTIONS}
                        onChange={(e) => {
                          setCardComplete(e.complete);
                          setCardError(e.error?.message || null);
                        }}
                      />
                    </div>
                    {cardError && (
                      <p className="text-sm text-red-600">{cardError}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Your card won't be charged during the 3-day trial
                    </p>

                    {/* Trust Badges */}
                    <div className="flex items-center justify-center gap-4 py-2 border-t border-b bg-muted/20">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Shield className="h-3 w-3 text-green-600" />
                        <span>SSL Secure</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="font-bold text-slate-700 italic">Stripe</div>
                        <span>Secure Payment</span>
                      </div>
                    </div>
                  </div>

                  {/* Zip Code Input */}
                  <div className="mt-4">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                      Billing Zip Code
                    </label>
                    <input
                      type="text"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      maxLength={5}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="12345"
                      value={data.zipCode || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 5);
                        setData(prev => ({ ...prev, zipCode: val }));
                      }}
                    />
                  </div>

                  <div className="py-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      By clicking "Start Your Free Trial Now", you agree to our{" "}
                      <a href="/terms" target="_blank" className="text-primary hover:underline">
                        Terms of Service
                      </a>{" "}
                      and{" "}
                      <a href="/privacy" target="_blank" className="text-primary hover:underline">
                        Privacy Policy
                      </a>
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => {
                      console.log("Button clicked! isProcessing:", isProcessing);
                      // Assuming handlePayment function exists and contains the fetch call
                      // This is a placeholder for where the body would be constructed
                      // if handlePayment were defined in this scope.
                      // The actual change needs to be made inside the handlePayment function.
                      // For demonstration, if handlePayment were here:
                      /*
                      const body = JSON.stringify({
                        ...data,
                        paymentMethodId: paymentMethod.id,
                        planType: selectedPlan,
                        leadId: leadId,
                        bypassStripe: isBypassMode // Explicit flag
                      });
                      // Then this body would be used in a fetch call:
                      // fetch('/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
                      */
                      handlePayment();
                    }}
                    disabled={isProcessing}
                    data-debug-processing={isProcessing.toString()}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Start Your Free Trial Now
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    We'll send a receipt to {leadData?.email}
                  </p>
                </div>
              )}

              {step === "processing" && (
                <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span>Processing your payment...</span>
                </div>
              )}

              {step === "provisioning" && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span>Setting up your AI receptionist...</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Account created</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Payment confirmed</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {provisioningStatus === "pending" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                      <span>Creating AI assistant...</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {provisioningStatus === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <div className="h-4 w-4 border-2 border-muted rounded-full" />
                      )}
                      <span>Provisioning phone number...</span>
                    </div>
                  </div>
                </div>
              )}

              {step === "complete" && phoneNumber && (
                <div className="space-y-4">
                  <div className="p-6 border-2 border-green-200 rounded-lg bg-green-50 text-center">
                    <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-green-800 mb-2">You're All Set!</h3>
                    <p className="text-green-700 mb-4">Your AI phone number:</p>
                    <div className="bg-white rounded-lg p-4 flex items-center justify-center gap-3">
                      <span className="text-2xl font-bold">{phoneNumber}</span>
                      <Button variant="ghost" size="icon" onClick={copyPhoneNumber}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Next steps:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Forward your business line to {phoneNumber}</li>
                      <li>Test it by calling from your phone</li>
                      <li>Check your dashboard to customize settings</li>
                    </ol>
                  </div>

                  <Button className="w-full mb-4" size="lg" onClick={goToDashboard}>
                    Go to Dashboard
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>

                  {/* Call to Test */}
                  <div className="p-4 border rounded-lg bg-blue-50 border-blue-100">
                    <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Test Your Assistant
                    </h4>
                    <p className="text-sm text-blue-800 mb-3">
                      Give your new number a call right now to hear your AI receptionist in action!
                    </p>
                    <a href={`tel:${phoneNumber}`} className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md transition-colors">
                      Call {phoneNumber}
                    </a>
                  </div>

                  {/* Carrier Instructions */}
                  <div className="p-4 border rounded-lg bg-card">
                    <h4 className="font-semibold mb-3">Forwarding Instructions</h4>
                    <div className="space-y-3 text-sm">
                      <details className="group">
                        <summary className="cursor-pointer font-medium text-primary hover:underline">AT&T Wireless</summary>
                        <div className="mt-2 pl-4 text-muted-foreground">
                          Dial <strong>*21*{phoneNumber}#</strong> and press Call.
                          <br /><span className="text-xs">To turn off: Dial #21#</span>
                        </div>
                      </details>
                      <details className="group">
                        <summary className="cursor-pointer font-medium text-primary hover:underline">Verizon</summary>
                        <div className="mt-2 pl-4 text-muted-foreground">
                          Dial <strong>*72{phoneNumber}</strong> and press Call.
                          <br /><span className="text-xs">To turn off: Dial *73</span>
                        </div>
                      </details>
                      <details className="group">
                        <summary className="cursor-pointer font-medium text-primary hover:underline">T-Mobile</summary>
                        <div className="mt-2 pl-4 text-muted-foreground">
                          Dial <strong>**21*{phoneNumber}#</strong> and press Call.
                          <br /><span className="text-xs">To turn off: Dial ##21#</span>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// Main component wrapped with Stripe Elements
export default function OnboardingChat() {
  return (
    <Elements stripe={stripePromise}>
      <OnboardingChatInner />
    </Elements>
  );
}
