// Stripe Helper Functions
// Shared utilities for Stripe operations

import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Find or create a Stripe customer for an account
 * Maps account.id to Stripe customer metadata
 */
export async function ensureStripeCustomer(params: {
  accountId: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<string> {
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  // Check if account already has a Stripe customer
  const { data: account } = await supabase
    .from("accounts")
    .select("stripe_customer_id")
    .eq("id", params.accountId)
    .single();

  if (account?.stripe_customer_id) {
    // Verify customer exists in Stripe
    try {
      await stripe.customers.retrieve(account.stripe_customer_id);
      return account.stripe_customer_id;
    } catch (err) {
      console.warn("Stripe customer not found, creating new:", err);
    }
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      account_id: params.accountId,
      ...params.metadata,
    },
  });

  // Save customer ID to account
  await supabase
    .from("accounts")
    .update({ stripe_customer_id: customer.id })
    .eq("id", params.accountId);

  return customer.id;
}

/**
 * Create a Setup Intent for collecting payment method
 * Does not charge the customer
 */
export async function createSetupIntent(params: {
  customerId: string;
  accountId: string;
  userId: string;
}): Promise<Stripe.SetupIntent> {
  const setupIntent = await stripe.setupIntents.create({
    customer: params.customerId,
    usage: "off_session", // Can be used for future payments
    metadata: {
      account_id: params.accountId,
      user_id: params.userId,
    },
  });

  return setupIntent;
}

/**
 * Attach payment method to customer and set as default
 */
export async function attachPaymentMethod(params: {
  customerId: string;
  paymentMethodId: string;
  accountId: string;
}): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  // Attach payment method to customer
  await stripe.paymentMethods.attach(params.paymentMethodId, {
    customer: params.customerId,
  });

  // Set as default payment method
  await stripe.customers.update(params.customerId, {
    invoice_settings: {
      default_payment_method: params.paymentMethodId,
    },
  });

  // Update account: has_payment_method = true, trial_status = active
  await supabase
    .from("accounts")
    .update({
      has_payment_method: true,
      trial_status: "active",
      trial_type: "card_required", // Promote from cardless if applicable
    })
    .eq("id", params.accountId);

  // Log analytics event
  await supabase.rpc("log_trial_event", {
    p_account_id: params.accountId,
    p_event_type: "payment_method_added",
    p_event_data: { payment_method_id: params.paymentMethodId },
  });
}

export { stripe };
