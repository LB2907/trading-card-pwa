-- Run in Supabase SQL Editor (or supabase db push) after creating a project.
-- Enables profiles, cloud collection snapshots, moderation queue, reports, and audit log.
--
-- Grant admin (replace UUID with auth.users.id from Authentication > Users):
--   update public.profiles set role = 'admin' where id = 'YOUR_USER_UUID';

create extension if not exists "pgcrypto";

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_self"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_self"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, 'user'), '@', 1)),
    'user'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- One JSON snapshot per user (MVP cloud sync)
create table if not exists public.user_collection_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists user_collection_snapshots_updated_at_idx
  on public.user_collection_snapshots (updated_at desc);

alter table public.user_collection_snapshots enable row level security;

create policy "snapshots_select_own"
  on public.user_collection_snapshots for select
  using (auth.uid() = user_id);

create policy "snapshots_insert_own"
  on public.user_collection_snapshots for insert
  with check (auth.uid() = user_id);

create policy "snapshots_update_own"
  on public.user_collection_snapshots for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "snapshots_delete_own"
  on public.user_collection_snapshots for delete
  using (auth.uid() = user_id);

-- User-submitted content awaiting or past review
create table if not exists public.content_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body jsonb,
  status text not null default 'pending_review'
    check (status in ('draft', 'pending_review', 'approved', 'rejected', 'hidden')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id),
  review_note text
);

create index if not exists content_submissions_status_idx
  on public.content_submissions (status, created_at desc);

alter table public.content_submissions enable row level security;

create policy "content_select_own"
  on public.content_submissions for select
  using (auth.uid() = user_id);

create policy "content_insert_own"
  on public.content_submissions for insert
  with check (
    auth.uid() = user_id
    and status in ('draft', 'pending_review')
  );

create policy "content_update_own_draft"
  on public.content_submissions for update
  using (auth.uid() = user_id and status = 'draft')
  with check (auth.uid() = user_id and status = 'draft');

-- Abuse / policy reports (read by admins via service role)
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null,
  target_id text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.content_reports enable row level security;

create policy "reports_insert_own"
  on public.content_reports for insert
  with check (auth.uid() = reporter_id);

create policy "reports_select_own"
  on public.content_reports for select
  using (auth.uid() = reporter_id);

-- Audit log (no user-facing RLS; service role only)
create table if not exists public.moderation_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users (id),
  action text not null,
  target_type text not null,
  target_id text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.moderation_audit_log enable row level security;

-- Explicit grants (Supabase projects vary; adjust if your project already grants broadly)
grant select, insert, update, delete on table public.profiles to authenticated, service_role;
grant select, insert, update, delete on table public.user_collection_snapshots to authenticated, service_role;
grant select, insert, update, delete on table public.content_submissions to authenticated, service_role;
grant select, insert on table public.content_reports to authenticated;
grant all on table public.content_reports to service_role;
grant all on table public.moderation_audit_log to service_role;
