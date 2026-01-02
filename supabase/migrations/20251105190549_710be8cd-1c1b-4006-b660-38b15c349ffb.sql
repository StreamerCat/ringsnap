-- =====================================================
-- BATCH 3: COMPLETE MVP SCHEMA
-- Plan-based limits, multi-assistant, anti-abuse, referrals, SMS, recording
-- =====================================================

-- 1. PLAN DEFINITIONS TABLE
CREATE TABLE plan_definitions (
  plan_type TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_minutes_limit INTEGER NOT NULL,
  max_phone_numbers INTEGER NOT NULL,
  max_assistants INTEGER NOT NULL,
  call_recording_enabled BOOLEAN DEFAULT false,
  sms_enabled BOOLEAN DEFAULT false,
  price_cents INTEGER NOT NULL,
  overage_rate_cents INTEGER NOT NULL,
  stripe_price_id TEXT
);

-- Seed plans with correct limits and overage rates
INSERT INTO plan_definitions VALUES
  ('trial', 'Free Trial', 150, 1, 1, false, false, 0, 0, NULL),
  ('starter', 'Starter', 500, 1, 1, false, false, 29700, 90, 'price_starter_monthly'),
  ('professional', 'Professional', 1000, 5, 3, true, true, 79700, 70, 'price_pro_monthly'),
  ('premium', 'Premium', 2500, 5, 5, true, true, 149700, 50, 'price_premium_monthly');

-- 2. EXTEND ACCOUNTS TABLE
ALTER TABLE accounts 
  ADD COLUMN monthly_minutes_limit INTEGER DEFAULT 150,
  ADD COLUMN monthly_minutes_used INTEGER DEFAULT 0,
  ADD COLUMN overage_minutes_used INTEGER DEFAULT 0,
  ADD COLUMN billing_cycle_start DATE DEFAULT CURRENT_DATE,
  ADD COLUMN overage_cap_percentage INTEGER DEFAULT 200,
  ADD COLUMN last_usage_warning_sent_at TIMESTAMPTZ,
  ADD COLUMN last_usage_warning_level TEXT CHECK (last_usage_warning_level IN ('80', '95', '100', 'cap')),
  ADD COLUMN account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'disabled', 'cancelled')),
  ADD COLUMN zip_code TEXT,
  ADD COLUMN assistant_gender TEXT DEFAULT 'female' CHECK (assistant_gender IN ('male', 'female')),
  ADD COLUMN phone_number_area_code TEXT,
  ADD COLUMN phone_number_status TEXT DEFAULT 'pending' CHECK (phone_number_status IN ('pending', 'active', 'suspended', 'held', 'released')),
  ADD COLUMN phone_number_held_until TIMESTAMPTZ,
  ADD COLUMN call_recording_enabled BOOLEAN DEFAULT false,
  ADD COLUMN call_recording_consent_accepted BOOLEAN DEFAULT false,
  ADD COLUMN call_recording_consent_date TIMESTAMPTZ,
  ADD COLUMN call_recording_retention_days INTEGER DEFAULT 30,
  ADD COLUMN billing_state TEXT,
  ADD COLUMN company_website TEXT,
  ADD COLUMN service_specialties TEXT,
  ADD COLUMN custom_instructions TEXT CHECK (LENGTH(custom_instructions) <= 500),
  ADD COLUMN sms_enabled BOOLEAN DEFAULT false,
  ADD COLUMN sms_appointment_confirmations BOOLEAN DEFAULT true,
  ADD COLUMN sms_reminders BOOLEAN DEFAULT true,
  ADD COLUMN daily_sms_quota INTEGER DEFAULT 100,
  ADD COLUMN daily_sms_sent INTEGER DEFAULT 0,
  ADD COLUMN signup_ip TEXT,
  ADD COLUMN device_fingerprint TEXT,
  ADD COLUMN is_flagged_for_review BOOLEAN DEFAULT false,
  ADD COLUMN flagged_reason TEXT,
  ADD COLUMN phone_verified BOOLEAN DEFAULT false,
  ADD COLUMN email_verified BOOLEAN DEFAULT false;

-- 3. EXTEND SIGNUP LEADS TABLE (lead capture before full account creation)
-- Note: accounts table already has assistant_gender and zip_code (added above)
-- These columns on signup_leads capture preferences during lead collection
ALTER TABLE signup_leads
  ADD COLUMN IF NOT EXISTS assistant_gender TEXT CHECK (assistant_gender IN ('male', 'female')),
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- 4. PHONE NUMBERS TABLE (Multi-phone support)
CREATE TABLE phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  area_code TEXT NOT NULL,
  vapi_phone_id TEXT UNIQUE,
  label TEXT,
  purpose TEXT CHECK (purpose IN ('primary', 'secondary', 'spanish', 'overflow', 'after-hours')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'held', 'released')),
  held_until TIMESTAMPTZ,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_phone_numbers_primary ON phone_numbers(account_id, is_primary) WHERE is_primary = true;

-- 5. ASSISTANTS TABLE (Multi-assistant support)
CREATE TABLE assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  vapi_assistant_id TEXT UNIQUE,
  voice_id TEXT NOT NULL,
  voice_gender TEXT CHECK (voice_gender IN ('male', 'female')),
  language TEXT DEFAULT 'en-US',
  custom_instructions TEXT CHECK (LENGTH(custom_instructions) <= 500),
  is_primary BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_assistants_primary ON assistants(account_id, is_primary) WHERE is_primary = true;

-- 6. VOICE LIBRARY TABLE
CREATE TABLE voice_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'elevenlabs',
  voice_id TEXT NOT NULL UNIQUE,
  voice_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'neutral')),
  accent TEXT,
  tone TEXT,
  sample_url TEXT,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default voices
INSERT INTO voice_library (voice_id, voice_name, gender, accent, tone) VALUES
  ('jennifer-professional', 'Sarah', 'female', 'american', 'professional'),
  ('michael-professional', 'Michael', 'male', 'american', 'professional');

-- 7. STATE RECORDING LAWS TABLE
CREATE TABLE state_recording_laws (
  state_code TEXT PRIMARY KEY,
  state_name TEXT NOT NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('one-party', 'two-party', 'all-party')),
  requires_notification BOOLEAN DEFAULT true,
  notification_text TEXT DEFAULT 'This call may be recorded for quality and training purposes.'
);

-- Seed two-party consent states (11 states)
INSERT INTO state_recording_laws VALUES
  ('CA', 'California', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('CT', 'Connecticut', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('FL', 'Florida', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('IL', 'Illinois', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('MD', 'Maryland', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('MA', 'Massachusetts', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('MT', 'Montana', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('NH', 'New Hampshire', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('PA', 'Pennsylvania', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('WA', 'Washington', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('HI', 'Hawaii', 'two-party', true, 'This call may be recorded for quality and training purposes.');

-- 8. ANTI-ABUSE: SIGNUP ATTEMPTS TABLE
CREATE TABLE signup_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT,
  ip_address TEXT NOT NULL,
  device_fingerprint TEXT,
  success BOOLEAN DEFAULT false,
  blocked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_signup_attempts_ip ON signup_attempts(ip_address, created_at);
CREATE INDEX idx_signup_attempts_email ON signup_attempts(email, created_at);

-- 9. ANTI-ABUSE: CALL PATTERN ALERTS TABLE
CREATE TABLE call_pattern_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  alert_type TEXT NOT NULL,
  alert_details JSONB,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  auto_flagged BOOLEAN DEFAULT false,
  reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_call_pattern_alerts_account ON call_pattern_alerts(account_id, created_at);

-- 10. REFERRAL CODES TABLE
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_referral_codes_account ON referral_codes(account_id);

-- 11. REFERRALS TABLE
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_account_id UUID REFERENCES accounts(id),
  referee_account_id UUID REFERENCES accounts(id),
  referral_code TEXT REFERENCES referral_codes(code),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'expired')),
  referrer_credit_cents INTEGER DEFAULT 5000,
  referee_credit_cents INTEGER DEFAULT 2500,
  referee_signup_ip TEXT,
  referee_phone TEXT,
  referee_email TEXT,
  is_flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_account_id);
CREATE INDEX idx_referrals_referee ON referrals(referee_account_id);

-- 12. ACCOUNT CREDITS TABLE
CREATE TABLE account_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  amount_cents INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('referral', 'promotion', 'refund', 'compensation')),
  source_id UUID,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'applied', 'expired')),
  applied_to_invoice_id TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_account_credits_account ON account_credits(account_id, status);

-- 13. SMS MESSAGES TABLE
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  phone_number_id UUID REFERENCES phone_numbers(id),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  message_body TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'pending')),
  vapi_message_id TEXT,
  conversation_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sms_messages_account ON sms_messages(account_id, created_at);

-- 14. EXTEND USAGE LOGS TABLE
ALTER TABLE usage_logs
  ADD COLUMN assistant_id UUID REFERENCES assistants(id),
  ADD COLUMN phone_number_id UUID REFERENCES phone_numbers(id),
  ADD COLUMN recording_url TEXT,
  ADD COLUMN recording_duration_seconds INTEGER,
  ADD COLUMN recording_expires_at TIMESTAMPTZ,
  ADD COLUMN was_transferred BOOLEAN DEFAULT false,
  ADD COLUMN was_emergency BOOLEAN DEFAULT false,
  ADD COLUMN appointment_booked BOOLEAN DEFAULT false,
  ADD COLUMN is_overage BOOLEAN DEFAULT false;

-- 15. UPDATE TRIGGERS FOR TIMESTAMPS
CREATE TRIGGER update_phone_numbers_updated_at
  BEFORE UPDATE ON phone_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assistants_updated_at
  BEFORE UPDATE ON assistants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();