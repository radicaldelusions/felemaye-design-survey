// FELEMAYE — Site footer (Framer code component). Five balanced columns on one grid; headers share one baseline and sit on the same
// left/right margins as the site header. The Practice Index lists the nine practice verticals, each a fast-track link to
// /inquiry?vertical=<slug> (the same slugs the Capabilities Matrix uses, so the inquiry form can pre-select the vertical).
// Paste your existing external URLs (Are.na, Substack, Pinterest, Instagram, ReadCV, Spotify) into the sidebar; empty ones render as plain "#".
// @framerSupportedLayoutWidth any
// @framerSupportedLayoutHeight auto
import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

type Props = { maxWidth?: number; gutter?: number; colGap?: number; tidycalBase: string; tidycalFallback: string; tidycalLinks: string; bookings: string; inquiryPath: string; arena: string; substack: string; pinterest: string; instagram: string; readcv: string; spotify: string; portalHref: string; practiceHref: string; capabilitiesHref: string; perspectivesHref: string; surfaceHref: string; style?: React.CSSProperties }
const GOLD = "#D4A373", BG = "#0B0B0C", LINE = "#222226", TEXT = "#EDE6D8", MUTED = "#A39B8B"
const SANS = "Jost,Inter,system-ui,sans-serif", SERIF = "'Cormorant Garamond',Georgia,serif", MONO = "ui-monospace,'SF Mono',Menlo,monospace"
// Booking ecosystem (label | duration · fee | TidyCal slug or full URL). Slugs below that you have not created yet fall back to your TidyCal profile page.
const BOOKINGS = "General Studio Discovery Call|15 min · Complimentary|discoverycall\nSpatial Design & Architectural Interiors Advisory|45 min · $350|\nSurface Studio & Licensing Inquiry|30 min · $250|\nBIM / VDC & Technical Consulting|45 min · $300|\nCreative Strategy & Brand Alignment|30 min · $250|"
const SERVICES: [string, string][] = [["Spatial Design & Interiors", "spatial-design"], ["Surface Design / Surface Library", "surface-library"], ["BIM / VDC", "bim-vdc"], ["FF&E and OS&E Procurement", "ffe-procurement"], ["Creative Strategy", "creative-strategy"], ["Talent Alignment", "talent-alignment"], ["Critical Inquiry", "critical-inquiry"], ["Media Archives", "media-archives"], ["Radical Delusions Lab ©", "radical-delusions-lab"]]

export default function SiteFooter(props: Props) {
    const p = { tidycalBase: "https://tidycal.com/felemaye", tidycalFallback: "discoverycall", tidycalLinks: "", bookings: BOOKINGS, inquiryPath: "/inquiry", arena: "", substack: "", pinterest: "", instagram: "", readcv: "", spotify: "", portalHref: "/client-suite", practiceHref: "/practice", capabilitiesHref: "/capabilities", perspectivesHref: "/perspectives", surfaceHref: "/surface-library", ...Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined)) } as Props
    // Content-weighted columns: short lists (Culture & Archives, Portal & Navigation) get narrower tracks so the
    // five columns read as one balanced row; gap stays inside 32–48 px. Gutter/max width match the site header.
    const GAP = Math.max(32, Math.min(48, Number(p.colGap) || 40))
    const css = `.ftr *{box-sizing:border-box}.ftr a{color:${MUTED};text-decoration:none;font:400 12px/1.5 ${SANS};letter-spacing:.14em;text-transform:uppercase;display:block;padding:7px 0;min-height:32px}.ftr a:hover,.ftr a:focus-visible{color:${GOLD};outline:none}.ftr h3{margin:0 0 14px;font:500 10px ${MONO};letter-spacing:.24em;text-transform:uppercase;color:${GOLD};line-height:1.4}.ftr .grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.3fr) minmax(0,.8fr) minmax(0,1fr) minmax(0,1.3fr);column-gap:${GAP}px;row-gap:40px;align-items:start}.ftr .btn{display:inline-block;border:1px solid ${GOLD};color:${GOLD};padding:12px 18px;margin-top:14px}.ftr .btn:hover{background:${GOLD};color:${BG}}@media (max-width:1100px){.ftr .grid{column-gap:32px}}@media (min-width:768px) and (max-width:1023px){.ftr .grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media (max-width:767px){.ftr .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:40px 32px}}@media (max-width:420px){.ftr .grid{grid-template-columns:minmax(0,1fr)}}@media(max-width:767px){.ftr .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:40px 32px}}@media(max-width:420px){.ftr .grid{grid-template-columns:minmax(0,1fr)}}.ftr .bk{padding:8px 0;border-top:1px solid #222226}.ftr .bk a{padding:0;min-height:0;font-size:11px;line-height:1.5}.ftr .bk small{display:block;font:10px ui-monospace,monospace;letter-spacing:.14em;color:#6f6a60;text-transform:uppercase}.ftr .tc{display:inline!important;padding:0!important;min-height:0!important;font-size:9px!important;letter-spacing:.16em;margin-left:8px;color:${GOLD}!important;opacity:.8}.ftr .tc:hover{opacity:1}.ftr .row{display:flex;align-items:baseline;flex-wrap:wrap}`
    // TidyCal per vertical: paste one "slug=https://tidycal.com/…" per line in "TidyCal links", or set a base URL (slug is appended).
    const map: Record<string, string> = {}; String(p.tidycalLinks || "").split(/\r?\n/).forEach((l) => { const i = l.indexOf("="); if (i > 0) map[l.slice(0, i).trim()] = l.slice(i + 1).trim() })
    const base = String(p.tidycalBase || "").replace(/\/$/, "")
    const book = (v: string) => !v ? (base ? base + (p.tidycalFallback ? "/" + p.tidycalFallback : "") : "") : /^https?:/.test(v) ? v : base + "/" + v
    const tc = (slug: string) => book(map[slug] || "")
    const ext = (label: string, href: string) => <a href={href || "#"} target={href ? "_blank" : undefined} rel="noopener">{label} ↗</a>
    return (
        <footer className="ftr" style={{ ...p.style, background: BG, color: TEXT, width: "100%", overflow: "hidden", boxSizing: "border-box", borderTop: `1px solid ${LINE}`, padding: "64px 0 28px" }}>
            <style>{css}</style>
            <div className="grid-cols-2 md:grid-cols-5 gap-12 lg:gap-16 py-16 px-8 md:px-16" style={{ maxWidth: p.maxWidth || 1680, margin: "0 auto", padding: p.gutter ? `0 ${p.gutter}px` : "0 clamp(32px,5vw,64px)", boxSizing: "border-box", width: "100%" }}>
                <div className="grid">
                    <div>
                        <div style={{ font: `400 clamp(26px,3vw,36px)/1 ${SERIF}`, letterSpacing: ".14em", color: GOLD, borderBottom: `1px solid ${GOLD}`, display: "inline-block", paddingBottom: 6 }}>FELEMAYE</div>
                        <p style={{ font: `italic 400 17px/1.4 ${SERIF}`, color: TEXT, margin: "16px 0 14px" }}>Designed from memory, built for futures.</p>
                        <div style={{ font: `10px/1.9 ${MONO}`, letterSpacing: ".16em", textTransform: "uppercase", color: MUTED }}>Los Angeles · New York<br />34.0537° N, 118.2427° W<br />Reg. Studio No. FY-2026</div>
                    </div>
                    <nav aria-label="Practice index"><h3>Practice Index</h3>{SERVICES.map(([l, s]) => <div className="row" key={s}><a href={`${p.inquiryPath}?vertical=${s}`}>{l}</a>{tc(s) && <a className="tc" href={tc(s)} target="_blank" rel="noopener" aria-label={`Book a discovery call: ${l}`}>Book ↗</a>}</div>)}</nav>
                    <nav aria-label="Culture and archives"><h3>Culture &amp; Archives</h3>{ext("Are.na", p.arena)}{ext("Substack", p.substack)}{ext("Pinterest", p.pinterest)}{ext("Instagram", p.instagram)}{ext("ReadCV", p.readcv)}{ext("Spotify", p.spotify)}</nav>
                    <nav aria-label="Portal and navigation"><h3>Portal &amp; Navigation</h3><a href={p.practiceHref}>Practice (B2C / B2B)</a><a href={p.capabilitiesHref}>Capabilities Matrix</a><a href={p.perspectivesHref}>Perspective(s)</a><a href={p.surfaceHref}>Surface Library</a><a className="btn" href={p.portalHref}>Client Suite Gateway ↗</a></nav>
                    <div><h3>Communication</h3><p style={{ font: `300 14px/1.7 ${SANS}`, color: TEXT, margin: "0 0 4px", maxWidth: 280 }}>For commission inquiries, surface licensing, soft staging briefs, or institutional strategy:</p><a className="btn" href={p.inquiryPath}>Initiate Brief ↗</a>
                        <h3 style={{ marginTop: 28 }}>Book a call</h3>
                        {String(p.bookings || "").split(/\r?\n/).map((l) => l.split("|")).filter((r) => r[0]?.trim()).map(([a, b, c]) => <div className="bk" key={a}><a href={book((c || "").trim())} target="_blank" rel="noopener">{a.trim()} ↗</a>{b && <small>{b.trim()}</small>}</div>)}
                        <a href="#top" style={{ marginTop: 14 }}>↑ Back to top</a></div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, borderTop: `1px solid ${LINE}`, marginTop: 36, paddingTop: 18, font: `10px ${MONO}`, letterSpacing: ".18em", textTransform: "uppercase", color: MUTED }}>
                    <span>© 2026 FELEMAYE Studio LLC. All rights reserved.</span><span>Design System(s) · Built for futures</span>
                </div>
            </div>
        </footer>
    )
}
SiteFooter.defaultProps = { tidycalBase: "https://tidycal.com/felemaye", tidycalFallback: "discoverycall", tidycalLinks: "", bookings: BOOKINGS, inquiryPath: "/inquiry", arena: "", substack: "", pinterest: "", instagram: "", readcv: "", spotify: "", portalHref: "/client-suite", practiceHref: "/practice", capabilitiesHref: "/capabilities", perspectivesHref: "/perspectives", surfaceHref: "/surface-library", width: 1200 }
addPropertyControls(SiteFooter, {
    maxWidth: { type: ControlType.Number, title: "Max width", min: 960, max: 2400, step: 10, defaultValue: 1680, description: "Match the site header's max width" },
    gutter: { type: ControlType.Number, title: "Side gutter", min: 0, max: 120, step: 2, defaultValue: 0, description: "0 = fluid 32–64 px. Set to the header's horizontal padding to line the column headers up with the top nav" },
    colGap: { type: ControlType.Number, title: "Column gap", min: 32, max: 48, step: 2, defaultValue: 40 },
    tidycalFallback: { type: ControlType.String, title: "Fallback event", description: "Slug used until a vertical has its own event" },
    bookings: { type: ControlType.String, title: "Booking list", displayTextArea: true, description: "Label|duration · fee|slug or full URL, one per line" },
    tidycalBase: { type: ControlType.String, title: "TidyCal base URL", description: "e.g. https://tidycal.com/felemaye (slug appended)" },
    tidycalLinks: { type: ControlType.String, title: "TidyCal links", displayTextArea: true, description: "One per line: spatial-design=https://tidycal.com/…" },
    inquiryPath: { type: ControlType.String, title: "Inquiry path" },
    arena: { type: ControlType.String, title: "Are.na URL" }, substack: { type: ControlType.String, title: "Substack URL" }, pinterest: { type: ControlType.String, title: "Pinterest URL" },
    instagram: { type: ControlType.String, title: "Instagram URL" }, readcv: { type: ControlType.String, title: "ReadCV URL" }, spotify: { type: ControlType.String, title: "Spotify URL" },
    portalHref: { type: ControlType.String, title: "Client Suite link" }, practiceHref: { type: ControlType.String, title: "Practice link" }, capabilitiesHref: { type: ControlType.String, title: "Capabilities link" },
    perspectivesHref: { type: ControlType.String, title: "Perspectives link" }, surfaceHref: { type: ControlType.String, title: "Surface Library link" },
})
