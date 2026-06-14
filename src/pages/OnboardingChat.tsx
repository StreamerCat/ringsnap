/**
 * STEP 2: Agent Chat Onboarding (Two-Step Signup Flow)
 *
 * This component handles the full chat-based onboarding flow:
 * - For NEW users (with lead_id from Step 1): Collects all info + payment
 * - For EXISTING users (authenticated): Collects assistant config only
 *
 * Consolidated Chat Flow (New Users) — 5 steps:
 * 1. Phone + Company name (combined)
 * 2. Trade/service type
 * 3. Website + Business hours (combined)
 * 4. Goal + Plan selection
 * 5. Payment → Provisioning
 *
 * Features:
 * - Back navigation between steps
 * - Inline validation errors
 * - Plan selection with call-based pricing
 * - Plan summary at payment step
 * - Graceful error handling with retry
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import {
  Loader2,
  Phone,
  Clock,
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
  ArrowLeft,
  Shield,
  Check,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { ChatMessage, TypingIndicator, MessageRole } from "@/components/onboarding-chat/ChatMessage";
import { ChatButtons, ChatButtonOption } from "@/components/onboarding-chat/ChatButtons";
import { ChatInput } from "@/components/onboarding-chat/ChatInput";
import { ServiceHoursEditor, ServiceHoursData } from "@/components/onboarding-chat/ServiceHoursEditor";
import { extractUserError, logClientError } from "@/lib/errors";
import { trackFunnelEvent, trackCheckpoint, trackConversion, trackFormEvent, trackTiming } from "@/lib/sentry-tracking";
import { capture, identify, IS_DEV } from "@/lib/analytics";
import { getExperimentAttribution } from "@/lib/experimentAttribution";
import { Helmet } from "react-helmet-async";
import * as Sentry from "@sentry/react";


// Chat step types
type ChatStep =
  | "loading"
  | "phone_company"   // Combined: phone + company name
  | "phone"           // Legacy (kept for compat)
  | "company"         // Legacy (kept for compat)
  | "trade"
  | "website_hours"   // Combined: website + hours
  | "website"         // Legacy
  | "hours"           // Legacy
  | "hours_custom"
  | "goal"
  | "plan"            // NEW: plan selection
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
  if (IS_DEV) console.log("Stripe Key loaded (prefix):", STRIPE_KEY.substring(0, 8) + "...");
}

const stripePromise = loadStripe(STRIPE_KEY!);
const HOMEPAGE_HERO_EXPERIMENT_KEY = 'exp_homepage_hero_copy_v1';

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

// ═══════════════════════════════════════════════════════════════════
// Sub-components for consolidated steps
// ═══════════════════════════════════════════════════════════════════

/** Combined Phone + Company input (reduces 2 steps to 1) */
function PhoneCompanyInput({ onSubmit, onBack }: { onSubmit: (phone: string, company: string) => void; onBack?: () => void }) {
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [errors, setErrors] = useState<{ phone?: string; company?: string }>({});

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneNumber(e.target.value));
    if (errors.phone) setErrors(prev => ({ ...prev, phone: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "");
    const newErrors: { phone?: string; company?: string } = {};

    if (cleanPhone.length !== 10) {
      newErrors.phone = "Enter a valid 10-digit US phone number";
    } else if (cleanPhone.startsWith("1")) {
      newErrors.phone = "Enter without the leading '1'";
    }
    if (company.trim().length < 2) {
      newErrors.company = "Enter your company name";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSubmit(phone, company);
  };

  return (
    <form onSubmit={handleSubmit} action="javascript:void(0);" className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Business phone number</label>
        <input
          type="tel"
          value={phone}
          onChange={handlePhoneChange}
          placeholder="(555) 123-4567"
          autoFocus
          inputMode="numeric"
          maxLength={14}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Company name</label>
        <input
          type="text"
          value={company}
          onChange={(e) => { setCompany(e.target.value); if (errors.company) setErrors(prev => ({ ...prev, company: undefined })); }}
          placeholder="Acme Plumbing"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {errors.company && <p className="text-xs text-red-600 mt-1">{errors.company}</p>}
      </div>
      <div className="flex items-center justify-between">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Back
          </button>
        ) : <span />}
        <Button type="submit" size="sm">
          Continue <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
    </form>
  );
}

/** Combined Website + Hours step (reduces 2 steps to 1) */
function WebsiteHoursInput({ onSubmit, onBack }: {
  onSubmit: (website: string, hoursChoice: string, hoursData?: ServiceHoursData) => void;
  onBack: () => void;
}) {
  const [website, setWebsite] = useState("");
  const [hoursChoice, setHoursChoice] = useState<string>("");

  const handleSubmit = () => {
    if (!hoursChoice) {
      toast.error("Please select when your receptionist should answer calls");
      return;
    }
    onSubmit(website, hoursChoice);
  };

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
      {/* Website */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Website <span className="text-muted-foreground/60">(optional — helps your AI answer questions)</span>
        </label>
        <input
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="www.yourcompany.com"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      {/* Hours */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">When should your receptionist answer?</label>
        <div className="grid grid-cols-1 gap-2">
          {[
            { label: "Weekdays 9am–5pm", value: "weekdays_9_5" },
            { label: "Every day 8am–6pm", value: "everyday_8_6" },
            { label: "24/7", value: "24_7" },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setHoursChoice(opt.value)}
              className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg text-sm text-left transition-colors ${hoursChoice === opt.value ? "border-primary bg-primary/5 text-primary font-medium" : "border-input hover:border-primary/50"}`}
            >
              <Clock className="h-4 w-4 flex-shrink-0" />
              {opt.label}
              {hoursChoice === opt.value && <Check className="h-4 w-4 ml-auto text-primary" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back
        </button>
        <Button size="sm" onClick={handleSubmit} disabled={!hoursChoice}>
          Continue <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}



// ═══════════════════════════════════════════════════════════════════

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

  // Calculate progress based on step (4 user steps: phone_company → trade → website_hours → payment)
  useEffect(() => {
    const stepProgress: Record<ChatStep, number> = {
      loading: 0,
      phone_company: 20,
      phone: 20,
      company: 30,
      trade: 40,
      website_hours: 55,
      website: 55,
      hours: 65,
      hours_custom: 65,
      goal: 75,
      plan: 85,
      payment: 90,
      processing: 95,
      provisioning: 98,
      complete: 100,
      error: 0,
    };
    setProgress(stepProgress[step] || 0);
  }, [step]);

  // Initialize - load lead data
  useEffect(() => {
    const init = async () => {
      // Always check authentication status first.
      // A previously signed-in user may still have a stale lead_id in localStorage,
      // and we must not route them back through the new-signup flow.
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();

        if (authError && authError.name !== "AuthSessionMissingError") {
          if (IS_DEV) console.log("[OnboardingChat] auth lookup error", authError);
        }

        if (authData?.user) {
          // User is already authenticated — clear any stale lead_id and send them
          // to the appropriate destination so they never re-enter the signup funnel.
          try { localStorage.removeItem(LEAD_ID_KEY); } catch { /* ignore */ }

          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_status")
            .eq("id", authData.user.id)
            .maybeSingle();

          if (profile?.onboarding_status === "active") {
            navigate("/dashboard", { replace: true });
          } else {
            // Account exists but onboarding not complete — send to activation
            navigate("/activation", { replace: true });
          }
          return;
        }
      } catch (err) {
        if (IS_DEV) console.log("[OnboardingChat] auth check skipped", err);
      }

      // Check for lead_id
      if (!lead_id) {
        // No lead_id and not authenticated - go back to start
        if (IS_DEV) console.log("[OnboardingChat] Resume lookup skipped - no lead id");
        toast.error("Please start the signup process first");
        navigate("/start", { replace: true });
        return;
      }

      // Load lead data
      try {
        if (IS_DEV) console.log("[OnboardingChat] Attempting resume lookup", { leadId: lead_id });
        const { data: lead, error } = await supabase
          .from("signup_leads")
          .select("id, email, full_name, completed_at")
          .eq("id", lead_id)
          .maybeSingle();

        if (error || !lead) {
          if (IS_DEV) console.log("[OnboardingChat] Resume lookup failed - not found", { leadId: lead_id, error });
          // Clear the bad lead_id so the user gets a clean start form
          try { localStorage.removeItem(LEAD_ID_KEY); } catch { /* ignore */ }
          toast.error("Could not find your signup. Please start again.");
          navigate("/start", { replace: true });
          return;
        }

        if (lead.completed_at) {
          // Lead already converted — clear stale storage and send to login
          try { localStorage.removeItem(LEAD_ID_KEY); } catch { /* ignore */ }
          toast.info("Your account has already been created. Please sign in.");
          navigate("/auth/login", { replace: true });
          return;
        }

        setLeadData({
          id: lead.id,
          email: lead.email,
          full_name: lead.full_name,
        });

        // Start the chat with combined phone + company step
        setStep("phone_company");
        trackFunnelEvent("onboarding_started", { lead_id: lead.id, email: lead.email });

        await showTypingDelay(500);
        const userName = lead.full_name?.split(" ")[0] || "there";
        addMessage(
          "assistant",
          `Hi ${userName}! Let's get your RingSnap receptionist set up in just a few steps. What's your business phone number and company name?`
        );
      } catch (error) {
        console.error("Init error:", error);
        toast.error("Something went wrong. Please try again.");
        navigate("/start", { replace: true });
      }
    };

    init();
  }, [lead_id, navigate, addMessage, showTypingDelay]);

  // Poll provisioning status - MOVED TO /setup/assistant page
  // useEffect(() => { ... }) removed


  // Step history for back navigation
  const [stepHistory, setStepHistory] = useState<ChatStep[]>([]);

  const goBack = () => {
    if (stepHistory.length === 0) return;
    const prevStep = stepHistory[stepHistory.length - 1];
    setStepHistory(prev => prev.slice(0, -1));
    setStep(prevStep);
  };

  const advanceStep = (nextStep: ChatStep) => {
    setStepHistory(prev => [...prev, step]);
    setStep(nextStep);
  };

  // Handle combined phone + company input
  const handlePhoneCompany = async (phone: string, company: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit US phone number");
      return;
    }
    if (cleanPhone.startsWith("1")) {
      toast.error("Please enter your 10-digit number WITHOUT the leading '1'");
      return;
    }
    if (company.trim().length < 2) {
      toast.error("Please enter your company name");
      return;
    }

    addMessage("user", `${formatPhoneNumber(cleanPhone)} • ${company.trim()}`);
    setData((prev) => ({ ...prev, phone: formatPhoneNumber(cleanPhone), companyName: company.trim() }));

    trackCheckpoint("onboarding_phone_collected");
    trackCheckpoint("onboarding_company_collected", { company_name: company.trim() });
    // Save to lead record (fire-and-forget)
    if (leadData) {
      supabase.from("signup_leads" as any).update({ phone: normalizePhone(cleanPhone), last_step: 2 }).eq("id", leadData.id).then(() => {});
    }

    advanceStep("trade");
    await showTypingDelay(600);
    addMessage("assistant", "What type of work do you do?");
  };

  // Handle phone input (legacy path, still works if needed)
  const handlePhone = async (value: string) => {
    const cleanPhone = value.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit US phone number");
      return;
    }

    if (cleanPhone.startsWith("1")) {
      toast.error("Please enter your 10-digit number WITHOUT the leading '1'");
      return;
    }

    addMessage("user", value);
    setData((prev) => ({ ...prev, phone: value }));
    advanceStep("company");
    trackCheckpoint("onboarding_phone_collected");
    if (leadData) {
      supabase.from("signup_leads" as any).update({ phone: normalizePhone(cleanPhone), last_step: 1 }).eq("id", leadData.id).then(() => {});
    }
    await showTypingDelay(600);
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

    advanceStep("trade");
    trackCheckpoint("onboarding_company_collected", { company_name: value.trim() });
    if (leadData) {
      supabase.from("signup_leads" as any).update({ last_step: 2 }).eq("id", leadData.id).then(() => {});
    }
    await showTypingDelay(600);
    addMessage("assistant", "What type of work do you do?");
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

    advanceStep("website_hours");
    trackCheckpoint("onboarding_trade_collected", { trade: value });
    if (leadData) {
      supabase.from("signup_leads" as any).update({ last_step: 3 }).eq("id", leadData.id).then(() => {});
    }
    await showTypingDelay(600);
    addMessage(
      "assistant",
      "Almost there! Do you have a website, and when should your receptionist answer calls?"
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

    advanceStep("website_hours");
    if (leadData) {
      supabase.from("signup_leads" as any).update({ last_step: 3 }).eq("id", leadData.id).then(() => {});
    }
    await showTypingDelay(600);
    addMessage(
      "assistant",
      "Almost there! Do you have a website, and when should your receptionist answer calls?"
    );
  };

  // Handle combined website + hours submission
  const handleWebsiteHours = async (website: string, hoursChoice: string, hoursData?: ServiceHoursData) => {
    let url = website.trim();
    if (url && !url.startsWith("http")) {
      url = `https://${url}`;
    }

    const hoursLabel = hoursChoice === "weekdays_9_5" ? "Weekdays 9am-5pm"
      : hoursChoice === "everyday_8_6" ? "Every day 8am-6pm"
      : hoursChoice === "24_7" ? "24/7"
      : "Custom hours";

    addMessage("user", `${url || "No website"} • ${hoursLabel}`);

    // Build hours data
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let finalHoursData: ServiceHoursData;

    if (hoursData) {
      finalHoursData = hoursData;
    } else if (hoursChoice === "weekdays_9_5") {
      finalHoursData = {
        timezone,
        blocks: [
          { day: "monday", start: "09:00", end: "17:00" },
          { day: "tuesday", start: "09:00", end: "17:00" },
          { day: "wednesday", start: "09:00", end: "17:00" },
          { day: "thursday", start: "09:00", end: "17:00" },
          { day: "friday", start: "09:00", end: "17:00" },
        ]
      };
    } else if (hoursChoice === "everyday_8_6") {
      finalHoursData = {
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
      finalHoursData = {
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

    setData((prev) => ({ ...prev, website: url, businessHours: finalHoursData }));
    trackCheckpoint("onboarding_website_collected", { skipped: !url });
    trackCheckpoint("onboarding_hours_collected", { type: hoursChoice });

    if (leadData) {
      supabase.from("signup_leads" as any).update({ last_step: 4 }).eq("id", leadData.id).then(() => {});
    }

    advanceStep("goal");
    await showTypingDelay(600);
    addMessage("assistant", "What's the main job for your receptionist?");
  };

  // Handle website (legacy path)
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

    advanceStep("hours");
    trackCheckpoint("onboarding_website_collected", { skipped });
    await showTypingDelay(600);
    addMessage("assistant", "When should your receptionist answer calls?");
  };

  // Handle hours selection
  const handleHoursChoice = async (value: string) => {
    if (value === "custom") {
      setStep("hours_custom");
      await showTypingDelay(300);
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

    advanceStep("goal");
    trackCheckpoint("onboarding_hours_collected", { type: value });
    if (leadData) {
      supabase.from("signup_leads" as any).update({ last_step: 4 }).eq("id", leadData.id).then(() => {});
    }
    await showTypingDelay(600);
    addMessage("assistant", "What's the main job for your receptionist?");
  };

  // Handle custom hours
  const handleCustomHours = async (hours: ServiceHoursData) => {
    const daysText =
      hours.blocks.length === 7
        ? "Every day"
        : hours.blocks.map((b) => b.day.charAt(0).toUpperCase() + b.day.slice(1, 3)).join(", ");

    addMessage("user", `Custom hours: ${daysText}`);
    setData((prev) => ({ ...prev, businessHours: hours }));

    advanceStep("goal");
    if (leadData) {
      supabase.from("signup_leads" as any).update({ last_step: 4 }).eq("id", leadData.id).then(() => {});
    }
    await showTypingDelay(600);
    addMessage("assistant", "What's the main job for your receptionist?");
  };

  // Handle goal selection → goes directly to payment (plan defaults to starter for highest conversion)
  const handleGoal = async (value: string) => {
    const goalLabel = GOAL_OPTIONS.find((g) => g.value === value)?.label || value;
    addMessage("user", goalLabel);
    setData((prev) => ({ ...prev, primaryGoal: value, planType: "starter" }));

    advanceStep("payment");
    trackCheckpoint("onboarding_goal_collected", { goal: value });
    capture('checkout_started', { plan_key: 'starter', source_channel: 'onboarding_chat' });
    await showTypingDelay(600);
    addMessage("assistant", "Last step! Add your card to start your free 3-day trial. You won't be charged — cancel anytime before the trial ends.");
  };

  // Handle payment submission
  const handlePayment = async () => {
    if (!stripe || !elements || !leadData) {
      toast.error("Payment system not ready. Please refresh and try again.");
      return;
    }

    if (!data.zipCode || data.zipCode.length !== 5) {
      toast.error("Please enter a valid 5-digit billing zip code");
      return;
    }

    // Bypass mode: zip 99999 - for safe testing without real payment
    const isBypassMode = data.zipCode === "99999";

    // For bypass mode, skip card validation entirely
    // For normal mode, require card to be complete
    if (!isBypassMode) {
      if (!cardComplete) {
        toast.error("Please complete your card information");
        return;
      }
    }

    setIsProcessing(true);
    addMessage("user", "Payment submitted");
    trackFormEvent("onboarding_payment", "submit", { plan: data.planType });

    try {
      // Create payment method - default for bypass mode
      let paymentMethod = { id: "pm_bypass_check_deploy" };

      if (isBypassMode) {
        if (IS_DEV) console.log("[BYPASS MODE] Skipping Stripe frontend - using mock payment method");
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
            // Agent configuration
            assistantGender: data.assistantGender,
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

      // Check for ACCOUNT_EXISTS error code
      if (result?.code === "ACCOUNT_EXISTS") {
        addMessage(
          "assistant",
          <div className="space-y-2">
            <p>It looks like you already have an account with this email.</p>
            <p>Please log in to access your dashboard.</p>
          </div>
        );
        setTimeout(() => {
          navigate("/auth/login?email=" + encodeURIComponent(leadData.email));
        }, 2000);
        return;
      }

      if (createTrialError || !result?.success) {
        throw new Error(
          result?.error || result?.message || createTrialError?.message || "Failed to create account"
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
          // If sign-in fails but account created, send to login
          navigate("/auth/login?email=" + encodeURIComponent(result.email));
          return;
        }
      }

      // Track completion (Sentry)
      trackFunnelEvent("signup_completed", { account_id: result.accountId, email: result.email });
      trackConversion("signup", { value: 0 }); // Trial has 0 upfront value

      // PostHog: checkout_completed, trial_activated, onboarding_started
      capture('checkout_completed', { plan_key: data.planType, amount: 0, trial: true });
      capture('trial_activated', { plan_key: data.planType, signup_source: 'onboarding_chat' });
      const experimentAttribution = getExperimentAttribution(HOMEPAGE_HERO_EXPERIMENT_KEY);
      capture('trial_started', {
        plan_key: data.planType,
        signup_source: 'onboarding_chat',
        experiment_key: HOMEPAGE_HERO_EXPERIMENT_KEY,
        variant: experimentAttribution?.variant ?? 'control',
        page: '/onboarding-chat',
        section: 'checkout',
        cta_text: experimentAttribution?.ctaText,
      });
      capture('onboarding_started', { plan_key: data.planType });

      // Re-identify with Supabase user_id now that account is created
      if (result.userId || result.accountId) {
        identify(
          result.userId || result.accountId,
          {
            plan_key: data.planType,
            billing_status: 'trial',
            account_id: result.accountId,
            last_active_at: new Date().toISOString(),
          }
        );
      }

      // Clear the stored lead_id now that signup is complete.
      // This prevents stale resumption logic from firing on future visits
      // (e.g. a previously-signed-in user coming back and hitting the free trial page).
      try { localStorage.removeItem(LEAD_ID_KEY); } catch { /* ignore */ }

      // Redirect immediately to the new Provisioning Status page
      // This handles the "wait" time gracefully instead of hanging in the chat
      navigate("/setup/assistant", { replace: true });

    } catch (error: any) {
      console.error("Payment error:", error);

      // Use shared error utility (handles both old and new formats)
      // Try result first (from edge function), then createTrialError, then the caught error
      const errorPayload = error;
      const appError = extractUserError(errorPayload);

      // Log technical details for debugging
      logClientError('Trial Creation', appError, {
        email: leadData.email,
        correlationId: errorPayload?.correlationId,
        phase: errorPayload?.phase
      });

      // Show user-friendly message with clear retry guidance
      if (appError.retryable) {
        setStep("payment");
        setIsProcessing(false);

        addMessage(
          "assistant",
          <div className="space-y-2">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800">{appError.userMessage}</p>
              {appError.suggestedAction && (
                <p className="text-xs text-red-600 mt-1">{appError.suggestedAction}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">Your information is saved — just try again below.</p>
            </div>
          </div>
        );
        return;
      }

      // Non-retryable error - show message and offer support
      setStep("payment");
      setIsProcessing(false);
      addMessage(
        "assistant",
        <div className="space-y-2">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm font-medium text-red-800">{appError.userMessage}</p>
            <p className="text-xs text-muted-foreground mt-2">
              If this continues, please try a different card or contact us at support@getringsnap.com
            </p>
          </div>
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
      <Helmet>
        <title>Setup | RingSnap</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Header */}
      <header className="p-3 border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <span className="font-semibold">RingSnap Setup</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Step {Math.min(Math.ceil(progress / 25), 4)} of 4
            </span>
            <div className="w-24">
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <main className="max-w-2xl mx-auto p-2 sm:p-4">
        <Card className="min-h-[60vh] flex flex-col">
          <CardContent className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="space-y-3">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} {...msg} />
              ))}

              {isTyping && <TypingIndicator />}

              {/* Interactive elements based on step */}

              {/* Combined phone + company step (new default) */}
              {step === "phone_company" && !isTyping && (
                <PhoneCompanyInput onSubmit={handlePhoneCompany} onBack={stepHistory.length > 0 ? goBack : undefined} />
              )}

              {/* Legacy individual steps (fallback) */}
              {step === "phone" && !isTyping && (
                <ChatInput
                  onSubmit={handlePhone}
                  placeholder="(555) 123-4567"
                  type="tel"
                  maxLength={14}
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
                <div className="space-y-3">
                  <ChatButtons
                    options={TRADE_OPTIONS}
                    onSelect={handleTrade}
                    layout="grid"
                  />
                  {stepHistory.length > 0 && (
                    <button onClick={goBack} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <ArrowLeft className="h-3 w-3" /> Back
                    </button>
                  )}
                </div>
              )}

              {step === "trade" && showCustomTrade && (
                <ChatInput
                  onSubmit={handleCustomTrade}
                  placeholder="Enter your service type..."
                  type="text"
                />
              )}

              {/* Combined website + hours step (new default) */}
              {step === "website_hours" && !isTyping && (
                <WebsiteHoursInput onSubmit={handleWebsiteHours} onBack={goBack} />
              )}

              {/* Legacy individual steps (fallback) */}
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

              {step === "goal" && !isTyping && (
                <div className="space-y-3">
                  <ChatButtons
                    options={GOAL_OPTIONS}
                    onSelect={handleGoal}
                    layout="vertical"
                  />
                  {stepHistory.length > 0 && (
                    <button onClick={goBack} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <ArrowLeft className="h-3 w-3" /> Back
                    </button>
                  )}
                </div>
              )}

              {/* Plan step removed — defaulting to starter for conversion optimization */}

              {step === "payment" && !isTyping && (
                <div className="space-y-4 p-4 border rounded-lg bg-card">
                  {/* Trial Messaging — Emphasize free, no-risk */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1.5">
                    <p className="text-sm font-semibold text-green-900 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> 3-Day Free Trial — No Charge Today
                    </p>
                    <ul className="text-xs text-green-800 space-y-0.5 pl-5 list-disc">
                      <li>Try your AI receptionist with 15 real calls</li>
                      <li>Cancel anytime before trial ends — $0 charged</li>
                      <li>No commitment, no contracts</li>
                    </ul>
                  </div>

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
                      By clicking below, you agree to our{" "}
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
                    onClick={handlePayment}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting your free trial...
                      </>
                    ) : (
                      <>
                        Start My Free Trial — $0 Today
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  {stepHistory.length > 0 && !isProcessing && (
                    <button
                      type="button"
                      onClick={goBack}
                      className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1"
                    >
                      <ArrowLeft className="inline h-3 w-3 mr-1" />Go back
                    </button>
                  )}
                </div>
              )}

              {step === "processing" && (
                <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span>Setting up your account...</span>
                </div>
              )}

              {step === "provisioning" && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span>Setting up your RingSnap Agent...</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Account created</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Card verified</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {provisioningStatus === "pending" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                      <span>Creating Voice Agent...</span>
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
                    <p className="text-green-700 mb-4">Your RingSnap Number:</p>
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
                      Give your new number a call right now to hear your automated receptionist in action!
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
