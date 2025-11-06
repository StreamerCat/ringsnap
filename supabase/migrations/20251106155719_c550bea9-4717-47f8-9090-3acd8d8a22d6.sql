-- Create audit log table for tracking role changes
CREATE TABLE public.role_change_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by_user_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  old_role app_role,
  new_role app_role NOT NULL,
  change_type TEXT NOT NULL, -- 'added', 'updated', 'removed'
  context TEXT, -- 'internal_staff' or 'customer_team'
  account_id UUID REFERENCES public.accounts(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;

-- Only owners can view audit logs
CREATE POLICY "Owners can view all audit logs"
ON public.role_change_audit
FOR SELECT
USING (has_role(auth.uid(), 'owner'));

-- Account owners can view their account's audit logs
CREATE POLICY "Account owners can view their account audit logs"
ON public.role_change_audit
FOR SELECT
USING (
  account_id = get_user_account_id(auth.uid()) 
  AND has_role(auth.uid(), 'owner')
);

-- Create index for better query performance
CREATE INDEX idx_role_audit_target_user ON public.role_change_audit(target_user_id);
CREATE INDEX idx_role_audit_changed_by ON public.role_change_audit(changed_by_user_id);
CREATE INDEX idx_role_audit_account ON public.role_change_audit(account_id);