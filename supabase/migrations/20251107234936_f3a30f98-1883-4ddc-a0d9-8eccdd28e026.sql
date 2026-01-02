-- Create RLS policy for sales reps to view their assigned accounts
CREATE POLICY "Sales reps can view their assigned accounts"
ON accounts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM staff_roles sr
    JOIN profiles p ON p.id = sr.user_id
    WHERE sr.user_id = auth.uid()
    AND sr.role::text = 'sales'
    AND accounts.sales_rep_name = p.name
  )
);

-- Create RLS policy for sales reps to view account members of their accounts
CREATE POLICY "Sales reps can view members of their assigned accounts"
ON account_members
FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT a.id
    FROM accounts a
    JOIN staff_roles sr ON sr.user_id = auth.uid()
    JOIN profiles p ON p.id = sr.user_id
    WHERE sr.role::text = 'sales'
    AND a.sales_rep_name = p.name
  )
);

-- Create RLS policy for sales reps to view profiles in their accounts
CREATE POLICY "Sales reps can view profiles in their assigned accounts"
ON profiles
FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT a.id
    FROM accounts a
    JOIN staff_roles sr ON sr.user_id = auth.uid()
    JOIN profiles p ON p.id = sr.user_id
    WHERE sr.role::text = 'sales'
    AND a.sales_rep_name = p.name
  )
);