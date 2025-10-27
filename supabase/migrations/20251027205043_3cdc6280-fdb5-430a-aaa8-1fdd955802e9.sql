-- Create trial signups table
CREATE TABLE public.trial_signups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  wants_advanced_voice BOOLEAN DEFAULT false,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT trial_signups_email_unique UNIQUE (email),
  CONSTRAINT trial_signups_email_check CHECK (char_length(email) <= 255),
  CONSTRAINT trial_signups_name_check CHECK (char_length(name) <= 100),
  CONSTRAINT trial_signups_phone_check CHECK (char_length(phone) <= 20)
);

-- Enable RLS
ALTER TABLE public.trial_signups ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (for signup form)
CREATE POLICY "Anyone can create trial signups"
  ON public.trial_signups
  FOR INSERT
  WITH CHECK (true);

-- Create index for email lookups
CREATE INDEX trial_signups_email_idx ON public.trial_signups(email);
CREATE INDEX trial_signups_created_at_idx ON public.trial_signups(created_at DESC);