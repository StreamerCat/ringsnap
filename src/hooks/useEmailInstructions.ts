import { useState } from "react";
import { toast } from "sonner";

interface EmailInstructionsParams {
  email: string;
  phoneNumber?: string | null;
  companyName?: string;
  customerName?: string;
  tempPassword?: string;
}

const formatPhone = (phone?: string | null) => {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return cleaned.substring(1).replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
  }
  return phone;
};

export const useEmailInstructions = () => {
  const [isSending, setIsSending] = useState(false);

  const sendInstructions = ({
    email,
    phoneNumber,
    companyName,
    customerName,
    tempPassword,
  }: EmailInstructionsParams) => {
    if (!email) {
      toast.error("No email available for instructions");
      return;
    }

    setIsSending(true);

    try {
      const formattedPhone = formatPhone(phoneNumber);
      const subject = `Your RingSnap setup instructions`;

      const bodyLines = [
        `Hey ${customerName || "there"},`,
        "",
        `Your RingSnap account for ${companyName || "your business"} is live and ready to answer calls immediately.`,
        "",
        formattedPhone
          ? `➡️ Forward your existing line to your new RingSnap number: ${formattedPhone}`
          : "➡️ We'll send your dedicated RingSnap number shortly — you can still share login access now.",
        "",
        `🔑 Login email: ${email}`,
        tempPassword ? `🔒 Temporary password: ${tempPassword}` : undefined,
        formattedPhone
          ? `☎️ Tip: Dial your main line to hear the AI assistant in action once forwarding is on.`
          : undefined,
        "",
        "Need a hand? Reply to this email and we'll jump in.",
        "",
        "— The RingSnap Team"
      ].filter(Boolean);

      const body = encodeURIComponent(bodyLines.join("\n"));
      const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${body}`;

      window.location.href = mailto;
      toast.success("Opened email draft with setup instructions");
    } catch (error) {
      console.error("Failed to open email client", error);
      toast.error("Could not open email client");
    } finally {
      setTimeout(() => setIsSending(false), 300);
    }
  };

  return { sendInstructions, isSending };
};
