
-- Create assistant_templates table
CREATE TABLE IF NOT EXISTS public.assistant_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  trade TEXT NOT NULL,
  template_body TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'system_generated' CHECK (source IN ('system_generated', 'custom')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure only one default template per trade per account (though usually one account has one trade)
  UNIQUE(account_id, trade, is_default)
);

-- Enable RLS
ALTER TABLE public.assistant_templates ENABLE ROW LEVEL SECURITY;

-- Helper function to get the current default template for an account
CREATE OR REPLACE FUNCTION public.get_account_template(_account_id UUID, _trade TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT template_body
  FROM public.assistant_templates
  WHERE account_id = _account_id
    AND trade = _trade
  ORDER BY is_default DESC, created_at DESC
  LIMIT 1;
$$;

-- RLS Policies
CREATE POLICY "Users can view their account templates"
  ON public.assistant_templates FOR SELECT
  TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid()));

CREATE POLICY "Owners and admins can manage account templates"
  ON public.assistant_templates FOR ALL
  TO authenticated
  USING (
    account_id = public.get_user_account_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  );

-- Trigger for updated_at
CREATE TRIGGER update_assistant_templates_updated_at
  BEFORE UPDATE ON public.assistant_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
