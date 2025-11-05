import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractCorrelationId, logError, logInfo } from "../_shared/logging.ts";

const FUNCTION_NAME = "stripe-webhook";

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

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

    // TODO: Verify webhook signature when STRIPE_WEBHOOK_SECRET is configured
    // For now, parse the event directly
    const event = JSON.parse(body);

    logInfo('Stripe webhook received', {
      ...baseLogOptions,
      context: { eventType: event.type }
    });

    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        // Find account
        const { data: account } = await supabase
          .from('accounts')
          .select('*')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (!account) break;

        currentAccountId = account.id;

        // Apply account credits to invoice
        const invoiceAmountCents = invoice.amount_due;
        
        const { data: credits } = await supabase
          .from('account_credits')
          .select('*')
          .eq('account_id', account.id)
          .eq('status', 'available')
          .order('expires_at', { ascending: true });

        let remainingAmount = invoiceAmountCents;
        
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
