/**
 * SMS Utility - Twilio Integration
 *
 * Sends SMS messages via Twilio API
 * Used for appointment notifications, booking confirmations, etc.
 */

import { logError, logInfo } from './logging.ts';

export interface SendSMSOptions {
  to: string;
  message: string;
  functionName?: string;
  correlationId?: string;
}

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send SMS via Twilio
 *
 * Required environment variables:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER
 */
export async function sendSMS(options: SendSMSOptions): Promise<SendSMSResult> {
  const { to, message, functionName = 'sms-utility', correlationId } = options;

  // Validate environment variables
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    const error = 'Missing Twilio configuration: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER';
    logError('SMS configuration missing', {
      functionName,
      correlationId,
      error: new Error(error)
    });
    return { success: false, error };
  }

  // Format phone numbers (Twilio expects E.164 format: +1XXXXXXXXXX)
  const toFormatted = formatPhoneNumber(to);
  const fromFormatted = formatPhoneNumber(fromNumber);

  logInfo('Sending SMS', {
    functionName,
    correlationId,
    context: {
      to: toFormatted,
      from: fromFormatted,
      messageLength: message.length
    }
  });

  try {
    // Twilio API endpoint
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    // Basic auth credentials
    const credentials = btoa(`${accountSid}:${authToken}`);

    // Request body
    const body = new URLSearchParams({
      To: toFormatted,
      From: fromFormatted,
      Body: message
    });

    // Make request to Twilio
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.message || `Twilio API error: ${response.status}`;

      logError('Twilio API request failed', {
        functionName,
        correlationId,
        error: new Error(errorMessage),
        context: {
          status: response.status,
          twilioError: errorData
        }
      });

      return { success: false, error: errorMessage };
    }

    const data = await response.json();
    const messageId = data.sid;

    logInfo('SMS sent successfully', {
      functionName,
      correlationId,
      context: {
        messageId,
        to: toFormatted,
        status: data.status
      }
    });

    return { success: true, messageId };

  } catch (error) {
    logError('SMS send failed', {
      functionName,
      correlationId,
      error: error instanceof Error ? error : new Error(String(error))
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Format phone number to E.164 format (+1XXXXXXXXXX)
 * Handles various input formats
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If starts with 1 and has 11 digits, add +
  if (digits.length === 11 && digits[0] === '1') {
    return `+${digits}`;
  }

  // If has 10 digits, add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If already starts with +, return as-is
  if (phone.startsWith('+')) {
    return phone;
  }

  // Default: add + prefix
  return `+${digits}`;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
}
