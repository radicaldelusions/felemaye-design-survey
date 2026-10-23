-- FELEMAYE · 2026-10-23e · lead introductions + opportunities (fellowships, residencies, prizes)
-- Run once in Supabase › SQL editor (safe to re-run).
--   1. Lead signals: who filed (role, firm), project stage, the introduction path, your notes and overrides.
--      NYC filings already carry an architect or engineer of record, so they are re-labelled "consult"
--      (partner with that firm) instead of "you can lead". Void / denied County cases are dismissed.
--   2. Opportunities: a tracker for fellowships, residencies, prizes and grants, with requirements,
--      references, a fit score and an estimated chance; seeded with the current cycle (researched Oct 23, 2026).
--   3. Practice profile used to score opportunities (edit it in Console › Growth › Opportunities).

-- ─────────────────────────────────────────────────────────────── 1 · LEADS
alter table public.lead_signals add column if not exists applicant_role text;   -- owner · contractor · architect · engineer · expediter · business · unknown
alter table public.lead_signals add column if not exists applicant_firm text;
alter table public.lead_signals add column if not exists stage text;            -- planning · plan_check · issued · unknown
alter table public.lead_signals add column if not exists intro_contact text;    -- who will introduce you (free text or a network contact)
alter table public.lead_signals add column if not exists outreach_notes text;
alter table public.lead_signals add column if not exists fee_low numeric;       -- your overrides; blank = the console's estimate
alter table public.lead_signals add column if not exists fee_high numeric;
alter table public.lead_signals add column if not exists win_override numeric check (win_override is null or win_override between 0 and 1);

-- NYC: the professional of record is public (licence title + firm); owners' personal names are not used anywhere
update public.lead_signals
   set applicant_role = case raw->>'applicant_professional_title' when 'RA' then 'architect' when 'PE' then 'engineer' when 'R' then 'architect' else coalesce(applicant_role, 'unknown') end,
       applicant_firm = coalesce(applicant_firm, nullif(raw->>'applicant_business_name', '')),
       applicant = coalesce(nullif(trim(coalesce(raw->>'applicant_first_name', '') || ' ' || coalesce(raw->>'applicant_last_name', '')), ''), applicant),
       stage = coalesce(stage, case when raw->>'filing_status' ~* 'approved|permit' then 'issued' else 'plan_check' end),
       fit = case when raw->>'applicant_professional_title' in ('RA', 'PE', 'R') then 'consult' else fit end,
       fit_why = case when raw->>'applicant_professional_title' in ('RA', 'PE', 'R')
                      then 'Already filed by a licensed ' || case raw->>'applicant_professional_title' when 'PE' then 'engineer' else 'architect' end || coalesce(' at ' || nullif(raw->>'applicant_business_name', ''), '') || '. The opening is the firm, not the owner: interiors, FF&E, BIM production or overflow drafting.'
                      else fit_why end
 where source = 'nyc_dob_now';

-- LA County: stage from the case type and status (the County's open data does not list the applicant)
update public.lead_signals
   set stage = coalesce(stage, case
         when permit_type ~* 'Permits & Reviews' then 'planning'
         when work_type ~* 'issued|finaled|approved' then 'issued'
         else 'plan_check' end),
       applicant_role = coalesce(applicant_role, 'unknown')
 where source = 'epicla';
update public.lead_signals set status = 'dismissed' where source = 'epicla' and work_type ~* '^(void|denied|withdrawn|expired)' and status = 'new';
update public.lead_signals set stage = coalesce(stage, 'issued'), applicant_role = coalesce(applicant_role, 'unknown') where source = 'ladbs_permits';

-- ─────────────────────────────────────────────────────────────── 2 · OPPORTUNITIES
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org text,
  kind text not null default 'fellowship' check (kind in ('fellowship', 'residency', 'prize', 'grant', 'commission', 'competition')),
  disciplines text,
  location text,
  award text,                       -- stipend / prize, as published
  duration text,
  deadline date,
  deadline_note text,               -- extensions, "expected", time zone
  cycle text,                       -- e.g. 2027–28
  eligibility text,
  requirements jsonb not null default '[]',   -- [{item, done}]
  refs_needed int,
  refs jsonb not null default '[]',           -- [{name, relation, status: ask|agreed|submitted}]
  base_rate numeric check (base_rate is null or base_rate between 0 and 1),  -- published or estimated acceptance rate
  base_rate_basis text,
  fit int check (fit between 0 and 100),
  fit_why text,
  gaps text[] not null default '{}',
  angle text,                       -- the proposal angle that suits your practice
  url text,
  status text not null default 'watch' check (status in ('suggested', 'watch', 'preparing', 'submitted', 'shortlisted', 'won', 'declined', 'skip')),
  notes text,
  source text default 'studio',
  verified_on date,
  updated_at timestamptz not null default now(),
  unique (name, cycle)
);
alter table public.opportunities enable row level security;
drop policy if exists opportunities_studio on public.opportunities;
create policy opportunities_studio on public.opportunities for all using (public.is_studio()) with check (public.is_studio());

insert into public.studio_config (key, value) values ('practice_profile', $pp$Felema Yemaneberhan, principal of FELEMAYE LLC (Los Angeles · New York). Licensed architect in New York; California supplemental exam in progress. Practice: residential and hospitality interiors, courtyards and additions; BIM / Revit ecosystems; FF&E procurement; Surface Library (wallcoverings, textiles licensed to manufacturers); critical inquiry on place and culture, including the 90008 Index (Baldwin Hills, Leimert Park, View Park) and Black postmodernism in Los Angeles (Los Angeles Times feature, April 2026, with Jerald Cooper); Media Archives (essays, sonic records); Radical Delusions Lab (speculative work, Dem Arts & Crafts objects). To confirm: degree and year, citizenship, references you can ask.$pp$)
on conflict (key) do nothing;

insert into public.opportunities (name, org, kind, disciplines, location, award, duration, deadline, deadline_note, cycle, eligibility, requirements, refs_needed, base_rate, base_rate_basis, fit, fit_why, gaps, angle, url, status, source, verified_on) values
 ('Rome Prize — Architecture (or Design / Historic Preservation)', 'American Academy in Rome', 'fellowship', 'Architecture, Design, Landscape, Historic Preservation', 'Rome, Italy (residential)', 'Stipend, room and board, studio', 'Half or full term', '2026-11-01', 'Extended deadline Nov 15 with an additional fee', '2027–28',
  'US citizens or permanent residents; category-specific guidelines on aarome.org.', '[{"item":"Project proposal for the category","done":false},{"item":"Work samples / portfolio per category guidelines","done":false},{"item":"CV","done":false},{"item":"Recommendations (per guidelines)","done":false},{"item":"Application fee","done":false}]', null,
  0.03, 'About 30–35 fellows a year across all categories from a large field; estimate, not published per category.', 72, 'Architecture and Design categories fit; your Black postmodernism research and courtyard work give a clear Rome angle (courtyard and threshold typologies, plaster and stone).', '{"Confirm citizenship / residency","Pick the category (Architecture vs Design)","Line up recommenders this week"}',
  'Thresholds and enclosed gardens: how the Roman courtyard and its plaster, stone and water travel into Black Los Angeles domestic space.', 'https://aarome.org/apply/rome-prize', 'watch', 'gmail:news@aarome.org', '2026-10-23'),
 ('Loeb Fellowship', 'Harvard Graduate School of Design', 'fellowship', 'Built environment practice (mid-career)', 'Cambridge, MA (residential)', 'Stipend and housing', 'One academic year', '2027-01-05', '11:59 pm ET', 'Class of 2028',
  'Mid-career practitioners with at least eight years of experience; no degree requirement.', '[{"item":"Statement on your practice and what you would do with the year","done":false},{"item":"CV","done":false},{"item":"References / nominations (see loebfellowship.gsd.harvard.edu)","done":false},{"item":"Talk to a Loeb alum (they offer alumni conversations)","done":false}]', null,
  0.05, 'Around nine fellows a year; estimate.', 78, 'Built for practitioners working on equity and place; your community-rooted residential work and the 90008 Index are the case.', '{"Confirm eight years of practice","Frame a public-impact question, not a design portfolio"}',
  'Spatial memory and stewardship in historically Black LA neighborhoods: what designers owe View Park, Leimert and Baldwin Hills as they change.', 'https://loebfellowship.gsd.harvard.edu/apply-nominate/', 'watch', 'research', '2026-10-23'),
 ('Wheelwright Prize', 'Harvard Graduate School of Design', 'prize', 'Architecture research with travel', 'Travel-based research', '$100,000', 'About two years', '2027-02-07', 'Expected early Feb 2027 — the 2026 cycle closed Feb 8, 2026; confirm when the call opens', '2027',
  'Degree from an accredited architecture program within the past 15 years; any GSD affiliation not required.', '[{"item":"Research proposal with travel outside your home country","done":false},{"item":"Portfolio (built, curatorial or written work)","done":false},{"item":"CV","done":false}]', 0,
  0.01, 'One winner a year from a large international field; estimate.', 60, 'Strong if your degree is within 15 years: a travel study of courtyard and plaster traditions (Mediterranean, Ethiopian, Mexican) feeding LA practice.', '{"Confirm degree year (must be 2012 or later for 2027)"}',
  'Courtyard as social infrastructure: Addis Ababa, Oaxaca, Seville, and what they teach Los Angeles front yards under today''s zoning.', 'https://wheelwrightprize.org', 'watch', 'research', '2026-10-23'),
 ('Arnold W. Brunner Grant', 'AIA New York / Center for Architecture', 'grant', 'Architectural research', 'New York based', 'Up to $15,000', 'Project-based', '2027-02-15', 'Anticipated February 2027 — confirm with AIA New York', '2027',
  'US citizen; at least five years past first professional architecture degree; mid-career.', '[{"item":"Research proposal with an end product","done":false},{"item":"Budget","done":false},{"item":"CV / portfolio","done":false}]', null,
  0.08, 'Small number of awards a year; estimate.', 70, 'NY licence and research output fit; an end product (publication / exhibition) on Black postmodernism would read well.', '{"Confirm US citizenship","Define the end product"}',
  'A field guide to Black postmodern houses in Los Angeles and New York — survey, drawings, oral histories.', 'https://www.centerforarchitecture.org', 'watch', 'research', '2026-10-23'),
 ('MacDowell Fellowship — Fall/Winter 2027–28', 'MacDowell', 'residency', 'Architecture, landscape architecture, interdisciplinary', 'Peterborough, NH', 'Residency; need-based stipends and travel grants', 'Two to eight weeks typically', null, 'Spring/Summer 2027 closed Sept 10, 2026; the Fall/Winter call usually opens mid-winter — date to confirm', 'Fall/Winter 2027–28',
  'At least 21; generating original work; not enrolled in a degree program.', '[{"item":"Project proposal","done":false},{"item":"Work samples in your discipline","done":false},{"item":"Five artistic achievements","done":false},{"item":"$30 fee","done":false}]', 0,
  0.10, 'Estimate; MacDowell does not publish a single rate by discipline.', 74, 'Architecture is an eligible discipline and the residency rewards a clear writing or drawing project — the Black postmodernism book or the Surface Library series.', '{"Choose a bounded project for the residency"}',
  'Draw and write the first chapter of the Black postmodernism study.', 'https://www.macdowell.org/apply', 'watch', 'research', '2026-10-23'),
 ('Tulsa Artist Fellowship', 'Tulsa Artist Fellowship', 'fellowship', 'Artists and arts workers, all disciplines (architects: confirm)', 'Tulsa, OK (live and work in Tulsa)', 'Multi-year funding and workspace', 'Three years', null, 'The 2027–29 call ran Apr 7 – May 7, 2026; the next call is expected in spring 2027 — confirm', '2028–30',
  'Commitment to community-engaged practice; relocation to Tulsa.', '[{"item":"Portfolio","done":false},{"item":"Project proposal","done":false},{"item":"Community-engagement plan","done":false}]', 0,
  0.01, 'About 10 fellows per cycle; estimate.', 45, 'Fit depends on relocating to Tulsa and on whether architecture counts as an eligible practice — Greenwood history aligns with your research.', '{"Decide on relocation","Confirm architects are eligible"}',
  'Greenwood: drawing the domestic architecture that was lost and the courtyards that could hold memory now.', 'https://www.tulsaartistfellowship.org', 'watch', 'research', '2026-10-23'),
 ('Graham Foundation — Grants to Individuals', 'Graham Foundation', 'grant', 'Architecture: publications, exhibitions, research', 'Any', 'Project grants', 'Project-based', '2027-09-15', 'Annual Sept 15 deadline — the 2026 round has closed', '2027',
  'Individuals with a project that produces public output (publication, exhibition, film, research).', '[{"item":"Project description and output","done":false},{"item":"Budget","done":false},{"item":"Work samples","done":false}]', 0,
  0.12, 'Estimate.', 80, 'Your strongest match: a funded publication or exhibition on Black postmodernism in LA.', '{"Secure a publisher or venue letter"}',
  'Book or exhibition: Black Postmodernism in Los Angeles — houses, courtyards, surfaces.', 'https://grahamfoundation.org/grants', 'watch', 'research', '2026-10-23'),
 ('Dumbarton Oaks — Garden and Landscape Studies fellowship', 'Dumbarton Oaks (Harvard)', 'fellowship', 'Garden and landscape history and practice', 'Washington, DC (residential)', '$35,000 a year or $17,500 a term', 'One term or one year', '2026-11-01', 'Nov 1 annually', '2027–28',
  'Appropriate terminal degree (e.g. PhD or MLA) by the deadline; practice-based studies are within scope — confirm that an M.Arch qualifies.', '[{"item":"Research proposal","done":false},{"item":"CV","done":false},{"item":"Letters (per guidelines)","done":false}]', null,
  0.10, 'Estimate.', 55, 'The courtyard and threshold research fits; eligibility hinges on the terminal-degree rule.', '{"Confirm M.Arch counts as terminal","Deadline in 9 days — likely next cycle"}',
  'Front-yard enclosures and the public/private line in Black Los Angeles gardens.', 'https://www.doaks.org/fellowships-awards/research-fellowships', 'watch', 'research', '2026-10-23'),
 ('Harvard Radcliffe Institute Fellowship', 'Harvard Radcliffe Institute', 'fellowship', 'Creative arts, humanities (architecture: confirm field)', 'Cambridge, MA', 'Stipend (see guidelines)', 'One academic year', '2027-09-10', 'The 2027–28 creative-arts deadline was Sept 10, 2026; next cycle expected Sept 2027', '2028–29',
  'Any career stage; not a postdoc; not enrolled in a degree program.', '[{"item":"Project proposal","done":false},{"item":"Work samples","done":false},{"item":"CV","done":false},{"item":"References","done":false}]', null,
  0.04, 'Estimate.', 62, 'Interdisciplinary research year suits the Black postmodernism study.', '{"Confirm which field architecture applies under"}',
  null, 'https://www.radcliffe.harvard.edu/fellowship-program', 'watch', 'research', '2026-10-23'),
 ('MAK Center Artists and Architects-in-Residence', 'MAK Center for Art and Architecture (Schindler House)', 'residency', 'Art and architecture', 'Los Angeles (Mackey Apartments)', 'Monthly stipend and apartment', 'Six months', null, 'The last call closed Sept 2025; check makcenter.org for the next call. Program is oriented to international residents — confirm eligibility for LA-based applicants', 'next call',
  'International artists and architects; projects on art and architecture with a link to Los Angeles.', '[{"item":"Project proposal","done":false},{"item":"Portfolio","done":false}]', 0,
  0.05, 'Estimate.', 35, 'Theme fits perfectly, but residency is designed to bring people to LA — you may be better as a MAK collaborator than resident.', '{"Confirm local applicants are eligible"}',
  null, 'https://www.makcenter.org/residency', 'watch', 'gmail:info@studioahead.com', '2026-10-23'),
 ('Paris Prize (which one?)', null, 'prize', null, 'Paris', null, null, null, 'I could not identify a current "Paris Prize" open to US architects — tell me which programme you mean and I will add the real dates', 'tbd',
  null, '[]', null, null, null, null, null, '{"Name the programme"}', null, null, 'watch', 'felema', null)
on conflict (name, cycle) do nothing;
