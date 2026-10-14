# FELEMAYE — Pass 5.0 Install SOP v5 (2026-10-13 evening)

Paste each file over the matching Framer code file (Assets → Code). Additive: nothing is deleted, old copies stay in `_superseded` if you want them.

| File | Page | Notes |
|---|---|---|
| FELEMAYE_StudioEthosHero.tsx | About | Blank-canvas bug fixed (reveals now run on load, not on scroll-into-view). Contained to max-w-7xl. Name line: Felema Yemaneberhan \| ፈለማ የማነበርሃን. Add the Polaroid photo in the sidebar. Edit the body and credentials text to your own wording. |
| FELEMAYE_SiteFooter.tsx | Footer, every page | Set the footer layer Width = Fill (100%). Responds to its own width, so phone frames in the canvas are correct now. "Book a call" list + per-vertical "Book" links. |
| FELEMAYE_CapabilitiesMatrix.tsx | /capabilities | Scope index in the centre; hover a node and it lists that discipline's scope. FF&E slug is now `ffe-procurement`. |
| FELEMAYE_FamilySurvey.tsx | /survey/lorado-family | No age. Lives here full-time? Yes/No, then visit frequency. One 4-column moodboard (lighting beside lighting, plants beside plants), 8 colourways, Essential / Maybe / Pass wishlist from the master list. Max width 896. |
| FELEMAYE_SurfaceLibrary.tsx | /surface-library | Five application tiles filter the library. Licensing copy block. No "unavailable" state. |
| FELEMAYE_Perspectives.tsx (new) | /perspectives | Replace the list. Add entries one per line: Date\|type\|Title\|Note\|URL. Vimeo/YouTube URLs become video previews; .mp3/.m4a become audio players; Spotify/SoundCloud embed. |
| FELEMAYE_ClientPortal.tsx | /suite | Clients no longer see jurisdiction switches. They see only their locked jurisdiction's milestones. Wishlist matrix card added. |
| FELEMAYE_StudioConsole.tsx | Studio console | Permit tab: `[ LA County (EPIC / Public Works) ] \| [ NYC (DOB NOW / LPC) ]` toggle locks the project jurisdiction. |
| FELEMAYE_HomeDeskStudio.tsx | Home | Perspectives notebook lettering now sits inside an embossed inner rule. |

## TidyCal (https://tidycal.com/felemaye)
Your page currently has three events: `discoverycall` (30 min, free), `designconsult` (1 hr, $400), `designmastermind` (45 min, $150). The directive's five booking types do not exist yet and I cannot create TidyCal events from here. Create these in TidyCal, then paste the slugs into the footer "Booking list" (third column) and "TidyCal links":

| Booking | Length / fee | Suggested slug |
|---|---|---|
| General Studio Discovery Call | 15 min, free | change `discoverycall` from 30 to 15 min |
| Spatial Design & Architectural Interiors Advisory | 45 min, $350 | spatial-advisory |
| Surface Studio & Licensing Inquiry | 30 min, $250 | surface-licensing |
| BIM / VDC & Technical Consulting | 45 min, $300 | bim-vdc-consulting |
| Creative Strategy & Brand Alignment | 30 min, $250 | creative-strategy-alignment |

Until then every vertical's "Book" link falls back to `/discoverycall`, which works today. Footer "TidyCal links" format: `spatial-design=spatial-advisory` (one per line; a slug or full URL).

## Framer-side
- /perspectives: use the new component and put nothing else beside it; its container supplies the margins.
- /inquiry: dropdown "How did you hear about us?" (Client Referral, Architectural Press / Media, Industry Partner / Trade, Academic / Cornell Network, Other); hidden fields `vertical`, `item`, `intent` read from the query string.
- Redeploy the v6 survey HTML to Netlify if you have not (iframe auto-height).
