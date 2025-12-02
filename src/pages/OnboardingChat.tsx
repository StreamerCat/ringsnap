import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Sparkles, Building2, Globe, Phone, Clock, Mic, Calendar, MessageSquare, Settings } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { ChatMessage, TypingIndicator, MessageRole } from "@/components/onboarding-chat/ChatMessage";
import { ChatButtons, ChatButtonOption } from "@/components/onboarding-chat/ChatButtons";
import { ChatInput } from "@/components/onboarding-chat/ChatInput";
import { ServiceHoursEditor, ServiceHoursData } from "@/components/onboarding-chat/ServiceHoursEditor";

type OnboardingStep =
  | "loading"
  | "welcome"
  | "business_name"
  | "business_website"
  | "destination_phone"
  | "service_hours"
  | "service_hours_custom"
  | "voice_gender"
  | "assistant_tone"
  | "booking_preference"
  | "summary"
  | "provisioning";

interface Message {
  id: string;
  role: MessageRole;
  content: string | React.ReactNode;
  timestamp: Date;
}

export default function OnboardingChat() {
  const navigate = useNavigate();
  const [step, setStep] = useState<OnboardingStep>("loading");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  // Collected data
  const [businessName, setBusinessName] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [destinationPhone, setDestinationPhone] = useState("");
  const [serviceHours, setServiceHours] = useState<ServiceHoursData | null>(null);
  const [voiceGender, setVoiceGender] = useState<"male" | "female">("female");
  const [assistantTone, setAssistantTone] = useState<"formal" | "friendly" | "casual">("friendly");
  const [bookingMode, setBookingMode] = useState<"sms_only" | "direct_calendar">("sms_only");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Check auth and load user data
  useEffect(() => {
    const initOnboarding = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          // This should not happen due to withAuthGuard, but as a fallback:
          toast.error("Session not found. Please sign in again.");
          navigate("/auth/login");
          return;
        }

        setUserId(user.id);

        // Get profile and account with retry logic for just-created users
        let profile = null;
        let lastError = null;
        for (let i = 0; i < 3; i++) {
          const { data, error } = await supabase
            .from("profiles")
            .select("account_id, onboarding_status")
            .eq("id", user.id)
            .single();

          if (data) {
            profile = data;
            break;
          }
          lastError = error;
          // Wait 1 second before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (profileError || !profile) {
          toast.error("Failed to load your profile");
          navigate("/start"); // Or a more appropriate error page
          return;
        }

        setAccountId(profile.account_id);

        // Check if already completed onboarding
        if (profile.onboarding_status === "active") {
          navigate("/dashboard");
          return;
        }

        // Update status to 'collecting' if not started
        if (profile.onboarding_status === "not_started") {
          await supabase
            .from("profiles")
            .update({ onboarding_status: "collecting" })
            .eq("id", user.id);
        }

        // Start the chat flow
        setStep("welcome");
        await showTypingDelay(1000);
        addMessage(
          "assistant",
          "Welcome to RingSnap. Your free trial is active. I’ll help you set up your AI phone assistant now. This takes about 2 minutes. Ready to get started?"
        );
      } catch (error) {
        console.error("Onboarding init error:", error);
        toast.error("Something went wrong during setup.");
        navigate("/start"); // Or a more appropriate error page
      }
    };

    initOnboarding();
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

  const saveToAccount = async (updates: Record<string, any>) => {
    if (!accountId) return;

    const { error } = await supabase
      .from("accounts")
      .update(updates)
      .eq("id", accountId);

    if (error) {
      console.error("Failed to save account data:", error);
      toast.error("Failed to save. Please try again.");
      throw error;
    }
  };

  const handleWelcomeResponse = async () => {
    addMessage("user", "Yes, let's do it!");
    setStep("business_name");
    await showTypingDelay();
    addMessage(
      "assistant",
      "Great! First, what's your business name?"
    );
  };

  const handleBusinessName = async (value: string) => {
    addMessage("user", value);
    setBusinessName(value);

    try {
      await saveToAccount({ company_name: value });

      setStep("business_website");
      await showTypingDelay();

      // Get user's email domain to suggest
      const { data: { user } } = await supabase.auth.getUser();
      const emailDomain = user?.email?.split("@")[1];
      const isGeneric = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(emailDomain || "");

      if (!isGeneric && emailDomain) {
        addMessage(
          "assistant",
          <>
            <p className="mb-2">Perfect! Now, what's your business website?</p>
            <p className="text-xs opacity-75">I noticed your email is @{emailDomain}. Is your website https://www.{emailDomain}?</p>
          </>
        );
      } else {
        addMessage("assistant", "Perfect! Now, what's your business website?");
      }
    } catch (error) {
      // Error already handled in saveToAccount
    }
  };

  const handleBusinessWebsite = async (value: string) => {
    addMessage("user", value || "I don't have one yet");
    setBusinessWebsite(value);

    try {
      await saveToAccount({ company_website: value || null });

      setStep("destination_phone");
      await showTypingDelay();
      addMessage(
        "assistant",
        "Great! When someone calls your AI assistant, what phone number should we route important calls to?"
      );
    } catch (error) {
      // Error already handled
    }
  };

  const handleDestinationPhone = async (value: string) => {
    // Basic validation
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }

    const formatted = cleaned.length === 11 && cleaned[0] === "1" ? cleaned : `1${cleaned.slice(-10)}`;
    addMessage("user", value);
    setDestinationPhone(formatted);

    try {
      await saveToAccount({ destination_phone: formatted });

      setStep("service_hours");
      await showTypingDelay();
      addMessage(
        "assistant",
        "Excellent! When is your business typically available to take calls?"
      );
    } catch (error) {
      // Error already handled
    }
  };

  const handleServiceHoursChoice = async (choice: string) => {
    addMessage("user", choice);

    if (choice === "custom") {
      setStep("service_hours_custom");
      await showTypingDelay(500);
      addMessage("assistant", "No problem! Let's customize your hours:");
      return;
    }

    let hours: ServiceHoursData;
    if (choice === "weekdays_9_5") {
      hours = {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        blocks: [
          { day: "monday", start: "09:00", end: "17:00" },
          { day: "tuesday", start: "09:00", end: "17:00" },
          { day: "wednesday", start: "09:00", end: "17:00" },
          { day: "thursday", start: "09:00", end: "17:00" },
          { day: "friday", start: "09:00", end: "17:00" }
        ]
      };
    } else {
      // everyday_8_6
      hours = {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        blocks: [
          { day: "monday", start: "08:00", end: "18:00" },
          { day: "tuesday", start: "08:00", end: "18:00" },
          { day: "wednesday", start: "08:00", end: "18:00" },
          { day: "thursday", start: "08:00", end: "18:00" },
          { day: "friday", start: "08:00", end: "18:00" },
          { day: "saturday", start: "08:00", end: "18:00" },
          { day: "sunday", start: "08:00", end: "18:00" }
        ]
      };
    }

    setServiceHours(hours);

    try {
      // Convert to business_hours format
      const businessHours: Record<string, any> = {};
      hours.blocks.forEach(block => {
        businessHours[block.day] = `${block.start}-${block.end}`;
      });

      await saveToAccount({ business_hours: businessHours });

      await continueAfterServiceHours();
    } catch (error) {
      // Error already handled
    }
  };

  const handleServiceHoursCustom = async (hours: ServiceHoursData) => {
    setServiceHours(hours);

    try {
      // Convert to business_hours format
      const businessHours: Record<string, any> = {};
      hours.blocks.forEach(block => {
        businessHours[block.day] = `${block.start}-${block.end}`;
      });

      await saveToAccount({ business_hours: businessHours });

      await continueAfterServiceHours();
    } catch (error) {
      // Error already handled
    }
  };

  const continueAfterServiceHours = async () => {
    setStep("voice_gender");
    await showTypingDelay();
    addMessage(
      "assistant",
      "Perfect! Now let's personalize your assistant's voice. Would you prefer a male or female voice?"
    );
  };

  const handleVoiceGender = async (value: string) => {
    const gender = value as "male" | "female";
    addMessage("user", value === "male" ? "Male" : "Female");
    setVoiceGender(gender);

    try {
      await saveToAccount({ assistant_gender: gender });

      setStep("assistant_tone");
      await showTypingDelay();
      addMessage(
        "assistant",
        "Great choice! How should your assistant sound when talking to customers?"
      );
    } catch (error) {
      // Error already handled
    }
  };

  const handleAssistantTone = async (value: string) => {
    const tone = value as "formal" | "friendly" | "casual";
    addMessage("user", value.charAt(0).toUpperCase() + value.slice(1));
    setAssistantTone(tone);

    try {
      await saveToAccount({ assistant_tone: tone });

      setStep("booking_preference");
      await showTypingDelay();
      addMessage(
        "assistant",
        "Almost done! When customers want to book an appointment, how should we handle it?"
      );
    } catch (error) {
      // Error already handled
    }
  };

  const handleBookingPreference = async (value: string) => {
    const mode = value as "sms_only" | "direct_calendar";
    addMessage(
      "user",
      mode === "sms_only" ? "Text me to confirm" : "Book directly on my calendar"
    );
    setBookingMode(mode);

    try {
      await saveToAccount({ booking_mode: mode });

      setStep("summary");
      await showTypingDelay();
      addMessage(
        "assistant",
        <>
          <p className="font-semibold mb-2">Perfect! Here's what we've set up:</p>
          <ul className="text-sm space-y-1 ml-4 list-disc">
            <li>Business: {businessName}</li>
            <li>Voice: {voiceGender === "male" ? "Male" : "Female"}, {assistantTone} tone</li>
            <li>Booking: {mode === "sms_only" ? "SMS confirmation" : "Direct calendar (coming soon)"}</li>
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">You can change these settings anytime from your dashboard.</p>
          <p className="mt-3">Ready to activate your assistant? This will take about 30 seconds.</p>
        </>
      );
    } catch (error) {
      // Error already handled
    }
  };

  const handleActivate = async () => {
    addMessage("user", "Yes, activate it!");

    try {
      // Update onboarding status to ready_to_provision
      if (userId) {
        await supabase
          .from("profiles")
          .update({ onboarding_status: "ready_to_provision" })
          .eq("id", userId);
      }

      setStep("provisioning");
      await showTypingDelay(500);
      addMessage(
        "assistant",
        "Excellent! Setting up your phone number and assistant now. This usually takes under a minute..."
      );

      // Call provision-account edge function
      const { data, error } = await supabase.functions.invoke("provision-account", {
        body: {
          account_id: accountId,
          user_id: userId,
          source: "trial"
        }
      });

      if (error) {
        console.error("Provisioning error:", error);
        toast.error("Provisioning failed. Redirecting to status page...");
        // Set status to provision_failed
        if (userId) {
          await supabase
            .from("profiles")
            .update({ onboarding_status: "provision_failed" })
            .eq("id", userId);
        }
      }

      // Redirect to setup status page
      setTimeout(() => {
        navigate("/setup-status");
      }, 2000);

    } catch (error) {
      console.error("Activation error:", error);
      toast.error("Something went wrong. Please try again.");
    }
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
      <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="border-b p-4 flex items-center gap-2 bg-muted/50">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-lg">Setup Your AI Assistant</h1>
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
                  { label: "Yes, let's do it!", value: "yes" }
                ]}
                onSelect={handleWelcomeResponse}
              />
            )}

            {step === "business_name" && !isTyping && (
              <ChatInput
                onSubmit={handleBusinessName}
                placeholder="Enter your business name..."
                type="text"
              />
            )}

            {step === "business_website" && !isTyping && (
              <ChatInput
                onSubmit={handleBusinessWebsite}
                placeholder="https://www.example.com"
                type="url"
              />
            )}

            {step === "destination_phone" && !isTyping && (
              <ChatInput
                onSubmit={handleDestinationPhone}
                placeholder="(555) 123-4567"
                type="tel"
              />
            )}

            {step === "service_hours" && !isTyping && (
              <ChatButtons
                options={[
                  { label: "Weekdays 9 to 5", value: "weekdays_9_5", icon: <Clock className="h-4 w-4" /> },
                  { label: "Every day 8 to 6", value: "everyday_8_6", icon: <Clock className="h-4 w-4" /> },
                  { label: "Custom hours", value: "custom", icon: <Settings className="h-4 w-4" /> }
                ]}
                onSelect={handleServiceHoursChoice}
                layout="vertical"
              />
            )}

            {step === "service_hours_custom" && !isTyping && (
              <ServiceHoursEditor onSubmit={handleServiceHoursCustom} />
            )}

            {step === "voice_gender" && !isTyping && (
              <ChatButtons
                options={[
                  { label: "Female", value: "female", icon: <Mic className="h-4 w-4" /> },
                  { label: "Male", value: "male", icon: <Mic className="h-4 w-4" /> }
                ]}
                onSelect={handleVoiceGender}
                layout="grid"
              />
            )}

            {step === "assistant_tone" && !isTyping && (
              <ChatButtons
                options={[
                  { label: "Formal", value: "formal", description: "Professional and businesslike" },
                  { label: "Friendly", value: "friendly", description: "Warm and approachable" },
                  { label: "Casual", value: "casual", description: "Relaxed and conversational" }
                ]}
                onSelect={handleAssistantTone}
                layout="vertical"
              />
            )}

            {step === "booking_preference" && !isTyping && (
              <ChatButtons
                options={[
                  {
                    label: "Text me to confirm",
                    value: "sms_only",
                    icon: <MessageSquare className="h-4 w-4" />,
                    description: "I'll manually confirm appointments via SMS"
                  },
                  {
                    label: "Book directly on my calendar",
                    value: "direct_calendar",
                    icon: <Calendar className="h-4 w-4" />,
                    description: "Coming soon - automatic calendar booking"
                  }
                ]}
                onSelect={handleBookingPreference}
                layout="vertical"
              />
            )}

            {step === "summary" && !isTyping && (
              <ChatButtons
                options={[
                  { label: "Yes, activate it!", value: "activate" }
                ]}
                onSelect={handleActivate}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
