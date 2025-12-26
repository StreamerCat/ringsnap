-- Deduplicate signup_leads (keep most recent)
DELETE FROM public.signup_leads a
USING public.signup_leads b
WHERE a.id < b.id
AND a.email = b.email;

-- Add unique constraint to email
ALTER TABLE public.signup_leads
DROP CONSTRAINT IF EXISTS signup_leads_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_signup_leads_email_unique ON public.signup_leads(email);
-- Or a proper constraint
ALTER TABLE public.signup_leads
ADD CONSTRAINT signup_leads_email_key UNIQUE USING INDEX idx_signup_leads_email_unique;

-- Create RPC function to handle lead capture securely
CREATE OR REPLACE FUNCTION public.capture_signup_lead(
  p_email TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_signup_flow TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Run as owner to bypass RLS for this specific upsert operation
SET search_path = public
AS $$
DECLARE
  v_lead_id UUID;
  v_result JSONB;
BEGIN
  -- Normalize email
  p_email := lower(trim(p_email));

  INSERT INTO public.signup_leads (
    email,
    full_name,
    phone,
    source,
    signup_flow,
    metadata
  )
  VALUES (
    p_email,
    p_full_name,
    p_phone,
    p_source,
    p_signup_flow,
    p_metadata
  )
  ON CONFLICT (email) DO UPDATE
  SET
    full_name = COALESCE(EXCLUDED.full_name, signup_leads.full_name),
    phone = COALESCE(EXCLUDED.phone, signup_leads.phone),
    source = COALESCE(EXCLUDED.source, signup_leads.source),
    metadata = COALESCE(EXCLUDED.metadata, signup_leads.metadata),
    updated_at = NOW()
  RETURNING id INTO v_lead_id;

  v_result := jsonb_build_object(
    'id', v_lead_id,
    'email', p_email,
    'success', true
  );

  RETURN v_result;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.capture_signup_lead TO anon;
GRANT EXECUTE ON FUNCTION public.capture_signup_lead TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_signup_lead TO service_role;
