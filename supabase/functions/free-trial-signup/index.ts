import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isDisposableEmail } from "../_shared/disposable-domains.ts";
import { isValidPhoneNumber, isValidZipCode } from "../_shared/validators.ts";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";

const FUNCTION_NAME = "free-trial-signup";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { name, email, phone, companyName, deviceFingerprint } = await req.json();

    // Validate required fields
    if (!name || !email || !phone) {
      return new Response(
        JSON.stringify({ error: 'Name, email, and phone are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate phone format
    if (!isValidPhoneNumber(phone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Block disposable emails
    if (isDisposableEmail(email)) {
      logWarn('Blocked disposable email', {
        ...baseLogOptions,
        context: { email }
      });
      return new Response(
        JSON.stringify({ error: 'Please use a valid business or personal email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';

    // Check IP rate limiting (max 3 trials per IP in 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: ipAttempts } = await supabase
      .from('signup_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', clientIP)
      .eq('success', true)
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (ipAttempts && ipAttempts >= 3) {
      logWarn('IP rate limit exceeded for trial signup', {
        ...baseLogOptions,
        context: { clientIP, ipAttempts }
      });
      await supabase.from('signup_attempts').insert({
        email,
        phone,
        ip_address: clientIP,
        device_fingerprint: deviceFingerprint,
        success: false,
        blocked_reason: 'IP rate limit exceeded (3 trials per 30 days)',
      });
      return new Response(
        JSON.stringify({ error: 'Trial limit reached for this location. Please contact support.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check phone uniqueness (not used in last 30 days)
    const { data: recentPhoneUse } = await supabase
      .from('profiles')
      .select('created_at')
      .eq('phone', phone)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .maybeSingle();

    if (recentPhoneUse) {
      logWarn('Phone number recently used for trial signup', {
        ...baseLogOptions,
        context: { phone }
      });
      await supabase.from('signup_attempts').insert({
        email,
        phone,
        ip_address: clientIP,
        device_fingerprint: deviceFingerprint,
        success: false,
        blocked_reason: 'Phone number used within 30 days',
      });
      return new Response(
        JSON.stringify({ error: 'This phone number was recently used for a trial' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract email domain and determine company name
    const emailDomain = email.split('@')[1].toLowerCase();
    const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'protonmail.com', 'mail.com'];
    const isGeneric = genericDomains.includes(emailDomain);

    let finalCompanyName: string;
    if (isGeneric) {
      // Use provided company name, or fallback to email prefix
      finalCompanyName = companyName || email.split('@')[0];
    } else {
      // Business email - use domain
      finalCompanyName = emailDomain;
    }

    // Generate secure random password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const password = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    // Create auth user with metadata
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for trial signups
      user_metadata: {
        company_name: finalCompanyName,
        name,
        phone,
        source: 'website'
      }
    });

    if (authError) {
      logError('Auth error during free trial signup', {
        ...baseLogOptions,
        error: authError,
        context: { email }
      });
      await supabase.from('signup_attempts').insert({
        email,
        phone,
        ip_address: clientIP,
        device_fingerprint: deviceFingerprint,
        success: false,
        blocked_reason: authError.message,
      });
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logInfo('Trial user created successfully', {
      ...baseLogOptions,
      context: { userId: authData.user.id, email }
    });

    // Log successful signup
    await supabase.from('signup_attempts').insert({
      email,
      phone,
      ip_address: clientIP,
      device_fingerprint: deviceFingerprint,
      success: true,
    });

    return new Response(
      JSON.stringify({ 
        ok: true,
        user_id: authData.user.id,
        email: email,
        password: password, // Return password for instant login
        message: 'Trial signup successful. Redirecting to onboarding...'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError('Free trial signup error', {
      ...baseLogOptions,
      error
    });
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
