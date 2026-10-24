-- FELEMAYE · 2026-10-23f · Friday progress note, itemized
-- Run once in Supabase › SQL editor (safe to re-run).
-- Adds dated "Coming up" rows, "From you" requests with due dates and "Decisions ahead" to Friday notes,
-- a studio contact line for the footer, and itemizes the Week 1 draft (text unchanged; dates only where you wrote them).
-- Publishing a note already notifies the client in the portal and by email (trg_cadence_notify → fy_notify).

alter table public.async_updates add column if not exists next_items jsonb not null default '[]';   -- [{date, item, who: studio|you|both}]
alter table public.async_updates add column if not exists asks_items jsonb not null default '[]';   -- [{item, due}]
alter table public.async_updates add column if not exists decisions jsonb not null default '[]';    -- [{item, by}]
alter table public.async_updates add column if not exists print_ctx jsonb;                            -- phase, timeline, next review, footer contact — saved with the note so the client's PDF matches yours

insert into public.studio_config (key, value) values ('studio_contact', '{"email":"felema@felemaye.com","phone":"","web":"felemaye.com"}')
on conflict (key) do nothing;

update public.async_updates
   set next_items = '[
        {"date":"2026-10-26","item":"Kickoff call — 12-week roadmap and Massing Options A and B (week of Oct 26–30)","who":"both"},
        {"date":"","item":"Back on site for interior and rear-yard measurements","who":"studio"},
        {"date":"2026-11-02","item":"First live review","who":"both"}]'::jsonb,
       asks_items = '[
        {"item":"Have the kids fill out the short design intent survey (this weekend or early next week)","due":""},
        {"item":"Choose a recurring review time from the options in your portal","due":""},
        {"item":"Keep an eye out for the Welcome Kit","due":""}]'::jsonb
 where id = '6d367233-799d-4447-8c73-d999672c7b06' and published_at is null and next_items = '[]'::jsonb;
