-- FELEMAYE · survey auto-save (2026-10-19)
-- Holds in-progress Design Intent Survey answers so a reload or a dropped connection never loses a client's work.
-- Written by the Client Portal (signed-in client session); read back on reload. One draft per client.
create table if not exists public.client_onboarding_drafts (
  client_id     text primary key references public.clients(client_id) on delete cascade,
  project_id    uuid references public.projects(id) on delete set null,
  client_email  text not null,
  answers       jsonb not null default '{}'::jsonb,
  step          integer not null default 0,
  updated_at    timestamptz not null default now(),
  submitted_at  timestamptz
);
create index if not exists client_onboarding_drafts_email_idx on public.client_onboarding_drafts (lower(client_email));

alter table public.client_onboarding_drafts enable row level security;

-- A client may only see and write the draft attached to their own client record.
drop policy if exists "client reads own draft" on public.client_onboarding_drafts;
create policy "client reads own draft" on public.client_onboarding_drafts
  for select using (lower(client_email) = lower(auth.email()));

drop policy if exists "client inserts own draft" on public.client_onboarding_drafts;
create policy "client inserts own draft" on public.client_onboarding_drafts
  for insert with check (
    lower(client_email) = lower(auth.email())
    and exists (select 1 from public.clients c where c.client_id = client_onboarding_drafts.client_id and lower(c.email) = lower(auth.email()))
  );

drop policy if exists "client updates own draft" on public.client_onboarding_drafts;
create policy "client updates own draft" on public.client_onboarding_drafts
  for update using (lower(client_email) = lower(auth.email()))
  with check (
    lower(client_email) = lower(auth.email())
    and exists (select 1 from public.clients c where c.client_id = client_onboarding_drafts.client_id and lower(c.email) = lower(auth.email()))
  );

drop policy if exists "studio manages drafts" on public.client_onboarding_drafts;
create policy "studio manages drafts" on public.client_onboarding_drafts
  for all using (public.is_studio()) with check (public.is_studio());

revoke all on public.client_onboarding_drafts from anon;
grant select, insert, update on public.client_onboarding_drafts to authenticated;
