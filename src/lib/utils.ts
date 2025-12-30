import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "No number";

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Check if it starts with 1 (US country code) and has 11 digits, remove it
  let match = cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    match = cleaned.substring(1);
  }

  // Format as xxx-xxx-xxxx
  if (match.length === 10) {
    return `${match.slice(0, 3)}-${match.slice(3, 6)}-${match.slice(6)}`;
  }

  // For other lengths, just return original or maybe try to format partials?
  // Returning original is safest fallback
  return phone;
}
