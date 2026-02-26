begin;

create extension if not exists pgcrypto;

create table if not exists public.attendpro_report_runs (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  source text not null default 'manual',
  slot_key text null,
  report_date date null,
  account_email text null,
  status text not null default 'pending',
  telegram_message_id bigint null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz null
);

create unique index if not exists attendpro_report_runs_slot_ux
  on public.attendpro_report_runs (account_email, slot_key)
  where slot_key is not null and account_email is not null;

create index if not exists attendpro_report_runs_report_date_idx
  on public.attendpro_report_runs (report_date);

create index if not exists attendpro_report_runs_status_idx
  on public.attendpro_report_runs (status);

create index if not exists attendpro_report_runs_created_at_idx
  on public.attendpro_report_runs (created_at desc);

create or replace function public.attendpro_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists attendpro_report_runs_set_updated_at on public.attendpro_report_runs;
create trigger attendpro_report_runs_set_updated_at
before update on public.attendpro_report_runs
for each row
execute function public.attendpro_set_updated_at();

alter table public.attendpro_report_runs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'attendpro_report_runs'
      and policyname = 'attendpro_report_runs_service_role_all'
  ) then
    create policy attendpro_report_runs_service_role_all
      on public.attendpro_report_runs
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

revoke all on public.attendpro_report_runs from anon, authenticated;

do $$
begin
  if to_regclass('public.attendpro_accounts') is not null then
    create index if not exists attendpro_accounts_email_idx
      on public.attendpro_accounts (lower(email));

    create index if not exists attendpro_accounts_updated_at_idx
      on public.attendpro_accounts (updated_at desc);
  end if;
end
$$;

commit;
