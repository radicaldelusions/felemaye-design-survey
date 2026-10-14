# FELEMAYE — Pass 6.0 Portal SOP v6 (2026-10-13 night)
Replace FELEMAYE_ClientPortal.tsx and FELEMAYE_StudioConsole.tsx in Framer. All state, audio and database connections are unchanged.

## What changed in the portal
- Top: a long **HOME** bar (project name; Meet button lives here). Beneath it: `HOME | ROADMAP | LEDGER | CHECKPOINTS | FAMILY INSIGHTS | DIRECTORY`. CHECKPOINTS is the former Phases view. Mood Boards, Files, Permit Path, FF&E and Billing sit in a small second row so nothing was removed.
- Home: one row of four glass cards (Current phase, Awaiting you, Phases approved, Soundtrack). Below: Progress and Action items on the left, Schedule on the right, tucked up under the row (no gap). Recent activity is a full-width card.
- Recent activity (portal and Studio Console): 12-column grid, timestamp `MM/DD/YYYY HH:MM AM` in col-span-3 on one line, text in col-span-9. On phones the two stack.
- Cards use the glass frame (60% surface, 12px blur, 1px hairline) in whichever Paper/Surface colours you set in the sidebar, so it works on your cream theme as well as dark.

## Studio bypass (already live)
Signed in as felema@felemaye.com you can open `/suite/admin-audit` (list of every client) or `/suite/<client-slug>` (or `?c=<slug>`) and go straight to that dashboard, skipping the onboarding survey.

## Automation check (Supabase side)
- Existing and working: phase, deliverable and file changes, survey submitted, inquiries, staging, credentials, meeting requests all call your Make webhooks.
- Added tonight: task assigned / task status change, family survey answer, receipt upload now also call `make_portal_events_webhook` with `event` = task_assigned, task_pending_review, task_completed, family_survey_submitted, receipt_uploaded. In Make, add those event values to the router so the studio inbox gets an email. I could not open or test the Make scenario from here.
- Not verified: Tally upload forms and invoice PDF links (no Tally form is wired to the portal in the database). Tell me which Tally form you use and I will check it.
