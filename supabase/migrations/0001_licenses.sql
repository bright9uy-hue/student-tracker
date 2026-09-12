-- Licenses table for the student-tracker paid-activation system.
-- No RLS policies are defined on purpose: with row level security enabled
-- and zero policies, anon/authenticated clients get zero access (default
-- deny). The verify-license Edge Function is the only reader/writer, and
-- it connects with the service_role key, which bypasses RLS entirely.

create table if not exists public.licenses (
    key text primary key,
    parent_key text references public.licenses(key),
    owner_name text not null,
    platform text,
    expires_at timestamptz not null,
    status text not null default 'active' check (status in ('active', 'revoked')),
    activated_at timestamptz,
    last_verified_at timestamptz,
    verify_count integer not null default 0,
    created_at timestamptz not null default now()
);

comment on table public.licenses is
    'Activation keys sold for the student-tracker desktop app. A purchase issues one primary key plus zero or more secondary keys (parent_key pointing back to the primary) so one purchase can activate a small, fixed number of devices without any device-fingerprint tracking.';

alter table public.licenses enable row level security;
