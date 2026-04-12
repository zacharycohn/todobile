create extension if not exists pgcrypto;
create extension if not exists citext;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type public.task_category as enum ('buy', 'do', 'remember', 'blocker');
create type public.task_assignee as enum ('Zac', 'Lauryl', 'Someone');
create type public.task_status as enum ('active', 'completed', 'deleted');
create type public.device_platform as enum ('android', 'web');

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  display_name text not null,
  assignee_key public.task_assignee not null check (assignee_key in ('Zac', 'Lauryl')),
  family_id uuid not null references public.families(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_family_member(target_family_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.family_id = target_family_id
  );
$$;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete restrict,
  details text not null check (length(trim(details)) > 0),
  category public.task_category not null default 'do',
  assignee public.task_assignee not null,
  status public.task_status not null default 'active',
  deadline_date date null,
  scheduled_date date null,
  urls jsonb not null default '[]'::jsonb,
  created_by_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  deleted_at timestamptz null,
  constraint tasks_urls_is_array check (jsonb_typeof(urls) = 'array'),
  constraint tasks_status_timestamps_consistent check (
    (
      status = 'active'
      and completed_at is null
      and deleted_at is null
    ) or (
      status = 'completed'
      and completed_at is not null
      and deleted_at is null
    ) or (
      status = 'deleted'
      and completed_at is null
      and deleted_at is not null
    )
  )
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform public.device_platform not null,
  device_id text null,
  device_name text null,
  push_token text not null,
  app_version text null,
  push_enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_family_status_idx
  on public.tasks (family_id, status);

create index tasks_family_assignee_status_idx
  on public.tasks (family_id, assignee, status);

create index tasks_family_deadline_idx
  on public.tasks (family_id, deadline_date)
  where status = 'active' and deadline_date is not null;

create index tasks_family_scheduled_idx
  on public.tasks (family_id, scheduled_date)
  where status = 'active' and scheduled_date is not null;

create index tasks_details_search_idx
  on public.tasks
  using gin (to_tsvector('simple', details));

create unique index devices_push_token_uidx
  on public.devices (push_token);

create unique index devices_user_device_id_uidx
  on public.devices (user_id, device_id)
  where device_id is not null;

create index devices_user_idx
  on public.devices (user_id);

create trigger set_families_updated_at
before update on public.families
for each row execute function public.set_updated_at();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger set_devices_updated_at
before update on public.devices
for each row execute function public.set_updated_at();

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.devices enable row level security;

create policy "family members can read their family"
on public.families
for select
using (public.is_family_member(id));

create policy "users can read profiles in their family"
on public.profiles
for select
using (public.is_family_member(family_id));

create policy "users can update their own profile"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid() and public.is_family_member(family_id));

create policy "family members can read family tasks"
on public.tasks
for select
using (public.is_family_member(family_id));

create policy "family members can insert family tasks"
on public.tasks
for insert
with check (
  public.is_family_member(family_id)
  and created_by_user_id = auth.uid()
);

create policy "family members can update family tasks"
on public.tasks
for update
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id));

create policy "users can read their own devices"
on public.devices
for select
using (user_id = auth.uid());

create policy "users can insert their own devices"
on public.devices
for insert
with check (user_id = auth.uid());

create policy "users can update their own devices"
on public.devices
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());
