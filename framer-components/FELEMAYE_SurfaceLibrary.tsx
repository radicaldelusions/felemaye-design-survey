// FELEMAYE — Surface Library showcase (Framer code component). Live from Supabase table surface_items.
// Filters: material type (tadelakt plaster, natural stone, specialty finish, trade sample…), origin, application context, trade-sample toggle, search.
// Access: visitors see rows flagged public_preview; signed-in approved members (surface_members) and studio see every published row.
// It reads the Supabase session that the Client Suite already stores in this browser, so no extra login is needed.
// Images: files in the private "surface-library" bucket, shown through short-lived signed links (members/studio); otherwise a tonal swatch.
// ADD ITEMS: Supabase → Table editor → surface_items (name, material_type, origin, applications text[], finish, description, image_path, trade_sample, published, public_preview).
// @framerSupportedLayoutWidth any
// @framerSupportedLayoutHeight auto
import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

type Props = { supabaseUrl: string; publishableKey: string; heading: string; intro: string; requestHref: string; licensingTitle: string; licensingCopy: string; collaborators: string; style?: React.CSSProperties }
type Item = { id: string; name: string; material_type: string; origin: string | null; applications: string[] | null; finish: string | null; description: string | null; image_path: string | null; trade_sample: boolean; public_preview: boolean }
const DEF = { supabaseUrl: "https://afejhlfwymwagstyfnse.supabase.co", publishableKey: "sb_publishable_DxxomxoBSa8QkC6pBzYf5A_O86rctbV", heading: "Surface Library", intro: "A considered library of specialty pattern and surface systems, and trade samples. Access and licensing are arranged directly with the studio. Filter by material, origin and where it will live.", requestHref: "/inquiry?vertical=surface-library", licensingTitle: "Licensing & collaboration", licensingCopy: "FELEMAYE Surface Studio develops original wallcoverings, woven textiles, plaster finishes, tile and stone, and architectural hardware for licensing and brand collaboration. Collections are designed for hospitality and residential programmes, with the pattern, material and technical documentation a manufacturing partner needs.", collaborators: "" }
const APPS: [string, string][] = [["Wallcoverings", "Original pattern for paper, vinyl and woven grounds."], ["Woven Textiles", "Upholstery, drapery and rug-scale cloths."], ["Custom Plaster / Tadelakt", "Hand-troweled, burnished and waterproof lime finishes."], ["Tile & Stone", "Natural stone, cement and glazed tile."], ["Architectural Hardware", "Pulls, plates and fixtures in considered metals."]]
const BG = "#0B0B0C", CARD = "#141416", LINE = "#222226", GOLD = "#D4A373", TEXT = "#EDE6D8", MUTED = "#A39B8B"
const SANS = "Jost,Inter,system-ui,sans-serif", SERIF = "'Cormorant Garamond',Georgia,serif", MONO = "ui-monospace,'SF Mono',Menlo,monospace"
const tone = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return `linear-gradient(135deg,hsl(${h},14%,26%),hsl(${(h + 30) % 360},12%,15%))` }

function session(url: string) {
    try { const ref = new URL(url).hostname.split(".")[0]; const raw = localStorage.getItem(`sb-${ref}-auth-token`); if (!raw) return ""; const j = JSON.parse(raw); return j?.access_token || j?.currentSession?.access_token || "" } catch { return "" }
}

export default function SurfaceLibrary(props: Props) {
    const p = { ...DEF, ...Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined)) } as Props
    const [items, setItems] = React.useState<Item[] | null>(null)
    const [signed, setSigned] = React.useState<Record<string, string>>({})
    const [err, setErr] = React.useState("")
    const [f, setF] = React.useState({ type: "", origin: "", app: "", trade: false, q: "" })
    const [open, setOpen] = React.useState<Item | null>(null)

    React.useEffect(() => {
        let dead = false
        const tok = session(p.supabaseUrl)
        const h: Record<string, string> = { apikey: p.publishableKey }
        // New-style publishable keys are not JWTs: send Authorization only when a signed-in member session exists.
        if (tok) h.Authorization = `Bearer ${tok}`
        fetch(`${p.supabaseUrl}/rest/v1/surface_items?select=id,name,material_type,origin,applications,finish,description,image_path,trade_sample,public_preview&order=material_type.asc,name.asc`, { headers: h })
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then(async (rows: Item[]) => {
                if (dead) return; setItems(rows)
                const withImg = rows.filter((r) => r.image_path)
                if (withImg.length && tok) {
                    const out: Record<string, string> = {}
                    await Promise.all(withImg.map(async (r) => { try { const x = await fetch(`${p.supabaseUrl}/storage/v1/object/sign/surface-library/${r.image_path}`, { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 3600 }) }); if (x.ok) { const j = await x.json(); out[r.id] = p.supabaseUrl + "/storage/v1" + j.signedURL } } catch {} }))
                    if (!dead) setSigned(out)
                }
            })
            .catch(() => { if (!dead) { setItems([]); setErr("") } })
        return () => { dead = true }
    }, [p.supabaseUrl, p.publishableKey])

    const all = items || []
    const uniq = (g: (i: Item) => string[]) => Array.from(new Set(all.flatMap(g).filter(Boolean))).sort()
    const types = uniq((i) => [i.material_type]), origins = uniq((i) => [i.origin || ""]), apps = Array.from(new Set([...APPS.map((a) => a[0]), ...uniq((i) => i.applications || [])]))
    const shown = all.filter((i) => (!f.type || i.material_type === f.type) && (!f.origin || i.origin === f.origin) && (!f.app || (i.applications || []).includes(f.app)) && (!f.trade || i.trade_sample) && (!f.q || `${i.name} ${i.finish || ""} ${i.description || ""}`.toLowerCase().includes(f.q.toLowerCase())))
    const sel = (label: string, key: "type" | "origin" | "app", opts: string[]) => (
        <label className="sl-f"><span>{label}</span><select value={(f as any)[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}><option value="">All</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
    )
    const css = `.sl *{box-sizing:border-box}.sl .wrap{width:100%;max-width:80rem;margin:0 auto;padding:0 16px}@media(min-width:640px){.sl .wrap{padding:0 24px}}@media(min-width:768px){.sl .wrap{padding:0 48px}}@media(min-width:1024px){.sl .wrap{padding:0 64px}}
.sl-f{display:flex;flex-direction:column;gap:6px;font:500 10px ${MONO};letter-spacing:.2em;text-transform:uppercase;color:${GOLD};min-width:0}
.sl-f select,.sl input[type=search]{background:${CARD};border:1px solid ${LINE};color:${TEXT};font:400 14px ${SANS};padding:12px;min-height:44px;width:100%;border-radius:0}
.sl-f select:focus,.sl input:focus,.sl button:focus-visible{outline:1px solid ${GOLD}}
.sl .apps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:28px}.sl .apptile{background:${CARD};border:1px solid ${LINE};color:${TEXT};text-align:left;padding:16px;cursor:pointer;min-height:44px}.sl .apptile:hover{border-color:${GOLD}}@media (max-width:900px){.sl .apps{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:420px){.sl .apps{grid-template-columns:minmax(0,1fr)}}.sl .bar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}@media(min-width:1024px){.sl .apps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:28px}.sl .apptile{background:${CARD};border:1px solid ${LINE};color:${TEXT};text-align:left;padding:16px;cursor:pointer;min-height:44px}.sl .apptile:hover{border-color:${GOLD}}@media (max-width:900px){.sl .apps{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:420px){.sl .apps{grid-template-columns:minmax(0,1fr)}}.sl .bar{grid-template-columns:repeat(5,minmax(0,1fr));align-items:end}}
.sl .grid{display:grid;grid-template-columns:repeat(1,minmax(0,1fr));gap:20px}@media(min-width:560px){.sl .grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(min-width:1024px){.sl .grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:28px}}
.sl .card{background:${CARD};border:1px solid ${LINE};text-align:left;padding:0;cursor:pointer;color:inherit;display:block;width:100%;transition:border-color .25s,transform .25s}.sl .card:hover{border-color:${GOLD};transform:translateY(-3px)}
.sl .tag{display:inline-block;border:1px solid ${LINE};padding:3px 8px;margin:0 6px 6px 0;font:10px ${MONO};letter-spacing:.14em;text-transform:uppercase;color:${MUTED}}`
    return (
        <section className="sl" style={{ ...p.style, width: "100%", overflow: "hidden", boxSizing: "border-box", background: BG, color: TEXT, padding: "clamp(40px,7vw,96px) 0" }}>
            <style>{css}</style>
            <div className="wrap max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
                <div style={{ font: `500 10px ${MONO}`, letterSpacing: ".28em", textTransform: "uppercase", color: GOLD }}>Surface Studio</div>
                <h1 style={{ font: `400 clamp(38px,6vw,76px)/1.04 ${SERIF}`, margin: "14px 0 12px" }}>{p.heading}</h1>
                <p style={{ font: `300 clamp(15px,1.5vw,18px)/1.7 ${SANS}`, color: MUTED, maxWidth: 640, margin: "0 0 36px" }}>{p.intro}</p>
                <div className="apps">
                    {APPS.map(([a, d]) => { const on = f.app === a; return (
                        <button key={a} aria-pressed={on} onClick={() => setF({ ...f, app: on ? "" : a })} className="apptile" style={{ borderColor: on ? GOLD : LINE }}>
                            <span style={{ font: `400 20px/1.15 ${SERIF}`, display: "block" }}>{a}</span>
                            <span style={{ font: `300 13px/1.5 ${SANS}`, color: MUTED, display: "block", marginTop: 6 }}>{d}</span>
                        </button>) })}
                </div>
                <div className="bar">
                    {sel("Material", "type", types)}{sel("Origin", "origin", origins)}{sel("Application", "app", apps)}
                    <label className="sl-f"><span>Search</span><input type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Name or finish" /></label>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, font: `500 10px ${MONO}`, letterSpacing: ".2em", textTransform: "uppercase", color: GOLD, cursor: "pointer" }}><input type="checkbox" checked={f.trade} onChange={(e) => setF({ ...f, trade: e.target.checked })} style={{ width: 20, height: 20, accentColor: GOLD }} />Trade samples</label>
                </div>
                <div style={{ margin: "28px 0 20px", font: `10px ${MONO}`, letterSpacing: ".2em", textTransform: "uppercase", color: MUTED, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <span>{items === null ? "Loading…" : all.length ? `${shown.length} of ${all.length} surfaces` : "Surface families"}</span>
                    {(f.type || f.origin || f.app || f.trade || f.q) && <button onClick={() => setF({ type: "", origin: "", app: "", trade: false, q: "" })} style={{ background: "none", border: 0, color: GOLD, font: "inherit", letterSpacing: "inherit", textTransform: "inherit", cursor: "pointer", minHeight: 32 }}>Clear filters</button>}
                </div>
                {items !== null && all.length === 0 && (
                    <div style={{ border: `1px dashed ${LINE}`, padding: "48px 24px", textAlign: "center" }}>
                        <div style={{ font: `italic 400 28px ${SERIF}` }}>Samples are shared by appointment</div>
                        <p style={{ font: `300 15px/1.7 ${SANS}`, color: MUTED, margin: "10px auto 20px", maxWidth: 480 }}>Select an application above to see how each surface family is developed, or request access to view current surfaces and trade samples.</p>
                        <a href={p.requestHref} style={{ display: "inline-block", border: `1px solid ${GOLD}`, color: GOLD, padding: "12px 20px", font: `500 11px ${MONO}`, letterSpacing: ".2em", textTransform: "uppercase", textDecoration: "none" }}>Request access ↗</a>
                    </div>
                )}
                <div style={{ marginTop: 56, borderTop: `1px solid ${LINE}`, paddingTop: 32, display: "grid", gap: 14, maxWidth: 760 }}>
                    <div style={{ font: `500 10px ${MONO}`, letterSpacing: ".28em", textTransform: "uppercase", color: GOLD }}>{p.licensingTitle}</div>
                    <p style={{ font: `300 clamp(16px,1.6vw,19px)/1.75 ${SANS}`, color: "#D8D0C0", margin: 0 }}>{p.licensingCopy}</p>
                    {p.collaborators && <p style={{ font: `italic 400 20px/1.4 ${SERIF}`, color: MUTED, margin: 0 }}>{p.collaborators}</p>}
                    <a href={`${p.requestHref}${p.requestHref.includes("?") ? "&" : "?"}intent=licensing`} style={{ justifySelf: "start", border: `1px solid ${GOLD}`, color: GOLD, padding: "12px 20px", font: `500 11px ${MONO}`, letterSpacing: ".2em", textTransform: "uppercase", textDecoration: "none" }}>Discuss licensing ↗</a>
                </div>
                {shown.length === 0 && all.length > 0 && <p style={{ font: `300 15px ${SANS}`, color: MUTED }}>No surfaces match these filters.</p>}
                <div className="grid">
                    {shown.map((i) => (
                        <button key={i.id} className="card" onClick={() => setOpen(i)} aria-label={`${i.name}, ${i.material_type}`}>
                            <div style={{ aspectRatio: "4 / 3", background: signed[i.id] ? `url(${signed[i.id]}) center/cover` : tone(i.name + i.material_type), position: "relative" }}>
                                {i.trade_sample && <span style={{ position: "absolute", top: 10, left: 10, background: GOLD, color: BG, font: `600 9px ${MONO}`, letterSpacing: ".18em", textTransform: "uppercase", padding: "4px 8px" }}>Trade sample</span>}
                            </div>
                            <div style={{ padding: "16px 18px 18px" }}>
                                <div style={{ font: `500 10px ${MONO}`, letterSpacing: ".2em", textTransform: "uppercase", color: GOLD }}>{i.material_type}{i.origin ? ` · ${i.origin}` : ""}</div>
                                <div style={{ font: `400 24px/1.15 ${SERIF}`, margin: "8px 0 10px" }}>{i.name}</div>
                                <div>{(i.applications || []).slice(0, 3).map((a) => <span key={a} className="tag">{a}</span>)}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
            {open && (
                <div role="dialog" aria-modal="true" aria-label={open.name} onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 9999, display: "grid", placeItems: "center", padding: 16 }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: CARD, border: `1px solid ${LINE}`, maxWidth: 560, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
                        <div style={{ aspectRatio: "16 / 10", background: signed[open.id] ? `url(${signed[open.id]}) center/cover` : tone(open.name + open.material_type) }} />
                        <div style={{ padding: 24 }}>
                            <div style={{ font: `500 10px ${MONO}`, letterSpacing: ".2em", textTransform: "uppercase", color: GOLD }}>{open.material_type}{open.origin ? ` · ${open.origin}` : ""}{open.finish ? ` · ${open.finish}` : ""}</div>
                            <h2 style={{ font: `400 32px/1.1 ${SERIF}`, margin: "10px 0 12px" }}>{open.name}</h2>
                            {open.description && <p style={{ font: `300 15px/1.7 ${SANS}`, color: "#D8D0C0", margin: "0 0 14px" }}>{open.description}</p>}
                            <div>{(open.applications || []).map((a) => <span key={a} className="tag">{a}</span>)}</div>
                            <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
                                <a href={`${p.requestHref}${p.requestHref.includes("?") ? "&" : "?"}item=${encodeURIComponent(open.name)}`} style={{ background: GOLD, color: BG, padding: "12px 20px", font: `600 11px ${MONO}`, letterSpacing: ".2em", textTransform: "uppercase", textDecoration: "none", minHeight: 44, display: "inline-flex", alignItems: "center" }}>{open.trade_sample ? "Request trade sample" : "Enquire"}</a>
                                <button onClick={() => setOpen(null)} style={{ background: "none", border: `1px solid ${LINE}`, color: TEXT, padding: "12px 20px", font: `500 11px ${MONO}`, letterSpacing: ".2em", textTransform: "uppercase", cursor: "pointer", minHeight: 44 }}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}
SurfaceLibrary.defaultProps = { ...DEF, width: 1200, height: 900 }
addPropertyControls(SurfaceLibrary, {
    supabaseUrl: { type: ControlType.String, title: "Supabase URL" },
    publishableKey: { type: ControlType.String, title: "Publishable key" },
    heading: { type: ControlType.String, title: "Heading" },
    intro: { type: ControlType.String, title: "Intro", displayTextArea: true },
    requestHref: { type: ControlType.String, title: "Request link" },
    licensingTitle: { type: ControlType.String, title: "Licensing title" },
    licensingCopy: { type: ControlType.String, title: "Licensing copy", displayTextArea: true },
    collaborators: { type: ControlType.String, title: "Collaborating houses", description: "Optional line naming partners, e.g. hospitality and residential collections with ... (only names you have agreed)" },
})
