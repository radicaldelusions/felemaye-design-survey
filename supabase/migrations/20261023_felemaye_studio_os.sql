-- FELEMAYE · Studio OS (2026-10-23)
-- 1. Notifications that reliably reach both sides (portal + email), with per-person counts
-- 2. Reimbursables v2: tax buckets, IRS mileage engine, curated client lines, batched statements
-- 3. Portal conversation (messages) + task templates (family survey share, uploads, approvals)
-- 4. Network directory (realtors, brokers, expediters), growth: targets, pipeline, leads
-- 5. Proposal & fee estimates (WBS) · follow-up reminders · vendor-reply capture
-- Safe to re-run. RLS on every table. Clients never see trade discounts, raw mileage math,
-- markups, internal notes, waterfall, or consultant rep contacts.

-- ═════════════════════════════════════════════ 1. NOTIFICATIONS ═════════════════════════════════════════════
-- Make: scenario 6613470 "FELEMAYE | Survey + Portal Notifications (client + studio)" (hook 2928434) routes
-- event=portal_notification to the client (audience=client) or to felema@felemaye.com (audience=studio).
insert into public.studio_config(key, value) values
  ('make_notifications_webhook', 'https://hook.us2.make.com/p26zwyaolw59r3a46gphr5wxqz95oc0o'),
  -- kinds that already send their own branded email through the Credentials & Access scenario; listed here so
  -- nobody receives two emails for one event. Edit the list any time (comma-separated).
  ('notify_email_skip_kinds', 'meeting_requested,phase_approved,changes_requested,signoff,client_upload,studio_upload'),
  ('family_survey_base', 'https://felemaye.com/survey/')
on conflict (key) do nothing;

create or replace function public.fy_notify(p_project uuid, p_audience text, p_kind text, p_title text, p_body text, p_link text, p_ref uuid)
returns void language plpgsql security definer set search_path = public as $$
declare skip text;
begin
  insert into public.portal_notifications (project_id, audience, kind, title, body, link_target, ref_id)
  values (p_project, p_audience, p_kind, left(p_title,200), left(p_body,600), p_link, p_ref);
  select value into skip from public.studio_config where key = 'notify_email_skip_kinds';
  if p_kind = any(string_to_array(replace(coalesce(skip,''),' ',''), ',')) then return; end if;
  begin  -- email fan-out never blocks the write
    perform public.notify_make('make_notifications_webhook',
      jsonb_build_object('event','portal_notification','audience',p_audience,'kind',p_kind,
                         'title',p_title,'body',coalesce(p_body,''),'link',coalesce(p_link,''),'project_id',p_project));
  exception when others then null;
  end;
end $$;

-- ═════════════════════════════════════════════ 2. REIMBURSABLES v2 ═════════════════════════════════════════════
create table if not exists public.irs_mileage_rates (
  effective_from date primary key,
  effective_to   date not null,
  rate           numeric(5,3) not null check (rate > 0),
  source         text,
  created_at     timestamptz default now()
);
alter table public.irs_mileage_rates enable row level security;
drop policy if exists irs_rates_read on public.irs_mileage_rates;
create policy irs_rates_read on public.irs_mileage_rates for select using (auth.role() = 'authenticated');
drop policy if exists irs_rates_studio on public.irs_mileage_rates;
create policy irs_rates_studio on public.irs_mileage_rates for all using (is_studio()) with check (is_studio());
-- Rates as set by the studio for 2026 (confirm against the IRS notice each year and add a row).
insert into public.irs_mileage_rates(effective_from, effective_to, rate, source) values
  ('2026-01-01','2026-06-30',0.725,'Studio master brief, Oct 2026 — IRS standard business rate H1 2026'),
  ('2026-07-01','2026-12-31',0.760,'Studio master brief, Oct 2026 — IRS standard business rate H2 2026')
on conflict (effective_from) do update set rate = excluded.rate, effective_to = excluded.effective_to, source = excluded.source;

create or replace function public.irs_rate_on(p_date date) returns numeric
language sql stable security definer set search_path = public as $$
  select rate from irs_mileage_rates where p_date between effective_from and effective_to
  order by effective_from desc limit 1
$$;

create table if not exists public.reimbursable_statements (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  number        text,
  period_label  text,
  period_start  date,
  period_end    date,
  basis         text not null default 'monthly' check (basis in ('monthly','milestone')),
  status        text not null default 'draft' check (status in ('draft','sent','approved','paid','void')),
  total         numeric(12,2) not null default 0,
  client_note   text,          -- message shown to the client with the statement
  client_reply  text,
  pay_url       text,
  sent_at       timestamptz,
  approved_at   timestamptz,
  approved_by   text,
  paid_at       timestamptz,
  invoice_id    uuid,
  created_at    timestamptz default now()
);
alter table public.reimbursable_statements enable row level security;
drop policy if exists stmt_studio on public.reimbursable_statements;
create policy stmt_studio on public.reimbursable_statements for all using (is_studio()) with check (is_studio());
drop policy if exists stmt_client_read on public.reimbursable_statements;
create policy stmt_client_read on public.reimbursable_statements for select
  using (status <> 'draft' and project_id in (select my_projects()));

alter table public.studio_reimbursables
  add column if not exists bucket          text not null default 'client_reimbursable',
  add column if not exists miles           numeric(8,2),
  add column if not exists rate_per_mile   numeric(5,3),
  add column if not exists flat_fee        numeric(10,2),
  add column if not exists list_price      numeric(12,2),   -- what the client is shown for trade items (list / agreed net)
  add column if not exists trade_cost      numeric(12,2),   -- studio's net after trade discount (internal)
  add column if not exists client_label    text,            -- curated client-facing line
  add column if not exists internal_notes  text,
  add column if not exists receipt_client_visible boolean not null default false,
  add column if not exists statement_id    uuid references public.reimbursable_statements(id) on delete set null,
  add column if not exists trip_from       text,
  add column if not exists trip_to         text;

do $$ begin
  alter table public.studio_reimbursables add constraint studio_reimb_bucket_chk
    check (bucket in ('client_reimbursable','studio_opex'));
exception when duplicate_object then null; end $$;

-- Category vocabulary (the console offers these; old free-text labels are mapped by the trigger).
create or replace function public.reimb_category_norm(p text) returns text language sql immutable as $$
  select case
    when p is null then 'other'
    when p ~* 'mileage|travel' then 'mileage'
    when p ~* 'print|plot' then 'printing'
    when p ~* 'permit|filing|fee' then 'filing_fees'
    when p ~* 'sample|material|swatch' then 'samples'
    when p ~* 'courier|ship|freight|delivery' then 'courier'
    when p ~* 'consult' then 'consultant'
    when p ~* 'software|subscription|bim|revit|adobe' then 'software'
    when p ~* 'host|domain' then 'hosting'
    when p ~* 'legal|attorney' then 'legal'
    when p ~* 'insur' then 'insurance'
    when p ~* 'vehicle|car maint' then 'vehicle'
    when p ~* 'equipment|hardware|computer' then 'equipment'
    when p ~* 'meal|food|dining' then 'meals'
    when p ~* 'gas|fuel' then 'fuel'
    when p ~* 'admin|office|drive' then 'admin'
    else lower(p) end
$$;

create or replace function public.trg_reimb_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.category := reimb_category_norm(new.category);
  if new.project_id is null then new.bucket := 'studio_opex'; end if;
  if new.bucket = 'client_reimbursable' then
    if new.category in ('fuel') then
      raise exception 'Gas receipts are never invoiced. Log the trip as mileage (miles × IRS rate) instead.';
    elsif new.category in ('meals','software','equipment','hosting','legal','insurance','vehicle','admin') then
      raise exception '"%" is a studio operating expense, not a client reimbursable. Save it with bucket = studio_opex.', new.category;
    elsif new.category not in ('mileage','printing','filing_fees','samples','courier','consultant','other') then
      raise exception 'Unknown reimbursable category: %', new.category;
    end if;
  else
    new.billable := false;
  end if;
  if new.category = 'mileage' then
    if coalesce(new.flat_fee,0) > 0 then
      new.amount := new.flat_fee;
    else
      if new.miles is null or new.miles <= 0 then raise exception 'Mileage needs the miles driven.'; end if;
      new.rate_per_mile := coalesce(new.rate_per_mile, irs_rate_on(new.spent_on));
      if new.rate_per_mile is null then raise exception 'No IRS mileage rate on file for %. Add it in Reimbursables › Rates.', new.spent_on; end if;
      new.amount := round(new.miles * new.rate_per_mile, 2);
    end if;
    new.markup_pct := 0;                       -- mileage is at cost
    new.receipt_client_visible := false;
    new.description := coalesce(nullif(new.description,''),
      'Site travel: ' || trim(to_char(new.miles,'FM999990.0')) || ' mi @ $' || trim(to_char(new.rate_per_mile,'FM0.000')) || '/mi');
  end if;
  if new.client_label is null or new.client_label = '' then
    new.client_label := case new.category
      when 'mileage'     then 'Reimbursable Expense: On-site Survey & Travel'
      when 'printing'    then 'Reimbursable Expense: Printing & Plotting'
      when 'filing_fees' then 'Agency Filing Fee (pass-through at cost)'
      when 'samples'     then 'Reimbursable Expense: Material Samples'
      when 'courier'     then 'Reimbursable Expense: Courier & Sample Delivery'
      when 'consultant'  then 'Consultant Fee (pass-through)'
      else 'Reimbursable Expense' end;
  end if;
  if new.amount is null or new.amount <= 0 then raise exception 'Enter the amount.'; end if;
  return new;
end $$;
drop trigger if exists reimb_rules on public.studio_reimbursables;
create trigger reimb_rules before insert or update of category, bucket, miles, rate_per_mile, flat_fee, amount, spent_on, client_label, project_id
  on public.studio_reimbursables for each row execute function public.trg_reimb_rules();

-- Curated client view (replaces the earlier version; same columns so the portal keeps working).
-- vendor → curated label, category → client group, amount → billed amount (no cost / markup / trade price).
create or replace function public.client_reimbursables(p_project uuid)
returns table(id uuid, spent_on date, vendor text, category text, description text, amount numeric, billed numeric,
              status text, needs_auth boolean, auth_status text, receipt_path text)
language sql stable security definer set search_path = public as $$
  select r.id, r.spent_on, r.client_label,
         case r.category when 'mileage' then 'Site travel' when 'printing' then 'Printing & plotting'
                         when 'filing_fees' then 'Agency fees' when 'samples' then 'Samples & swatches'
                         when 'courier' then 'Courier & delivery' when 'consultant' then 'Consultants' else 'Other' end,
         coalesce(s.period_label, ''),
         round(coalesce(r.list_price, r.amount*(1+coalesce(r.markup_pct,0)/100)),2),
         round(coalesce(r.list_price, r.amount*(1+coalesce(r.markup_pct,0)/100)),2),
         r.status, coalesce(r.amount > 250, false), r.client_auth_status,
         case when r.receipt_client_visible then r.receipt_path end
  from studio_reimbursables r left join reimbursable_statements s on s.id = r.statement_id
  where r.project_id = p_project and r.billable and r.bucket = 'client_reimbursable'
    and (is_studio() or p_project in (select my_projects()))
  order by r.spent_on desc
$$;

-- Client statement list with curated, grouped lines.
create or replace function public.client_statements(p_project uuid)
returns table(id uuid, number text, period_label text, period_start date, period_end date, basis text, status text,
              total numeric, client_note text, pay_url text, sent_at timestamptz, approved_at timestamptz, paid_at timestamptz, lines jsonb)
language sql stable security definer set search_path = public as $$
  select s.id, s.number, s.period_label, s.period_start, s.period_end, s.basis, s.status, s.total, s.client_note, s.pay_url,
         s.sent_at, s.approved_at, s.paid_at,
         coalesce((select jsonb_agg(jsonb_build_object('label', g.label, 'count', g.n, 'amount', g.amt) order by g.label)
                   from (select r.client_label label, count(*) n,
                                round(sum(coalesce(r.list_price, r.amount*(1+coalesce(r.markup_pct,0)/100))),2) amt
                         from studio_reimbursables r where r.statement_id = s.id group by r.client_label) g), '[]'::jsonb)
  from reimbursable_statements s
  where s.project_id = p_project and s.status <> 'draft'
    and (is_studio() or p_project in (select my_projects()))
  order by coalesce(s.period_end, s.created_at::date) desc
$$;

-- Studio: batch every unbilled, billable item in a window into one statement (draft).
create or replace function public.studio_build_statement(p_project uuid, p_start date, p_end date, p_label text default null, p_basis text default 'monthly')
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid; n int; tot numeric; num text;
begin
  if not is_studio() then raise exception 'Studio only'; end if;
  select count(*) into n from reimbursable_statements where project_id = p_project;
  num := 'RS-' || to_char(coalesce(p_end, current_date),'YYMM') || '-' || lpad((n+1)::text, 2, '0');
  insert into reimbursable_statements(project_id, number, period_label, period_start, period_end, basis)
  values (p_project, num, coalesce(p_label, to_char(coalesce(p_end,current_date),'FMMonth YYYY') || ' reimbursables'), p_start, p_end, coalesce(p_basis,'monthly'))
  returning id into sid;
  update studio_reimbursables set statement_id = sid, status = 'invoiced'
   where project_id = p_project and billable and bucket = 'client_reimbursable' and statement_id is null
     and status = 'logged' and spent_on between coalesce(p_start,'1900-01-01') and coalesce(p_end, current_date)
     and not (amount > 250 and coalesce(client_auth_status,'') <> 'authorized');
  select coalesce(round(sum(coalesce(list_price, amount*(1+coalesce(markup_pct,0)/100))),2),0) into tot
    from studio_reimbursables where statement_id = sid;
  if tot = 0 then delete from reimbursable_statements where id = sid; raise exception 'Nothing unbilled in that window (items over $250 need written approval first).'; end if;
  update reimbursable_statements set total = tot where id = sid;
  return sid;
end $$;

create or replace function public.studio_send_statement(p_id uuid, p_note text default null, p_pay_url text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if not is_studio() then raise exception 'Studio only'; end if;
  update reimbursable_statements set status = 'sent', sent_at = now(),
         client_note = coalesce(p_note, client_note), pay_url = coalesce(p_pay_url, pay_url)
   where id = p_id and status in ('draft','sent') returning * into s;
  if not found then raise exception 'Statement not found or already approved'; end if;
  perform fy_notify(s.project_id, 'client', 'statement', 'Reimbursable statement · ' || s.period_label,
    'Total ' || to_char(s.total, 'FM$999,999,990.00') || '. Review the summary and approve in one click.', 'ledger', s.id);
end $$;

create or replace function public.client_approve_statement(p_id uuid, p_reply text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  update reimbursable_statements set status = 'approved', approved_at = now(), approved_by = auth.email(), client_reply = p_reply
   where id = p_id and status = 'sent' and project_id in (select my_projects()) returning * into s;
  if not found then raise exception 'not available'; end if;
  perform fy_notify(s.project_id, 'studio', 'statement_approved', 'Statement approved · ' || s.period_label,
    to_char(s.total, 'FM$999,999,990.00') || coalesce(' — ' || nullif(p_reply,''), ''), 'reimbursables', s.id);
  perform fy_log(s.project_id, 'statement_approved', jsonb_build_object('number', s.number, 'total', s.total));
end $$;

create or replace function public.studio_mark_statement_paid(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_studio() then raise exception 'Studio only'; end if;
  update reimbursable_statements set status = 'paid', paid_at = now() where id = p_id;
  update studio_reimbursables set status = 'reimbursed' where statement_id = p_id;
end $$;

-- ═════════════════════════════════════════════ 3. CONVERSATION + TASK TEMPLATES ═════════════════════════════════════════════
create table if not exists public.project_messages (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  sender_role       text not null check (sender_role in ('client','studio')),
  sender_email      text,
  sender_name       text,
  body              text not null check (length(body) between 1 and 8000),
  attachments       jsonb not null default '[]'::jsonb,   -- [{name, path}] in project-files
  read_by_client_at timestamptz,
  read_by_studio_at timestamptz,
  created_at        timestamptz default now()
);
create index if not exists project_messages_proj on public.project_messages(project_id, created_at);
alter table public.project_messages enable row level security;
drop policy if exists msg_studio on public.project_messages;
create policy msg_studio on public.project_messages for all using (is_studio()) with check (is_studio());
drop policy if exists msg_client_read on public.project_messages;
create policy msg_client_read on public.project_messages for select using (project_id in (select my_projects()));
-- writes go through post_message() so the sender role can't be spoofed

create or replace function public.post_message(p_project uuid, p_body text, p_attachments jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare mid uuid; role text; nm text;
begin
  if is_studio() then role := 'studio'; nm := 'Felema';
  elsif p_project in (select my_projects()) then
    role := 'client';
    select coalesce(c.full_name, c.name) into nm from clients c where lower(c.email) = lower(auth.email()) limit 1;
  else raise exception 'not available'; end if;
  if coalesce(trim(p_body),'') = '' then raise exception 'Write a message first.'; end if;
  insert into project_messages(project_id, sender_role, sender_email, sender_name, body, attachments,
                               read_by_client_at, read_by_studio_at)
  values (p_project, role, auth.email(), nm, trim(p_body), coalesce(p_attachments,'[]'::jsonb),
          case when role='client' then now() end, case when role='studio' then now() end)
  returning id into mid;
  perform fy_notify(p_project, case when role='client' then 'studio' else 'client' end, 'message',
    case when role='client' then 'New message from ' || coalesce(split_part(nm,' ',1),'your client') else 'New message from Felema' end,
    left(trim(p_body), 400), 'messages', mid);
  return mid;
end $$;

create or replace function public.mark_messages_read(p_project uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if is_studio() then
    update project_messages set read_by_studio_at = now() where project_id = p_project and read_by_studio_at is null;
    update portal_notifications set read_at = now() where project_id = p_project and audience='studio' and kind='message' and read_at is null;
  elsif p_project in (select my_projects()) then
    update project_messages set read_by_client_at = now() where project_id = p_project and read_by_client_at is null;
    update portal_notifications set read_at = now() where project_id = p_project and audience='client' and kind='message' and read_at is null;
  end if;
end $$;

create table if not exists public.task_templates (
  key            text primary key,
  title          text not null,
  detail         text,
  kind           text not null default 'action',
  link_target    text,
  link_label     text,
  default_due_days int default 7,
  share          boolean not null default false,   -- creates a link the client can pass to others
  sort           int default 100
);
alter table public.task_templates enable row level security;
drop policy if exists tt_read on public.task_templates;
create policy tt_read on public.task_templates for select using (auth.role() = 'authenticated');
drop policy if exists tt_studio on public.task_templates;
create policy tt_studio on public.task_templates for all using (is_studio()) with check (is_studio());
insert into public.task_templates(key, title, detail, kind, link_target, link_label, default_due_days, share, sort) values
 ('family_survey','Share the family survey','Send this link to everyone who will use the courtyard — family, kids, frequent guests. Each response arrives here and is filed to the project Drive. Five minutes each, phone-friendly.','family_survey','family','Copy the share link',10,true,10),
 ('upload_references','Upload reference images','Add photos of courtyards, gates, tile, planting or lighting you love (and any you don''t). Screenshots and Pinterest saves are fine.','upload','files','Open Files',7,false,20),
 ('site_documents','Upload property documents','Property survey, title report, any prior permits or HOA letters you have. If you don''t have them, tell us and we''ll order them.','upload','files','Open Files',10,false,30),
 ('review_day','Confirm your standing review day','Pick the weekday and time that works for our recurring design reviews.','schedule','home','Choose a day',3,false,40),
 ('review_presentation','Review the presentation','Look through the options and choose a direction, or ask for changes.','review','phases','Open Checkpoints',5,false,50),
 ('approve_statement','Approve the reimbursable statement','A summary of pass-through expenses for the period. Approve in one click.','approve','ledger','Open Ledger',7,false,60),
 ('consultant_decision','Choose your structural engineer','Compare the proposals side by side and select one. You sign directly with the engineer; we coordinate.','decision','team','Open Directory',7,false,70),
 ('site_photos','Send site photos','Front yard from the street, the gate, both side yards and the porch — daytime, landscape orientation.','upload','files','Open Files',5,false,80),
 ('book_meeting','Book a working session','Choose a time for a focused session on the open questions.','schedule','meet','Schedule',5,false,90)
on conflict (key) do update set title = excluded.title, detail = excluded.detail, kind = excluded.kind,
  link_target = excluded.link_target, link_label = excluded.link_label, default_due_days = excluded.default_due_days,
  share = excluded.share, sort = excluded.sort;

alter table public.client_tasks add column if not exists template_key text;
alter table public.client_tasks add column if not exists share_url text;

create or replace function public.studio_assign_task(p_project uuid, p_template text, p_title text default null,
  p_detail text default null, p_due date default null)
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
  insert into client_tasks(project_id, title, detail, status, due_on, assigned_by, kind, link_target, link_label, link_url, template_key, share_url)
  values (p_project, coalesce(nullif(p_title,''), t.title, 'Action item'), coalesce(nullif(p_detail,''), t.detail),
          'action_required', coalesce(p_due, current_date + coalesce(t.default_due_days, 7)), auth.email(),
          coalesce(t.kind,'action'), t.link_target, t.link_label, url, p_template, url)
  returning id into tid;   -- trg_cadence_notify tells the client (portal + email)
  return tid;
end $$;

-- Family survey: count responses on the task, notify both sides, mark for Drive filing.
alter table public.family_survey_responses add column if not exists drive_synced_at timestamptz;
alter table public.family_survey_responses add column if not exists drive_file_url text;

create or replace function public.trg_family_survey_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from family_survey_responses where project_id = new.project_id;
  perform fy_notify(new.project_id, 'studio', 'family_survey', 'Family survey response · ' || coalesce(nullif(new.nickname,''),'a family member'),
    n || ' response' || case when n = 1 then '' else 's' end || ' so far.', 'family', new.id);
  perform fy_notify(new.project_id, 'client', 'family_survey', coalesce(nullif(new.nickname,''),'Someone') || ' answered the family survey',
    n || ' response' || case when n = 1 then '' else 's' end || ' so far. See them in Family Insights.', 'family', new.id);
  update client_tasks set detail = regexp_replace(coalesce(detail,''), '\s*\(\d+ responses? so far\)$', '') || ' (' || n || ' response' || case when n=1 then '' else 's' end || ' so far)',
         updated_at = now()
   where project_id = new.project_id and template_key = 'family_survey' and status = 'action_required';
  return new;
exception when others then return new;
end $$;
drop trigger if exists family_survey_notify on public.family_survey_responses;
create trigger family_survey_notify after insert on public.family_survey_responses
  for each row execute function public.trg_family_survey_notify();

-- Uploads and receipts show in the bell on the other side (email for uploads already goes out separately).
create or replace function public.trg_upload_bell() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'project_files' then
    if new.direction in ('client','client_to_studio') then
      perform fy_notify(new.project_id, 'studio', 'client_upload', 'Client uploaded · ' || coalesce(new.name,'a file'), new.category, 'files', new.id);
    elsif new.category is distinct from 'reference' then
      perform fy_notify(new.project_id, 'client', 'studio_upload', 'New file · ' || coalesce(new.name,'from the studio'), new.category, 'files', new.id);
    end if;
  elsif tg_table_name = 'project_receipts' then
    perform fy_notify(new.project_id, 'studio', 'receipt_uploaded', 'Receipt uploaded · ' || coalesce(new.title, new.vendor, 'receipt'),
      case when new.amount is not null then to_char(new.amount,'FM$999,999,990.00') end, 'reimbursables', new.id);
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists upload_bell on public.project_files;
create trigger upload_bell after insert on public.project_files for each row execute function public.trg_upload_bell();
do $$ begin
  if to_regclass('public.project_receipts') is not null then
    execute 'drop trigger if exists upload_bell on public.project_receipts';
    execute 'create trigger upload_bell after insert on public.project_receipts for each row execute function public.trg_upload_bell()';
  end if;
end $$;

-- ═════════════════════════════════════════════ 4. NETWORK + GROWTH ═════════════════════════════════════════════
create table if not exists public.network_contacts (
  id                 uuid primary key default gen_random_uuid(),
  kind               text not null check (kind in ('realtor','broker','expediter','lender','attorney','contractor','developer','other')),
  name               text,
  firm               text,
  market             text not null default 'LA' check (market in ('LA','NY','both')),
  area               text,               -- e.g. View Park–Windsor Hills, Leimert Park, Baldwin Hills
  email              text,
  phone              text,
  website            text,
  license_no         text,
  source_url         text,
  why                text,               -- why they matter / track record (verified facts only)
  collaboration      text,               -- referral idea
  vetting_status     text not null default 'to_verify' check (vetting_status in ('to_verify','verified','warm','do_not_use')),
  relationship       text not null default 'cold' check (relationship in ('cold','intro_sent','warm','active','partner')),
  last_contact_date  date,
  next_follow_up     date,
  notes              text,
  created_at         timestamptz default now(),
  unique nulls not distinct (kind, firm, name)
);
alter table public.network_contacts enable row level security;
drop policy if exists network_studio on public.network_contacts;
create policy network_studio on public.network_contacts for all using (is_studio()) with check (is_studio());

create table if not exists public.studio_targets (
  year                int primary key,
  revenue_target      numeric(12,2) not null,
  profit_target       numeric(12,2),
  owner_pay_target    numeric(12,2),
  max_active_projects int default 4,
  max_weekly_hours    numeric(5,1) default 40,
  avg_fee_target      numeric(12,2),
  notes               text,
  updated_at          timestamptz default now()
);
alter table public.studio_targets enable row level security;
drop policy if exists targets_studio on public.studio_targets;
create policy targets_studio on public.studio_targets for all using (is_studio()) with check (is_studio());
-- Placeholder targets so the dashboard renders; edit in Growth › Targets.
insert into public.studio_targets(year, revenue_target, profit_target, max_active_projects, max_weekly_hours, avg_fee_target, notes) values
  (2026, 60000, 30000, 3, 40, 9000, 'Placeholder — set in Growth › Targets'),
  (2027, 180000, 85000, 5, 40, 18000, 'Placeholder — set in Growth › Targets')
on conflict (year) do nothing;

create table if not exists public.pipeline_deals (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  client_name      text,
  contact_email    text,
  market           text default 'LA' check (market in ('LA','NY')),
  project_type     text default 'residential' check (project_type in ('residential','commercial','hospitality','retail','other')),
  source           text,             -- referral, website, realtor:<name>, lead_signal, repeat
  stage            text not null default 'lead' check (stage in ('lead','qualified','proposal','negotiation','won','lost','on_hold')),
  est_fee          numeric(12,2),
  probability      numeric(4,2),     -- 0–1; defaults by stage when null
  expected_start   date,
  duration_weeks   int default 12,
  weekly_hours     numeric(5,1) default 10,
  project_id       uuid references public.projects(id) on delete set null,
  estimate_id      uuid,
  network_contact_id uuid references public.network_contacts(id) on delete set null,
  lead_signal_id   uuid,
  next_step        text,
  next_step_on     date,
  lost_reason      text,
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
alter table public.pipeline_deals enable row level security;
drop policy if exists deals_studio on public.pipeline_deals;
create policy deals_studio on public.pipeline_deals for all using (is_studio()) with check (is_studio());
insert into public.pipeline_deals(name, client_name, market, project_type, source, stage, est_fee, probability, expected_start, duration_weeks, weekly_hours, project_id, next_step)
select 'The Lorado Courtyard', 'Banchi Abegaze', 'LA', 'residential', 'referral', 'won', 9000, 1, '2026-10-13', 20, 12,
       '67663797-dbb1-410b-b00b-a99452c6a660', 'SD delivery'
where not exists (select 1 from public.pipeline_deals where project_id = '67663797-dbb1-410b-b00b-a99452c6a660');

create table if not exists public.lead_signals (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,        -- nyc_dob_now, nyc_dob_jobs, ladbs_permits, la_county_epic, manual
  market       text not null check (market in ('LA','NY')),
  external_id  text not null,
  address      text,
  neighborhood text,
  permit_type  text,
  work_type    text,
  description  text,
  valuation    numeric(14,2),
  filed_on     date,
  applicant    text,                 -- design professional / applicant firm on the public record
  status       text not null default 'new' check (status in ('new','reviewing','pursue','contacted','converted','dismissed')),
  score        int,
  score_why    text,
  url          text,
  raw          jsonb,
  created_at   timestamptz default now(),
  unique (source, external_id)
);
alter table public.lead_signals enable row level security;
drop policy if exists leads_studio on public.lead_signals;
create policy leads_studio on public.lead_signals for all using (is_studio()) with check (is_studio());

-- Lead scoring rules the scout uses (editable).
insert into public.studio_config(key, value) values
  ('lead_scout_rules', '{"LA":{"zips":["90008","90043","90016","90018","90056","90062","90047","90302","90305"],"keywords":["addition","adu","remodel","courtyard","patio","facade","restaurant","tenant improvement","retail"],"min_valuation":25000},"NY":{"boroughs":["BROOKLYN","MANHATTAN","QUEENS"],"keywords":["alteration","restaurant","retail","storefront","brownstone","rear yard","enlargement"],"min_valuation":50000}}')
on conflict (key) do nothing;

-- ═════════════════════════════════════════════ 5. PROPOSALS · FOLLOW-UPS · VENDOR REPLIES ═════════════════════════════════════════════
create table if not exists public.proposal_estimates (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  project_id      uuid references public.projects(id) on delete set null,
  deal_id         uuid references public.pipeline_deals(id) on delete set null,
  project_type    text not null default 'residential' check (project_type in ('residential','commercial')),
  tiers           jsonb not null,     -- {principal:{bill,cost}, pm:{...}, designer:{...}, admin:{...}}
  wbs             jsonb not null,     -- [{phase, tasks:[{name, hours:{principal,pm,designer,admin}}]}]
  adders          jsonb not null default '[]'::jsonb,
  multiplier      numeric(4,2) not null default 3.0,
  contingency_pct numeric(5,2) not null default 15,
  reimbursables   numeric(12,2) not null default 0,
  quoted_fee      numeric(12,2),
  totals          jsonb,
  status          text not null default 'draft' check (status in ('draft','sent','accepted','declined','archived')),
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.proposal_estimates enable row level security;
drop policy if exists est_studio on public.proposal_estimates;
create policy est_studio on public.proposal_estimates for all using (is_studio()) with check (is_studio());

create table if not exists public.follow_up_reminders (
  id           uuid primary key default gen_random_uuid(),
  thread_id    text,
  subject      text,
  counterpart  text,
  category     text default 'other' check (category in ('client','vendor','consultant','agency','lead','network','other')),
  last_sent_on date,
  due_on       date,
  status       text not null default 'open' check (status in ('open','snoozed','done')),
  suggestion   text,
  source       text default 'gmail_digest',
  created_at   timestamptz default now(),
  unique (thread_id)
);
alter table public.follow_up_reminders enable row level security;
drop policy if exists fu_studio on public.follow_up_reminders;
create policy fu_studio on public.follow_up_reminders for all using (is_studio()) with check (is_studio());

-- Vendor replied by email → update the rep + account in one call (used by the daily inbox task and the console).
create or replace function public.studio_capture_vendor_reply(p_vendor text, p_email text, p_name text default null,
  p_phone text default null, p_title text default null, p_note text default null, p_account_status text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v record; rid uuid; dom text := lower(split_part(coalesce(p_email,''),'@',2));
begin
  -- studio user, service role, or a direct database session (scheduled inbox task via the database connector)
  if not is_studio() and coalesce(auth.role(),'') <> 'service_role' and session_user not in ('postgres','supabase_admin') then
    raise exception 'Studio only'; end if;
  select * into v from vendors
   where lower(name) = lower(trim(p_vendor))
      or (dom <> '' and dom not in ('gmail.com','yahoo.com','outlook.com','icloud.com','hotmail.com') and lower(website) like '%' || dom || '%')
   order by (lower(name) = lower(trim(p_vendor))) desc limit 1;
  if not found then return jsonb_build_object('ok', false, 'reason', 'vendor not found'); end if;
  select id into rid from sales_reps where vendor_id = v.id and lower(email) = lower(p_email) limit 1;
  if rid is null then
    insert into sales_reps(vendor_id, name, title, email, phone, notes, last_contact_date, source, is_primary)
    values (v.id, coalesce(p_name, split_part(p_email,'@',1)), p_title, lower(p_email), p_phone, p_note, current_date, 'email_reply',
            not exists (select 1 from sales_reps where vendor_id = v.id))
    returning id into rid;
  else
    update sales_reps set name = coalesce(p_name, name), phone = coalesce(p_phone, phone), title = coalesce(p_title, title),
           notes = concat_ws(E'\n', notes, nullif(p_note,'')), last_contact_date = current_date where id = rid;
  end if;
  update vendors set last_contact_date = current_date, primary_rep_id = coalesce(primary_rep_id, rid),
         relationship_status = case when coalesce(relationship_status,'') in ('','none','cold') then 'in_contact' else relationship_status end,
         interaction_notes = concat_ws(E'\n', interaction_notes, to_char(current_date,'YYYY-MM-DD') || ' reply: ' || coalesce(nullif(p_note,''),'(no note)'))
   where id = v.id;
  update trade_accounts set rep_id = coalesce(rep_id, rid),
         status = coalesce(nullif(p_account_status,''), status), updated_at = now()
   where vendor_id = v.id;
  return jsonb_build_object('ok', true, 'vendor', v.name, 'rep_id', rid);
end $$;

-- Vendor review queue summary: what needs a human, grouped by the action that clears it.
create or replace view public.v_vendor_review_queue as
select t.id as trade_account_id, v.id as vendor_id, v.name, v.website, t.status, t.discovery_status, t.review_reason,
       t.application_url, t.attempt_count, t.last_attempt_at,
       case
         when coalesce(t.review_reason,'') ~* 'captcha' then 'assist_captcha'
         when coalesce(t.review_reason,'') ~* 'no application form' then 'email_rep'
         when coalesce(t.review_reason,'') ~* 'wrong page' then 'fix_link'
         when coalesce(t.review_reason,'') ~* 'no confirmation' then 'check_inbox'
         when coalesce(t.review_reason,'') ~* 'required fields|form reported|stuck on step' then 'finish_form'
         when t.status = 'Not Applied' and t.discovery_status = 'not_found' then 'find_link'
         when t.status = 'Not Applied' then 'retry'
         else 'review' end as action
from trade_accounts t join vendors v on v.id = t.vendor_id
where t.status in ('Needs Manual Review','Not Applied');
alter view public.v_vendor_review_queue set (security_invoker = on);

-- touch triggers
do $$ begin
  if exists (select 1 from pg_proc where proname = 'fy_touch') then
    execute 'drop trigger if exists touch on public.pipeline_deals';
    execute 'create trigger touch before update on public.pipeline_deals for each row execute function public.fy_touch()';
    execute 'drop trigger if exists touch on public.proposal_estimates';
    execute 'create trigger touch before update on public.proposal_estimates for each row execute function public.fy_touch()';
  end if;
end $$;

grant execute on function public.post_message(uuid,text,jsonb), public.mark_messages_read(uuid),
  public.client_statements(uuid), public.client_approve_statement(uuid,text), public.client_reimbursables(uuid),
  public.studio_build_statement(uuid,date,date,text,text), public.studio_send_statement(uuid,text,text),
  public.studio_mark_statement_paid(uuid), public.studio_assign_task(uuid,text,text,text,date),
  public.studio_capture_vendor_reply(text,text,text,text,text,text,text), public.irs_rate_on(date) to authenticated;

-- realtime for the bell + conversation (ignore if already added)
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.portal_notifications'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.project_messages'; exception when others then null; end;
end $$;

-- ═════════════════════════════════════════════ COUNTS (after all tables exist) ═════════════════════════════════════════════
-- Unread counts for the bell / tab title. Client: their projects only. Studio: everything addressed to studio.
create or replace function public.notification_counts(p_project uuid default null)
returns table(unread_notifications bigint, unread_messages bigint, open_tasks bigint, pending_statements bigint)
language sql stable security definer set search_path = public as $$
  with scope as (
    select id from projects
    where (p_project is null or id = p_project)
      and (is_studio() or id in (select my_projects()))
  )
  select
    (select count(*) from portal_notifications n where n.project_id in (select id from scope) and n.read_at is null
       and n.audience = case when is_studio() then 'studio' else 'client' end),
    (select count(*) from project_messages m where m.project_id in (select id from scope)
       and case when is_studio() then m.sender_role = 'client' and m.read_by_studio_at is null
                else m.sender_role = 'studio' and m.read_by_client_at is null end),
    (select count(*) from client_tasks t where t.project_id in (select id from scope)
       and t.status = case when is_studio() then 'pending_review' else 'action_required' end),
    (select count(*) from reimbursable_statements s where s.project_id in (select id from scope)
       and s.status = case when is_studio() then 'approved' else 'sent' end)
$$;
grant execute on function public.notification_counts(uuid) to authenticated;

-- ═════════════════════════════════════════════ LEAD SCOUT RUNNER ═════════════════════════════════════════════
-- Private key store (RLS on, no policies = unreadable from the browser or the API).
create table if not exists public.studio_private (key text primary key, value text not null, updated_at timestamptz default now());
alter table public.studio_private enable row level security;
revoke all on public.studio_private from anon, authenticated;
-- After deploying lead-scout, set the same random string here and as the LEAD_SCOUT_KEY function secret:
--   insert into public.studio_private(key, value) values ('lead_scout_key', '<long random string>')
--   on conflict (key) do update set value = excluded.value;
create or replace function public.run_lead_scout(p_days int default 7) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare k text; base text := 'https://afejhlfwymwagstyfnse.supabase.co';
begin
  if not is_studio() and session_user not in ('postgres','supabase_admin') then raise exception 'Studio only'; end if;
  select value into k from studio_private where key = 'lead_scout_key';
  if k is null then raise exception 'Set studio_private.lead_scout_key first (see migration notes).'; end if;
  return net.http_post(url := base || '/functions/v1/lead-scout',
                       body := jsonb_build_object('days', p_days, 'markets', jsonb_build_array('LA','NY')),
                       headers := jsonb_build_object('content-type','application/json','x-scout-key', k),
                       timeout_milliseconds := 60000);
end $$;
revoke execute on function public.run_lead_scout(int) from anon;
