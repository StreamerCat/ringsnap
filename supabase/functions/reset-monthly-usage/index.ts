import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { extractCorrelationId, logError, logInfo } from '../_shared/logging.ts';
import type { LogOptions } from '../_shared/logging.ts';

const FUNCTION_NAME = 'reset-monthly-usage';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16',
    });

    logInfo('Running monthly usage reset cron', {
      ...baseLogOptions
    });

    // Find accounts where billing cycle is today
    const today = new Date().toISOString().split('T')[0];
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('*, plan_definitions!inner(*)')
      .eq('billing_cycle_start', today)
      .eq('subscription_status', 'active');

    if (error) {
      logError('Error fetching accounts', {
        ...baseLogOptions,
        error
      });
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    logInfo('Processing accounts for reset', {
      ...baseLogOptions,
      context: { accountCount: accounts?.length || 0 }
    });

    for (const account of accounts || []) {
      try {
        logInfo('Processing account for monthly reset', {
          ...baseLogOptions,
          accountId: account.id
        });

        const overageMinutes = account.overage_minutes_used || 0;
        let totalOverageChargeCents = 0;

        // Calculate overage charges if any
        if (overageMinutes > 0) {
          const overageRateCents = account.plan_definitions?.overage_rate_cents || 0;
          totalOverageChargeCents = Math.round(overageMinutes * (overageRateCents / 100));

          logInfo('Calculated overage charges', {
            ...baseLogOptions,
            accountId: account.id,
            context: {
              overageMinutes,
              overageRateCents,
              totalOverageChargeCents
            }
          });

          // Create Stripe invoice line item
          if (account.stripe_customer_id && totalOverageChargeCents > 0) {
            await stripe.invoiceItems.create({
              customer: account.stripe_customer_id,
              amount: totalOverageChargeCents,
              currency: 'usd',
              description: `Overage charges: ${overageMinutes} minutes @ $${(overageRateCents / 100).toFixed(2)}/minute`,
            });

            // Apply available credits
            const { data: credits } = await supabase
              .from('account_credits')
              .select('*')
              .eq('account_id', account.id)
              .eq('status', 'available')
              .order('expires_at', { ascending: true });

            if (credits && credits.length > 0) {
              let remainingCharge = totalOverageChargeCents;
              
              for (const credit of credits) {
                if (remainingCharge <= 0) break;

                const creditAmount = Math.min(credit.amount_cents, remainingCharge);
                remainingCharge -= creditAmount;

                // Mark credit as applied
                await supabase
                  .from('account_credits')
                  .update({
                    status: 'applied',
                    applied_to_invoice_id: `overage_${today}`
                  })
                  .eq('id', credit.id);

                logInfo('Applied credit to overage charge', {
                  ...baseLogOptions,
                  accountId: account.id,
                  context: { creditAmount }
                });
              }
            }
          }
        }

        // Reset usage counters
        await supabase
          .from('accounts')
          .update({
            monthly_minutes_used: 0,
            overage_minutes_used: 0,
            last_usage_warning_sent_at: null,
            last_usage_warning_level: null,
            daily_sms_sent: 0,
            billing_cycle_start: getNextBillingDate(account.billing_cycle_start)
          })
          .eq('id', account.id);

        // Send usage summary email
        await sendUsageSummary(
          account,
          account.monthly_minutes_used || 0,
          overageMinutes,
          totalOverageChargeCents,
          baseLogOptions
        );

        logInfo('Account reset successfully', {
          ...baseLogOptions,
          accountId: account.id
        });

      } catch (accountError) {
        logError('Error processing account during reset', {
          ...baseLogOptions,
          accountId: account.id,
          error: accountError
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: accounts?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    logError('Reset cron error', {
      ...baseLogOptions,
      error
    });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function getNextBillingDate(currentDate: string): string {
  const date = new Date(currentDate);
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().split('T')[0];
}

async function sendUsageSummary(
  account: Record<string, unknown>,
  monthlyMinutes: number,
  overageMinutes: number,
  overageChargeCents: number,
  logOptions: Pick<LogOptions, 'functionName' | 'correlationId'>
) {
  logInfo('Usage summary email pending send', {
    ...logOptions,
    accountId: typeof account.id === 'string' ? account.id : null,
    context: {
      monthlyMinutes,
      overageMinutes,
      overageChargeCents
    }
  });
  // TODO: Integrate with Resend
}
