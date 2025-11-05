create table if not exists public.vapi_assistants (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  vapi_assistant_id text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.vapi_numbers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  vapi_number_id text not null,
  phone_e164 text not null,
  country text,
  created_at timestamptz not null default now()
);

create table if not exists public.provisioning_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  user_id uuid not null,
  status text not null default 'queued',
  step text,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.vapi_assistants disable row level security;
alter table if exists public.vapi_numbers disable row level security;
alter table if exists public.provisioning_jobs disable row level security;

alter table if exists public.accounts
  add column if not exists vapi_assistant_id text,
  add column if not exists vapi_number_id text,
  add column if not exists phone_number_e164 text;
