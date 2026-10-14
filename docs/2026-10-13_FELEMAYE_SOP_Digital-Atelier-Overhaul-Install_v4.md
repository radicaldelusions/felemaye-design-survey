# FELEMAYE — Digital Atelier Overhaul: Install SOP v4 (2026-10-13)

All components are Framer code components (Assets → Code → New file → paste). Changes are additive: new files, plus updates to files you already have.

## New / updated files
| File | Where it goes | What changed |
|---|---|---|
| FELEMAYE_SiteFooter.tsx | Footer on every page | 5 even columns, container `max-w-7xl px-6 md:px-12 lg:px-16`, slugs per directive (`ffe-procurement`), "Book ↗" TidyCal link per vertical |
| FELEMAYE_AudioContext.tsx | ONE instance in the site-wide layout | "Sound On" pill shows once per browser, never on later routes |
| FELEMAYE_StudioEthosHero.tsx (new) | About page hero | manifesto ticker, blue accents, Framer Motion reveals, Polaroid with marker captions, flex-col → lg:flex-row |
| FELEMAYE_CapabilitiesMatrix.tsx | Capabilities | curved titles, ≥84px nodes, centred initials, trimmed connectors, lower-left detail card |
| FELEMAYE_HomeDeskStudio.tsx | Home | Post-it: Who We Work With / B2B | B2C / [See Full Breakdown →] |
| FELEMAYE_ClientPortal.tsx | /client-suite | 12-col Directory with own Company column, bi-coastal permit card, Family Wishlist & Spatial Adjacencies card |
| FELEMAYE_FamilySurvey.tsx | /survey/lorado-family | `Max width` prop, default 896 (max-w-4xl) |
| FELEMAYE_SurfaceLibrary.tsx (new) | /surface-library | live filters: material, origin, application, trade samples |

## Footer: TidyCal
Select the footer → "TidyCal links": one per line, e.g. `spatial-design=https://tidycal.com/<your-handle>/<event>`. Or fill "TidyCal base URL" and the slug is appended. Verticals with no link simply show no "Book" link. Slugs: spatial-design, surface-library, bim-vdc, ffe-procurement, creative-strategy, talent-alignment, critical-inquiry, media-archives, radical-delusions-lab.

## /perspectives margin fix (Framer-side)
Select the page's outer stack/section → set Width 100%, Max width 1280, Center, and horizontal padding 24 (mobile) / 48 (tablet) / 64 (desktop). Those are the Tailwind values `px-6 md:px-12 lg:px-16`. Do the same on every route's top-level section so margins match the header and footer.

## /inquiry form (Framer-side)
1. Add a dropdown "How did you hear about us?" with: Client Referral, Architectural Press / Media, Industry Partner / Trade, Academic / Cornell Network, Other.
2. Add a hidden field "vertical". In Framer form: Variables → read the `vertical` query string and fill the field, so `/inquiry?vertical=bim-vdc` arrives pre-selected. Map values to your Vertical dropdown using the nine slugs above.
3. Surface Library "Enquire / Request trade sample" sends `?item=<name>`; add a hidden "item" field the same way.

## Supabase (one step left for you)
Open `supabase/migrations/20261013_master_schema.sql`, Addendum 3, and run the two `update public.jurisdiction_workflows` statements in the SQL editor. Also set `primary_goals` for Lorado (example in the file). The portal's bi-coastal card works without them.

## Surface Library data
Add rows in Table editor → `surface_items`. `public_preview = true` shows to any visitor; otherwise only approved members (`surface_members`) and the studio. Images upload to bucket `surface-library`; put the file path in `image_path`.

## Not verified
No LA County or NYC DOB fee figures were verified from a primary source, so the portal lists fee types and says amounts are quoted per project. Add real figures only from the current agency fee schedules.
