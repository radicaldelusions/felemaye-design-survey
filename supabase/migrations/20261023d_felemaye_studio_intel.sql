-- FELEMAYE · 2026-10-23d · studio intelligence pass
-- Run once in Supabase › SQL editor (safe to re-run). Sections:
--   1. Lead signals: sector / project type / fit columns, run log, a scout key, weekend schedule (pg_cron)
--   2. Fees: milestone checkboxes create real invoices; the client "retainer paid" flag books the retainer;
--      Lorado's $4,500 retainer (paid Oct 16) is backfilled so the dashboard counts it
--   3. Revenue forecast lines per vertical (market-based starting numbers, editable in Dashboard)
--   4. Trade bot: "assist" jobs (prefilled form opened on the PC for review) and a shared answers library
--   5. Reference images: cached thumbnails for Drive images (filled by the Drive bridge)
--   6. Zoning: versioned analyses (each update keeps the previous one); Lorado v2 with the planner team's update
-- Nothing here stores bank details, EINs, permit numbers or passwords.

-- ─────────────────────────────────────────────────────────────── 1 · LEADS
alter table public.lead_signals add column if not exists sector text;
alter table public.lead_signals add column if not exists project_type text;
alter table public.lead_signals add column if not exists fit text;
alter table public.lead_signals add column if not exists fit_why text;
alter table public.lead_signals add column if not exists jurisdiction text;
create index if not exists lead_signals_fit_idx on public.lead_signals (status, fit, score desc);

create table if not exists public.lead_scout_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  trigger text,
  days int,
  result jsonb
);
alter table public.lead_scout_runs enable row level security;
drop policy if exists scout_runs_studio on public.lead_scout_runs;
create policy scout_runs_studio on public.lead_scout_runs for all using (public.is_studio()) with check (public.is_studio());

-- the weekend schedule authenticates with this key; the function reads it with the service role (no secret to copy)
insert into public.studio_private (key, value)
select 'lead_scout_key', encode(gen_random_bytes(24), 'hex')
where not exists (select 1 from public.studio_private where key = 'lead_scout_key');

-- licence profile drives the "fit" label. Change CA to "licensed" the day the CSE supplemental exam clears.
insert into public.studio_config (key, value) values ('license_profile', '{"CA":"pending","NY":"licensed"}')
on conflict (key) do nothing;

-- add LA County (unincorporated, EPIC-LA) areas to the scout rules without touching the LA / NY parts
update public.studio_config
   set value = (value::jsonb || jsonb_build_object('COUNTY', jsonb_build_object(
        'home_areas', jsonb_build_array('View Park/Windsor Hills', 'Ladera Heights'),
        'areas', jsonb_build_array('View Park/Windsor Hills', 'Ladera Heights', 'Altadena', 'Marina del Rey', 'Del Aire', 'Wiseburn', 'West LA', 'Santa Monica Mountains', 'La Crescenta-Montrose', 'East Pasadena', 'Kinneloa Mesa', 'Athens-Westmont'),
        'keywords', jsonb_build_array('addition', 'courtyard', 'patio', 'wall', 'fence', 'remodel', 'adu', 'kitchen', 'facade', 'restaurant', 'tenant improvement', 'rebuild', 'pergola', 'garden'))))::text
 where key = 'lead_scout_rules' and not (value::jsonb ? 'COUNTY');

drop function if exists public.run_lead_scout(int);
create or replace function public.run_lead_scout(p_days int default 7, p_trigger text default 'manual') returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare k text; base text := 'https://afejhlfwymwagstyfnse.supabase.co';
begin
  if not is_studio() and session_user not in ('postgres', 'supabase_admin') then raise exception 'Studio only'; end if;
  select value into k from studio_private where key = 'lead_scout_key';
  return net.http_post(url := base || '/functions/v1/lead-scout',
                       body := jsonb_build_object('days', p_days, 'markets', jsonb_build_array('LA', 'NY'), 'trigger', p_trigger),
                       headers := jsonb_build_object('content-type', 'application/json', 'x-scout-key', k),
                       timeout_milliseconds := 120000);
end $$;
revoke execute on function public.run_lead_scout(int, text) from anon;

-- Weekend runs, so Monday starts with a fresh list:
--   Saturday 7:00 AM Pacific (14:00 UTC) — the full week, 8 days back
--   Sunday   6:00 PM Pacific (01:00 UTC Monday) — top-up of the last 3 days
-- (UTC times; during standard time these land an hour earlier, 6 AM Saturday and 5 PM Sunday)
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron not available here — enable it in Database › Extensions, then re-run this block.';
    return;
  end;
  perform cron.unschedule(jobid) from cron.job where jobname in ('fy-leads-saturday', 'fy-leads-sunday');
  perform cron.schedule('fy-leads-saturday', '0 14 * * 6', $c$select public.run_lead_scout(8, 'weekend')$c$);
  perform cron.schedule('fy-leads-sunday', '0 1 * * 1', $c$select public.run_lead_scout(3, 'weekend')$c$);
end $$;

-- ─────────────────────────────────────────────────────────────── 2 · FEES → INVOICES
alter table public.invoices add column if not exists vertical text not null default 'SD';
alter table public.invoices add column if not exists phase_code text;
alter table public.invoices add column if not exists source text not null default 'console';
alter table public.invoices add column if not exists external_ref text;
create unique index if not exists invoices_external_ref_key on public.invoices (external_ref) where external_ref is not null;
create unique index if not exists invoices_project_phase_key on public.invoices (project_id, phase_code) where phase_code is not null;

-- internal: create / update the milestone invoice for one phase (no auth check — wrappers below check)
create or replace function public.fy_fee_invoice(p_project uuid, p_phase text, p_paid boolean, p_when timestamptz default now())
returns uuid language plpgsql security definer set search_path = public as $$
declare v_amt numeric; v_title text; v_seq int; v_id uuid; v_slug text; v_num text;
begin
  select pb.fee_amount, ph.title, ph.seq into v_amt, v_title, v_seq
    from phases ph join phase_budgets pb on pb.phase_id = ph.id
   where ph.project_id = p_project and pb.phase_code = p_phase;
  if v_amt is null or v_amt <= 0 then raise exception 'No fee set for phase % on this project', p_phase; end if;
  select upper(left(regexp_replace(regexp_replace(coalesce(title, slug, 'FY'), '^(the|a)\s+', '', 'i'), '[^A-Za-z]', '', 'g'), 3)) into v_slug from projects where id = p_project;
  v_num := coalesce(nullif(v_slug, ''), 'FY') || '-' || lpad(v_seq::text, 3, '0');
  select id into v_id from invoices where project_id = p_project and phase_code = p_phase;
  if v_id is null then
    insert into invoices (project_id, number, description, amount, status, issued_at, paid_at, phase_code, vertical, source)
    values (p_project, v_num || case when exists (select 1 from invoices where number = v_num) then '-' || p_phase else '' end,
            case when v_seq = 1 then 'Retainer · ' else 'Milestone · ' end || v_title, v_amt,
            case when p_paid then 'paid' else 'sent' end, p_when, case when p_paid then p_when end, p_phase, 'SD', 'fee_schedule')
    returning id into v_id;
  else
    update invoices set status = case when p_paid then 'paid' else 'sent' end,
                        paid_at = case when p_paid then coalesce(paid_at, p_when) end,
                        amount_paid = case when p_paid then coalesce(amount_paid, amount) end
     where id = v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.fy_fee_invoice(uuid, text, boolean, timestamptz) from public, anon, authenticated;

-- studio: tick / untick a milestone as received
create or replace function public.studio_set_fee_paid(p_project uuid, p_phase text, p_paid boolean, p_paid_on date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not is_studio() then raise exception 'studio only'; end if;
  v := fy_fee_invoice(p_project, p_phase, p_paid, coalesce(p_paid_on::timestamptz, now()));
  -- the first phase is the retainer: keep the client's flag (which releases portal credentials) in step
  if p_phase = (select pb.phase_code from phases ph join phase_budgets pb on pb.phase_id = ph.id where ph.project_id = p_project order by ph.seq limit 1) then
    update clients set retainer_paid = p_paid, retainer_paid_at = case when p_paid then coalesce(retainer_paid_at, now()) end where project_id = p_project and retainer_paid is distinct from p_paid;
  end if;
  return v;
end $$;
grant execute on function public.studio_set_fee_paid(uuid, text, boolean, date) to authenticated;

-- ticking "retainer paid" on the client books the retainer invoice
create or replace function public.trg_retainer_invoice() returns trigger language plpgsql security definer set search_path = public as $$
declare v_phase text;
begin
  if new.project_id is null or new.retainer_paid is not distinct from old.retainer_paid then return new; end if;
  select pb.phase_code into v_phase from phases ph join phase_budgets pb on pb.phase_id = ph.id
   where ph.project_id = new.project_id and pb.fee_amount > 0 order by ph.seq limit 1;
  if v_phase is not null then perform fy_fee_invoice(new.project_id, v_phase, new.retainer_paid, coalesce(new.retainer_paid_at, now())); end if;
  return new;
end $$;
drop trigger if exists trg_retainer_invoice on public.clients;
create trigger trg_retainer_invoice after update of retainer_paid on public.clients for each row execute function public.trg_retainer_invoice();

-- the fee schedule the console shows (one row per phase with a fee)
create or replace view public.v_project_fees with (security_invoker = true) as
select ph.project_id, ph.id as phase_id, ph.seq, ph.title, pb.phase_code, pb.fee_amount,
       i.id as invoice_id, i.number, i.status as invoice_status, i.paid_at, coalesce(i.status = 'paid', false) as paid
  from phases ph
  join phase_budgets pb on pb.phase_id = ph.id
  left join invoices i on i.project_id = ph.project_id and i.phase_code = pb.phase_code
 where pb.fee_amount > 0;
grant select on public.v_project_fees to authenticated;

-- backfill: every client already marked "retainer paid" gets the retainer invoice (Lorado: $4,500, Oct 16)
do $$
declare c record; v_phase text;
begin
  for c in select project_id, retainer_paid_at from clients where retainer_paid and project_id is not null loop
    select pb.phase_code into v_phase from phases ph join phase_budgets pb on pb.phase_id = ph.id
     where ph.project_id = c.project_id and pb.fee_amount > 0 order by ph.seq limit 1;
    if v_phase is not null and not exists (select 1 from invoices where project_id = c.project_id and phase_code = v_phase) then
      perform fy_fee_invoice(c.project_id, v_phase, true, coalesce(c.retainer_paid_at, now()));
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────── 3 · REVENUE FORECAST BY VERTICAL
create table if not exists public.revenue_lines (
  id uuid primary key default gen_random_uuid(),
  vertical text not null,            -- SD SL BV PF CS TA CI MA RD VG
  line_item text not null,
  market text not null default 'LA',
  unit text not null default 'project',
  unit_price numeric not null default 0,
  qty_per_year numeric not null default 0,
  start_month date not null default date_trunc('month', now())::date,
  probability numeric not null default 0.5 check (probability between 0 and 1),
  basis text,                        -- where the number comes from
  source_url text,
  active boolean not null default true,
  sort int not null default 100,
  updated_at timestamptz not null default now()
);
alter table public.revenue_lines enable row level security;
drop policy if exists revenue_lines_studio on public.revenue_lines;
create policy revenue_lines_studio on public.revenue_lines for all using (public.is_studio()) with check (public.is_studio());

insert into public.revenue_lines (vertical, line_item, market, unit, unit_price, qty_per_year, start_month, probability, basis, source_url, sort)
select * from (values
 ('SD','Residential design: courtyards, front yards, additions (fixed fee)','LA','project',12000,4,'2027-01-01'::date,0.6,'Lorado fixed fee $9,000; 2027 average-fee target $18,000 — midpoint used',null,10),
 ('SD','Fire-rebuild and ADU design sets (Altadena, Santa Monica Mtns)','LA','project',15000,2,'2027-02-01'::date,0.35,'EPIC-LA shows ~160 rebuild cases a month countywide; exempt work under B&P §5537 while the CA licence is pending','https://data.lacounty.gov/datasets/la-county-permitting-epic-la-case-history',11),
 ('SD','Design advisory hours beyond included sessions','LA','hour',225,60,'2026-11-01'::date,0.7,'Advisory rate on the Lorado cadence ($225/h)',null,12),
 ('SD','NYC alteration / interior design (NY RA)','NY','project',25000,1,'2027-04-01'::date,0.3,'Studio estimate — NY filings need the RA stamp you hold',null,13),
 ('VG','Vignettes: vacant-home staging, first 30 days','LA','home',3000,18,'2027-01-01'::date,0.5,'National vacant staging $1,500–4,000 first month; LA runs 20–40% above the national average','https://ibuyer.com/blog/how-much-does-home-staging-cost/',20),
 ('VG','Vignettes: rental extension after 30 days','LA','home-month',750,9,'2027-02-01'::date,0.5,'Furniture rental $150–1,200 per month after the first month; assume half the homes extend once','https://ibuyer.com/blog/how-much-does-home-staging-cost/',21),
 ('VG','Vignettes: occupied-home styling consult','LA','visit',350,12,'2027-01-01'::date,0.6,'Consultation fee $150–600, average $300–400','https://ibuyer.com/blog/how-much-does-home-staging-cost/',22),
 ('PF','FF&E procurement margin (30% on product)','LA','$ of product',0.30,40000,'2027-03-01'::date,0.5,'Studio pricing rule: trade markup 30–35%; assume $40k of product a year through projects',null,30),
 ('SL','Surface Library licensing advances','LA','design',1000,3,'2027-03-01'::date,0.4,'Non-exclusive licences $250–1,000+ a year; semi-exclusive $400–1,500+','https://wallsneedlove.com/blogs/news/wallpaper-art-licensing-a-2026-guide-for-creatives',40),
 ('SL','Surface Library royalties (8% of wholesale)','LA','$ wholesale',0.08,20000,'2027-07-01'::date,0.3,'Surface-design royalties run 3–15% of wholesale; 8% used','https://wallsneedlove.com/blogs/news/wallpaper-art-licensing-a-2026-guide-for-creatives',41),
 ('BV','BIM / VDC consulting hours','LA','hour',125,240,'2027-01-01'::date,0.45,'Studio estimate for independent BIM consultants; edit to your quoted rate',null,50),
 ('BV','Revit template & family package','LA','package',6000,2,'2027-02-01'::date,0.4,'Studio estimate',null,51),
 ('BV','BIM company audit & training plan','LA','engagement',4500,2,'2027-04-01'::date,0.35,'Studio estimate',null,52),
 ('CS','Creative strategy brief (hospitality / retail)','LA','engagement',6000,2,'2027-03-01'::date,0.35,'Studio estimate',null,60),
 ('TA','Consultant RFP & team assembly (outside your own projects)','LA','engagement',2500,2,'2027-03-01'::date,0.3,'Studio estimate',null,70),
 ('CI','Lectures, panels and juries (honoraria)','LA','event',1500,3,'2027-01-01'::date,0.5,'Studio estimate',null,80),
 ('CI','Commissioned writing','LA','piece',600,3,'2027-01-01'::date,0.4,'Studio estimate',null,81),
 ('MA','Photography / archive licensing','LA','licence',500,2,'2027-04-01'::date,0.3,'Studio estimate',null,90),
 ('RD','Dem Arts & Crafts objects','LA','object',400,10,'2027-05-01'::date,0.3,'Studio estimate',null,100)
) v(vertical,line_item,market,unit,unit_price,qty_per_year,start_month,probability,basis,source_url,sort)
where not exists (select 1 from public.revenue_lines);

-- ─────────────────────────────────────────────────────────────── 4 · TRADE BOT: PREFILL & REVIEW
alter table public.trade_jobs drop constraint if exists trade_jobs_kind_check;
alter table public.trade_jobs add constraint trade_jobs_kind_check check (kind in ('apply', 'discover', 'status_check', 'assist', 'submit'));
alter table public.trade_jobs add column if not exists payload jsonb;

-- answers the bot reuses on every form. Sensitive items (EIN, seller's permit no., resale certificate no., phone)
-- are listed so you can see they exist, but their values stay in the PC's local credentials file — never here.
create table if not exists public.trade_form_answers (
  field_key text primary key,
  label text not null,
  answer text,
  match_terms text[] not null default '{}',   -- label / name / placeholder fragments that map to this answer
  sensitive boolean not null default false,
  uses int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.trade_form_answers enable row level security;
drop policy if exists trade_answers_studio on public.trade_form_answers;
create policy trade_answers_studio on public.trade_form_answers for all using (public.is_studio()) with check (public.is_studio());
insert into public.trade_form_answers (field_key, label, answer, match_terms, sensitive) values
 ('company', 'Company / business name', 'FELEMAYE LLC', '{company,business name,firm,organization,dba}', false),
 ('website', 'Website', 'https://felemaye.com', '{website,url,web site}', false),
 ('email', 'Business email', 'felema@felemaye.com', '{email,e-mail}', false),
 ('first_name', 'First name', 'Felema', '{first name,firstname,given}', false),
 ('last_name', 'Last name', 'Yemaneberhan', '{last name,lastname,surname,family name}', false),
 ('title', 'Title / role', 'Principal', '{title,role,position,job}', false),
 ('business_type', 'Business type', 'Interior Designer / Architect', '{business type,type of business,profession,industry,trade type,customer type}', false),
 ('markets', 'Markets served', 'Los Angeles, CA and New York, NY', '{markets,regions,service area,territory}', false),
 ('projects_per_year', 'Projects per year', '4–8', '{projects per year,annual projects,number of projects}', false),
 ('project_types', 'Project types', 'Residential, hospitality and courtyard / outdoor', '{project type,specialty,focus}', false),
 ('annual_purchases', 'Estimated annual purchases', '$25,000–$100,000', '{annual purchase,annual spend,purchase volume,budget}', false),
 ('heard_about', 'How did you hear about us', 'Industry referral', '{hear about,referred,how did you find,source}', false),
 ('street', 'Business street address', null, '{street,address line,address 1}', true),
 ('city', 'City', 'Los Angeles', '{city,town}', false),
 ('state', 'State', 'CA', '{state,province,region}', false),
 ('zip', 'ZIP', null, '{zip,postal}', true),
 ('phone', 'Business phone', null, '{phone,telephone,mobile}', true),
 ('ein', 'EIN / Tax ID', null, '{ein,tax id,federal id,fein,tin}', true),
 ('seller_permit', 'CA seller''s permit number', null, '{seller,spr,resale number,sales tax,permit number,cdtfa}', true),
 ('resale_cert', 'Resale certificate (file)', null, '{resale certificate,tax exempt,exemption certificate,upload}', true),
 ('ny_authority', 'NY Certificate of Authority', null, '{certificate of authority,ny tax}', true)
on conflict (field_key) do nothing;

-- fields the bot reported as blank, counted across vendors (what to answer once)
create or replace view public.v_trade_missing_fields with (security_invoker = true) as
with r as (
  select t.id, v.name, coalesce(t.review_reason, '') as reason
    from trade_accounts t join vendors v on v.id = t.vendor_id
   where t.status in ('Needs Manual Review', 'Not Applied') and coalesce(t.review_reason, '') ~* 'required fields|form reported|stuck on step'
), f as (
  select r.id, r.name, nullif(trim(x), '') as field
    from r, regexp_split_to_table(coalesce(substring(r.reason from 'left blank: (.*?)\.?$'), ''), ',\s*') x
  union all
  select r.id, r.name, case when r.reason ~* 'please select' then '(dropdown — option not chosen)'
                            when r.reason ~* 'next button' then '(multi-step form — step 1 did not advance)'
                            when r.reason ~* 'try again|error' then '(form rejected the submission)'
                            else '(unlabelled required field)' end
    from r where r.reason !~* 'left blank: \w'
)
select field, count(*) as vendors, array_agg(name order by name) as vendor_names
  from f where field is not null group by field order by count(*) desc;
grant select on public.v_trade_missing_fields to authenticated;

-- ─────────────────────────────────────────────────────────────── 5 · REFERENCE IMAGES
alter table public.project_files add column if not exists thumb_path text;   -- Storage copy (project-files bucket)
alter table public.project_files add column if not exists mime_type text;
alter table public.project_files add column if not exists drive_id text generated always as (substring(path from 'drive\.google\.com/file/d/([\w-]+)')) stored;

-- ─────────────────────────────────────────────────────────────── 6 · ZONING VERSIONS
alter table public.project_zoning_audits add column if not exists version int not null default 1;
alter table public.project_zoning_audits add column if not exists supersedes uuid references public.project_zoning_audits (id) on delete set null;

-- Lorado v2: same sources plus the second Regional Planning conversation (Daisy, after her section meeting):
-- photographs of nearby homes using hedges as walls, together with the very shallow rear yard, can support a
-- Yard Modification in the front yard and potentially more height — through a public hearing.
-- Saved as a new draft that supersedes v1 (v1 is kept). Review it in Console › Zoning.
insert into public.project_zoning_audits (project_id, jurisdiction, zone_class, overlays, setback_front_ft, wall_height_cap_in, transparency_pct,
                                          status, analysis, source_files, source_note, sheet_number, parsed, version, supersedes)
select a.project_id, a.jurisdiction, a.zone_class, a.overlays, a.setback_front_ft, a.wall_height_cap_in, 50,
       'draft', a.analysis || $j${
 "summary": "By right, the front yard can take a 42-inch solid base with open iron above it, paving no more than a foot above grade, and seat walls within the same height; nothing roofed. Regional Planning's section team has now said a Yard Modification heard in public could allow more height in the front yard if we document nearby homes that use hedges as walls and show how shallow the rear yard is. Option B is buildable by right at 42 inches; anything taller is the hearing path.",
 "non_negotiables": [
  "No roof, pergola, trellis or other overhead structure inside the required front yard; it stays open to the sky (planner; Title 22 has no 'courtyard' use).",
  "Covered patios are rear-yard only (§22.110.090.H).",
  "Front-yard fence/wall solid portion capped at 42 in by right; chain-link prohibited (CSD).",
  "Required front yard stays landscaped except driveway and walks (CSD).",
  "Garage and driveway stay where they are; no second driveway onto the front yard (planner).",
  "Perforated panels that are not genuinely open are not accepted above 42 in (planner).",
  "Neighbors' hedges and taller walls are not precedent by right. They become evidence only inside a Yard Modification application (section team, meeting 2)."
 ],
 "negotiables": [
  "Yard Modification for front-yard height (Title 22 Ch. 22.196, authorized by §22.110.190.A), heard in public per the section team. Evidence: dated photos and measured heights of homes on Lorado Way and the adjoining blocks that use hedges as walls, a measured rear-yard depth showing how little private outdoor space the lot has, a compatibility narrative, and drawings. Discretionary; Regional Planning before Building & Safety.",
  "Front-yard depth by averaging the two adjoining lots (§22.110.080.B.1). Daisy read this lot at about 24 ft against a 20 ft requirement; if the survey confirms it, roughly 4 ft of the existing front yard sits outside the required yard and can take a solid wall or a roofed element. By right if it applies.",
  "Placement: set any solid element taller than 42 in behind the required front-yard line — no relief needed.",
  "Design: masonry pilasters with open iron infill may read as non-view-obscuring; ask how the County measures openness (pilaster width and spacing).",
  "Planting: box hedges are allowed within the height limits; a hedge kept at the 42-in line plus an open fence above gives a green wall without relief."
 ],
 "applications": [
  "Second pre-application appointment with Regional Planning: bring the hedge photo survey outline and ask for the hearing type, fee and findings in writing.",
  "Boundary + topographic survey by a licensed land surveyor (no County corner records for the parcel — Ernesto Rodriguez, DPW, Oct 21).",
  "Photo and measurement survey of the block: every front yard with a hedge or wall over 42 in, address, height, material, date.",
  "If going above 42 in solid: Yard Modification application to Regional Planning, public notice and hearing, then Building & Safety.",
  "Building permit through EPIC-LA (Public Works Building & Safety); a separate permit for each retaining wall; stamped structural sheets for masonry and footings."
 ],
 "questions": [
  "For a Yard Modification on front-yard height: is it heard by a hearing officer, what is the fee, and how long from filing to decision?",
  "How many hedge-as-wall examples, and within what radius, does the section team want to see? Photos only, or measured heights too?",
  "What is the maximum height the team would consider for a solid element in the front yard under a Yard Modification?",
  "Under the View Park–Windsor Hills CSD as adopted, is a solid 42-inch base allowed by right, or must the fence be non-view-obscuring below 3.5 ft?",
  "What is the required front-yard depth for 3745 Lorado Way: 20 ft, or the average of the adjoining lots under §22.110.080.B.1?",
  "On the sloping front yard with a low retaining wall at the lot line, from which grade is fence/wall height measured?",
  "Would pilasters with open iron count as non-view-obscuring? Any limit on pilaster width or spacing?"
 ],
 "conflicts": [
  "Neighbor hedges: in meeting 1 the planner said hedges and taller walls are not precedent; after the section meeting the team said documented examples can support a Yard Modification. Both can be true (not by right, yes as evidence) — get the team's position in writing before building the photo survey.",
  "Front-yard wall opacity: the View Park–Windsor Hills CSD text says fences in the required front yard must be non-view-obscuring below 3.5 ft — read literally, no solid 42-in masonry base. The planner said a 42-in solid retaining wall with wrought iron above is permitted. Get a written answer citing the adopted CSD section before developing Option B.",
  "Front-yard depth: the Oct 8 guide used 15 ft, the project brief 20 ft, the planner observed about 24 ft. Fix it from the survey and the adjoining-lot average.",
  "CSD front-setback reduction applies only to listed Hillside Management Area addresses and excludes registered historic districts — Lorado Way is not listed, so it does not apply.",
  "Section numbering for the View Park–Windsor Hills CSD differs between the 2024 drafts — cite the adopted Municode section on the sheet."
 ],
 "numbers": [
  {"item": "Required front yard depth", "unit": "ft", "code": "20", "planner": "≈24 existing", "governing": "20 (or adjoining-lot average)", "option_a": "no change", "option_b": "wall at or behind PL", "basis": "R-1 (verify); §22.110.080.B.1; Daisy, meeting 1", "status": "conflict"},
  {"item": "Front-yard fence / wall — solid portion", "unit": "in", "code": "42", "planner": "42 (solid retaining + iron above OK)", "governing": "42", "option_a": "≤ 42 pilasters + gate", "option_b": "42 CMU base", "basis": "§22.110.070.B.1; CSD (opacity in conflict); planner", "status": "conflict"},
  {"item": "Front-yard fence — open portion above the solid base", "unit": "% open", "code": "≥ 50", "planner": "genuinely open; perforated panels rejected", "governing": "≥ 50", "option_a": "iron gate ≥ 50", "option_b": "iron ≥ 50", "basis": "Project brief; planner", "status": "confirmed"},
  {"item": "Front-yard fence — total height with open portion", "unit": "ft", "code": "CSD maximum — to confirm", "planner": "open above 42 in allowed", "governing": "6 (assumed for scenarios, confirm)", "option_a": "≤ 6", "option_b": "≤ 6", "basis": "CSD (section to confirm)", "status": "to_verify"},
  {"item": "Front-yard solid height via Yard Modification", "unit": "in", "code": "discretionary", "planner": "potentially higher (section team, meeting 2)", "governing": "set at hearing", "option_a": "n/a", "option_b": "72 target (test)", "basis": "Ch. 22.196; §22.110.190.A; section team", "status": "to_verify"},
  {"item": "Side / rear fence or wall", "unit": "ft", "code": "6", "planner": "6, only past the driveway on the side", "governing": "6", "option_a": "n/a", "option_b": "6 at side past driveway", "basis": "§22.110.070.B.2; planner", "status": "confirmed"},
  {"item": "Paving, tile, patio slab in required yards", "unit": "in above grade", "code": "≤ 12", "planner": "open-air flooring is not an encroachment", "governing": "12", "option_a": "at grade", "option_b": "≤ 12", "basis": "§22.110.040.D; planner", "status": "confirmed"},
  {"item": "Seat walls / planters inside the front yard", "unit": "in", "code": "42 (treated as wall)", "planner": "—", "governing": "42", "option_a": "18 seat height", "option_b": "18 seat, 42 back", "basis": "§22.110.070.B.1 (verify that seat walls count as walls)", "status": "to_verify"},
  {"item": "Uncovered entry landing projection into front yard", "unit": "ft", "code": "≤ 5, ≥ 2 from lot lines, rail ≤ 42 in", "planner": "—", "governing": "5", "option_a": "existing", "option_b": "≤ 5", "basis": "§22.110.090.D.1", "status": "confirmed"},
  {"item": "Roofed / covered area inside required front yard", "unit": "sf", "code": "0", "planner": "0 — open to the sky", "governing": "0", "option_a": "0", "option_b": "0", "basis": "§22.110.090.H; planner", "status": "confirmed"},
  {"item": "Retaining wall needing structural permit", "unit": "ft", "code": "> 4 from bottom of footing, or surcharged", "planner": "fence-only scope needs no soils test", "governing": "4", "option_a": "none", "option_b": "engineer either way (CMU + footing)", "basis": "DPW 2026 Retaining Wall checklist; site research", "status": "confirmed"},
  {"item": "Front yard area available to the courtyard", "unit": "sf", "code": "—", "planner": "—", "governing": "≈ 1,488 (front parcel footprint, brief)", "option_a": "≈ 1,488", "option_b": "≈ 1,488", "basis": "Project brief; confirm on survey", "status": "to_verify"},
  {"item": "Rear yard depth", "unit": "ft", "code": "15 required (R-1, verify)", "planner": "shallow — the basis for the Yard Modification", "governing": "measure on survey", "option_a": "—", "option_b": "—", "basis": "Felema; section team", "status": "to_verify"}
 ],
 "scenarios": [
  {"id": "S1", "name": "Option A by right — reinforced gate + new pilasters", "what": "Keep the existing perimeter line; new masonry pilasters with an iron gate and infill, solid parts ≤ 42 in, ≥ 50% open above.", "solid_in": 42, "total_ft": 6, "open_pct": 50, "roof": "none", "path": "Building & Safety only", "approvals": "Building permit (EPIC-LA); engineer for pilaster footings", "weeks": "6–10", "verdict": "works", "why": "Inside every confirmed limit; no planning review."},
  {"id": "S2", "name": "Option B by right — 42-in CMU enclosure + iron", "what": "Continuous-footing CMU wall in plaster, 42 in solid, open iron above to the CSD maximum; seat walls and paving inside ≤ 12 in above grade.", "solid_in": 42, "total_ft": 6, "open_pct": 50, "roof": "none", "path": "Building & Safety (Regional Planning only if the CSD opacity reading holds)", "approvals": "Building permit; stamped S-sheets; written CSD confirmation", "weeks": "8–12", "verdict": "conditional", "why": "Works if the County confirms in writing that a solid 42-in base is allowed under the CSD."},
  {"id": "S3", "name": "Option B open variant — pilasters + open iron full height", "what": "If the CSD requires non-view-obscuring below 3.5 ft: masonry pilasters at intervals with open iron between, low 18-in planter curb.", "solid_in": 18, "total_ft": 6, "open_pct": 50, "roof": "none", "path": "Building & Safety", "approvals": "Building permit; engineer for pilasters", "weeks": "6–10", "verdict": "works", "why": "Satisfies the strictest CSD reading."},
  {"id": "S4", "name": "Taller solid enclosure through a Yard Modification", "what": "Solid wall or wall-plus-hedge up to about 6 ft in the front yard, justified by the block's hedge-as-wall pattern and the shallow rear yard.", "solid_in": 72, "total_ft": 6, "open_pct": 0, "roof": "none", "path": "Regional Planning — Yard Modification with public hearing, then Building & Safety", "approvals": "Yard Modification (Ch. 22.196); public notice; building permit; S-sheets", "weeks": "16–28 (verify)", "verdict": "conditional", "why": "Now on the table per the section team; outcome is discretionary and adds a hearing to the schedule."},
  {"id": "S5", "name": "Hedge as the wall, by right", "what": "Box hedge held at 42 in on the line, open iron fence behind it to the CSD maximum.", "solid_in": 42, "total_ft": 6, "open_pct": 50, "roof": "none", "path": "Building & Safety for the fence only", "approvals": "Fence permit", "weeks": "4–8", "verdict": "works", "why": "Landscaping within the height limit is allowed; enforcement on taller hedges is complaint-driven, so don't plan on letting it grow."},
  {"id": "S6", "name": "Roofed element in the ≈4 ft beyond the required front yard", "what": "If the survey confirms ≈24 ft against 20 ft required, a shade structure or covered seat could sit in that strip.", "solid_in": null, "total_ft": null, "open_pct": null, "roof": "allowed outside the required yard", "path": "Regional Planning review, then Building & Safety", "approvals": "Plot plan / RP review; building permit", "weeks": "8–14", "verdict": "conditional", "why": "Depends on the survey and on the adjoining-lot average."},
  {"id": "S7", "name": "Enclosed, roofed courtyard inside the required front yard", "what": "Pergola, roof or enclosure over the front yard.", "solid_in": null, "total_ft": null, "open_pct": null, "roof": "prohibited", "path": "—", "approvals": "—", "weeks": "—", "verdict": "does_not_work", "why": "Front yard must stay open to the sky; a Yard Modification addresses height and setbacks, not a roof (planner)."}
 ],
 "evidence": [
  {"date": "2026-10-08", "source": "Zoning & Feasibility guide (pre-design)", "said": "Front yard assumed 15 ft.", "effect": "Superseded by the planner's reading and the brief (20 ft); confirm on survey."},
  {"date": "2026-10", "source": "Regional Planning, Daisy — meeting 1 (virtual)", "said": "No enclosed courtyard in the front yard; fence 3.5 ft solid, open above; covered patios rear only; neighbors' hedges not precedent; fence-only goes straight to Building & Safety; front yard appears ≈24 ft.", "effect": "Set the by-right limits and the non-negotiables."},
  {"date": "2026-10-21", "source": "LA County DPW Survey & Mapping — Ernesto Rodriguez (email)", "said": "No corner records for the parcel.", "effect": "A licensed boundary + topo survey is required."},
  {"date": "2026-10-23", "source": "Regional Planning, Daisy — meeting 2, after the section meeting", "said": "With photos of nearby homes that use hedges as walls, and given the very shallow rear yard, a Yard Modification in the front yard could be pursued through a public hearing, potentially allowing more height.", "effect": "Adds scenario S4; turns neighbor hedges from 'not precedent' into evidence for the hearing; adds the photo survey and the hearing questions."}
 ],
 "revit": [
  {"param": "FY_Zone", "type": "Text", "value": "R-1"},
  {"param": "FY_Overlays", "type": "Text", "value": "Westside PASD; View Park–Windsor Hills CSD"},
  {"param": "FY_APN", "type": "Text", "value": "5012-027-005"},
  {"param": "FY_Tract", "type": "Text", "value": "Tract 6177"},
  {"param": "FY_FrontYard_Required", "type": "Length", "value": "20'-0\"", "note": "confirm vs adjoining-lot average"},
  {"param": "FY_FrontYard_Existing", "type": "Length", "value": "24'-0\"", "note": "planner observation; survey to confirm"},
  {"param": "FY_FrontFence_SolidMax", "type": "Length", "value": "3'-6\""},
  {"param": "FY_FrontFence_TotalMax", "type": "Length", "value": "6'-0\"", "note": "CSD maximum to confirm"},
  {"param": "FY_FrontFence_OpenPct", "type": "Number", "value": "50"},
  {"param": "FY_SideRearFence_Max", "type": "Length", "value": "6'-0\""},
  {"param": "FY_Paving_MaxAboveGrade", "type": "Length", "value": "1'-0\""},
  {"param": "FY_Landing_MaxProjection", "type": "Length", "value": "5'-0\""},
  {"param": "FY_RetainingWall_PermitThreshold", "type": "Length", "value": "4'-0\""},
  {"param": "FY_FrontYard_RoofedArea", "type": "Area", "value": "0 SF"},
  {"param": "FY_Relief_Path", "type": "Text", "value": "Yard Modification, Title 22 Ch. 22.196 — public hearing (verify)"}
 ],
 "change_log": ["v2 (Oct 23): added numbers, scenarios S1–S7, evidence log and Revit parameters; added the section team's Yard Modification path; revised the hedge item; new questions for meeting 3."]
}$j$::jsonb,
       a.source_files || array['Regional Planning — Daisy, meeting 2 (reported Oct 23)'], a.source_note, a.sheet_number, coalesce(a.parsed, '{}'::jsonb), 2, a.id
  from public.project_zoning_audits a
 where a.id = 'af9a5bff-156e-4074-b39a-c372fed3bf20'
   and not exists (select 1 from public.project_zoning_audits where supersedes = 'af9a5bff-156e-4074-b39a-c372fed3bf20');

-- ─────────────────────────────────────────────────────────────── 7 · CLIENT REFERENCES: PRODUCTS + MOOD BOARD
-- Adds product suggestions (tied to the vendor list, so the console shows trade-account status) and a visual board
-- (Unsplash photos, credited) to the first design read. Internal only.
update public.design_reads
   set read = read || $p${
 "products": [
  {"item": "Walls and seat backs", "product": "Lime Wash over cement plaster", "maker": "Portola Paints", "vendor": "Portola Paints & Glazes", "format": "Brushed, two coats over their mineral primer (per TDS); sample three warm whites on site", "finish": "Soft, mottled matte", "url": "https://portolapaints.com/cdn/shop/files/TDS_-_LIME_WASH_-_01.26.pdf", "why": "The limewash direction; one colour on walls and seat backs keeps the courtyard monolithic."},
  {"item": "Wall structure and cap", "product": "8 in CMU under plaster, 8 × 2 × 16 in concrete top cap", "maker": "Angelus Block", "vendor": "Angelus Block", "format": "8 × 8 × 16 CMU; cap plastered in or replaced by a precast 2 in bullnose", "finish": "Cap rounded and plastered — no brick coping", "url": "https://angelusblock.com/products/products.cfm", "why": "Option B base at 42 in; she rejected brick trim."},
  {"item": "Fountain wall / stair risers", "product": "Handmade zellige", "maker": "Clé Tile", "vendor": "Clé Tile", "format": "2 × 6 in or 4 × 4 in field; one blue glaze, one field only", "finish": "Glossy, uneven handmade face", "url": "https://hospitalitydesign.com/products/surfaces-tile/zellige-from-cl", "why": "Carries the Talavera board's colour in one place; confirm the glaze is rated for exterior use."},
  {"item": "Paving", "product": "Aqualine permeable paver, 4.5 × 9 in, 80 mm", "maker": "Belgard", "vendor": "Belgard", "format": "Field with DG joints or bands; keep the slab ≤ 12 in above grade", "finish": "Choose a warm buff to sit with the plaster", "url": "https://orders.oldcastleapg.com/pavers-slabs/permeable-grid-pavers/belgard-aqualine-4-5-x-9-80mm-paver", "why": "Drains the front yard; reads close to the gravel boards."},
  {"item": "Fire feature", "product": "Bento gas fire table (square, concrete)", "maker": "Paloform", "vendor": "Paloform", "format": "Freestanding; gas line to be permitted; check clearances to the banquette", "finish": "Concrete, colour to match cap", "url": "https://stardust.com/paloformbento.html", "why": "The banquette-around-fire image; freestanding keeps it out of the wall permit."},
  {"item": "Water feature (off-the-shelf option)", "product": "Parisienne two-tier cast stone fountain", "maker": "Campania International", "vendor": "Campania International", "format": "Freestanding, recirculating; or a custom tiled wall spout in the plaster wall", "finish": "Choose a pale patina", "url": "https://www.walmart.com/ip/44983799", "why": "Fountain boards; listing shown for reference — order through the trade account."},
  {"item": "Cushions", "product": "Canvas Pacific Blue 5401-0000, plus a terracotta canvas", "maker": "Sunbrella", "vendor": "Sunbrella", "format": "Box cushions on the banquette; welt in the other colour", "finish": "Solution-dyed acrylic", "url": "https://patiolane.com/sunbrella-canvas-pacific-blue-5401-0000-fabric.html", "why": "The red/orange cushion images and the cobalt tile; confirm the terracotta number with the rep."},
  {"item": "Hedge at the 42 in line", "product": "Little Ollie dwarf olive (Olea europaea 'Little Ollie')", "maker": "Monrovia (grower)", "vendor": "Flora Grubb Gardens", "format": "15-gal, 24–30 in on centre, clipped to the fence height", "finish": "Grey-green, fruitless", "url": "https://monrovia.com/little-ollie-dwarf-olive.html", "why": "Olive in gravel boards; also the by-right hedge-as-wall (scenario S5) and the evidence theme for the Yard Modification."},
  {"item": "Lighting", "product": "Solid brass or copper wall lantern, 2700K lamp", "maker": "Choose in SD", "vendor": "Rejuvenation", "format": "One per pilaster; shielded, warm", "finish": "Unlacquered brass or copper to age", "url": null, "why": "Copper gate and lantern boards. Hinkley and Visual Comfort are also on the vendor list."},
  {"item": "Loose seating", "product": "Teak lounge chairs and side tables", "maker": "Choose in SD", "vendor": "Teak Warehouse", "format": "Two chairs facing the banquette", "finish": "Teak left to silver", "url": null, "why": "Keeps the built banquette as the main seat; teak ages next to limewash."}
 ],
 "board": [
  {"title": "Plaster bench and lantern", "theme": "Limewash courtyard", "img": "https://images.unsplash.com/photo-1775161776593-c47cc9a30f41?w=900&q=80&auto=format&fit=crop", "credit": "Jasimine Blaser / Unsplash", "link": "https://unsplash.com/photos/stone-bench-and-lantern-on-a-stucco-wall-58Xfrnln3Ec"},
  {"title": "Bougainvillea over a white wall", "theme": "Limewash courtyard", "img": "https://images.unsplash.com/photo-1778199793901-dc0f6e5de393?w=900&q=80&auto=format&fit=crop", "credit": "Chermiti Mohamed / Unsplash", "link": "https://unsplash.com/photos/pink-bougainvillea-flowers-cascade-over-a-white-wall--1Hkxi8kUWU"},
  {"title": "Old tree, stone wall, gravel", "theme": "Limewash courtyard", "img": "https://images.unsplash.com/photo-1785245957712-07b2143b25aa?w=900&q=80&auto=format&fit=crop", "credit": "Arno Senoner / Unsplash", "link": "https://unsplash.com/photos/rustic-garden-path-with-a-gnarled-tree-and-stone-wall-khRuNLXwUvI"},
  {"title": "Terracotta patio, iron gate", "theme": "Threshold", "img": "https://images.unsplash.com/photo-1773179655576-94d3423736e5?w=900&q=80&auto=format&fit=crop", "credit": "Howard Walsh / Unsplash", "link": "https://unsplash.com/photos/terracotta-tiled-patio-with-ornate-gate-and-shutters-9vb8-Blq9co"},
  {"title": "Clipped hedges as the street edge", "theme": "Hedge as wall (Yard Modification evidence)", "img": "https://images.unsplash.com/photo-1759355787092-87e4eee09600?w=900&q=80&auto=format&fit=crop", "credit": "ubeyonroad / Unsplash", "link": "https://unsplash.com/photos/a-large-elegant-house-with-manicured-hedges-and-palm-trees-OaEHU0utrwA"},
  {"title": "Mosaic fountain", "theme": "Talavera garden room", "img": "https://images.unsplash.com/photo-1746487836224-a0ca46cdbf1c?w=900&q=80&auto=format&fit=crop", "credit": "Dennis Cortés / Unsplash", "link": "https://unsplash.com/photos/a-beautiful-colorful-mosaic-water-fountain-zmXDxXWtBe0"},
  {"title": "Courtyard fountain with pots", "theme": "Talavera garden room", "img": "https://images.unsplash.com/photo-1709881154613-45c6531036e9?w=900&q=80&auto=format&fit=crop", "credit": "Guy Grandjean / Unsplash", "link": "https://unsplash.com/photos/a-fountain-in-a-courtyard-with-potted-plants-OwwSn43gzAg"},
  {"title": "Cobalt tile field", "theme": "Talavera garden room", "img": "https://images.unsplash.com/photo-1646997181412-d0432602a8c4?w=900&q=80&auto=format&fit=crop", "credit": "Elena Giglia / Unsplash", "link": "https://unsplash.com/photos/a-close-up-of-a-blue-tiled-wall-DdrvtJ0lieY"},
  {"title": "Orange tree against blue tile", "theme": "Talavera garden room", "img": "https://images.unsplash.com/photo-1764288588047-46e78febc7d0?w=900&q=80&auto=format&fit=crop", "credit": "Daniela Almeida / Unsplash", "link": "https://unsplash.com/photos/orange-tree-branches-against-a-blue-tiled-wall-Y8xx8NezCgc"},
  {"title": "Fire after dark", "theme": "Evening", "img": "https://images.unsplash.com/photo-1642185859150-40942764765e?w=900&q=80&auto=format&fit=crop", "credit": "Joshua Bos / Unsplash", "link": "https://unsplash.com/photos/a-group-of-people-sitting-around-a-fire-pit-k4VNFMAfgDE"},
  {"title": "Warm wall light", "theme": "Evening", "img": "https://images.unsplash.com/photo-1502307444187-44d62a6a80af?w=900&q=80&auto=format&fit=crop", "credit": "Jarrod Reed / Unsplash", "link": "https://unsplash.com/photos/black-and-yellow-wall-sconce-eomLWSJphQA"}
 ]
}$p$::jsonb
 where title like 'Reference read 01%' and not (read ? 'products');
