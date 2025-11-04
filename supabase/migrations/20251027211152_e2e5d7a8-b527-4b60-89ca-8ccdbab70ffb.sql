-- Create revenue_report_leads table to store calculator form submissions
CREATE TABLE public.revenue_report_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  name text NOT NULL,
  email text NOT NULL,
  business text NOT NULL,
  trade text,
  customer_calls integer,
  lost_revenue numeric,
  recovered_revenue numeric,
  net_gain numeric,
  roi numeric,
  payback_days integer
);

-- Enable Row Level Security
ALTER TABLE public.revenue_report_leads ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous inserts for revenue report leads
CREATE POLICY "Anyone can create revenue report leads"
ON public.revenue_report_leads
FOR INSERT
TO anon
WITH CHECK (true);