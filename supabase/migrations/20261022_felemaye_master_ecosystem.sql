-- ════════════════════════════════════════════════════════════════════════════
-- FELEMAYE · MASTER ECOSYSTEM  (Studio Console V4 + Client Suite master update)
-- 2026-10-22 · strictly ADDITIVE: no drops, no renames, no column type changes.
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING / CREATE OR REPLACE).
--
-- Security model (unchanged): is_studio() = Felema's two studio addresses,
-- my_projects() = projects linked to the signed-in client's email.
--   • Trade discounts, reps, vendors, budgets, burn, time, waterfall,
--     consultant contacts, trade jobs, Drive refs  → STUDIO ONLY.
--   • Clients see: phase progress %, permit checklist items marked visible,
--     RFPs once sent, proposals marked visible (firm, fee, scope), their tasks,
--     an issued zoning summary via RPC (no raw notes).
--   • No secrets in this file. Portal passwords stay in the local vault.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0 · helpers ─────────────────────────────────────────────────────────────
create or replace function public.studio_email(p text)
returns boolean language sql immutable set search_path = public as $$
  select lower(coalesce(p,'')) in ('felema@felemaye.com','felemayemaneberhan@gmail.com')
$$;

create or replace function public.fy_touch()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

-- ── 1 · TIME BANK & FINANCIAL ENGINE ───────────────────────────────────────
-- Budgets live in studio-only tables so clients (who can read projects/phases)
-- never see hours, burn or internal fee splits.
create table if not exists public.project_budgets (
  project_id      uuid primary key references public.projects(id) on delete cascade,
  fixed_fee       numeric(12,2) not null default 9000,
  time_bank_hours numeric(8,2)  not null default 60,
  target_ehr      numeric(8,2)  not null default 150,
  burn_alert_pct  numeric(5,2)  not null default 80,
  notes           text,
  updated_at      timestamptz not null default now()
);

create table if not exists public.phase_budgets (
  phase_id     uuid primary key references public.phases(id) on delete cascade,
  phase_code   text,                       -- PD / SD / DD / CD / SA
  fee_amount   numeric(12,2) not null default 0,
  budget_hours numeric(8,2)  not null default 0,
  updated_at   timestamptz not null default now()
);

-- Client-visible progress (exact % of the active phase) + optional flag.
alter table public.phases add column if not exists progress_pct numeric(5,2) not null default 0;
alter table public.phases add column if not exists optional     boolean      not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'phases_progress_pct_chk') then
    alter table public.phases add constraint phases_progress_pct_chk check (progress_pct between 0 and 100);
  end if;
end $$;

-- Timecard hierarchy: Project → Week → Phase Code → Activity Code → Task Notes
alter table public.studio_time_entries add column if not exists phase_id      uuid references public.phases(id) on delete set null;
alter table public.studio_time_entries add column if not exists phase_code    text;
alter table public.studio_time_entries add column if not exists activity_code text;
alter table public.studio_time_entries add column if not exists task_notes    text;
create index if not exists studio_time_entries_proj_week on public.studio_time_entries (project_id, work_date);

create table if not exists public.activity_codes (
  code       text primary key,             -- e.g. PD-02
  phase_code text not null,                -- PD
  label      text not null,
  seq        int  not null default 0
);
insert into public.activity_codes (code, phase_code, label, seq) values
  ('PD-01','PD','Site visit & field measure',1),
  ('PD-02','PD','Zoning / code research',2),
  ('PD-03','PD','Client meeting & program',3),
  ('PD-04','PD','Existing conditions drafting',4),
  ('PD-05','PD','Feasibility memo',5),
  ('SD-01','SD','Concept options',1),
  ('SD-02','SD','Massing & 3D studies',2),
  ('SD-03','SD','Material palette & boards',3),
  ('SD-04','SD','Client review & revisions',4),
  ('DD-01','DD','Permit set drafting',1),
  ('DD-02','DD','Details & specifications',2),
  ('DD-03','DD','Consultant coordination',3),
  ('DD-04','DD','Agency submittal prep',4),
  ('CD-01','CD','Structural integration',1),
  ('CD-02','CD','Plan check corrections',2),
  ('SA-01','SA','Site walkthrough',1),
  ('SA-02','SA','RFIs & submittals',2),
  ('AD-01','AD','Admin / project management',1)
on conflict (code) do nothing;

-- Seed the Lorado budget: $9,000 fixed fee · 60.0 h bank · $150/h target.
-- Fee split per proposal: Phase 1 retainer $4,500 · SD $2,250 · DD $2,250.
insert into public.project_budgets (project_id, fixed_fee, time_bank_hours, target_ehr)
select id, 9000, 60, 150 from public.projects where slug = 'the-lorado-courtyard'
on conflict (project_id) do nothing;

insert into public.phase_budgets (phase_id, phase_code, fee_amount, budget_hours)
select ph.id,
       case ph.seq when 1 then 'PD' when 2 then 'SD' when 3 then 'DD' when 4 then 'CD' else 'SA' end,
       case ph.seq when 1 then 4500 when 2 then 2250 when 3 then 2250 else 0 end,
       case ph.seq when 1 then 30   when 2 then 15   when 3 then 15   else 0 end
from public.phases ph join public.projects p on p.id = ph.project_id
where p.slug = 'the-lorado-courtyard'
on conflict (phase_id) do nothing;

update public.phases set optional = true
where optional = false and (title ilike '%optional%' or title ilike '%advisory%');

-- Phase burn / EHR (security_invoker → returns nothing to clients).
--   EHR  = (Fixed Fee × Phase Progress %) / Total Logged Hours
--   alert when Burn > alert % while progress < alert %
create or replace view public.v_phase_burn with (security_invoker = on) as
select ph.project_id,
       ph.id                    as phase_id,
       ph.seq, ph.title, ph.status, ph.optional,
       ph.progress_pct,
       pb.phase_code,
       coalesce(pb.fee_amount,0)   as fee_amount,
       coalesce(pb.budget_hours,0) as budget_hours,
       coalesce(t.hours,0)         as logged_hours,
       case when coalesce(pb.budget_hours,0) > 0
            then round(100 * coalesce(t.hours,0) / pb.budget_hours, 1) end as burn_pct,
       case when coalesce(t.hours,0) > 0
            then round(coalesce(pb.fee_amount,0) * ph.progress_pct / 100 / t.hours, 2) end as ehr,
       (coalesce(pb.budget_hours,0) > 0
        and 100 * coalesce(t.hours,0) / pb.budget_hours > coalesce(b.burn_alert_pct,80)
        and ph.progress_pct < coalesce(b.burn_alert_pct,80)) as burn_alert
from public.phases ph
left join public.phase_budgets  pb on pb.phase_id = ph.id
left join public.project_budgets b on b.project_id = ph.project_id
left join (select phase_id, sum(minutes)/60.0 as hours
           from public.studio_time_entries where phase_id is not null group by phase_id) t
       on t.phase_id = ph.id
where public.is_studio();

create or replace view public.v_time_bank with (security_invoker = on) as
select b.project_id, p.title, b.fixed_fee, b.time_bank_hours, b.target_ehr,
       coalesce(t.hours,0) as logged_hours,
       b.time_bank_hours - coalesce(t.hours,0) as hours_remaining,
       coalesce(e.earned,0) as earned_value,
       case when coalesce(t.hours,0) > 0 then round(coalesce(e.earned,0) / t.hours, 2) end as ehr
from public.project_budgets b
join public.projects p on p.id = b.project_id
left join (select project_id, sum(minutes)/60.0 as hours from public.studio_time_entries group by 1) t
       on t.project_id = b.project_id
left join (select ph.project_id, sum(coalesce(pb.fee_amount,0) * ph.progress_pct / 100) as earned
           from public.phases ph left join public.phase_budgets pb on pb.phase_id = ph.id group by 1) e
       on e.project_id = b.project_id
where public.is_studio();

-- 50 / 25 / 25 inflow waterfall (view-layer; the existing 5-bucket ENGINE
-- trigger on invoices is left untouched).
insert into public.studio_config (key, value) values
  ('waterfall_tax_pct','25'), ('waterfall_opex_pct','25'), ('waterfall_owner_pct','50')
on conflict (key) do nothing;

create or replace view public.v_inflow_waterfall with (security_invoker = on) as
with cfg as (
  select coalesce(max(case when key='waterfall_tax_pct'   then value end)::numeric,25) as tax,
         coalesce(max(case when key='waterfall_opex_pct'  then value end)::numeric,25) as opex,
         coalesce(max(case when key='waterfall_owner_pct' then value end)::numeric,50) as owner
  from public.studio_config)
select i.id as invoice_id, i.amount, coalesce(i.amount_paid,0) as inflow,
       round(coalesce(i.amount_paid,0) * cfg.tax   / 100, 2) as tax_reserve,
       round(coalesce(i.amount_paid,0) * cfg.opex  / 100, 2) as opex_reserve,
       round(coalesce(i.amount_paid,0) * cfg.owner / 100, 2) as owners_draw
from public.invoices i cross join cfg
where public.is_studio();

-- ── 2 · CLIENT TASK DEEP-LINKS ─────────────────────────────────────────────
alter table public.client_tasks add column if not exists kind        text;   -- survey / upload / review / sign / pay / meet
alter table public.client_tasks add column if not exists link_target text;   -- portal tab key: files, ledger, boards, permit, ffe, billing …
alter table public.client_tasks add column if not exists link_label  text;
alter table public.client_tasks add column if not exists link_url    text;   -- optional external link (DocuSign, Calendly)

-- ── 3 · DUAL-SIDED AUDIT TRAIL ─────────────────────────────────────────────
alter table public.project_activity add column if not exists side text;     -- studio / client / system
create or replace function public.trg_activity_side()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.side is null then
    new.side := case when new.actor is null or new.actor = 'system' then 'system'
                     when public.studio_email(new.actor) then 'studio'
                     else 'client' end;
  end if;
  return new;
end $$;
drop trigger if exists trg_activity_side on public.project_activity;
create trigger trg_activity_side before insert on public.project_activity
  for each row execute function public.trg_activity_side();

update public.project_activity
   set side = case when actor is null or actor = 'system' then 'system'
                   when public.studio_email(actor) then 'studio' else 'client' end
 where side is null;

create or replace function public.fy_log(p_project uuid, p_action text, p_meta jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.project_activity (project_id, actor, action, meta)
  values (p_project, coalesce(auth.email(), 'system'), p_action, coalesce(p_meta,'{}'::jsonb))
$$;
revoke execute on function public.fy_log(uuid,text,jsonb) from public, anon, authenticated;

create or replace function public.trg_log_task()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.fy_log(new.project_id, 'task_assigned', jsonb_build_object('title', new.title, 'task_id', new.id));
  elsif new.status is distinct from old.status then
    perform public.fy_log(new.project_id, 'task_' || new.status, jsonb_build_object('title', new.title, 'task_id', new.id));
  end if;
  return new;
end $$;
drop trigger if exists trg_log_task on public.client_tasks;
create trigger trg_log_task after insert or update of status on public.client_tasks
  for each row execute function public.trg_log_task();

create or replace function public.trg_log_receipt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.fy_log(new.project_id, 'receipt_uploaded',
    jsonb_build_object('title', new.title, 'kind', new.kind, 'amount', new.amount));
  return new;
end $$;
drop trigger if exists trg_log_receipt on public.project_receipts;
create trigger trg_log_receipt after insert on public.project_receipts
  for each row execute function public.trg_log_receipt();

create or replace function public.trg_log_file()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- studio preview renders are internal plumbing, not activity
  if new.path not like '%/studio/previews/%' then
    perform public.fy_log(new.project_id, 'file_uploaded',
      jsonb_build_object('name', new.name, 'direction', new.direction, 'category', new.category));
  end if;
  return new;
end $$;
drop trigger if exists trg_log_file on public.project_files;
create trigger trg_log_file after insert on public.project_files
  for each row execute function public.trg_log_file();

-- ── 4 · ZONING / MUNI ENGINE ───────────────────────────────────────────────
create table if not exists public.project_zoning_audits (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  jurisdiction         text not null default 'la_county',   -- la_county / ladbs / nyc_dob
  zone_class           text,                                -- R-1, R1-1-BHO …
  overlays             text[] not null default '{}',        -- BHO, HPOZ, CSD …
  lot_area_sf          numeric,
  far_allowable        numeric,
  far_proposed         numeric,
  floor_area_existing  numeric,
  floor_area_proposed  numeric,
  setback_front_ft     numeric,
  setback_side_ft      numeric,
  setback_rear_ft      numeric,
  height_cap_ft        numeric,
  wall_height_cap_in   numeric,                             -- solid fence/wall cap in front yard
  transparency_pct     numeric,                             -- required openness above the cap
  occupancy            text,                                -- R-3 / U
  construction_type    text,
  hillside             boolean not null default false,
  retaining_wall_max_ft numeric,
  se_required          boolean generated always as
                         (hillside or coalesce(retaining_wall_max_ft,0) > 4) stored,
  se_override          boolean,                             -- studio can force on/off
  citations            jsonb not null default '[]',         -- [{code, title, note}]
  source_note          text,                                -- raw meeting notes (studio only)
  parsed               jsonb not null default '{}',
  status               text not null default 'draft' check (status in ('draft','reviewed','issued')),
  created_by           text default coalesce(auth.email(),'system'),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists project_zoning_audits_proj on public.project_zoning_audits (project_id, created_at desc);
drop trigger if exists trg_zoning_touch on public.project_zoning_audits;
create trigger trg_zoning_touch before update on public.project_zoning_audits
  for each row execute function public.fy_touch();

-- Issued summary for the client portal — no raw notes, no internal flags.
create or replace function public.client_zoning_summary(p_project uuid)
returns table (zone_class text, overlays text[], lot_area_sf numeric, far_allowable numeric,
               far_proposed numeric, setback_front_ft numeric, setback_side_ft numeric,
               setback_rear_ft numeric, height_cap_ft numeric, wall_height_cap_in numeric,
               transparency_pct numeric, occupancy text, citations jsonb, issued_at timestamptz)
language sql stable security definer set search_path = public as $$
  select z.zone_class, z.overlays, z.lot_area_sf, z.far_allowable, z.far_proposed,
         z.setback_front_ft, z.setback_side_ft, z.setback_rear_ft, z.height_cap_ft,
         z.wall_height_cap_in, z.transparency_pct, z.occupancy, z.citations, z.updated_at
  from public.project_zoning_audits z
  where z.project_id = p_project and z.status = 'issued'
    and (public.is_studio() or p_project in (select public.my_projects()))
  order by z.updated_at desc limit 1
$$;

create table if not exists public.permit_checklists (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  agency         text not null,            -- LACDPW-BSD / LACDRP / LADBS / NYC-DOB
  item           text not null,
  sheet_ref      text,                     -- A-001, S-101 …
  responsible    text not null default 'studio' check (responsible in ('studio','client','engineer','contractor','agency')),
  status         text not null default 'todo' check (status in ('todo','in_progress','submitted','done','na')),
  due_on         date,
  seq            int not null default 0,
  client_visible boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists permit_checklists_proj on public.permit_checklists (project_id, seq);
drop trigger if exists trg_permit_touch on public.permit_checklists;
create trigger trg_permit_touch before update on public.permit_checklists
  for each row execute function public.fy_touch();

-- ── 5 · SUB-CONSULTANT CRM & CLIENT-DIRECT RFPs ────────────────────────────
create table if not exists public.consultants (
  id            uuid primary key default gen_random_uuid(),
  discipline    text not null,             -- structural / civil / geotech / survey / mep / landscape
  firm          text not null,
  contact_name  text,
  email         text,
  phone         text,
  license_no    text,
  license_state text default 'CA',
  website       text,
  notes         text,
  created_at    timestamptz not null default now()
);

create table if not exists public.consultant_rfps (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.projects(id) on delete cascade,
  discipline            text not null default 'structural',
  title                 text not null,
  scope                 text,
  trigger_reason        text,              -- e.g. "Retaining wall > 4 ft" / "Hillside"
  status                text not null default 'draft' check (status in ('draft','sent','comparing','approved','closed')),
  due_on                date,
  approved_proposal_id  uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
drop trigger if exists trg_rfp_touch on public.consultant_rfps;
create trigger trg_rfp_touch before update on public.consultant_rfps
  for each row execute function public.fy_touch();

create table if not exists public.consultant_proposals (
  id             uuid primary key default gen_random_uuid(),
  rfp_id         uuid not null references public.consultant_rfps(id) on delete cascade,
  consultant_id  uuid references public.consultants(id) on delete set null,
  firm_name      text not null,            -- denormalized so clients never read consultants
  fee            numeric(12,2),
  fee_basis      text,                     -- fixed / hourly NTE
  duration_weeks numeric,
  inclusions     text,
  exclusions     text,
  insurance_note text,
  file_path      text,                     -- storage: <project>/consultants/…
  client_visible boolean not null default false,
  status         text not null default 'received' check (status in ('received','approved','declined','withdrawn')),
  approved_by    text,
  approved_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists consultant_proposals_rfp on public.consultant_proposals (rfp_id);

-- [ Approve & Direct Contract ] — the client contracts the engineer directly;
-- FELEMAYE stays lead designer and coordinates, without engineering liability.
create or replace function public.client_approve_proposal(p_proposal uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.consultant_rfps; pr public.consultant_proposals;
begin
  select * into pr from public.consultant_proposals where id = p_proposal;
  if not found then raise exception 'proposal not found'; end if;
  select * into r from public.consultant_rfps where id = pr.rfp_id;
  if not (public.is_studio()
          or (r.project_id in (select public.my_projects()) and pr.client_visible and r.status in ('sent','comparing')))
  then raise exception 'not allowed'; end if;

  update public.consultant_proposals
     set status = case when id = p_proposal then 'approved' else 'declined' end,
         approved_by = case when id = p_proposal then coalesce(auth.email(),'system') else approved_by end,
         approved_at = case when id = p_proposal then now() else approved_at end
   where rfp_id = r.id and status in ('received','approved');
  update public.consultant_rfps set status = 'approved', approved_proposal_id = p_proposal where id = r.id;
  perform public.fy_log(r.project_id, 'consultant_approved',
    jsonb_build_object('firm', pr.firm_name, 'discipline', r.discipline, 'fee', pr.fee, 'contract', 'client-direct'));
end $$;
revoke execute on function public.client_approve_proposal(uuid) from public, anon;
grant  execute on function public.client_approve_proposal(uuid) to authenticated;

-- ── 6 · VENDOR VAULT: TRADE JOB QUEUE + SHEET SYNC + DRIVE REFS ────────────
-- The console only QUEUES a job. The local Playwright bot on Felema's PC polls
-- with the service key from its own .env, reads credentials from the local
-- vault, fills forms, and stops for human review on any CAPTCHA / bot check.
create table if not exists public.trade_jobs (
  id               uuid primary key default gen_random_uuid(),
  vendor_id        uuid references public.vendors(id) on delete cascade,
  trade_account_id uuid references public.trade_accounts(id) on delete set null,
  kind             text not null default 'apply' check (kind in ('apply','discover','status_check')),
  status           text not null default 'queued'
                   check (status in ('queued','claimed','running','needs_review','done','failed','cancelled')),
  requested_by     text default coalesce(auth.email(),'system'),
  requested_at     timestamptz not null default now(),
  claimed_by       text,
  claimed_at       timestamptz,
  finished_at      timestamptz,
  result           jsonb not null default '{}',
  error            text
);
create index if not exists trade_jobs_queue on public.trade_jobs (status, requested_at);
create unique index if not exists trade_jobs_one_open
  on public.trade_jobs (vendor_id, kind) where status in ('queued','claimed','running');

create or replace function public.claim_trade_job(p_worker text)
returns setof public.trade_jobs language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.trade_jobs j set status = 'claimed', claimed_by = p_worker, claimed_at = now()
   where j.id = (select id from public.trade_jobs where status = 'queued'
                 order by requested_at for update skip locked limit 1)
  returning j.*;
end $$;
revoke execute on function public.claim_trade_job(text) from public, anon, authenticated;
grant  execute on function public.claim_trade_job(text) to service_role;

-- Two-way sync with the "FELEMAYE | Procurement System" Google Sheet.
alter table public.vendors add column if not exists sheet_row        int;
alter table public.vendors add column if not exists sheet_synced_at  timestamptz;
alter table public.vendors add column if not exists sheet_hash       text;

create table if not exists public.vendor_sheet_sync (
  id          uuid primary key default gen_random_uuid(),
  direction   text not null check (direction in ('sheet_to_db','db_to_sheet')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  rows_in     int default 0,
  rows_out    int default 0,
  conflicts   jsonb not null default '[]',
  status      text not null default 'running' check (status in ('running','ok','error')),
  error       text
);

-- Upsert from the sheet. Called only by the vendor-sheet-sync edge function
-- (service role). Last-write-wins on updated_at vs the sheet's "Last Edited".
create or replace function public.vendors_upsert_from_sheet(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; n_in int := 0; conflicts jsonb := '[]'; v public.vendors; edited timestamptz;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    edited := nullif(r->>'last_edited','')::timestamptz;
    if nullif(r->>'id','') is not null then
      select * into v from public.vendors where id = (r->>'id')::uuid;
    else
      select * into v from public.vendors where lower(name) = lower(r->>'name') limit 1;
    end if;
    if v.id is null then
      insert into public.vendors (name, website, catalogue_url, category_primary, tier, scope, lead_time_weeks, notes, trusted, sheet_row, sheet_synced_at)
      values (r->>'name', r->>'website', nullif(r->>'catalogue_url',''), r->>'category_primary', nullif(r->>'tier',''), r->>'scope',
              nullif(r->>'lead_time_weeks','')::int, r->>'notes', coalesce(nullif(r->>'trusted','')::boolean, false),
              nullif(r->>'sheet_row','')::int, now());
      n_in := n_in + 1;
    elsif edited is null or edited >= coalesce(v.updated_at, 'epoch') then
      update public.vendors set
        website          = coalesce(nullif(r->>'website',''), website),
        catalogue_url    = coalesce(nullif(r->>'catalogue_url',''), catalogue_url),
        trusted          = coalesce(nullif(r->>'trusted','')::boolean, trusted),
        category_primary = coalesce(nullif(r->>'category_primary',''), category_primary),
        tier             = coalesce(nullif(r->>'tier',''), tier),
        scope            = coalesce(nullif(r->>'scope',''), scope),
        lead_time_weeks  = coalesce(nullif(r->>'lead_time_weeks','')::int, lead_time_weeks),
        notes            = coalesce(nullif(r->>'notes',''), notes),
        sheet_row        = coalesce(nullif(r->>'sheet_row','')::int, sheet_row),
        sheet_synced_at  = now()
      where id = v.id;
      n_in := n_in + 1;
    else
      conflicts := conflicts || jsonb_build_object('id', v.id, 'name', v.name, 'db_updated', v.updated_at, 'sheet_edited', edited);
    end if;
    v := null;
  end loop;
  insert into public.vendor_sheet_sync (direction, finished_at, rows_in, conflicts, status)
  values ('sheet_to_db', now(), n_in, conflicts, 'ok');
  return jsonb_build_object('rows_in', n_in, 'conflicts', conflicts);
end $$;
revoke execute on function public.vendors_upsert_from_sheet(jsonb) from public, anon, authenticated;
grant  execute on function public.vendors_upsert_from_sheet(jsonb) to service_role;

-- Drive references for "Studio Admin" (03_STUDIO_OPERATIONS_&_SETUP).
-- LINKS ONLY — the documents stay in Drive; no EIN or permit numbers here.
create table if not exists public.studio_drive_refs (
  id                uuid primary key default gen_random_uuid(),
  folder            text not null default '03_STUDIO_OPERATIONS_&_SETUP',
  doc_kind          text not null,         -- ein_letter / cdtfa_permit / resale_cert / nys_cert_authority / w9 / coi / trade_app_template / letterhead
  title             text not null,
  drive_file_id     text,
  drive_url         text,
  compliance_doc_id uuid references public.studio_compliance_docs(id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now()
);
create unique index if not exists studio_drive_refs_file on public.studio_drive_refs (drive_file_id) where drive_file_id is not null;

-- ── 7 · ROW LEVEL SECURITY ─────────────────────────────────────────────────
alter table public.project_budgets       enable row level security;
alter table public.phase_budgets         enable row level security;
alter table public.activity_codes        enable row level security;
alter table public.project_zoning_audits enable row level security;
alter table public.permit_checklists     enable row level security;
alter table public.consultants           enable row level security;
alter table public.consultant_rfps       enable row level security;
alter table public.consultant_proposals  enable row level security;
alter table public.trade_jobs            enable row level security;
alter table public.vendor_sheet_sync     enable row level security;
alter table public.studio_drive_refs     enable row level security;
-- re-assert the vendor vault is studio-only (already true; harmless)
alter table public.vendors        enable row level security;
alter table public.trade_accounts enable row level security;
alter table public.sales_reps     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['project_budgets','phase_budgets','activity_codes','project_zoning_audits',
                           'permit_checklists','consultants','consultant_rfps','consultant_proposals',
                           'trade_jobs','vendor_sheet_sync','studio_drive_refs']
  loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_studio') then
      execute format('create policy %I on public.%I for all to authenticated using (public.is_studio()) with check (public.is_studio())', t||'_studio', t);
    end if;
  end loop;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='permit_checklists' and policyname='permit_checklists_client_read') then
    create policy permit_checklists_client_read on public.permit_checklists for select to authenticated
      using (client_visible and project_id in (select public.my_projects()));
  end if;
  if not exists (select 1 from pg_policies where tablename='consultant_rfps' and policyname='consultant_rfps_client_read') then
    create policy consultant_rfps_client_read on public.consultant_rfps for select to authenticated
      using (status <> 'draft' and project_id in (select public.my_projects()));
  end if;
  if not exists (select 1 from pg_policies where tablename='consultant_proposals' and policyname='consultant_proposals_client_read') then
    create policy consultant_proposals_client_read on public.consultant_proposals for select to authenticated
      using (client_visible and rfp_id in (select id from public.consultant_rfps
              where status <> 'draft' and project_id in (select public.my_projects())));
  end if;
end $$;

grant select, insert, update, delete on
  public.project_budgets, public.phase_budgets, public.activity_codes, public.project_zoning_audits,
  public.permit_checklists, public.consultants, public.consultant_rfps, public.consultant_proposals,
  public.trade_jobs, public.vendor_sheet_sync, public.studio_drive_refs
  to authenticated;
grant select on public.v_phase_burn, public.v_time_bank, public.v_inflow_waterfall to authenticated;
revoke all on public.v_phase_burn, public.v_time_bank, public.v_inflow_waterfall from anon;
grant execute on function public.client_zoning_summary(uuid) to authenticated;

-- ── 8 · SEED: Lorado permit path (LA County) ───────────────────────────────
insert into public.permit_checklists (project_id, agency, item, sheet_ref, responsible, seq)
select p.id, x.agency, x.item, x.sheet_ref, x.resp, x.seq
from public.projects p
cross join (values
  ('LACDRP','Confirm R-1 zone, 20 ft front-yard setback and wall/fence height rules (Title 22)','A-001','studio',1),
  ('LACDRP','Wall/fence: ≤ 42 in solid in the front yard, openwork above (≥ 50% transparent)','A-001','studio',2),
  ('Studio','Field-verify dimensions, grades and existing gate/pilasters','A-100','studio',3),
  ('Client','Provide survey or title report (property lines)',null,'client',4),
  ('Engineer','Footing, masonry and seismic calcs — stamped S-series sheets','S-101','engineer',5),
  ('LACDPW-BSD','Building permit application & plan check submittal (EPIC-LA)','A-001','studio',6),
  ('LACDPW-BSD','Respond to plan check corrections',null,'studio',7),
  ('Contractor','Permit issuance, inspections and final sign-off',null,'contractor',8)
) as x(agency, item, sheet_ref, resp, seq)
where p.slug = 'the-lorado-courtyard'
  and not exists (select 1 from public.permit_checklists c where c.project_id = p.id);

-- ════════════════════════════════════════════════════════════════════════════
-- END · verify with:
--   select * from v_phase_burn where project_id = (select id from projects where slug='the-lorado-courtyard');
--   select tablename, policyname from pg_policies where tablename like 'consultant%' or tablename like 'permit%';
-- ════════════════════════════════════════════════════════════════════════════
