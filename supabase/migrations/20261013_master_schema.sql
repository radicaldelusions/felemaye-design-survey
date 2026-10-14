-- FELEMAYE master schema record (2026-10-13). Project afejhlfwymwagstyfnse.
-- EVERYTHING BELOW IS ALREADY APPLIED to the live database except the items marked "NOT YET RUN".
-- Every statement is additive (create ... if not exists / create or replace / insert ... on conflict do nothing). Run statements one at a time.
-- Multi-tenant: every table is keyed by project_id; every client is addressed by projects.client_slug (e.g. 'lorado'). Onboard a client = insert a project + set client_slug.

-- 1. Multi-tenant keys -------------------------------------------------------
alter table public.projects add column if not exists jurisdiction_id text;
alter table public.projects add column if not exists permit_progress jsonb default '{}';
alter table public.projects add column if not exists client_slug text;
create unique index if not exists projects_client_slug_uq on public.projects (client_slug) where client_slug is not null;
-- update public.projects set client_slug = 'lorado' where id = '67663797-dbb1-410b-b00b-a99452c6a660';   -- applied

-- 2. Jurisdictions (3-way toggle: epic_la, ladbs, nyc_dob) -------------------
create table if not exists public.jurisdiction_workflows (id text primary key, label text not null, portal_name text not null, portal_url text, stages jsonb not null default '[]', fee_chart jsonb not null default '[]', notes text, sort int default 0);
alter table public.jurisdiction_workflows enable row level security;
-- create policy jw_read   on public.jurisdiction_workflows for select to authenticated using (true);
-- create policy jw_studio on public.jurisdiction_workflows for all to authenticated using (public.is_studio()) with check (public.is_studio());
insert into public.jurisdiction_workflows (id,label,portal_name,portal_url,stages,fee_chart,notes,sort) values
('epic_la','LA County (Unincorporated)','EPIC-LA / EnerGov','https://epicla.lacounty.gov',
 '["RPAP intake / screening","Plan check: Public Works (Southwest District)","Plan check: Regional Planning","Plan check: Fire","Plan check: Environmental Health","Corrections / resubmittal","Approval + RPPL permit issuance","Inspections"]',
 '[{"fee":"Plan check","status":"TBD at intake"},{"fee":"RPPL permit issuance","status":"TBD at issuance"}]',
 'Historic review: properties in unincorporated LA County may fall under County historic preservation review. Confirm with Regional Planning at intake.',1),
('nyc_dob','New York City','NYC DOB NOW (Build / Inspections) + Landmarks (LPC)','https://www.nyc.gov/site/buildings/dob/dob-now.page',
 '["DOB NOW: Build filing","Plan examiner review and objections","LPC review: Certificate of Appropriateness (if landmark or historic district)","Approval + permit issuance","DOB NOW: Inspections","Sign-off"]',
 '[{"fee":"DOB filing and permit fees","status":"TBD at filing"},{"fee":"LPC review","status":"No fee; confirm with LPC"}]',
 'Landmarks: in NYC, work on a designated landmark or in a historic district needs an LPC Certificate of Appropriateness (or a Permit for Minor Work) before DOB will issue the permit. The Los Angeles equivalent is an HPOZ review (City of LA) or the Cultural Heritage Commission for monuments. Verify applicability with the agency before filing.',3)
on conflict (id) do nothing;
-- NOT YET RUN (the permission classifier cancelled it twice): add the same historic-review note to the City of LA row.
-- update public.jurisdiction_workflows set notes = 'Historic review: City of LA properties inside an HPOZ need Planning/HPOZ board review; designated monuments go to the Cultural Heritage Commission. NYC equivalent: LPC Certificate of Appropriateness. Verify applicability before filing.' where id = 'ladbs';

-- 3. FF&E, calendar, reimbursables, perspectives -----------------------------
create table if not exists public.procurement_ffe (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, item text not null, vendor text, trade_price numeric, markup_pct numeric default 0, client_price numeric, lead_time text, cut_sheet_url text, status text default 'proposed', client_note text, created_at timestamptz default now());
alter table public.procurement_ffe enable row level security;
-- create policy ffe_studio on public.procurement_ffe for all to authenticated using (public.is_studio()) with check (public.is_studio());
-- clients never read this table directly; they use client_ffe() and decide_ffe() so trade price and markup stay private.
create table if not exists public.calendar_events (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, title text not null, kind text default 'appointment', starts_at timestamptz not null, ends_at timestamptz, location text, video_url text, agenda_url text, notes text);
alter table public.calendar_events enable row level security;
-- create policy cal_studio on public.calendar_events for all to authenticated using (public.is_studio()) with check (public.is_studio());
-- create policy cal_client_read on public.calendar_events for select to authenticated using (project_id in (select public.my_projects()));
alter table public.studio_reimbursables add column if not exists client_auth_status text default 'n/a', add column if not exists client_auth_at timestamptz;
-- $250 rule: a single billable expense above $250 cannot be invoiced until client_auth_status = 'authorized'. Portal badge: PENDING APPROVAL (> $250).
create table if not exists public.perspectives (id uuid primary key default gen_random_uuid(), title text not null, kind text, published_on date, url text, summary text);
alter table public.perspectives enable row level security;
-- NOT YET RUN: public read policy for the /perspectives index
-- create policy persp_read on public.perspectives for select to anon, authenticated using (true);

-- 4. Family survey (no login) ------------------------------------------------
create table if not exists public.family_survey_responses (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, nickname text, age_band text, room_feel text[], lighting text, seating text[], palette text, wish text, created_at timestamptz default now());
alter table public.family_survey_responses add column if not exists mood_picks text[] default '{}';
alter table public.family_survey_responses enable row level security;
-- create policy fsr_read on public.family_survey_responses for select to authenticated using (public.is_studio() or project_id in (select public.my_projects()));
-- no anon insert policy: anonymous writes go ONLY through submit_family_survey_v2 (route /survey/<client_slug>-family).

create or replace function public.submit_family_survey_v2(p_slug text, p_nickname text, p_age_band text, p_room_feel text[], p_lighting text, p_seating text[], p_palette text, p_wish text, p_mood text[], p_hp text default '')
returns void language plpgsql security definer set search_path to 'public' as $$
declare pid uuid;
begin
  if coalesce(p_hp,'')<>'' then return; end if;
  select id into pid from projects where client_slug=p_slug or slug=p_slug limit 1;
  if pid is null then raise exception 'unknown survey'; end if;
  if (select count(*) from family_survey_responses where project_id=pid and created_at>now()-interval '1 hour')>=60 then raise exception 'too many responses, try later'; end if;
  insert into family_survey_responses(project_id,nickname,age_band,room_feel,lighting,seating,palette,wish,mood_picks) values (pid, left(trim(coalesce(p_nickname,'')),30), left(coalesce(p_age_band,''),20), (select coalesce(array_agg(left(x,40)),'{}') from unnest(coalesce(p_room_feel,'{}')) x limit 8), left(coalesce(p_lighting,''),40), (select coalesce(array_agg(left(x,40)),'{}') from unnest(coalesce(p_seating,'{}')) x limit 8), left(coalesce(p_palette,''),40), left(coalesce(p_wish,''),400), (select coalesce(array_agg(left(x,60)),'{}') from unnest(coalesce(p_mood,'{}')) x limit 12));
end $$;
grant execute on function public.submit_family_survey_v2(text,text,text,text[],text,text[],text,text,text[],text) to anon, authenticated;

create or replace function public.family_survey_summary(p_project uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare r jsonb;
begin
  if not (is_studio() or p_project in (select my_projects())) then raise exception 'not allowed'; end if;
  select jsonb_build_object('total',(select count(*) from family_survey_responses where project_id=p_project),
   'lighting',coalesce((select jsonb_object_agg(k,c) from (select lighting k,count(*) c from family_survey_responses where project_id=p_project and lighting<>'' group by 1) a),'{}'),
   'palette',coalesce((select jsonb_object_agg(k,c) from (select palette k,count(*) c from family_survey_responses where project_id=p_project and palette<>'' group by 1) a),'{}'),
   'seating',coalesce((select jsonb_object_agg(k,c) from (select unnest(seating) k,count(*) c from family_survey_responses where project_id=p_project group by 1) a),'{}'),
   'room_feel',coalesce((select jsonb_object_agg(k,c) from (select unnest(room_feel) k,count(*) c from family_survey_responses where project_id=p_project group by 1) a),'{}'),
   'mood',coalesce((select jsonb_object_agg(k,c) from (select unnest(mood_picks) k,count(*) c from family_survey_responses where project_id=p_project group by 1) a),'{}'),
   'wishes',coalesce((select jsonb_agg(jsonb_build_object('who',nullif(nickname,''),'age',nullif(age_band,''),'wish',wish) order by created_at desc) from (select * from family_survey_responses where project_id=p_project and wish<>'' order by created_at desc limit 30) w),'[]')) into r;
  return r;
end $$;
revoke execute on function public.family_survey_summary(uuid) from public, anon;

-- 5. Audio bucket ------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('site-audio','site-audio',true) on conflict (id) do nothing;

-- 6. Other live functions (read bodies with: select pg_get_functiondef('public.<name>'::regproc);)
-- client_ffe(p_project) · decide_ffe(p_item,p_decision,p_note) · client_reimbursables(p_project) · authorize_reimbursable(p_id,p_ok)
-- set_jurisdiction(p_project,p_jur) · set_permit_stage(p_project,p_stage,p_state) · project_permit(p_project,p_jur) · submit_family_survey (v1, kept)

-- 7. Optional, NOT RUN: rename phase titles to the master-directive wording. The signed proposal uses the current titles, so this is left to you.
-- update public.phases set title = 'Pre-Design, Feasibility & Site Survey' where project_id = '67663797-dbb1-410b-b00b-a99452c6a660' and title like 'Pre-Design%';

-- 8. Onboarding a new client (template)
-- insert into public.projects (title, address, slug, client_slug, jurisdiction_id) values ('<Project>', '<Address>', '<slug>', '<client_slug>', 'ladbs');
-- Then add the client row + project directory rows in the Studio Console; the portal and /survey/<client_slug>-family work with no code change.

-- ============================ ADDENDUM 2 (2026-10-13 evening) — ALL APPLIED ============================
-- Family survey v3: granular design data in a whitelisted jsonb column; the portal summary aggregates it.
alter table public.family_survey_responses add column if not exists extra jsonb default '{}';
-- function public.submit_family_survey_v3(p_slug, p_nickname, p_age_band, p_room_feel, p_lighting, p_seating, p_palette, p_wish, p_mood, p_extra jsonb, p_hp)
--   accepts only: time_of_day, light_control, activities, group_size, privacy, flow, materials, underfoot, sit_duration, shade, seasons, comfort
--   slug may be 'lorado', 'lorado-family' or the project slug. 60/hour cap, honeypot. Read the body: select pg_get_functiondef('public.submit_family_survey_v3'::regproc);
-- function public.family_survey_summary(p_project) now also returns "extra" counts per question.

-- Client action items (Asana-style checklist). Studio manages; the client can only send an item for review.
create table if not exists public.client_tasks (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, title text not null, detail text, status text not null default 'action_required' check (status in ('action_required','pending_review','completed')), due_on date, assigned_by text, created_at timestamptz default now(), updated_at timestamptz default now(), completed_at timestamptz);
alter table public.client_tasks enable row level security;
-- create policy tasks_studio on public.client_tasks for all to authenticated using (public.is_studio()) with check (public.is_studio());
-- create policy tasks_client_read on public.client_tasks for select to authenticated using (project_id in (select public.my_projects()));
-- function public.client_submit_task(p_id uuid): action_required -> pending_review, only for the caller's own project.

-- Receipts & proof upload (files live in storage bucket project-files under <project_id>/receipts/, already readable by that project's client).
create table if not exists public.project_receipts (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, kind text not null default 'receipt' check (kind in ('receipt','invoice','proof')), title text not null, vendor text, amount numeric, file_path text not null, uploaded_by text, created_at timestamptz default now());
alter table public.project_receipts enable row level security;
-- create policy rcpt_studio on public.project_receipts for all to authenticated using (public.is_studio()) with check (public.is_studio());
-- create policy rcpt_client_read on public.project_receipts for select to authenticated using (project_id in (select public.my_projects()));

-- Directory status column (Structural Engineer = 'Pending Selection / TBD')
alter table public.project_directory add column if not exists status text default 'Active';
-- update public.project_directory set status = 'Pending Selection / TBD' where id = '580e24c8-1376-46ba-b742-2909b9ef89e4';

-- ============================ ADDENDUM 3 (2026-10-13 18:00 directive) ============================
-- ALREADY APPLIED: surface_items (+RLS surf_studio / surf_members_read / surf_public_preview), projects.primary_goals text[],
-- function public.family_adjacencies(p_project) -> { goals: text[], pairs: [{a,b,n}] }.
-- Set a project's primary goals (shown in "Family Wishlist & Spatial Adjacencies"; run in the SQL editor, edit the text):
-- update public.projects set primary_goals = array['Indoor-outdoor flow','Evening gathering','Privacy','Natural materials'] where id = '67663797-dbb1-410b-b00b-a99452c6a660';
-- Add a surface: insert into public.surface_items (name, material_type, origin, applications, finish, description, trade_sample, published, public_preview) values ('…','Tadelakt plaster','Marrakech, Morocco',array['Bath','Wall'],'Burnished','…',false,true,true);

-- NOT YET APPLIED (the assistant's tool permissions blocked these two updates). Run once in the Supabase SQL editor.
-- Fee wording is deliberately valuation-based / "quoted at intake": no fee figures were verified, none are invented.
update public.jurisdiction_workflows set stages = '["LA County Regional Planning: zoning review (EPIC-LA / EnerGov)","Public Works Building & Safety: plan check intake","Plan check: Public Works Southwest District, Fire, Environmental Health","Structural plan check: SE wet-stamped drawings","Corrections / resubmittal","Approval + permit issuance","Inspections and final"]'::jsonb where id = 'epic_la';
update public.jurisdiction_workflows set stages = '["DOB NOW: Build filing (Alt-CO, Alteration Type 2)","Plan examiner review and objections","DOB Plan Examiner approval","Directive 14 (professional-certified inspection track, if applicable)","LPC review: Certificate of Appropriateness (if landmark or historic district)","Permit issuance","Special Inspections","DOB NOW: Inspections and sign-off"]'::jsonb where id = 'nyc_dob';
-- (If your column is not jsonb, or ids differ, check: select id, pg_typeof(stages) from public.jurisdiction_workflows;)
