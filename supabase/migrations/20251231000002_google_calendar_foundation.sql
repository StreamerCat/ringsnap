-- Migration: Google Calendar Foundation (Phase 2 Placeholder)
-- Description: Core table for storing encrypted calendar tokens/IDs.
-- Note: No UI or logic uses this yet. Safe foundation only.
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
    -- Auth Data (Encrypted at rest advisable, but here just storage)
    refresh_token_encrypted TEXT,
    calendar_id TEXT,
    -- Connection Status
    status TEXT DEFAULT 'disconnected' CHECK (
        status IN ('connected', 'disconnected', 'expired')
    ),
    -- Metadata
    connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view calendar connection" ON public.google_calendar_connections;
CREATE POLICY "Users can view calendar connection" ON public.google_calendar_connections FOR
SELECT TO authenticated USING (
        account_id = public.get_user_account_id(auth.uid())
    );
-- Trigger
DROP TRIGGER IF EXISTS update_google_calendar_updated_at ON public.google_calendar_connections;
CREATE TRIGGER update_google_calendar_updated_at BEFORE
UPDATE ON public.google_calendar_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();