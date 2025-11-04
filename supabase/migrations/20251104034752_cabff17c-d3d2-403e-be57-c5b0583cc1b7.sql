-- Add SELECT policies to protect lead data tables

-- Policy for trial_signups: Only owners can view trial signups
CREATE POLICY "Only owners can view trial signups"
ON public.trial_signups
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Policy for revenue_report_leads: Only owners can view revenue reports
CREATE POLICY "Only owners can view revenue reports"
ON public.revenue_report_leads
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));