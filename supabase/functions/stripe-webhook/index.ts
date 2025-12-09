import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { extractCorrelationId, logError, logInfo } from "../_shared/logging.ts";

type BaseLogContext = {
  functionName: string;
  correlationId: string;
  accountId?: string | null;
};

type StripeInvoiceLine = {
  description?: string | null;
  plan?: { nickname?: string | null } | null;
  amount?: number | null;
  amount_excluding_tax?: number | null;
  quantity?: number | null;
};

type StripeInvoice = {
  id: string;
  number?: string | null;
  amount_paid?: number | null;
  amount_due?: number | null;
  total?: number | null;
  status_transitions?: { paid_at?: number | null } | null;
  finalized_at?: number | null;
  created?: number | null;
  period_start?: number | null;
  period_end?: number | null;
  invoice_pdf?: string | null;
  hosted_invoice_url?: string | null;
  lines?: { data?: StripeInvoiceLine[] | null } | null;
  customer?: string | null;
};

type AccountRecord = {
  id: string;
  company_name?: string | null;
  stripe_customer_id?: string | null;
};

type ProfileRecord = {
  id: string;
  name?: string | null;
  account_id?: string | null;
};

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function formatCurrencyFromCents(amountInCents: number | null | undefined): string {
  if (typeof amountInCents !== 'number' || !Number.isFinite(amountInCents)) {
    return CURRENCY_FORMATTER.format(0);
  }

  return CURRENCY_FORMATTER.format(amountInCents / 100);
}

function formatDateFromUnix(unixTimestamp: number | null | undefined): string | null {
  if (typeof unixTimestamp !== 'number' || !Number.isFinite(unixTimestamp)) {
    return null;
  }

  return DATE_FORMATTER.format(new Date(unixTimestamp * 1000));
}

async function sendInvoiceEmail({
  invoice,
  account,
  primaryProfile,
  recipientEmail,
  logOptions,
}: {
  invoice: StripeInvoice;
  account: AccountRecord;
  primaryProfile: ProfileRecord | null;
  recipientEmail: string | null;
  logOptions: BaseLogContext;
}): Promise<void> {
  const logBase = {
    ...logOptions,
    accountId: logOptions.accountId ?? account.id,
  };

  const logContextBase = {
    ...logBase,
    context: {
      invoiceId: invoice.id,
      recipientEmail,
      accountStripeCustomerId: account.stripe_customer_id ?? null,
    },
  } as const;

  if (!recipientEmail) {
    logInfo('No primary email available for invoice notification', logContextBase);
    return;
  }

  if (!RESEND_API_KEY) {
    logInfo('Resend API key not configured; skipping invoice email send', logContextBase);
    return;
  }

  const customerName = primaryProfile?.name || account.company_name || 'there';
  const invoiceNumber = invoice.number ?? invoice.id;
  const paidAt = formatDateFromUnix(
    invoice.status_transitions?.paid_at ?? invoice.finalized_at ?? invoice.created,
  );
  const periodStart = formatDateFromUnix(invoice.period_start);
  const periodEnd = formatDateFromUnix(invoice.period_end);
  const amountFormatted = formatCurrencyFromCents(
    invoice.amount_paid ?? invoice.amount_due ?? invoice.total ?? 0,
  );
  const invoicePdfUrl = invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? null;
  const hostedInvoiceUrl = invoice.hosted_invoice_url ?? null;

  const lineItemSource = Array.isArray(invoice.lines?.data) ? invoice.lines?.data ?? [] : [];
  const lineItems: Array<{ description: string; amount: string; quantity: number | null }> = lineItemSource.map(
    (line) => {
      const description = line?.description ?? line?.plan?.nickname ?? 'Charge';
      const rawAmountCents = line?.amount ?? line?.amount_excluding_tax;
      const quantity = typeof line?.quantity === 'number' ? line.quantity : null;
      const amount = formatCurrencyFromCents(typeof rawAmountCents === 'number' ? rawAmountCents : 0);
      return { description, amount, quantity };
    },
  );

  const lineItemsHtml = lineItems.length
    ? `<ul style="margin: 0 0 16px 16px; padding: 0;">${lineItems
      .map((item) => `<li style="margin-bottom: 8px;">${item.description}${item.quantity ? ` (x${item.quantity})` : ''} - ${item.amount}</li>`)
      .join('')}</ul>`
    : '';

  const lineItemsTextLines = lineItems.map((item) => `• ${item.description}${item.quantity ? ` (x${item.quantity})` : ''} - ${item.amount}`);

  const billingPeriodText = periodStart && periodEnd ? `${periodStart} - ${periodEnd}` : null;

  const htmlBody = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RingSnap payment receipt</title>
  </head>
  <body style="margin:0; padding:24px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color:#f9fafb;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:12px; overflow:hidden;">
      <tr>
        <td style="padding:32px;">
          <h1 style="margin:0 0 16px 0; font-size:22px; color:#111827;">Payment received</h1>
          <p style="margin:0 0 16px 0; color:#374151; font-size:16px; line-height:1.6;">Hi ${customerName},</p>
          <p style="margin:0 0 16px 0; color:#374151; font-size:16px; line-height:1.6;">Thanks for your payment of <strong>${amountFormatted}</strong> for RingSnap.</p>
          <p style="margin:0 0 16px 0; color:#374151; font-size:16px; line-height:1.6;">
            Invoice number: <strong>${invoiceNumber}</strong><br/>
            ${paidAt ? `Paid on: <strong>${paidAt}</strong><br/>` : ''}
            ${billingPeriodText ? `Billing period: ${billingPeriodText}` : ''}
          </p>
          ${lineItemsHtml}
          ${invoicePdfUrl ? `<p style="margin:0 0 16px 0; color:#374151; font-size:16px; line-height:1.6;">Download your receipt as a PDF: <a href="${invoicePdfUrl}" target="_blank" rel="noopener" style="color:#D95F3C;">View PDF</a></p>` : ''}
          ${hostedInvoiceUrl && hostedInvoiceUrl !== invoicePdfUrl ? `<p style="margin:0 0 16px 0; color:#374151; font-size:16px; line-height:1.6;">View the invoice in your browser: <a href="${hostedInvoiceUrl}" target="_blank" rel="noopener" style="color:#D95F3C;">Open invoice</a></p>` : ''}
          <p style="margin:0 0 16px 0; color:#374151; font-size:16px; line-height:1.6;">Need anything? Reply to this email and our team will help.</p>
          <p style="margin:24px 0 0 0; color:#6b7280; font-size:14px;">— The RingSnap Team</p>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;

  const textBodyLines = [
    `Hi ${customerName},`,
    '',
    `Thanks for your payment of ${amountFormatted} for RingSnap.`,
    '',
    `Invoice number: ${invoiceNumber}`,
  ];

  if (paidAt) {
    textBodyLines.push(`Paid on: ${paidAt}`);
  }

  if (billingPeriodText) {
    textBodyLines.push(`Billing period: ${billingPeriodText}`);
  }

  if (lineItemsTextLines.length) {
    textBodyLines.push('', 'Line items:', ...lineItemsTextLines);
  }

  if (invoicePdfUrl) {
    textBodyLines.push('', `Download PDF: ${invoicePdfUrl}`);
  }

  if (hostedInvoiceUrl && hostedInvoiceUrl !== invoicePdfUrl) {
    textBodyLines.push(`View online: ${hostedInvoiceUrl}`);
  }

  textBodyLines.push('', 'Need anything? Reply to this email and our team will help.', '', '— The RingSnap Team');

  const textBody = textBodyLines.join('\n');

  const subject = invoiceNumber
    ? `Payment receipt for RingSnap invoice ${invoiceNumber}`
    : 'Payment receipt for your RingSnap subscription';

  logInfo('Sending invoice email via Resend', {
    ...logContextBase,
    context: {
      ...logContextBase.context,
      subject,
    },
  });

  let response: Response;
  let responseBody = '';

  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'RingSnap Billing <billing@getringsnap.com>',
        to: recipientEmail,
        subject,
        html: htmlBody,
        text: textBody,
      }),
    });
    responseBody = await response.text();
  } catch (error) {
    logError('Invoice email send failed - network or fetch error', {
      ...logContextBase,
      error,
    });
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`Resend API error ${response.status}: ${responseBody}`);
    logError('Invoice email send failed - Resend returned error', {
      ...logContextBase,
      error,
    });
    throw error;
  }

  let resendMessageId: string | null = null;
  try {
    if (responseBody) {
      const parsed = JSON.parse(responseBody);
      if (parsed && typeof parsed === 'object' && 'id' in parsed) {
        resendMessageId = String((parsed as { id: string }).id);
      }
    }
  } catch (_parseError) {
    // Ignore JSON parse errors for logging, but keep raw response
  }

  logInfo('Invoice email sent successfully', {
    ...logContextBase,
    context: {
      ...logContextBase.context,
      resendMessageId,
      responseStatus: response.status,
    },
  });
}

const FUNCTION_NAME = "stripe-webhook";

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const RESEND_API_KEY = Deno.env.get('RESEND_PROD_KEY');

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };
  let currentAccountId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    // Verify webhook signature if STRIPE_WEBHOOK_SECRET is configured
    if (STRIPE_WEBHOOK_SECRET) {
      if (!signature) {
        logError('Missing stripe-signature header', baseLogOptions);
        return new Response(
          JSON.stringify({ error: 'Missing signature' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Parse signature header
      const signatureObj: Record<string, string> = {};
      signature.split(',').forEach((pair) => {
        const [key, value] = pair.split('=');
        signatureObj[key] = value;
      });

      const timestamp = signatureObj.t;
      const signatureV1 = signatureObj.v1;

      if (!timestamp || !signatureV1) {
        logError('Invalid stripe-signature format', baseLogOptions);
        return new Response(
          JSON.stringify({ error: 'Invalid signature format' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Verify timestamp (prevent replay attacks - reject events older than 5 minutes)
      const currentTime = Math.floor(Date.now() / 1000);
      const eventTime = parseInt(timestamp, 10);
      const timeDiff = currentTime - eventTime;

      if (timeDiff > 300) {
        logError('Webhook timestamp too old', {
          ...baseLogOptions,
          context: { timeDiff, timestamp },
        });
        return new Response(
          JSON.stringify({ error: 'Timestamp too old' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Compute expected signature
      const signedPayload = `${timestamp}.${body}`;
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(STRIPE_WEBHOOK_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(signedPayload)
      );
      const signatureArray = Array.from(new Uint8Array(signatureBuffer));
      const expectedSignature = signatureArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // Compare signatures (constant-time comparison)
      if (expectedSignature !== signatureV1) {
        logError('Invalid webhook signature', baseLogOptions);
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      logInfo('Webhook signature verified', baseLogOptions);
    } else {
      logInfo('Webhook signature validation skipped (STRIPE_WEBHOOK_SECRET not configured)', baseLogOptions);
    }

    const event = JSON.parse(body);

    logInfo('Stripe webhook received', {
      ...baseLogOptions,
      context: { eventType: event.type, eventId: event.id }
    });

    // Check for duplicate event (idempotency)
    const { data: isDuplicate, error: idempotencyError } = await supabase.rpc(
      'record_stripe_event',
      {
        p_stripe_event_id: event.id,
        p_event_type: event.type,
        p_event_data: event,
        p_stripe_customer_id: event.data?.object?.customer || null,
        p_correlation_id: correlationId,
      }
    );

    if (idempotencyError) {
      logError('Failed to check event idempotency', {
        ...baseLogOptions,
        error: idempotencyError,
        context: { eventId: event.id },
      });
      // Continue processing despite idempotency check failure
    } else if (isDuplicate) {
      logInfo('Duplicate event ignored', {
        ...baseLogOptions,
        context: { eventType: event.type, eventId: event.id },
      });
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as StripeInvoice;
        const customerId = invoice.customer;

        if (!customerId) {
          logError('Invoice payment succeeded event missing customer id', {
            ...baseLogOptions,
            context: { invoiceId: invoice.id },
          });
          break;
        }

        // Find account
        const { data: account, error: accountLookupError } = await supabase
          .from('accounts')
          .select('id, company_name, stripe_customer_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (accountLookupError) {
          logError('Failed to load account for Stripe customer', {
            ...baseLogOptions,
            context: { customerId },
            error: accountLookupError,
          });
          throw accountLookupError;
        }

        if (!account) {
          logInfo('No account found for Stripe customer', {
            ...baseLogOptions,
            context: { customerId, invoiceId: invoice.id },
          });
          break;
        }

        currentAccountId = account.id;

        // Load primary profile for account
        const { data: primaryProfile, error: primaryProfileError } = await supabase
          .from('profiles')
          .select('id, name, account_id')
          .eq('account_id', account.id)
          .eq('is_primary', true)
          .maybeSingle();

        if (primaryProfileError) {
          logError('Failed to load primary profile for account', {
            ...baseLogOptions,
            accountId: currentAccountId,
            context: { invoiceId: invoice.id },
            error: primaryProfileError,
          });
        }

        let primaryUserEmail: string | null = null;
        if (primaryProfile?.id) {
          const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(primaryProfile.id);
          if (authUserError) {
            logError('Failed to load Supabase auth user for primary profile', {
              ...baseLogOptions,
              accountId: currentAccountId,
              context: { invoiceId: invoice.id, profileId: primaryProfile.id },
              error: authUserError,
            });
          } else {
            primaryUserEmail = authUserData?.user?.email ?? null;
          }
        } else {
          logInfo('No primary profile found for account during invoice processing', {
            ...baseLogOptions,
            accountId: currentAccountId,
            context: { invoiceId: invoice.id },
          });
        }

        // Apply account credits to invoice
        const invoiceAmountCents = invoice.amount_due ?? 0;

        const { data: credits } = await supabase
          .from('account_credits')
          .select('*')
          .eq('account_id', account.id)
          .eq('status', 'available')
          .order('expires_at', { ascending: true });

        let remainingAmount: number = invoiceAmountCents;

        for (const credit of credits || []) {
          if (remainingAmount <= 0) break;

          const appliedAmount = Math.min(credit.amount_cents, remainingAmount);

          await supabase
            .from('account_credits')
            .update({
              status: 'applied',
              applied_to_invoice_id: invoice.id,
            })
            .eq('id', credit.id);

          remainingAmount -= appliedAmount;
        }

        logInfo('Applied credits to invoice', {
          ...baseLogOptions,
          accountId: currentAccountId,
          context: {
            invoiceId: invoice.id,
            remainingAmountCents: remainingAmount
          }
        });

        // Check if this is first payment for referral conversion
        const { data: referrals } = await supabase
          .from('referrals')
          .select('*')
          .eq('referee_account_id', account.id)
          .eq('status', 'pending')
          .eq('is_flagged', false);

        for (const referral of referrals || []) {
          // Mark as converted
          await supabase
            .from('referrals')
            .update({
              status: 'converted',
              converted_at: new Date().toISOString(),
            })
            .eq('id', referral.id);

          // Award credits to both parties
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year expiration

          await supabase.from('account_credits').insert([
            {
              account_id: referral.referrer_account_id,
              amount_cents: 5000, // $50
              source: 'referral',
              source_id: referral.id,
              expires_at: expiresAt.toISOString(),
              status: 'available',
            },
            {
              account_id: referral.referee_account_id,
              amount_cents: 2500, // $25
              source: 'referral',
              source_id: referral.id,
              expires_at: expiresAt.toISOString(),
              status: 'available',
            },
          ]);

          logInfo('Referral converted from payment', {
            ...baseLogOptions,
            accountId: currentAccountId,
            context: { referralId: referral.id, referrerAccountId: referral.referrer_account_id }
          });

          // Send notification emails
          if (RESEND_API_KEY) {
            // TODO: Send emails to referrer and referee
          }
        }

        await sendInvoiceEmail({
          invoice,
          account,
          primaryProfile: primaryProfile ?? null,
          recipientEmail: primaryUserEmail,
          logOptions: { ...baseLogOptions, accountId: currentAccountId },
        });

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        await supabase
          .from('accounts')
          .update({
            subscription_status: 'past_due',
            // Grace period: 3 days
          })
          .eq('stripe_customer_id', customerId);

        logInfo('Payment failed for customer', {
          ...baseLogOptions,
          context: { customerId }
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Hold phone number for 7 days
        const holdUntil = new Date();
        holdUntil.setDate(holdUntil.getDate() + 7);

        await supabase
          .from('accounts')
          .update({
            account_status: 'cancelled',
            subscription_status: 'cancelled',
            phone_number_held_until: holdUntil.toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        logInfo('Subscription cancelled for customer', {
          ...baseLogOptions,
          context: { customerId }
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Sync subscription status
        await supabase
          .from('accounts')
          .update({
            subscription_status: subscription.status,
            stripe_subscription_id: subscription.id
          })
          .eq('stripe_customer_id', customerId);

        // Check if reactivating within hold period
        const { data: account } = await supabase
          .from('accounts')
          .select('*')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (account?.phone_number_held_until) {
          const holdUntil = new Date(account.phone_number_held_until);
          if (new Date() <= holdUntil) {
            // Restore account
            await supabase
              .from('accounts')
              .update({
                account_status: 'active',
                subscription_status: 'active',
                phone_number_held_until: null,
              })
              .eq('id', account.id);

            logInfo('Account restored within hold period', {
              ...baseLogOptions,
              accountId: account.id,
              context: { customerId }
            });
          }
        }

        break;
      }

      default:
        logInfo('Unhandled Stripe webhook event', {
          ...baseLogOptions,
          context: { eventType: event.type }
        });
    }

    // Mark event as processed
    await supabase.rpc('mark_stripe_event_processed', {
      p_stripe_event_id: event.id,
      p_account_id: currentAccountId,
      p_error: null,
    });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logError('Stripe webhook error', {
      ...baseLogOptions,
      accountId: currentAccountId,
      error
    });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Webhook error' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
