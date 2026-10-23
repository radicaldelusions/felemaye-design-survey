-- FELEMAYE · review fixes (2026-10-23c). Run after 20261023_felemaye_studio_os.sql. Safe to re-run.
-- 1. Standing review: the studio offers 2–3 slots; the client chooses one of them. Meeting requests limited to the
--    studio's real windows (default Tue–Thu, 10:00 AM–1:30 PM PT — clear of afternoon school pickup).
-- 2. Client tasks: assigned from Studio admin as drafts; the client sees nothing until the studio presses Sign & send.
-- 3. Design reads: internal materials / themes read of the client's reference images (studio only), seeded for Lorado.

-- ═══════════ 1. STANDING REVIEW OPTIONS + MEETING WINDOWS ═══════════
alter table public.project_cadence
  add column if not exists standing_options jsonb not null default '[]'::jsonb,
  add column if not exists meet_days int[] not null default '{2,3,4}',
  add column if not exists meet_start text not null default '10:00',
  add column if not exists meet_end text not null default '13:30',
  add column if not exists meet_note text;

update public.project_cadence set
  standing_options = '[{"weekday":2,"time":"10:30","minutes":45,"label":"Tuesdays · 10:30–11:15 AM PT"},
                       {"weekday":3,"time":"12:00","minutes":45,"label":"Wednesdays · 12:00–12:45 PM PT"},
                       {"weekday":4,"time":"10:30","minutes":45,"label":"Thursdays · 10:30–11:15 AM PT"}]'::jsonb,
  meet_days = '{2,3,4}', meet_start = '10:00', meet_end = '13:30',
  meet_note = 'Tuesday to Thursday · 10:00 AM to 1:30 PM Pacific'
where project_id = '67663797-dbb1-410b-b00b-a99452c6a660' and standing_options = '[]'::jsonb;

create or replace function public.client_set_standing_slot(p_project uuid, p_weekday int, p_time text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare dn text[] := array['Monday','Tuesday','Wednesday','Thursday','Friday']; opts jsonb;
begin
  if not (is_studio() or p_project in (select my_projects())) then raise exception 'not allowed'; end if;
  select standing_options into opts from project_cadence where project_id = p_project;
  if not is_studio() and jsonb_array_length(coalesce(opts,'[]')) > 0
     and not exists (select 1 from jsonb_array_elements(opts) o where (o->>'weekday')::int = p_weekday and o->>'time' = p_time) then
    raise exception 'Please choose one of the times offered.';
  end if;
  if p_weekday not between 1 and 5 then raise exception 'Choose a weekday'; end if;
  if p_time !~ '^\d{2}:\d{2}$' then raise exception 'Choose a time'; end if;
  update project_cadence set standing_weekday = p_weekday, standing_time = p_time,
         standing_note = left(nullif(btrim(coalesce(p_note,'')),''), 500), standing_set_at = now()
   where project_id = p_project;
  perform fy_notify(p_project, 'studio', 'standing_slot', 'Standing review chosen · ' || dn[p_weekday] || 's at ' || p_time, p_note, 'cadence', null);
  perform fy_log(p_project, 'standing_slot_chosen', jsonb_build_object('title', dn[p_weekday] || 's ' || p_time));
end $$;

-- "None of these work" from the client: logged as a message so it reaches the studio's inbox and email.
create or replace function public.client_standing_none_work(p_project uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_project not in (select my_projects()) then raise exception 'not allowed'; end if;
  perform post_message(p_project, 'About our standing review time: none of the offered times work for me. ' || coalesce(nullif(btrim(p_note),''), ''));
end $$;
grant execute on function public.client_standing_none_work(uuid, text) to authenticated;

-- ═══════════ 2. TASKS: DRAFT → SIGN & SEND ═══════════
alter table public.client_tasks drop constraint if exists client_tasks_status_check;
alter table public.client_tasks add constraint client_tasks_status_check
  check (status in ('draft','action_required','pending_review','completed'));
alter table public.client_tasks add column if not exists sent_at timestamptz;
alter table public.client_tasks add column if not exists sent_by text;

drop policy if exists tasks_client_read on public.client_tasks;
create policy tasks_client_read on public.client_tasks for select
  using (status <> 'draft' and project_id in (select my_projects()));

drop function if exists public.studio_assign_task(uuid, text, text, text, date);
create or replace function public.studio_assign_task(p_project uuid, p_template text, p_title text default null,
  p_detail text default null, p_due date default null, p_send boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare t record; tid uuid; slug text; base text; url text;
begin
  if not is_studio() then raise exception 'Studio only'; end if;
  select * into t from task_templates where key = p_template;
  if p_template is not null and not found then raise exception 'Unknown template %', p_template; end if;
  if coalesce(t.share,false) then
    select coalesce(p.client_slug, p.slug) into slug from projects p where p.id = p_project;
    select value into base from studio_config where key = 'family_survey_base';
    url := coalesce(base,'https://felemaye.com/survey/') || coalesce(slug,'');
  end if;
  insert into client_tasks(project_id, title, detail, status, due_on, assigned_by, kind, link_target, link_label, link_url,
                           template_key, share_url, sent_at, sent_by)
  values (p_project, coalesce(nullif(p_title,''), t.title, 'Action item'), coalesce(nullif(p_detail,''), t.detail),
          case when p_send then 'action_required' else 'draft' end,
          coalesce(p_due, current_date + coalesce(t.default_due_days, 7)), 'Felema', coalesce(t.kind,'action'),
          t.link_target, t.link_label, url, p_template, url,
          case when p_send then now() end, case when p_send then auth.email() end)
  returning id into tid;
  return tid;
end $$;
grant execute on function public.studio_assign_task(uuid,text,text,text,date,boolean) to authenticated;

create or replace function public.studio_send_task(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_studio() then raise exception 'Studio only'; end if;
  update client_tasks set status = 'action_required', sent_at = now(), sent_by = auth.email(), updated_at = now()
   where id = p_id and status = 'draft';
  if not found then raise exception 'Task not found or already sent'; end if;
end $$;
grant execute on function public.studio_send_task(uuid) to authenticated;

-- Notifications: a draft is silent; the client is told when it is sent (or when a task is created already sent).
create or replace function public.trg_cadence_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare d text;
begin
  if tg_table_name = 'async_updates' then
    if new.published_at is not null and (tg_op = 'INSERT' or old.published_at is null) then
      perform fy_notify(new.project_id,'client','async_update', new.title, left(coalesce(new.body,''),240), 'roadmap', new.id);
      perform fy_log(new.project_id,'friday_update_posted', jsonb_build_object('title', new.title));
    end if;
  elsif tg_table_name = 'meeting_agendas' then
    if new.status = 'shared' and (tg_op = 'INSERT' or old.status = 'draft') then
      perform fy_notify(new.project_id,'client','agenda_shared','Agenda ready · ' || new.title, null, 'home', new.id);
    elsif new.status = 'held' and (tg_op = 'INSERT' or old.status <> 'held') then
      perform fy_notify(new.project_id,'client','meeting_recap','Meeting recap · ' || new.title, left(coalesce(new.summary,''),240), 'home', new.id);
    end if;
  elsif tg_table_name = 'presentations' then
    if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
      perform fy_notify(new.project_id,'client','presentation', 'New presentation · ' || new.title, new.decision_prompt, 'phases', new.id);
      perform fy_log(new.project_id,'presentation_published', jsonb_build_object('title', new.title));
    end if;
  elsif tg_table_name = 'calendar_events' then
    if tg_op = 'INSERT' and new.project_id is not null then
      d := to_char(new.starts_at at time zone 'America/Los_Angeles', 'Dy Mon DD · HH12:MI AM') || ' PT';
      perform fy_notify(new.project_id,'client','event_scheduled', new.title, d, 'home', new.id);
    end if;
  elsif tg_table_name = 'client_tasks' then
    if new.status = 'action_required' and (tg_op = 'INSERT' or old.status = 'draft') then
      perform fy_notify(new.project_id,'client','task', 'New action item · ' || new.title,
        case when new.due_on is not null then 'Due ' || to_char(new.due_on,'Mon DD') end, coalesce(new.link_target,'home'), new.id);
    elsif tg_op = 'UPDATE' and new.status = 'pending_review' and old.status is distinct from 'pending_review' then
      perform fy_notify(new.project_id,'studio','task_submitted','Client completed · ' || new.title, null, 'clients', new.id);
    end if;
  elsif tg_table_name = 'phases' then
    if new.status = 'in_review' and old.status is distinct from 'in_review' then
      perform fy_notify(new.project_id,'client','signoff','Ready for your sign-off · ' || new.title, null, 'phases', new.id);
    elsif new.status = 'approved' and old.status is distinct from 'approved' then
      perform fy_notify(new.project_id,'studio','phase_approved','Client approved · ' || new.title, null, 'cadence', new.id);
    end if;
  elsif tg_table_name = 'phase_decisions' then
    if new.decision = 'request_changes' then
      perform fy_notify(new.project_id,'studio','changes_requested','Changes requested', left(coalesce(new.comment,''),240), 'cadence', new.id);
    end if;
  elsif tg_table_name = 'presentation_decisions' then
    perform fy_notify(new.project_id,'studio','option_selected','Client chose Option ' || new.option_key, left(coalesce(new.comment,''),240), 'cadence', new.presentation_id);
  elsif tg_table_name = 'meeting_requests' then
    perform fy_notify(new.project_id,'studio','meeting_requested','Meeting request · ' || coalesce(new.topic,''), new.kind, 'meetings', new.id);
  end if;
  return new;
exception when others then return new;
end $$;

-- ═══════════ 3. DESIGN READS (internal) ═══════════
create table if not exists public.design_reads (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  title        text not null,
  summary      text,
  read         jsonb not null,   -- {directions[], materials[], palette[], elements[], keep_out[], tensions[], sd_moves[], questions[], images_seen[], images_not_seen[]}
  source       text not null default 'studio',  -- studio | ai
  model        text,
  status       text not null default 'working' check (status in ('working','adopted','archived')),
  created_by   text,
  created_at   timestamptz default now()
);
alter table public.design_reads enable row level security;
drop policy if exists design_reads_studio on public.design_reads;
create policy design_reads_studio on public.design_reads for all using (is_studio()) with check (is_studio());

insert into public.design_reads(project_id, title, summary, read, source, created_by)
select '67663797-dbb1-410b-b00b-a99452c6a660', 'Reference read 01 · Banchi''s boards (Oct 23)',
 'Two families of image sit in Banchi''s boards. One is quiet: limewashed curved walls, a built-in banquette that wraps a fire feature, olive trees and columnar cactus in gravel, large pale pavers. The other is saturated: cobalt-and-white Talavera tile, red and orange cushions, bougainvillea over a timber pergola, tiled wall fountains. The house itself (1920s–30s Spanish Colonial Revival, white stucco, clay tile roof, brick pilasters and iron fence) can carry both if the quiet family sets the architecture and the saturated one is held to a few concentrated moments: one fountain wall, cushions, a tile field. She flagged that she likes a curved seat but not its brick trim.',
 jsonb_build_object(
  'directions', jsonb_build_array(
    jsonb_build_object('name','Limewash courtyard','what','Curved monolithic walls and seat backs in one plaster colour; olive + cactus in gravel; pale stone pavers set in decomposed granite; linear or round gas fire feature.','refs', jsonb_build_array('Built-In Seating Inspo','Built-In Seating Inspo 4','Built-In Seating and Screen Inspo 3','Gravel Inspo','Gravel and Landscape Inspo 2','Floor Tile Inspo')),
    jsonb_build_object('name','Talavera garden room','what','Same plaster envelope, with colour carried by tile: a cobalt/white field under the seating area or on the fountain wall, cushions in cobalt, red and saffron, terracotta pots, bougainvillea on a pergola or the fence.','refs', jsonb_build_array('Tile and Ornamental Flower Inspo','Water Fountain Inspo 3','Built-In Seating Inspo B','Ornamental and Screening Inspo'))),
  'materials', jsonb_build_array(
    jsonb_build_object('item','Walls and seat backs','spec','Cement plaster over CMU, smooth trowel or light sand finish, integral colour + limewash; rounded top edges (bullnose), no brick coping','why','Every quiet reference uses one continuous plaster surface; she rejected the brick cap.'),
    jsonb_build_object('item','Seat tops','spec','Precast concrete or limestone cap 2" thick, eased edge, sloped 1/8" per ft to drain; outdoor cushions (Sunbrella-type) in removable covers','why','Plaster seat tops stain and crack under use.'),
    jsonb_build_object('item','Screening above 42"','spec','Decorative concrete breeze block, open lattice in timber or powder-coated steel, or a continuation of the existing wrought-iron fence — confirm each pattern is ≥ 50% open','why','Title 22 limits solid fencing in the front yard; the Ivy breeze-block and arched-lattice references fit if open enough.'),
    jsonb_build_object('item','Ground','spec','Large-format pale pavers (24×48 porcelain or limestone) on a stepping-stone rhythm, set in stabilised decomposed granite / pea gravel; one tile field (cement or glazed Talavera) at the seating or fountain','why','Matches Gravel Inspo and Landscape & Path; keeps tile to one place.'),
    jsonb_build_object('item','Water','spec','Wall fountain: tiled or carved-stone surround, shell or scupper spout, recirculating pump, basin ≤ 18" deep','why','Three fountain references; all wall-mounted, none freestanding.'),
    jsonb_build_object('item','Fire','spec','Gas fire feature (round or linear) with listed burner; confirm gas line, clearances to seating and any LA County Fire requirements','why','Round and linear pits appear in four seating references.'),
    jsonb_build_object('item','Planting','spec','Multi-trunk olive (fruitless), columnar cactus (Pachycereus / Cereus), agave, lavender, bougainvillea on structure; large concrete or terracotta pots','why','Repeated across eight images; low water.'),
    jsonb_build_object('item','Metal accents','spec','Copper bar inlays or copper gate detailing (per her copper references — files too large to preview here, review in Drive)','why','Named in four of her files.'),
    jsonb_build_object('item','Light','spec','Iron lanterns at piers, recessed step lights in seat bases, warm 2700K','why','Lanterns in five references.')),
  'palette', jsonb_build_array(
    jsonb_build_object('name','Limewash white','hex','#EEE8DC'), jsonb_build_object('name','Warm plaster','hex','#DCCFB8'),
    jsonb_build_object('name','Terracotta','hex','#B4643C'), jsonb_build_object('name','Cobalt','hex','#1F3F8F'),
    jsonb_build_object('name','Olive leaf','hex','#8C9472'), jsonb_build_object('name','Iron','hex','#2A2723'),
    jsonb_build_object('name','Bougainvillea','hex','#B8285A')),
  'elements', jsonb_build_array('Curved built-in banquette against the street-side wall','Fire feature centred on the seat','Wall fountain as the view from the front door or gate','Planter wall stepping with the grade','Arched openings or lattice panels in the screen above 42"','Copper detail at the gate'),
  'keep_out', jsonb_build_array('Brick caps or brick trim on seating (her note)','Freestanding tiered fountains','Tile on every surface — choose one field'),
  'tensions', jsonb_build_array(
    'The existing brick pilasters and iron fence read Spanish Revival; the limewash references are Ibiza-modern. Decide whether pilasters are kept, plastered over, or replaced.',
    'Seat backs that double as the enclosure wall must stay at or under 42" solid; anything taller has to be ≥ 50% open.',
    'Water + fire + seating in a ~1,488 sq ft front yard: rank them before SD so the plan has one focal point.',
    'Saturated colour (cobalt, red cushions) photographs well on screens; confirm in daylight samples on site.'),
  'sd_moves', jsonb_build_array(
    'Option A: keep pilasters, new iron infill gate with copper detail, low plaster seat wall behind the fence line, fountain on the house side.',
    'Option B: new curved CMU enclosure at 42" with plaster finish, open breeze-block or lattice above, banquette and fire feature inside, tile field at the seating.',
    'Test both with the same palette so the comparison is about enclosure, not colour.'),
  'questions', jsonb_build_array(
    'Fire, water, or both? If one, which?',
    'How many people should the banquette seat on an ordinary evening — 6, 10?',
    'Is the courtyard for evenings mostly (lighting, fire) or daytime (shade, pergola)?',
    'Keep the brick pilasters, or let them go?',
    'Tile: one statement field, or none?'),
  'images_seen', 21,
  'images_not_seen', jsonb_build_array('Front Gate Inspo (A, B, C, Up Close, Copper Gate)','Retainer Wall Copper Bar Up Close','Retainer Wall Inspo With Copper Bars','Up Close of Retainer Wall Inspo With Copper Bars','Retainer Wall Curve Inspo','Retainer Wall Cut-Out Inspo','Retainer Wall Planter Inspo')),
 'studio', 'felema@felemaye.com'
where not exists (select 1 from public.design_reads where project_id = '67663797-dbb1-410b-b00b-a99452c6a660');
