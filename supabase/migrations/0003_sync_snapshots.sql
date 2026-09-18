-- Stores one merged data snapshot per pairing code, used to sync core
-- academic data (classes/students/grades/subjects/grading
-- categories/periods) between the desktop app and the standalone mobile
-- app. Same posture as licenses: RLS enabled with zero policies, so
-- anon/authenticated clients get zero direct access — only the
-- sync-data Edge Function (connecting with the service_role key) can
-- read or write this table.

create table if not exists public.sync_snapshots (
    sync_code text primary key,
    data jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

comment on table public.sync_snapshots is
    'One row per teacher-generated pairing code. `data` holds the merged sync payload (see supabase/functions/sync-data) — the desktop and mobile apps each push their local core data here and pull back whatever the other side has since contributed.';

alter table public.sync_snapshots enable row level security;
