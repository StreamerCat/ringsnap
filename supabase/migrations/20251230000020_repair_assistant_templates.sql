-- Repair migration to ensure assistant_templates table and helper function exist
-- This is a safety measure for cases where 20251207150000_create_assistant_templates.sql was not applied
-- 1. Ensure assistant_templates table exists
CREATE TABLE IF NOT EXISTS public.assistant_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    trade TEXT NOT NULL,
    template_body TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    source TEXT DEFAULT 'system_generated' CHECK (source IN ('system_generated', 'custom')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- Ensure only one default template per trade per account
    UNIQUE(account_id, trade, is_default)
);
-- Enable RLS
ALTER TABLE public.assistant_templates ENABLE ROW LEVEL SECURITY;
-- 2. Ensure helper function exists
CREATE OR REPLACE FUNCTION public.get_account_template(_account_id UUID, _trade TEXT) RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
SELECT template_body
FROM public.assistant_templates
WHERE account_id = _account_id
    AND trade = _trade
ORDER BY is_default DESC,
    created_at DESC
LIMIT 1;
$$;
-- 3. Ensure RLS Policies exist
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'assistant_templates'
        AND policyname = 'Users can view their account templates'
) THEN CREATE POLICY "Users can view their account templates" ON public.assistant_templates FOR
SELECT TO authenticated USING (
        account_id = public.get_user_account_id(auth.uid())
    );
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'assistant_templates'
        AND policyname = 'Owners and admins can manage account templates'
) THEN CREATE POLICY "Owners and admins can manage account templates" ON public.assistant_templates FOR ALL TO authenticated USING (
    account_id = public.get_user_account_id(auth.uid())
    AND (
        public.has_role(auth.uid(), 'owner')
        OR public.has_role(auth.uid(), 'admin')
    )
);
END IF;
END $$;
-- 4. Ensure trigger for updated_at exists
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_assistant_templates_updated_at'
) THEN CREATE TRIGGER update_assistant_templates_updated_at BEFORE
UPDATE ON public.assistant_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
END IF;
END $$;