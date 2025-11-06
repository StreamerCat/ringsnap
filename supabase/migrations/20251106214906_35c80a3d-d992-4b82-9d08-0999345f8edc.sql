-- Enable Row Level Security on all unprotected tables
ALTER TABLE public.account_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_pattern_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

-- Account Credits Policies
CREATE POLICY "Users can view their account credits"
  ON public.account_credits FOR SELECT
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Platform owners can manage all credits"
  ON public.account_credits FOR ALL
  USING (has_platform_role(auth.uid(), 'platform_owner'::staff_role));

-- Assistants Policies
CREATE POLICY "Users can view their account assistants"
  ON public.assistants FOR SELECT
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Users can manage their account assistants"
  ON public.assistants FOR ALL
  USING (account_id = get_user_account_id(auth.uid()));

-- Call Pattern Alerts Policies
CREATE POLICY "Platform owners can view all alerts"
  ON public.call_pattern_alerts FOR SELECT
  USING (has_platform_role(auth.uid(), 'platform_owner'::staff_role));

CREATE POLICY "Users can view their account alerts"
  ON public.call_pattern_alerts FOR SELECT
  USING (account_id = get_user_account_id(auth.uid()));

-- Phone Numbers Policies
CREATE POLICY "Users can view their account phone numbers"
  ON public.phone_numbers FOR SELECT
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Users can manage their account phone numbers"
  ON public.phone_numbers FOR ALL
  USING (account_id = get_user_account_id(auth.uid()));

-- Plan Definitions Policies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view plan definitions"
  ON public.plan_definitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Platform owners can manage plan definitions"
  ON public.plan_definitions FOR ALL
  USING (has_platform_role(auth.uid(), 'platform_owner'::staff_role));

-- Referral Codes Policies
CREATE POLICY "Users can view their own referral codes"
  ON public.referral_codes FOR SELECT
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Platform owners can manage all referral codes"
  ON public.referral_codes FOR ALL
  USING (has_platform_role(auth.uid(), 'platform_owner'::staff_role));

-- Referrals Policies
CREATE POLICY "Users can view their referrals as referrer"
  ON public.referrals FOR SELECT
  USING (referrer_account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Users can view their referrals as referee"
  ON public.referrals FOR SELECT
  USING (referee_account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Platform owners can manage all referrals"
  ON public.referrals FOR ALL
  USING (has_platform_role(auth.uid(), 'platform_owner'::staff_role));

-- Signup Attempts Policies (admin only)
CREATE POLICY "Platform owners can view all signup attempts"
  ON public.signup_attempts FOR SELECT
  USING (has_platform_role(auth.uid(), 'platform_owner'::staff_role));

-- SMS Messages Policies
CREATE POLICY "Users can view their account SMS messages"
  ON public.sms_messages FOR SELECT
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Users can send SMS from their account"
  ON public.sms_messages FOR INSERT
  WITH CHECK (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Platform owners can view all SMS messages"
  ON public.sms_messages FOR SELECT
  USING (has_platform_role(auth.uid(), 'platform_owner'::staff_role));