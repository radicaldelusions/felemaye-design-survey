-- ════════════════════════════════════════════════════════════════════════════
-- FELEMAYE · PERMIT INTELLIGENCE, STANDING MEETINGS & CONSULTANT DIRECTORY (2026-10-22c)
-- Run after 20261022_ and 20261022b_. Additive + targeted data updates; re-runnable.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · Standing review day (client chooses; studio applies) ───────────────
alter table public.project_cadence add column if not exists standing_weekday int check (standing_weekday between 1 and 5);
alter table public.project_cadence add column if not exists standing_time    text;     -- "10:00"
alter table public.project_cadence add column if not exists standing_note    text;
alter table public.project_cadence add column if not exists standing_set_at  timestamptz;

create or replace function public.client_set_standing_slot(p_project uuid, p_weekday int, p_time text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare dn text[] := array['Monday','Tuesday','Wednesday','Thursday','Friday'];
begin
  if not (public.is_studio() or p_project in (select public.my_projects())) then raise exception 'not allowed'; end if;
  if p_weekday not between 1 and 5 then raise exception 'Choose a weekday'; end if;
  if p_time !~ '^\d{2}:\d{2}$' then raise exception 'Choose a time'; end if;
  update public.project_cadence set standing_weekday = p_weekday, standing_time = p_time,
         standing_note = left(nullif(btrim(coalesce(p_note,'')),''), 500), standing_set_at = now()
   where project_id = p_project;
  perform public.fy_notify(p_project, 'studio', 'standing_slot', 'Standing review preference · ' || dn[p_weekday] || 's at ' || p_time,
                           p_note, 'cadence', null);
  perform public.fy_log(p_project, 'standing_slot_chosen', jsonb_build_object('title', dn[p_weekday] || 's ' || p_time));
end $$;
revoke execute on function public.client_set_standing_slot(uuid,int,text,text) from public, anon;
grant  execute on function public.client_set_standing_slot(uuid,int,text,text) to authenticated;

-- Advisory rate: $225/h recommended (adjust in Console › Cadence › Settings).
update public.project_cadence set advisory_rate = 225 where advisory_rate is null;

-- ── 2 · Lorado plan: Week 1 is studio groundwork; kickoff after Banchi returns.
--        No video promises — Friday notes are written progress notes. ───────
update public.project_weeks w set
  title = 'Studio Groundwork · Site & Zoning',
  touchpoint = 'async',
  touchpoint_title = 'Friday progress note · site measured, County research under way',
  presentation = null, deliverables = '{}', approval_required = null
from public.projects p where p.id = w.project_id and p.slug = 'the-lorado-courtyard' and w.week_no = 1;

update public.project_weeks w set
  title = 'Kickoff · Welcome & Feasibility',
  touchpoint = 'live',
  touchpoint_title = 'Kickoff Call · Welcome Kit & roadmap',
  presentation = '12-week roadmap, zoning findings to date, portal walkthrough',
  deliverables = array['Project Overview Brief','Existing documents checklist'],
  approval_required = null
from public.projects p where p.id = w.project_id and p.slug = 'the-lorado-courtyard' and w.week_no = 2;

update public.project_weeks w set touchpoint_title = replace(replace(touchpoint_title, 'Friday update ·', 'Friday progress note ·'), ' video', '')
from public.projects p where p.id = w.project_id and p.slug = 'the-lorado-courtyard' and w.touchpoint = 'async';

update public.project_cadence c set cadence_note =
  'Live reviews happen every two to three weeks, at the moments a decision is needed. In between, a short written progress note is posted here every Friday, so you always know where the work stands without having to set time aside.'
from public.projects p where p.id = c.project_id and p.slug = 'the-lorado-courtyard';

insert into public.studio_deadlines (project_id, week_no, title, due_on)
select p.id, 2, 'Book follow-up Regional Planning appointment; bring plot plan, block photos and the open questions (front-yard wall opacity under the CSD, front-yard depth)', date '2026-10-30'
from public.projects p where p.slug = 'the-lorado-courtyard'
  and not exists (select 1 from public.studio_deadlines x where x.project_id = p.id and x.title like 'Book follow-up Regional Planning appointment%');
insert into public.studio_deadlines (project_id, week_no, title, due_on)
select p.id, 2, 'Commission boundary + topographic survey (County has no corner records for the parcel)', date '2026-10-30'
from public.projects p where p.slug = 'the-lorado-courtyard'
  and not exists (select 1 from public.studio_deadlines x where x.project_id = p.id and x.title like 'Commission boundary + topographic survey%');

-- Friday progress notes carry the images the studio already makes (Revit / Enscape views, site photos).
alter table public.async_updates add column if not exists images jsonb not null default '[]';  -- [{path, caption}]

-- ── 3 · Zoning audits: structured permit analysis ──────────────────────────
alter table public.project_zoning_audits add column if not exists analysis     jsonb not null default '{}';
alter table public.project_zoning_audits add column if not exists source_files text[] not null default '{}';
alter table public.project_zoning_audits add column if not exists sheet_number text;

-- ── 4 · Jurisdiction reference library (studio only) ───────────────────────
create table if not exists public.jurisdiction_references (
  id           uuid primary key default gen_random_uuid(),
  jurisdiction text not null,           -- la_county / ladbs / nyc_dob / national
  agency       text,
  topic        text not null,           -- zoning / sheets / title_block / text / submittal / historic / process / links
  title        text not null,
  body         text,
  url          text,
  status       text not null default 'verified' check (status in ('verified','to_verify','draft')),
  verified_on  date,
  created_at   timestamptz not null default now(),
  unique (jurisdiction, title)
);
alter table public.jurisdiction_references enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='jurisdiction_references' and policyname='jurisdiction_references_studio') then
    create policy jurisdiction_references_studio on public.jurisdiction_references for all to authenticated using (public.is_studio()) with check (public.is_studio());
  end if;
end $$;
grant select, insert, update, delete on public.jurisdiction_references to authenticated;

insert into public.jurisdiction_references (jurisdiction, agency, topic, title, body, url, status, verified_on) values
('la_county','Regional Planning','zoning','Westside Area Plan & Westside PASD — adopted Mar 11, 2025',
 'View Park–Windsor Hills is inside the Westside Planning Area. The Board adopted the Westside Area Plan and the Westside Planning Area Standards District on March 11, 2025. Community Standards Districts in this PASD add rules on top of Title 22.',
 'https://planning.lacounty.gov/long-range-planning/westside-area-plan/','verified','2026-10-21'),
('la_county','Regional Planning','zoning','View Park–Windsor Hills CSD — front-yard fences & walls',
 'Hearing-draft text (Sept 2024): in a required front yard, fences/walls max 3.5 ft when less than 10 ft from the front property line, max 6 ft beyond; fences in a required front yard must be NON-VIEW-OBSCURING for portions below 3.5 ft; chain-link prohibited; required front yard (excl. driveways/walks) landscaped; Title 22 §22.110.070 still applies. CONFIRM the adopted section text with Regional Planning — it may rule out a solid 42" masonry base in the required front yard.',
 'https://planning.lacounty.gov/wp-content/uploads/2024/09/WSAP_PASD_Ordinance.pdf','to_verify','2026-10-21'),
('la_county','Regional Planning','process','Fence-only vs. structure: review path (per County planner, Oct 2026)',
 'Fence/wall only: go directly to Building & Safety (skip Regional Planning). Anything adding floor area or a patio structure: Regional Planning first (~3–4 weeks), then Building & Safety. Soils testing not required for fence work. Pre-application meetings available up to 3 days per week; the reviewing planner may differ from the pre-app planner. Discretionary path discussed: yard modification supported by neighborhood photos showing comparable conditions, where the rear yard has little usable area.',
 null,'to_verify','2026-10-21'),
('la_county','Public Works · Building & Safety','sheets','BCM 106.4.3 — plan sheet size & scale',
 'Preferred sheet sizes 24×18 in. to 48×36 in.; half-size only for reference/DD. Smaller sheets allowed for minor work incl. certain retaining walls. Preferred scale 1/4" = 1''-0". Sections, details, notes and specs on the same sheet size as plans. The manual sets no sheet-numbering or text-height rule.',
 'https://ladpw.org:443/bsd/lib/fp/Building/Building Code Manuals/2017/BCM 106.4.3 A1 - Building Plan Sheet Size.pdf','verified','2026-10-21'),
('la_county','Public Works · Building & Safety','submittal','EPIC-LA — permits & plan check portal',
 'Unincorporated LA County permit applications and electronic plan check. Building & Safety district office serves the parcel; confirm the district office for View Park.',
 'https://epicla.lacounty.gov','verified','2026-10-21'),
('la_county','Regional Planning','zoning','Title 22 (Planning & Zoning) — LA County Code',
 'Base zone standards (R-1 yards, height, fences §22.110.070). Always read together with the Westside PASD / CSD overlays.',
 'https://library.municode.com/ca/los_angeles_county/codes/code_of_ordinances?nodeId=TIT22PLZO','verified','2026-10-21'),
('national','US National CAD Standard','sheets','Sheet naming — no CA-mandated zoning sheet number',
 'California agencies (LA County, LADBS) do not mandate a zoning sheet number. Common convention (US NCS): G-series = general (G-001 cover/code & zoning analysis), A-series = architectural. Use G-001 "Project Data, Zoning & Code Analysis" or put the analysis on the title sheet. NYC practice differs (Z-series + ZD1).',
 null,'verified','2026-10-21'),
('nyc_dob','NYC Department of Buildings','sheets','DOB drawing standards — title block, text, sheet size',
 'Zoning information belongs on the title sheet or the sheets immediately after it. Computer text min 3/32"; hand lettering min 1/8". Title block: DOB plan ID (e.g. A-411.07) and page "1 of 10" lower right; project name/address; owner; all RDPs; revision block; BSCAN sticker space (1"×3"); DOB stamp space (3"×3"); wet seal & signature (black/dark blue/brown). Sheets 11×17 min, 36×48 max; 24×36 preferred.',
 'https://www.nyc.gov/assets/buildings/pdf/drawing_standards_08132010.pdf','verified','2026-10-21'),
('nyc_dob','NYC Department of Buildings','zoning','ZD1 Zoning Diagram',
 'Required with initial filings that need zoning review. 11×17 ZD1 form, min 8-pt type; site plan with dimensioned zoning lot, yards, coverage, districts/overlays, curb cuts, parking, retaining walls, fences — each marked existing/proposed with Zoning Resolution citations; axonometric for height, setbacks, sky exposure plane. Zoning analysis sheets conventionally numbered Z-001+.',
 'https://www.nyc.gov/assets/buildings/pdf/zd1_guide.pdf','verified','2026-10-21'),
('nyc_dob','NYC Landmarks Preservation Commission','historic','LPC — landmark & historic district work',
 'Work on designated landmarks or in historic districts needs an LPC permit before DOB approval.',
 'https://www.nyc.gov/site/lpc/index.page','verified','2026-10-21'),
('ladbs','LA City Planning / LADBS','links','City of Los Angeles — ZIMAS, LADBS plan check, HPOZ',
 'City parcels: check ZIMAS for zone, overlays (HPOZ, Specific Plans, BHO). LADBS plan check via ePlanLA. HPOZ work needs Office of Historic Resources review. Note: View Park–Windsor Hills is unincorporated County, not City.',
 'https://zimas.lacity.org','to_verify','2026-10-21')
on conflict (jurisdiction, title) do nothing;

insert into public.jurisdiction_references (jurisdiction, agency, topic, title, body, url, status, verified_on) values
('la_county','Regional Planning','zoning','Title 22 sections that decide front-yard work',
 '§22.110.070 Fences & walls (front yard ≤ 3.5 ft; interior side/rear ≤ 6 ft; corner side ≤ 3.5 ft within 5 ft of the highway line). §22.110.090 Projections into yards (uncovered porches/landings ≤ 5 ft into the front yard, ≥ 2 ft from lot lines, open & unenclosed; covered patios rear yard only — .090.H). §22.110.040.D (walks, slabs, decks ≤ 1 ft above grade in any yard). §22.110.080.B.1 (partially developed blocks: front yard may be the average of the adjoining lots). §22.110.190.A → Yard Modification, Chapter 22.196.',
 'https://library.municode.com/ca/los_angeles_county/codes/code_of_ordinances?nodeId=TIT22PLZO','verified','2026-10-22'),
('la_county','Public Works · Building & Safety','submittal','Residential minimum plan submittal requirements',
 'Sheets 18×24 min (24×36 recommended); scale 1/8" min (1/4" recommended); fully dimensioned. General notes: codes, occupancy, construction type, sprinklers, APN, legal description. Site plan: address, north arrow, property lines, easements, setbacks, FAR & lot coverage (sf and %), landscaping, street names & centerlines, grades at corners/driveway/garage, utilities, adjacent structures within 10 ft, hardscape, slopes. Signed by the preparer; wet-stamped by a CA architect/engineer where required.',
 'https://dpw.lacounty.gov/bsd/lib/fp/Building/Residential/Residential%20Minimum%20Plan%20Submittal%20Requirements.pdf','verified','2026-10-22'),
('la_county','Public Works · Building & Safety','submittal','Retaining walls — 2026 plan review checklist',
 'A separate permit for each retaining wall. Engineer''s signature, registration no. and expiration on each sheet. Property line on every section; no footing or drainage on the neighbor''s side without written permission. A fence on top of a wall needs wind-load calculations for fence + wall. Soils report when the design departs from prescriptive requirements.',
 'https://dpw.lacounty.gov/bsd/lib/fp/Building/Structural%20and%20Technical/2026%20Code%20Version/2026%20Retaining%20Wall%20Plan%20Review%20v1.0.pdf','verified','2026-10-22'),
('la_county','State Historic Preservation Office','historic','View Park Historic District (NRHP 2016)',
 'Listed July 12, 2016 (#16000434); also on the California Register. Listing alone places no restrictions on private owners'' normal use or alterations; projects with substantial adverse change may trigger local ordinances or CEQA. 3745 Lorado Way does not appear in the nomination''s property inventory — confirm the parcel''s status with the County before relying on it.',
 'https://npgallery.nps.gov/AssetDetail/NRIS/16000434','verified','2026-10-22'),
('national','US National CAD Standard','sheets','NCS discipline letters — "Z" is not zoning',
 'G General (sheet list, code summary) · V Survey · B Geotechnical · C Civil · L Landscape · S Structural · A Architectural · I Interiors · P Plumbing · M Mechanical · E Electrical · Z Contractor/Shop drawings. Sheet ID = letter + type digit + sequence (A-101). Type digits: 0 general, 1 plans, 2 elevations, 3 sections, 4 enlarged, 5 details, 6 schedules, 9 3D.',
 'https://www.archtoolbox.com/construction-document-sheet-numbers/','verified','2026-10-22'),
('ladbs','LADBS · ePlanLA','sheets','ePlanLA plan file format',
 'One vector PDF per plan set, landscape, TrueType fonts, bookmarks matching sheet numbers, ≤ 50 MB per file; title (cover) page with sheet index; keep the upper-right corner clear for the approval stamp (2.25" from the right, 0.25" from the top).',
 'https://dbs.lacity.gov/node/2312','verified','2026-10-22'),
('nyc_dob','NYC City Planning','sheets','DCP zoning analysis sheet (land-use applications)',
 'Stand-alone sheet, 11×17 to 36×48; site data box upper right (block & lot, address, zoning lot area, zoning map, districts, community district); FAR, uses, yards, height & setback, parking, coverage, planting, street trees; text ≥ 12 pt; leave 4"×3.25" for the approval label.',
 'https://www.nyc.gov/assets/planning/download/pdf/applicants/applicant-portal/zoning_analysis_guidelines.pdf','verified','2026-10-22')
on conflict (jurisdiction, title) do nothing;

-- ── 5 · Lorado: seed a working permit analysis (draft) ─────────────────────
insert into public.project_zoning_audits (project_id, jurisdiction, zone_class, overlays, setback_front_ft, wall_height_cap_in, transparency_pct, status, sheet_number, source_note, source_files, analysis)
select p.id, 'la_county', 'R-1', array['Westside PASD','View Park–Windsor Hills CSD'], 20, 42, null, 'draft', 'G-001',
 'Seeded 2026-10-22 from: Regional Planning consult with Daisy (transcript in "Master Site Research Report"), Zoning & Feasibility guide (Oct 8), Survey & Mapping records check (Oct 21), Title 22 / Westside PASD / DPW research. Draft for studio verification.',
 array['Master Site Research Report (Regional Planning consult)','Zoning & Feasibility guide (Oct 8)','View Park Historic District NRHP nomination (108192.pdf)'],
 $a$
 {
  "summary": "A front-yard enclosure at 3745 Lorado Way can only be a fence or wall within the front-yard limits; anything with a roof, enclosure or added floor area has to sit behind the required front yard. The decision that unlocks Option B is whether the View Park–Windsor Hills CSD allows a solid 42-inch base in the front yard — the planner said yes, the CSD text reads no.",
  "allowed": [
   "Fence or wall up to 3.5 ft in the required front yard (Title 22 §22.110.070.B.1); up to 6 ft in interior side and rear yards (§22.110.070.B.2) — the side fence goes to 6 ft only past the driveway (planner).",
   "Open, see-through fencing above 42 in up to the CSD maximum (wrought-iron type) — planner.",
   "Open-air paving, tile, walkways and patio slabs no more than 1 ft above grade anywhere in the required yards (§22.110.040.D).",
   "Uncovered entry porch / landing projecting up to 5 ft into the front yard, at least 2 ft from lot lines, open and unenclosed, with an openwork railing up to 3.5 ft (§22.110.090.D.1).",
   "Moving the pedestrian gate; a path connecting the front and rear yards — Building & Safety only (planner).",
   "Fence/wall-only scope goes straight to Building & Safety: no Regional Planning review and no soils testing (planner).",
   "Solid walls, covered structures and added floor area behind the required front yard, within normal R-1 limits."
  ],
  "non_negotiables": [
   "No enclosed courtyard, roof, pergola, trellis or overhead structure inside the required front yard; the front yard stays open to the sky (planner; Title 22 has no 'courtyard' use).",
   "Covered patios are rear-yard only (§22.110.090.H).",
   "Front-yard fence/wall height capped at 3.5 ft; chain-link prohibited (CSD).",
   "Required front yard stays landscaped, except driveway and walks (CSD).",
   "Garage and driveway stay where they are — the garage is already nonconforming, so changes trigger a yard modification; no second driveway onto the front yard (planner).",
   "Decorative perforated panels that are not genuinely open are not accepted above 42 in (planner).",
   "Neighbors' taller walls and hedges are not precedent — the County treats them as likely unpermitted (planner)."
  ],
  "negotiables": [
   "Front-yard depth: on a partially developed block the required front yard may be the average of the two adjoining lots' front yards (§22.110.080.B.1). Daisy read this lot's setback at about 24 ft — measure both neighbors and confirm on the survey. By right if it applies.",
   "Yard Modification (Title 22 Ch. 22.196, authorized by §22.110.190.A) for any element beyond the yard rules — evidence: measured setbacks and dated photos along the block, the limited usable rear yard, a compatibility narrative and drawings. Discretionary; Regional Planning before Building & Safety.",
   "Placement: setting the solid portion behind the required front yard avoids the front-yard height and opacity rules entirely.",
   "Design: masonry pilasters with open iron infill may read as non-view-obscuring — ask how the County measures it (pilaster width and spacing).",
   "Enclosed front-yard courtyard concept: Daisy is taking it to the section planning meeting — wait for her written answer before designing toward it."
  ],
  "applications": [
   "Follow-up pre-application appointment with Regional Planning (30-minute slots, up to 3 days a week).",
   "Boundary + topographic survey by a licensed land surveyor (no County corner records for the parcel).",
   "If relief is needed: Yard Modification application to Regional Planning (~3–4 weeks typical review), then Building & Safety.",
   "Building permit through EPIC-LA (Public Works Building & Safety); a separate permit for each retaining wall; stamped structural sheets for masonry and footings."
  ],
  "conflicts": [
   "Front-yard wall opacity: the View Park–Windsor Hills CSD text says fences in the required front yard must be non-view-obscuring below 3.5 ft — read literally, no solid 42-in masonry base. The planner said a 42-in solid retaining wall with wrought iron above is permitted. Get a written answer citing the adopted CSD section before developing Option B.",
   "Front-yard depth: the Oct 8 guide used 15 ft, the project brief 20 ft, the planner observed about 24 ft. Fix it from the survey and the adjoining-lot average.",
   "CSD front-setback reduction applies only to listed Hillside Management Area addresses and excludes registered historic districts — Lorado Way is not listed, so it does not apply.",
   "Section numbering for the View Park–Windsor Hills CSD differs between the 2024 drafts — cite the adopted Municode section on the sheet."
  ],
  "questions": [
   "Under the View Park–Windsor Hills CSD as adopted, is a solid 42-inch masonry base allowed in the required front yard, or must the whole fence be non-view-obscuring below 3.5 ft?",
   "What is the required front-yard depth for 3745 Lorado Way — 20 ft, or the average of the adjoining lots under §22.110.080.B.1?",
   "On a sloping front yard with a low retaining wall at the lot line, from which grade is fence/wall height measured?",
   "Would a pilaster + open iron design count as non-view-obscuring? Any limit on pilaster width or spacing?",
   "If we pursue a Yard Modification for a front-yard element, which findings apply, what is the fee, and what evidence carries weight?",
   "What did the section meeting conclude on an enclosed front-yard courtyard?"
  ],
  "sheet_requirements": [
   "LA County B&S: sheets 18×24 in minimum (24×36 recommended); scale 1/8\" = 1'-0\" minimum, 1/4\" preferred; plans fully dimensioned.",
   "General notes: applicable codes, occupancy, construction type, sprinklers yes/no, APN 5012-027-005 and legal description (Tract 6177).",
   "Site plan: property lines, easements, existing/proposed setbacks, landscaping and lot-coverage figures, street centerline, grade elevations at corners/driveway/garage, adjacent structures within 10 ft, top/toe of slopes.",
   "Retaining walls: property line on each section; engineer's signature, registration no. and expiration on every sheet; wind-load calcs for any fence on top of a wall.",
   "Sheet number: LA County mandates none — use G-001 'Project Data, Zoning & Code Analysis' (NCS G-series). 'Z' in NCS means contractor/shop drawings, not zoning."
  ],
  "sheet": {"number": "G-001", "title": "Project Data, Zoning & Code Analysis", "note": "No mandated zoning sheet number in LA County; NCS G-series convention."},
  "facts": {"zone_class": "R-1", "overlays": ["Westside PASD","View Park–Windsor Hills CSD"], "setback_front_ft": 20, "wall_height_cap_in": 42},
  "sources": [
   {"title": "Regional Planning consult — Daisy (transcript, Master Site Research Report)", "url": "https://docs.google.com/document/d/1Ig_70Z2eN-hNI1qSl-608w8GHUwIY3P8SNHLJkpcrVE/edit", "cited_for": "front-yard rules, review path, garage, gate"},
   {"title": "Title 22, LA County Code (Municode) — §22.110.040, .070, .080, .090, .190; Ch. 22.196", "url": "https://library.municode.com/ca/los_angeles_county/codes/code_of_ordinances?nodeId=TIT22PLZO", "cited_for": "base R-1 yard, fence and projection rules"},
   {"title": "Westside Area Plan & Westside PASD — adopted Mar 11, 2025", "url": "https://planning.lacounty.gov/long-range-planning/westside-area-plan/", "cited_for": "overlay applies"},
   {"title": "Westside PASD ordinance text (Sept 2024) — View Park–Windsor Hills CSD", "url": "https://planning.lacounty.gov/wp-content/uploads/2024/09/WSAP_PASD_Ordinance.pdf", "cited_for": "front-yard fence opacity, landscaping, setback reduction"},
   {"title": "DPW Residential Minimum Plan Submittal Requirements", "url": "https://dpw.lacounty.gov/bsd/lib/fp/Building/Residential/Residential%20Minimum%20Plan%20Submittal%20Requirements.pdf", "cited_for": "sheet size, scale, site plan items"},
   {"title": "DPW 2026 Retaining Wall Plan Review checklist", "url": "https://dpw.lacounty.gov/bsd/lib/fp/Building/Structural%20and%20Technical/2026%20Code%20Version/2026%20Retaining%20Wall%20Plan%20Review%20v1.0.pdf", "cited_for": "separate permits, fence-on-wall calcs"},
   {"title": "View Park Historic District, NRHP #16000434 (listed 2016) — Lorado Way not in the property inventory", "url": "https://npgallery.nps.gov/AssetDetail/NRIS/16000434", "cited_for": "historic status"}
  ]
 }
 $a$::jsonb
from public.projects p
where p.slug = 'the-lorado-courtyard'
  and not exists (select 1 from public.project_zoning_audits z where z.project_id = p.id and z.analysis ? 'non_negotiables');

-- ── 6 · Consultant directory (to vet) ──────────────────────────────────────
alter table public.consultants add column if not exists vetting_status text not null default 'to_vet';  -- to_vet / contacted / vetted / warm / declined
alter table public.consultants add column if not exists source_url     text;
alter table public.consultants add column if not exists lead_time_note text;
alter table public.consultants add column if not exists service_area   text;

insert into public.consultants (discipline, firm, website, phone, email, service_area, lead_time_note, notes, source_url)
select * from (values
 ('structural','Nous Engineering','https://www.archdaily.com/professional/nous-engineering',null,null,'Los Angeles','Ask','Architect-facing structural practice known for design-led residential work; SEAOSC member listing. Good fit for a detailed masonry + iron enclosure.','https://architizer.com/firms/nous-engineering-inc'),
 ('structural','Jon Brody Consulting Engineers','https://www.archdaily.com/professional/jon-brody-consulting-engineers',null,null,'Los Angeles','Ask','Long-established LA structural engineer for custom residential work with architects.','https://www.archdaily.com/professional/jon-brody-consulting-engineers'),
 ('structural','The Eden Group','https://www.theedengroup.com/structural-engineering/','(818) 788-1481','info@theedengroup.com','Sherman Oaks · LA County','Residential plans 4–6 weeks (site); expedite available','Structural + civil + MEP + survey under one roof — simplest single contract for a small scope. Retaining walls and masonry listed.','https://www.theedengroup.com/structural-engineering/'),
 ('structural','Alpha Structural (design-build)','https://www.alphastructural.com/retaining-walls/','(323) 258-5482',null,'LA, Eagle Rock office','Ask','Design-build retaining-wall contractor with in-house engineering. Note: client already has a GC — useful mainly as a pricing benchmark.','https://www.alphastructural.com/retaining-walls/'),
 ('civil','B+W Engineering and Design','https://bwengr.com/cities/los-angeles/','(323) 739-3913',null,'La Cañada Flintridge · LA','Ask','Grading, drainage and hydrology plans; retaining-wall layouts; coordinates with geotech. Only needed if the County asks for grading/drainage.','https://bwengr.com/'),
 ('civil','The Eden Group — Civil','https://www.theedengroup.com/civil-engineering/','(818) 788-1481','info@theedengroup.com','Sherman Oaks · LA County','Ask','Same firm as structural; bundle if drainage is required.','https://www.theedengroup.com/civil-engineering/'),
 ('survey','Bonadiman Pacific Surveying','https://bonpacsurvey.com/land-surveyor-los-angeles/',null,null,'Santa Monica → Pasadena','"Rapid permit-ready turnaround" (ask for dates)','PLS 8922. Boundary + topographic surveys — needed to fix the front property line before the wall is drawn.','https://surveyslate.com/blog/best-land-surveyors-los-angeles/'),
 ('survey','Builoff Surveying & Mapping','https://www.builoff.com/',null,null,'LA & Ventura','Ask','PLS 8099; residential boundary/topo and 3D mapping (useful for the Revit base model).','https://surveyslate.com/blog/best-land-surveyors-los-angeles/'),
 ('survey','Becker & Miyamoto','https://surveyslate.com/listing/becker-miyamoto-inc-los-angeles/',null,null,'Greater LA','Ask','PLS 7155 / 4825; boundary and topographic surveys for public and private clients.','https://surveyslate.com/blog/best-land-surveyors-los-angeles/'),
 ('survey','LA Surveying & Mapping','https://surveyingla.com/',null,null,'Los Angeles','Ask','Licensed LA land surveyor; boundary/topo for residential.','https://surveyingla.com/'),
 ('mep','The Eden Group — MEP','https://www.theedengroup.com/','(818) 788-1481','info@theedengroup.com','Sherman Oaks · LA County','Ask','For exterior lighting / electrical if the County requires engineered plans; often a licensed electrical contractor can design-build this scope instead.','https://www.theedengroup.com/'),
 ('mep','NY Engineers — California residential MEP','https://www.ny-engineers.com/mep-design/residential-california',null,null,'Remote · California','Ask','Remote MEP/Title 24 design for residential; fallback if lighting/power plans are required.','https://www.ny-engineers.com/mep-design/residential-california'),
 ('structural','MPA Structural Inc.','https://mpastructural.com/',null,'info@mpastructural.com','Los Angeles','Ask','Principal Naman Parikh, PE (MS Structural, UCLA). ADUs, single-family and hillside homes. Independent engineer — fits the client-direct Engineer of Record model.','https://mpastructural.com/'),
 ('structural','CMZStudio','https://cmzstudio.com/','+1 510-277-7700',null,'Concord CA · works statewide incl. LA','Ask','Lei Zheng, CA Civil C-69809. Works behind the designer ("your client, your project"); stamped sets + plan check to permit. Bay Area based — confirm LA County experience and site visits.','https://cmzstudio.com/'),
 ('structural','Gordon L. Polon, Structural Engineering','https://www.gordonpolon.com/',null,null,'Santa Monica','Ask','Westside practice; residential and restoration among its project types. Confirm appetite for a small site-wall scope.','https://www.gordonpolon.com/'),
 ('structural','LA Structural (design-build)','https://www.la-structural.com/services/retaining-walls/','323-422-5807',null,'Burbank','Ask','General contractor (CSLB 1085050) that designs and builds retaining walls — bid comparison only, not an independent EOR.','https://www.la-structural.com/services/retaining-walls/'),
 ('survey','Chris Nelson Associates','https://surveyslate.com/blog/best-land-surveyors-los-angeles/',null,null,'Countywide','Ask','Boundary determination and ALTA; moderate pricing.','https://surveyslate.com/blog/best-land-surveyors-los-angeles/'),
 ('survey','JDJ Consulting Group','https://surveyslate.com/blog/best-land-surveyors-los-angeles/',null,null,'Los Angeles','Ask','Local specialist in hillside and complex-zoning sites; preconstruction surveys.','https://surveyslate.com/blog/best-land-surveyors-los-angeles/'),
 ('survey','C.P. Land Surveying','https://cplandsurveying.com/california-land-surveying-offices/los-angeles-land-survey-company/',null,null,'Los Angeles','Ask','LA land survey office; boundary and topo.','https://cplandsurveying.com/'),
 ('geotech','Grover-Hollingsworth & Associates',null,'(818) 889-0844',null,'Greater LA','Ask','CalGeo residential member. Only if a retaining wall needs a soils report — not required for fencing (planner).','https://www.calgeo.org/find-a-geotech-near-you-residential-'),
 ('geotech','Feffer Geological Consulting',null,'(310) 207-5048',null,'Westside','Ask','CalGeo residential member.','https://www.calgeo.org/find-a-geotech-near-you-residential-'),
 ('geotech','Hamilton & Associates',null,'(310) 618-2190',null,'South Bay','Ask','CalGeo residential member.','https://www.calgeo.org/find-a-geotech-near-you-residential-'),
 ('geotech','Irvine Geotechnical',null,'(626) 844-6641',null,'Greater LA','Ask','CalGeo residential member.','https://www.calgeo.org/find-a-geotech-near-you-residential-'),
 ('geotech','Ralph Stone & Company',null,'(310) 478-1501',null,'West LA','Ask','CalGeo residential member.','https://www.calgeo.org/find-a-geotech-near-you-residential-')
) as v(discipline, firm, website, phone, email, service_area, lead_time_note, notes, source_url)
where not exists (select 1 from public.consultants c where lower(c.firm) = lower(v.firm));
