-- ════════════════════════════════════════════════════════════════════════════
-- FELEMAYE · CADENCE & CLIENT EXPERIENCE  (2026-10-22b)
-- 12-week rhythm: internal deadlines (studio only) vs client touchpoints,
-- bi-weekly live milestone reviews with a standard 3-part agenda, Friday async
-- updates, design presentations with option decisions, two-sided notifications,
-- and booking boundaries (milestone reviews included, extra advisory billable).
-- ADDITIVE ONLY. Re-runnable. Needs 20261022_felemaye_master_ecosystem.sql first
-- (uses fy_touch / fy_log / studio_email).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · Project cadence settings ───────────────────────────────────────────
create table if not exists public.project_cadence (
  project_id        uuid primary key references public.projects(id) on delete cascade,
  kickoff_on        date not null,                         -- Monday of Week 1
  weeks             int  not null default 12,
  live_every_weeks  int  not null default 3,               -- milestone reviews every 2–3 weeks
  async_weekday     int  not null default 5,               -- 5 = Friday
  included_sessions int  not null default 5,               -- kickoff + 4 milestone reviews
  advisory_rate     numeric(8,2),                          -- null = shown as "studio advisory rate"
  cadence_note      text,
  booking_note      text,
  updated_at        timestamptz not null default now()
);
drop trigger if exists trg_cadence_touch on public.project_cadence;
create trigger trg_cadence_touch before update on public.project_cadence for each row execute function public.fy_touch();

-- ── 2 · Week-by-week plan: client-facing touchpoints ───────────────────────
create table if not exists public.project_weeks (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  week_no          int  not null check (week_no between 1 and 52),
  phase_seq        int,
  title            text not null,                          -- "Kickoff & Baseline"
  touchpoint       text not null default 'async' check (touchpoint in ('live','async','none')),
  touchpoint_title text,                                   -- "Live Call #1 · Milestone Sign-Off"
  presentation     text,
  deliverables     text[] not null default '{}',
  approval_required text,
  client_visible   boolean not null default true,
  status           text not null default 'planned' check (status in ('planned','in_progress','done','moved')),
  event_id         uuid references public.calendar_events(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (project_id, week_no)
);
drop trigger if exists trg_weeks_touch on public.project_weeks;
create trigger trg_weeks_touch before update on public.project_weeks for each row execute function public.fy_touch();

-- ── 3 · Internal studio deadlines (never shown to clients) ─────────────────
create table if not exists public.studio_deadlines (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  week_no    int,
  title      text not null,
  detail     text,
  due_on     date,
  done_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists studio_deadlines_due on public.studio_deadlines (project_id, due_on);

-- ── 4 · Meeting agendas (3-part SOP) ───────────────────────────────────────
-- parts: [{key:"context",title:"Context & Retrospective",minutes:10,items:[…]}, …]
create table if not exists public.meeting_agendas (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  event_id      uuid references public.calendar_events(id) on delete set null,
  week_no       int,
  title         text not null,
  parts         jsonb not null default '[]',
  decisions     jsonb not null default '[]',              -- [{q:"Enclosure approach", options:["A","B"], outcome:null}]
  status        text not null default 'draft' check (status in ('draft','shared','held')),
  shared_at     timestamptz,
  summary       text,                                      -- after-meeting recap (client-visible once held)
  next_meeting_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists trg_agenda_touch on public.meeting_agendas;
create trigger trg_agenda_touch before update on public.meeting_agendas for each row execute function public.fy_touch();

-- ── 5 · Friday asynchronous updates ────────────────────────────────────────
create table if not exists public.async_updates (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  week_no      int,
  title        text not null,
  body         text,
  highlights   text[] not null default '{}',
  video_url    text,                                       -- Loom
  file_path    text,                                       -- PDF note in project-files
  next_up      text,
  published_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ── 6 · Design presentations & option decisions ────────────────────────────
-- slides:  [{path|url, caption}]   options: [{key:"A", title, summary, pros:[…], cons:[…], cost, code}]
create table if not exists public.presentations (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  phase_seq     int,
  week_no       int,
  title         text not null,
  subtitle      text,
  deck_url      text,                                      -- Framer deck / PDF link (optional)
  slides        jsonb not null default '[]',
  options       jsonb not null default '[]',
  decision_prompt text,
  status        text not null default 'draft' check (status in ('draft','published','archived')),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists trg_pres_touch on public.presentations;
create trigger trg_pres_touch before update on public.presentations for each row execute function public.fy_touch();

create table if not exists public.presentation_decisions (
  id              uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  option_key      text not null,
  comment         text,
  decided_by      text not null default coalesce(auth.email(),'system'),
  created_at      timestamptz not null default now()
);

create or replace function public.client_decide_presentation(p_presentation uuid, p_option text, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare pr public.presentations;
begin
  select * into pr from public.presentations where id = p_presentation;
  if not found or pr.status <> 'published' then raise exception 'not found'; end if;
  if not (public.is_studio() or pr.project_id in (select public.my_projects())) then raise exception 'not allowed'; end if;
  if not exists (select 1 from jsonb_array_elements(pr.options) o where o->>'key' = p_option) then raise exception 'unknown option'; end if;
  insert into public.presentation_decisions (presentation_id, project_id, option_key, comment)
  values (p_presentation, pr.project_id, p_option, left(nullif(btrim(coalesce(p_comment,'')),''), 1500));
  perform public.fy_log(pr.project_id, 'option_selected', jsonb_build_object('title', pr.title || ' · Option ' || p_option));
end $$;
revoke execute on function public.client_decide_presentation(uuid,text,text) from public, anon;
grant  execute on function public.client_decide_presentation(uuid,text,text) to authenticated;

-- Meeting kind so milestone reviews (included) and advisory calls (billable) are counted apart.
alter table public.calendar_events  add column if not exists billable boolean not null default false;
alter table public.meeting_requests add column if not exists kind text not null default 'advisory';

-- ── 7 · Notifications (two-sided) ──────────────────────────────────────────
create table if not exists public.portal_notifications (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  audience    text not null check (audience in ('client','studio')),
  kind        text not null,
  title       text not null,
  body        text,
  link_target text,                                        -- portal tab / console tab
  ref_id      uuid,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists portal_notifications_feed on public.portal_notifications (project_id, audience, created_at desc);

create or replace function public.fy_notify(p_project uuid, p_audience text, p_kind text, p_title text, p_body text, p_link text, p_ref uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.portal_notifications (project_id, audience, kind, title, body, link_target, ref_id)
  values (p_project, p_audience, p_kind, left(p_title,200), left(p_body,600), p_link, p_ref);
  -- email/SMS fan-out through the existing Make webhook, if configured (never blocks the write)
  begin
    perform public.notify_make('make_portal_events_webhook',
      jsonb_build_object('event','portal_notification','audience',p_audience,'kind',p_kind,'title',p_title,'body',coalesce(p_body,''),'project_id',p_project));
  exception when others then null;
  end;
end $$;
revoke execute on function public.fy_notify(uuid,text,text,text,text,text,uuid) from public, anon, authenticated;

create or replace function public.mark_notifications_read(p_project uuid)
returns void language sql security definer set search_path = public as $$
  update public.portal_notifications set read_at = now()
  where project_id = p_project and read_at is null
    and ((audience = 'client' and p_project in (select public.my_projects()))
      or (audience = 'studio' and public.is_studio()))
$$;
grant execute on function public.mark_notifications_read(uuid) to authenticated;

create or replace function public.trg_cadence_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare d text;
begin
  if tg_table_name = 'async_updates' then
    if new.published_at is not null and (tg_op = 'INSERT' or old.published_at is null) then
      perform public.fy_notify(new.project_id,'client','async_update', new.title, left(coalesce(new.body,''),240), 'roadmap', new.id);
      perform public.fy_log(new.project_id,'friday_update_posted', jsonb_build_object('title', new.title));
    end if;
  elsif tg_table_name = 'meeting_agendas' then
    if new.status = 'shared' and (tg_op = 'INSERT' or old.status = 'draft') then
      perform public.fy_notify(new.project_id,'client','agenda_shared','Agenda ready · ' || new.title, null, 'home', new.id);
    elsif new.status = 'held' and (tg_op = 'INSERT' or old.status <> 'held') then
      perform public.fy_notify(new.project_id,'client','meeting_recap','Meeting recap · ' || new.title, left(coalesce(new.summary,''),240), 'home', new.id);
    end if;
  elsif tg_table_name = 'presentations' then
    if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
      perform public.fy_notify(new.project_id,'client','presentation', 'New presentation · ' || new.title, new.decision_prompt, 'phases', new.id);
      perform public.fy_log(new.project_id,'presentation_published', jsonb_build_object('title', new.title));
    end if;
  elsif tg_table_name = 'calendar_events' then
    if tg_op = 'INSERT' and new.project_id is not null then
      d := to_char(new.starts_at at time zone 'America/Los_Angeles', 'Dy Mon DD · HH12:MI AM') || ' PT';
      perform public.fy_notify(new.project_id,'client','event_scheduled', new.title, d, 'home', new.id);
    end if;
  elsif tg_table_name = 'client_tasks' then
    if tg_op = 'INSERT' then
      perform public.fy_notify(new.project_id,'client','task', 'New action item · ' || new.title,
        case when new.due_on is not null then 'Due ' || to_char(new.due_on,'Mon DD') end, coalesce(new.link_target,'home'), new.id);
    elsif new.status = 'pending_review' and old.status is distinct from 'pending_review' then
      perform public.fy_notify(new.project_id,'studio','task_submitted','Client completed · ' || new.title, null, 'clients', new.id);
    end if;
  elsif tg_table_name = 'phases' then
    if new.status = 'in_review' and old.status is distinct from 'in_review' then
      perform public.fy_notify(new.project_id,'client','signoff','Ready for your sign-off · ' || new.title, null, 'phases', new.id);
    elsif new.status = 'approved' and old.status is distinct from 'approved' then
      perform public.fy_notify(new.project_id,'studio','phase_approved','Client approved · ' || new.title, null, 'cadence', new.id);
    end if;
  elsif tg_table_name = 'phase_decisions' then
    if new.decision = 'request_changes' then
      perform public.fy_notify(new.project_id,'studio','changes_requested','Changes requested', left(coalesce(new.comment,''),240), 'cadence', new.id);
    end if;
  elsif tg_table_name = 'presentation_decisions' then
    perform public.fy_notify(new.project_id,'studio','option_selected','Client chose Option ' || new.option_key, left(coalesce(new.comment,''),240), 'cadence', new.presentation_id);
  elsif tg_table_name = 'meeting_requests' then
    perform public.fy_notify(new.project_id,'studio','meeting_requested','Meeting request · ' || coalesce(new.topic,''), new.kind, 'meetings', new.id);
  end if;
  return new;
exception when others then return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['async_updates','meeting_agendas','presentations','calendar_events','client_tasks','phases','phase_decisions','presentation_decisions','meeting_requests'] loop
    execute format('drop trigger if exists trg_cadence_notify on public.%I', t);
    execute format('create trigger trg_cadence_notify after insert or update on public.%I for each row execute function public.trg_cadence_notify()', t);
  end loop;
end $$;

-- ── 8 · RLS ────────────────────────────────────────────────────────────────
alter table public.project_cadence        enable row level security;
alter table public.project_weeks          enable row level security;
alter table public.studio_deadlines       enable row level security;
alter table public.meeting_agendas        enable row level security;
alter table public.async_updates          enable row level security;
alter table public.presentations          enable row level security;
alter table public.presentation_decisions enable row level security;
alter table public.portal_notifications   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['project_cadence','project_weeks','studio_deadlines','meeting_agendas','async_updates','presentations','presentation_decisions','portal_notifications'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_studio') then
      execute format('create policy %I on public.%I for all to authenticated using (public.is_studio()) with check (public.is_studio())', t||'_studio', t);
    end if;
  end loop;
  if not exists (select 1 from pg_policies where policyname='project_cadence_client') then
    create policy project_cadence_client on public.project_cadence for select to authenticated using (project_id in (select public.my_projects()));
  end if;
  if not exists (select 1 from pg_policies where policyname='project_weeks_client') then
    create policy project_weeks_client on public.project_weeks for select to authenticated using (client_visible and project_id in (select public.my_projects()));
  end if;
  if not exists (select 1 from pg_policies where policyname='meeting_agendas_client') then
    create policy meeting_agendas_client on public.meeting_agendas for select to authenticated using (status in ('shared','held') and project_id in (select public.my_projects()));
  end if;
  if not exists (select 1 from pg_policies where policyname='async_updates_client') then
    create policy async_updates_client on public.async_updates for select to authenticated using (published_at is not null and project_id in (select public.my_projects()));
  end if;
  if not exists (select 1 from pg_policies where policyname='presentations_client') then
    create policy presentations_client on public.presentations for select to authenticated using (status = 'published' and project_id in (select public.my_projects()));
  end if;
  if not exists (select 1 from pg_policies where policyname='presentation_decisions_client') then
    create policy presentation_decisions_client on public.presentation_decisions for select to authenticated using (project_id in (select public.my_projects()));
  end if;
  if not exists (select 1 from pg_policies where policyname='portal_notifications_client') then
    create policy portal_notifications_client on public.portal_notifications for select to authenticated using (audience = 'client' and project_id in (select public.my_projects()));
  end if;
end $$;

grant select, insert, update, delete on public.project_cadence, public.project_weeks, public.studio_deadlines,
  public.meeting_agendas, public.async_updates, public.presentations, public.presentation_decisions,
  public.portal_notifications to authenticated;

-- Session count: included milestone sessions vs billable advisory calls.
create or replace view public.v_session_usage with (security_invoker = on) as
select c.project_id, c.included_sessions, c.advisory_rate,
       count(e.id) filter (where not e.billable and e.starts_at < now()) as included_used,
       count(e.id) filter (where e.billable) as advisory_sessions
from public.project_cadence c
left join public.calendar_events e on e.project_id = c.project_id
group by c.project_id, c.included_sessions, c.advisory_rate;
grant select on public.v_session_usage to authenticated;

-- ── 9 · SEED · The Lorado Courtyard 12-week rhythm ─────────────────────────
insert into public.project_cadence (project_id, kickoff_on, cadence_note, booking_note)
select id, date '2026-10-19',
  'To respect your schedule and keep momentum across our 12-week timeline, live touchpoints happen every two to three weeks at the key decision milestones. On the weeks in between, the studio posts a short update here every Friday, so you always know where things stand without having to set time aside.',
  'Milestone reviews are included in your scope. Consultations you request beyond the scheduled phase sign-offs are billed at the studio''s hourly advisory rate and added to your final phase reconciliation.'
from public.projects where slug = 'the-lorado-courtyard'
on conflict (project_id) do nothing;

insert into public.project_weeks (project_id, week_no, phase_seq, title, touchpoint, touchpoint_title, presentation, deliverables, approval_required)
select p.id, w.n, w.ph, w.t, w.tp, w.tt, w.pres, w.del, w.appr
from public.projects p
cross join (values
  (1, 1,'Kickoff & Baseline','live','Kickoff Call · Welcome Kit','12-week roadmap walkthrough, zoning constraint strategy, portal setup', array['Project Overview Brief','Contract sign-off'], null),
  (2, 1,'Feasibility & Spatial Massing','async','Friday update · massing & zoning envelope video', null, array[]::text[], null),
  (3, 1,'Pre-Design Approval Milestone','live','Live Call #1 · Milestone Sign-Off','Pre-Design deck: site context, spatial options, zoning constraints', array['Phase 1 sign-off'], 'Choose the courtyard enclosure approach (Option A or B) before Schematic Design'),
  (4, 2,'Concept & Material Lookbooks','async','Friday update · material mood boards & first 3D views', null, array[]::text[], null),
  (5, 2,'3D Modeling & Visual Development','async','Friday update · modeling progress & review prep', null, array[]::text[], null),
  (6, 2,'Schematic Design Sign-Off','live','Live Call #2 · Milestone Sign-Off','3D renderings, courtyard elevations, material lookbook', array['SD approval package','Sign-off form'], 'Exterior aesthetic, enclosure geometry and primary material palette'),
  (7, 3,'Structural & Detailing Integration','async','Friday update · engineering coordination', null, array[]::text[], null),
  (8, 3,'Dimensioning & Material Specification','async','Friday update · preview of technical callout sheets', null, array[]::text[], null),
  (9, 3,'Design Development Sign-Off','live','Live Call #3 · Milestone Sign-Off','Full DD technical package with lighting & hardware callouts', array['DD approval document'], 'Dimensions, fixture and material specifications, final structural layout before the CD freeze'),
  (10,4,'CD Production & Specifications','async','Friday update · permit application status', null, array[]::text[], null),
  (11,4,'Quality Control & Final Polish','async','Friday update · final review confirmation', null, array[]::text[], null),
  (12,4,'Final Handoff & Permit Submittal','live','Live Call #4 · Project Closeout','Complete construction document package & permit submittal proof', array['Digital project vault','Printed studio binder (on request)','Final invoice reconciliation'], null)
) as w(n, ph, t, tp, tt, pres, del, appr)
where p.slug = 'the-lorado-courtyard'
on conflict (project_id, week_no) do nothing;

insert into public.studio_deadlines (project_id, week_no, title, due_on)
select p.id, w.n, w.t, date '2026-10-19' + (w.n - 1) * 7 + 4
from public.projects p
cross join (values
  (1,'Revit base model from LiDAR / tape survey; cross-check Title 22 R-1 front-yard wall limits (42" solid + openwork above)'),
  (2,'Massing options: A — modified gate & pilasters · B — masonry enclosure wall + wrought iron'),
  (3,'Finalize Pre-Design feasibility report & zoning strategy; package Pre-Design deck'),
  (4,'Initial 3D courtyard concepts; exterior palette (plaster, metals, glass, pavers)'),
  (5,'Refine BIM model: camera angles, lighting, custom gates / archways'),
  (6,'Package SD presentation deck & material selection sheet'),
  (7,'Coordinate footings, structural tie-ins and LA County code details with the Engineer of Record'),
  (8,'Dimensioned plans, courtyard sections, lighting / electrical layout, hardware schedule'),
  (9,'Lock DD set: A1.0 Site Plan · A2.0 Plans · A3.0 Elevations · A4.0 Sections'),
  (10,'Complete drawing set, structural calcs, permit forms'),
  (11,'Internal redline QC, sheet cross-referencing, submittal packet prep'),
  (12,'Submit set to LA County Public Works Building & Safety / Regional Planning')
) as w(n, t)
where p.slug = 'the-lorado-courtyard'
  and not exists (select 1 from public.studio_deadlines d where d.project_id = p.id);
