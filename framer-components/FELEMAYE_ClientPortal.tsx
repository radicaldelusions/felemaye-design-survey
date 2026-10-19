// FELEMAYE — Super-Portal (Framer code component)
// Place on /portal (full-width, min-height 100vh). Also usable for the entry state on /client-suite.
// Backend: Supabase project afejhlfwymwagstyfnse. Only the PUBLISHABLE key is used here.
// States: gateway -> survey (first login) -> dashboard.
// Secrets never live in this file: access keys are verified by the verify_portal_access RPC (bcrypt + throttle),
// and the session is a Supabase magic-link session. Every write goes through security-definer RPCs that check ownership.
import * as React from "react"
import { addPropertyControls, ControlType } from "framer"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

type Props = {
    supabaseUrl: string
    publishableKey: string
    surveyUrl: string
    portalUrl: string
    nameOverride: string
    stripeLink: string
    notionRoadmapEmbed: string
    arenaChannel: string
    driveFolderUrl: string
    welcomeEyebrow: string
    paper: string
    ink: string
    accent: string
    surface: string
    roadmap?: { title: string; from: number; to: number; note: string }[]
    notionUrl?: string
    matterUrl?: string
    cardPayUrl?: string
    familySurveyUrl?: string
    style?: React.CSSProperties
}

const sbCache: Record<string, any> = {}
function sb(url: string, key: string) {
    const k = url + key
    if (!sbCache[k]) sbCache[k] = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    return sbCache[k]
}

// Supabase only exposes these columns on `clients` to signed-in users (the access-key hash is private), so never select("*").
const CLIENT_COLS = "client_id,name,full_name,email,phone,portal_stage,project_id,project_name,project_slug,project_address,retainer_paid,survey_completed_at,welcome_seen_at,role,created_at"
const STATUS: Record<string, string> = { locked: "Locked", active: "In progress", in_review: "In review", approved: "Approved" }

// Project links (override any of these from the Framer sidebar).
const LINKS = {
    notion: "https://loradocourtyard.notion.site/3ac4385bb02b435abbb84e6c4c3d4dc2?v=d3a3187bf0fb485d8ff09bd09048ca8a",
    arenaSlug: "the-lorado-courtyard",
    arenaUrl: "https://www.are.na/felemaye-journal/the-lorado-courtyard",
    matter: "https://mattoboard.com/show/quxx98y1nm?ee=true",
    drive: "https://drive.google.com/drive/folders/1_Ivy4BJN8HjYqrwkzmbzdliSfBHsoyJC",
    studioEmail: "felema@felemaye.com",
}

// Timeline from the signed proposal (Oct 2026 – Jan 2027, 16 weeks incl. studio closures). Columns 0–15 = Oct W1 … Jan W4.
type Row = { k: "phase" | "task" | "ms"; n?: string; t: string; fill?: number[]; ms?: number[]; hollow?: boolean }
const MONTHS: [string, number][] = [["October 2026", 4], ["November 2026", 4], ["December 2026", 4], ["January 2027", 4]]
const CLOSURES = [7, 11]
const GANTT: Row[] = [
    { k: "ms", t: "Project Mobilization & Retainer", fill: [0, 1], ms: [1] },
    { k: "phase", n: "1", t: "Pre-Design & Feasibility", fill: [2, 3] },
    { k: "task", t: "Field Measurements & Existing Site Plan Sketch", fill: [2, 3] },
    { k: "task", t: "LA County Title 22 Zoning & Setback Audit", fill: [3] },
    { k: "task", t: "Feasibility Option Comparison (Gate vs. Wall)", fill: [3] },
    { k: "phase", n: "2", t: "Schematic Design", fill: [3, 4, 5, 6] },
    { k: "task", t: "Spatial Layout & Courtyard Entry Options", fill: [3, 4] },
    { k: "task", t: "3D Exterior Perspective Renderings", fill: [4, 5] },
    { k: "task", t: "Exterior Material, Lighting & FF&E Curation", fill: [6] },
    { k: "ms", t: "SD Sign-Off & Milestone 2 Payment", ms: [6] },
    { k: "phase", n: "3", t: "Design Development", fill: [8, 9, 10] },
    { k: "task", t: "Complete Permit Drawing Set & Structural Coordination", fill: [8], ms: [9], hollow: true },
    { k: "task", t: "Courtyard Entry Gate & Threshold Detailing", fill: [9] },
    { k: "task", t: "Lighting & Electrical Placement Plan", fill: [9, 10] },
    { k: "task", t: "Hardscape, Planter & Drainage Layout", fill: [9, 10] },
    { k: "task", t: "Material & Finish Specification Schedule" },
    { k: "ms", t: "DD Client Review & Milestone 3 Payment", ms: [10] },
    { k: "ms", t: "Structural Engineer Retainer (paid directly by client)", ms: [10], hollow: true },
    { k: "phase", n: "4", t: "Construction Documents & Structural Engineering", fill: [12, 13, 14, 15] },
    { k: "task", t: "CAD Background Handoff to Structural Engineer", fill: [12] },
    { k: "task", t: "Third-Party Engineering Calculations & Detailing", fill: [13, 14] },
    { k: "task", t: "Stamped Structural Sheet Integration", fill: [14, 15] },
    { k: "task", t: "Final Package, LA County Submittal", fill: [15] },
]
const PAY = {
    zelleTag: "@felemaye",
    payee: "FELEMAYE LLC · 4513 Don Arturo Place, Los Angeles, CA 90008-2803",
    bank: "Chase Bank",
    account: "809695767",
    routing: "021000021",
    memo: "The Lorado Courtyard : Project Retainer",
}
const FEES = [
    { t: "Mobilization & Retainer", amt: 4500, note: "50% · due on signed agreement" },
    { t: "Milestone 2 · Schematic Design delivery", amt: 2250, note: "25% · invoiced on SD approval" },
    { t: "Milestone 3 · Design Development delivery", amt: 2250, note: "25% · invoiced on DD approval" },
]

export default function ClientPortal(p: Props) {
    const db = React.useMemo(() => sb(p.supabaseUrl, p.publishableKey), [p.supabaseUrl, p.publishableKey])
    const [phase, setPhase] = React.useState<"boot" | "gate" | "survey" | "dash" | "audit">("boot")
    const [client, setClient] = React.useState<any>(null)
    const [project, setProject] = React.useState<any>(null)
    const [preview, setPreview] = React.useState(false)
    const [loadErr, setLoadErr] = React.useState("")
    const [fromAudit, setFromAudit] = React.useState(false)

    const load = React.useCallback(async () => {
        const { data: sd } = await db.auth.getSession()
        const s = sd
        if (!s.session) return setPhase("gate")
        // Studio preview: /portal?preview=<client_id>&stage=survey|dash — only honoured when is_studio() is true (checked server-side).
        const qs = new URLSearchParams(window.location.search)
        // Modular client routes: /suite/<client-slug> (or ?c=<client-slug>), and /suite/admin-audit for the studio principal.
        const pm = window.location.pathname.match(/\/suite\/([^/]+)/i)
        const routeSlug = decodeURIComponent(qs.get("c") || (pm && pm[1]) || "").toLowerCase()
        if (routeSlug) {
            const { data: isStudioR } = await db.rpc("is_studio")
            if (isStudioR) {
                if (routeSlug === "admin-audit") return setPhase("audit")
                const { data: pr0 } = await db.from("projects").select("*").or(`client_slug.eq.${routeSlug},slug.eq.${routeSlug}`).limit(1).maybeSingle()
                if (pr0) {
                    const { data: pc0 } = await db.from("clients").select(CLIENT_COLS).eq("client_id", pr0.client_id).maybeSingle()
                    if (pc0) { setPreview(true); setClient(pc0); setProject(pr0); return setPhase(qs.get("stage") === "survey" ? "survey" : "dash") }
                }
            }
        }
        const pv = qs.get("preview")
        if (pv) {
            const { data: isStudio } = await db.rpc("is_studio")
            if (isStudio) {
                const { data: pc } = await db.from("clients").select(CLIENT_COLS).eq("client_id", pv).maybeSingle()
                if (pc) {
                    setPreview(true); setClient(pc)
                    const { data: pp } = await db.from("projects").select("*").eq("client_id", pc.client_id).limit(1).maybeSingle()
                    setProject(pp)
                    const st = qs.get("stage")
                    return setPhase(st === "survey" ? "survey" : "dash")
                }
            }
        }
        const em = String(s.session.user?.email || "").toLowerCase()
        const { data: cls, error: ce } = await db.from("clients").select(CLIENT_COLS).ilike("email", em)
        const cl = (cls || [])[0]
        if (ce) { setLoadErr("We couldn't open your suite (" + ce.message + "). Please try again."); return setPhase("gate") }
        if (!cl) { setLoadErr("No client record is attached to " + em + "."); await db.auth.signOut(); return setPhase("gate") }
        setLoadErr("")
        setClient(cl)
        const { data: pr } = await db.from("projects").select("*").eq("client_id", cl.client_id).limit(1).maybeSingle()
        setProject(pr)
        // Cosmetic per-project address: felemaye.com/client-suite/portal?p=lorado-courtyard
        try { if (pr?.slug && !new URLSearchParams(window.location.search).get("p")) window.history.replaceState(null, "", window.location.pathname + "?p=" + encodeURIComponent(pr.slug)) } catch {}
        setPhase(cl.survey_completed_at ? "dash" : "survey")
    }, [db])

    React.useEffect(() => {
        load()
        const { data: sub } = db.auth.onAuthStateChange((ev: string) => {
            if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") setTimeout(() => load(), 0)
        })
        return () => sub.subscription.unsubscribe()
    }, [db, load])

    const css = `
    .fyp *{box-sizing:border-box}
    .fyp{--paper:${p.paper};--ink:${p.ink};--accent:${p.accent};--surface:${p.surface};--line:#222226;--sage:#8A9A86;--ochre:#C88A35;--slate:#5B7083;
      font-family:'Inter',system-ui,sans-serif;color:var(--ink);background:var(--paper);min-height:100%;width:100%}
    .fyp .mono{font-family:ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.2em;font-size:10px;text-transform:uppercase;opacity:.65}
    .fyp h1,.fyp h2,.fyp h3{font-family:'Cormorant Garamond',Georgia,serif;font-weight:400;margin:0;letter-spacing:.01em}
    .fyp button{font:inherit;cursor:pointer}
    .fyp .wrap{max-width:1280px;margin:0 auto;padding:clamp(20px,5vw,72px)}
    .fyp .card{background:color-mix(in srgb,var(--surface) 60%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid color-mix(in srgb,var(--ink) 9%,transparent);padding:clamp(18px,3vw,32px);min-width:0}
    .fyp .btn{background:var(--accent);color:#0B0B0C;border:0;padding:14px 22px;letter-spacing:.18em;font-size:11px;text-transform:uppercase}
    .fyp .btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}.fyp .btn.ghost:hover{border-color:var(--accent);color:var(--accent)}
    .fyp .btn:disabled{opacity:.4;cursor:default}
    .fyp input,.fyp textarea{width:100%;background:transparent;border:0;border-bottom:1px solid var(--line);padding:12px 2px;font:inherit;color:inherit;outline:none;font-size:16px}
    .fyp .grid{display:grid;gap:clamp(14px,2vw,24px)}
    .fyp .g3{grid-template-columns:repeat(3,1fr)}
    .fyp .g4{grid-template-columns:repeat(4,minmax(0,1fr));align-items:stretch}
    .fyp .snd{grid-column:span 2}
    .fyp .gh{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);align-items:start}
    .fyp .navgrid{display:grid;gap:1px;background:color-mix(in srgb,var(--ink) 22%,transparent);border:1px solid color-mix(in srgb,var(--ink) 22%,transparent);margin:0 0 28px}
    .fyp .navgrid .row2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px}
    .fyp .navgrid .row5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px}
    .fyp .nv{background:var(--paper);color:var(--ink);border:0;border-radius:0;min-height:52px;padding:10px 8px;font:500 11px ui-monospace,Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;text-align:center;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1.35}
    .fyp .nv:hover{background:color-mix(in srgb,var(--accent) 14%,var(--paper))}
    .fyp .nv[aria-selected=true],.fyp .nv[aria-current=page]{background:var(--accent);color:var(--paper)}
    .fyp .nv:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
    .fyp .actrow{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px;padding:10px 0;border-top:1px solid var(--line);font-size:13px;align-items:baseline}
    .fyp .actrow .ts{grid-column:span 3;white-space:nowrap;font:11px ui-monospace,Menlo,monospace;letter-spacing:.04em;opacity:.6}
    .fyp .actrow .tx{grid-column:span 9;min-width:0;overflow-wrap:anywhere}
    .fyp .g2{grid-template-columns:1.4fr 1fr}
    @media(max-width:1024px){.fyp .g4{grid-template-columns:repeat(2,minmax(0,1fr))}.fyp .snd{grid-column:span 2}}@media(max-width:860px){.fyp .g3,.fyp .g2,.fyp .gh{grid-template-columns:1fr}}@media(max-width:520px){.fyp .g4{grid-template-columns:minmax(0,1fr)}.fyp .snd{grid-column:auto}.fyp .actrow .ts{grid-column:span 12}.fyp .actrow .tx{grid-column:span 12}}@media(max-width:700px){.fyp .navgrid .row5{grid-template-columns:repeat(2,minmax(0,1fr))}.fyp .nv{letter-spacing:.12em;font-size:11px;min-height:56px}}
    .fyp img,.fyp iframe{max-width:100%}
    .fyp .tabs{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:8px;width:100%;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--line)}
    .fyp .tabs::-webkit-scrollbar{display:none}
    .fyp .tabs .btn{white-space:nowrap;padding:10px 14px;flex:1 1 auto;text-align:center}.fyp .wrap{width:100%}
    .fyp .only-m{display:none}
    .fyp select{font:inherit;font-size:16px;color:inherit;background:transparent;border:0;border-bottom:1px solid var(--line);padding:12px 2px;width:100%;border-radius:0}
    .fyp details>summary::-webkit-details-marker{display:none}
    .fyp .brk{overflow-wrap:anywhere;word-break:break-word}
    @media(max-width:700px){
      .fyp .wrap{padding:18px 14px 56px}
      .fyp .card{padding:18px 16px}
      .fyp .btn{padding:13px 16px;min-height:44px;letter-spacing:.14em}
      .fyp .row .btn{flex:1 1 auto;text-align:center}
      .fyp .hdr{flex-direction:column;align-items:flex-start!important}
      .fyp .hdr .btn{align-self:stretch}
      .fyp .no-m{display:none!important}
      .fyp .only-m{display:block}
      .fyp .stack-m{flex-direction:column!important;align-items:stretch!important}
      .fyp .stack-m>*{width:100%!important;flex:none!important}
      .fyp .tabs .btn{flex:0 0 auto}
      .fyp .tabs{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;margin-left:-14px;margin-right:-14px;padding-left:14px;padding-right:14px;position:sticky;top:0;z-index:4;background:var(--paper);padding-top:8px;padding-bottom:12px}
      .fyp .tabs::-webkit-scrollbar{display:none}
      .fyp .mono{letter-spacing:.14em}
    }
    .fyp .row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
    .fyp .pill{border:1px solid var(--line);padding:3px 10px;font-size:10px;letter-spacing:.16em;text-transform:uppercase}
    .fyp .glass{backdrop-filter:blur(18px) saturate(1.2);background:color-mix(in srgb,var(--surface) 72%,transparent);border:1px solid var(--line)}
    `
    return (
        <div className="fyp" style={p.style}>
            <style>{css}</style>
            {preview && <div className="mono" style={{ background: "var(--accent)", color: "#0B0B0C", padding: "10px 20px", opacity: 1, position: "sticky", top: 0, zIndex: 5 }}>Studio audit · {project?.title || "client"} · survey skipped{fromAudit && <a style={{ marginLeft: 16, textDecoration: "underline", cursor: "pointer", color: "inherit" }} onClick={() => setPhase("audit")}>Back to audit list</a>}</div>}
            {phase === "boot" && <div className="wrap mono">Opening the studio…</div>}
            {phase === "gate" && <Gateway p={p} db={db} onEntered={load} loadErr={loadErr} />}
            {phase === "survey" && <Survey p={p} client={client} project={project} onDone={load} db={db} preview={preview} />}
            {phase === "audit" && <AuditList db={db} onOpen={(pr: any, cl: any, st: any) => { setFromAudit(true); setPreview(true); setClient(cl); setProject(pr); setPhase(st) }} />}
            {phase === "dash" && <Dashboard p={p} client={client} project={project} db={db} />}
        </div>
    )
}

/* ───────────── Gateway ───────────── */
function Gateway({ p, db, onEntered, loadErr }: { p: Props; db: any; onEntered: () => void; loadErr?: string }) {
    const [mode, setMode] = React.useState<"have" | "get" | "forgot">("have")
    // The welcome email links here with ?email=… so the client only has to paste their key.
    const [email, setEmail] = React.useState(() => { try { return (new URLSearchParams(window.location.search).get("email") || "").trim() } catch { return "" } })
    const [code, setCode] = React.useState("")
    const [busy, setBusy] = React.useState(false)
    const [msg, setMsg] = React.useState("")
    React.useEffect(() => { if (loadErr) setMsg(loadErr) }, [loadErr])

    async function enter(e: React.FormEvent) {
        e.preventDefault()
        setBusy(true); setMsg("")
        try {
            const em = email.trim().toLowerCase()
            const r = await fetch(`${p.supabaseUrl}/functions/v1/portal-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: p.publishableKey, Authorization: `Bearer ${p.publishableKey}` },
                body: JSON.stringify({ email: em, code: code.trim() }),
            })
            const j = await r.json().catch(() => ({}))
            if (!j.ok || !j.token_hash) { setMsg("That email and key don't match. Check the key in your welcome email."); setBusy(false); return }
            const { error } = await db.auth.verifyOtp({ token_hash: j.token_hash, type: "magiclink" })
            if (error) { setMsg("We couldn't open your suite. Please try again."); setBusy(false); return }
            setMsg("Welcome. Opening your suite…")
            await onEntered()
        } catch { setMsg("Something went wrong. Please try again.") }
        setBusy(false)
    }
    async function ask(m: "get" | "forgot") {
        setBusy(true); setMsg("")
        try {
            await fetch(`${p.supabaseUrl}/functions/v1/client-credentials`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: p.publishableKey, Authorization: `Bearer ${p.publishableKey}` },
                body: JSON.stringify({ email: email.trim().toLowerCase(), mode: m }),
            })
        } catch {}
        // anti-enumeration: identical message regardless of outcome
        setMsg("If that email is attached to an active studio retainer, your access key is on its way.")
        setBusy(false)
    }

    return (
        <div className="wrap" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
            <div className="glass" style={{ width: "min(520px,100%)", padding: "clamp(24px,5vw,48px)" }}>
                <div className="mono">{p.welcomeEyebrow}</div>
                <h1 style={{ fontSize: "clamp(32px,6vw,44px)", margin: "10px 0 6px" }}>Client Suite</h1>
                <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
                    {mode === "have" ? "Enter the email on your retainer and the access key we sent you." : "Retainer on file? Enter your email and we'll send your access key."}
                </p>
                <form onSubmit={mode === "have" ? enter : (e) => { e.preventDefault(); ask(mode) }}>
                    <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                    {mode === "have" && <input required placeholder="Access key  (FY-XXXXXX)" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" style={{ marginTop: 12 }} />}
                    <div className="row" style={{ marginTop: 26 }}>
                        <button className="btn" disabled={busy} type="submit">{busy ? "One moment" : mode === "have" ? "Enter" : "Send my key"}</button>
                        {mode !== "have" && <button type="button" className="btn ghost" onClick={() => { setMode("have"); setMsg("") }}>Back</button>}
                    </div>
                </form>
                {msg && <p style={{ fontSize: 13, lineHeight: 1.6, marginTop: 18 }} role="status">{msg}</p>}
                <div className="row mono" style={{ marginTop: 28, gap: 22 }}>
                    {mode === "have" && <a style={{ cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 4 }} onClick={() => { setMode("get"); setMsg("") }}>Get my credentials</a>}
                    {mode === "have" && <a style={{ cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 4 }} onClick={() => { setMode("forgot"); setMsg("") }}>Forgot access key</a>}
                </div>
            </div>
        </div>
    )
}

/* ───────────── Survey (first login) ───────────── */
function Survey({ p, client, project, onDone, db, preview }: any) {
    const first = (client?.name || p.nameOverride || "").split(" ")[0]
    const src = React.useMemo(() => {
        if (!p.surveyUrl) return ""
        const u = new URL(p.surveyUrl)
        u.searchParams.set("cid", client.client_id)
        u.searchParams.set("name", client.name || "")
        u.searchParams.set("email", client.email || "")
        u.searchParams.set("slug", client.project_slug || project?.slug || "")
        if (preview) u.searchParams.set("test", "1")
        if (project) { u.searchParams.set("pid", project.id); u.searchParams.set("pn", project.title || ""); u.searchParams.set("addr", project.address || ""); u.searchParams.set("noun", project.noun || "") }
        return u.toString()
    }, [p.surveyUrl, client, project, preview])
    // The survey scrolls inside its own frame (85vh), so its sticky Back/Continue bar stays in reach on phones.
    // A reported content height only shrinks the frame for short steps; it never clips a tall one.
    const [surveyH, setSurveyH] = React.useState<number | null>(null)
    const frame = React.useRef<HTMLIFrameElement>(null)
    const surveyOrigin = React.useMemo(() => { try { return new URL(p.surveyUrl).origin } catch { return "" } }, [p.surveyUrl])
    // Background auto-save: survey progress is upserted to client_onboarding_drafts and offered back on reload.
    const draft = React.useRef<{ answers: any; step: number } | null>(null)
    const saveT = React.useRef<any>(null)
    const draftLoaded = React.useRef(false) // never save before the stored draft has been read, so a fresh frame can't overwrite it
    const sendRestore = React.useCallback(() => {
        const w = frame.current?.contentWindow
        if (w && draft.current && surveyOrigin) w.postMessage({ type: "fy-survey-restore", ...draft.current }, surveyOrigin)
    }, [surveyOrigin])
    React.useEffect(() => {
        if (preview || !client?.client_id) return
        db.from("client_onboarding_drafts").select("answers,step,submitted_at").eq("client_id", client.client_id).maybeSingle()
            .then(({ data }: any) => { draftLoaded.current = true; if (data && !data.submitted_at && data.answers) { draft.current = { answers: data.answers, step: Number(data.step) || 0 }; sendRestore() } }, () => { draftLoaded.current = true })
    }, [client?.client_id, preview, db, sendRestore])
    const [wait, setWait] = React.useState(false)
    const [welcomed, setWelcomed] = React.useState(false)

    React.useEffect(() => {
        let timer: any
        const onMsg = (e: MessageEvent) => {
            const fromSurvey = !!surveyOrigin && e.origin === surveyOrigin && e.source === frame.current?.contentWindow
            if (fromSurvey && e.data?.type === "fy-survey-ready") sendRestore()
            if (fromSurvey && e.data?.type === "fy-survey-state" && !preview && client?.client_id && draftLoaded.current) {
                clearTimeout(saveT.current)
                const row = { client_id: client.client_id, project_id: project?.id || null, client_email: (client.email || "").toLowerCase(), answers: e.data.answers || {}, step: Number(e.data.step) || 0, updated_at: new Date().toISOString() }
                saveT.current = setTimeout(() => { db.from("client_onboarding_drafts").upsert(row, { onConflict: "client_id" }).then(() => {}, () => {}) }, 800)
            }
            if (e.data?.type === "fy-survey-complete") {
                if (!preview && client?.client_id) db.from("client_onboarding_drafts").update({ submitted_at: new Date().toISOString() }).eq("client_id", client.client_id).then(() => {}, () => {})
                setWait(true)
                let tries = 0
                timer = setInterval(async () => {
                    tries++
                    const { data } = await db.from("clients").select("survey_completed_at").eq("client_id", client.client_id).maybeSingle()
                    if (data?.survey_completed_at || tries > 40) { clearInterval(timer); onDone() }
                }, 2500)
            }
            if (e.data?.type === "fy-survey-continue") onDone()
            if (e.data?.type === "fy-survey-height" && Number(e.data.h) > 300) setSurveyH(Math.ceil(Number(e.data.h)))
        }
        window.addEventListener("message", onMsg)
        return () => { window.removeEventListener("message", onMsg); clearInterval(timer); clearTimeout(saveT.current) }
    }, [client, project, db, onDone, preview, surveyOrigin, sendRestore])

    if (!welcomed)
        return (
            <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center", padding: "clamp(24px,6vw,80px)", background: "var(--paper)", color: "var(--ink)" }}>
                <style>{`@keyframes fyRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@keyframes fyTrack{from{letter-spacing:.2em;opacity:0}to{letter-spacing:.55em;opacity:.8}}`}</style>
                <div style={{ maxWidth: 720 }}>
                    <div className="mono" style={{ color: "var(--accent)", animation: "fyTrack 2.2s ease both", paddingLeft: ".55em" }}>FELEMAYE</div>
                    <div style={{ width: 40, height: 1, background: "var(--accent)", margin: "26px auto", animation: "fyRise 1.4s .6s ease both", opacity: 0 }} />
                    <h1 style={{ fontSize: "clamp(44px,9vw,96px)", lineHeight: 1.02, animation: "fyRise 1.4s .9s ease both", opacity: 0 }}>Welcome{first ? `, ${first}` : ""}.</h1>
                    <p style={{ fontSize: "clamp(16px,2.2vw,20px)", lineHeight: 1.7, opacity: 0, animation: "fyRise 1.4s 1.5s ease both", animationFillMode: "forwards", margin: "22px auto 0", maxWidth: 520 }}>
                        {project?.title ? `${project.title}${project.address ? ", " + project.address : ""}. ` : ""}Before we draw anything, we would like to hear how you want to live in this space.
                    </p>
                    <button className="btn" style={{ marginTop: 40, opacity: 0, animation: "fyRise 1.2s 2.2s ease both", animationFillMode: "forwards" }} onClick={() => { setWelcomed(true); window.scrollTo(0, 0) }}>Begin</button>
                    <div className="mono" style={{ marginTop: 18, opacity: 0.5 }}>About fifteen minutes</div>
                </div>
            </div>
        )
    return (
        <div className="wrap" style={{ width: "100%", maxWidth: 1024, minHeight: 0 }}>
            <h1 style={{ fontSize: "clamp(34px,6vw,60px)", margin: "0 0 6px" }}>{project?.title || "Your project"}</h1>
            <div className="mono" style={{ opacity: 0.85 }}>{project?.address ? `${project.address} | ` : ""}Client: {client?.name || p.nameOverride || ""}</div>
            <div style={{ borderBottom: "1px solid #222226", margin: "16px 0" }} />
            <h2 style={{ fontSize: "clamp(22px,3.4vw,32px)", letterSpacing: ".28em", textTransform: "uppercase", color: "var(--accent)", margin: "0 0 10px" }}>BEFORE WE BEGIN</h2>
            <p style={{ opacity: 0.7, maxWidth: 620, lineHeight: 1.7, margin: 0 }}>A short Design Intent Survey. Your answers shape Phase 1 and unlock your project suite.</p>
            {wait && <div className="card mono" style={{ margin: "18px 0" }}>Filing your survey and preparing your suite…</div>}
            {src ? (
                <div style={{ marginTop: 20, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-y", maxHeight: "85vh", minHeight: 0 }}>
                    <iframe ref={frame} title="Design Intent Survey" src={src} onLoad={sendRestore} style={{ display: "block", boxSizing: "border-box", width: "100%", height: surveyH ? `min(${surveyH}px, 85vh)` : "85vh", border: "1px solid #222226", background: "#0B0B0C" }} allow="clipboard-write" />
                </div>
            ) : <div className="card mono" style={{ marginTop: 20 }}>Add the survey URL in the component's sidebar.</div>}
        </div>
    )
}

/* ───────────── Dashboard ───────────── */
function Dashboard({ p, client, project, db }: any) {
    const [tab, setTab] = React.useState("home")
    const first = (client?.name || p.nameOverride || "").split(" ")[0]
    // Primary sub-navigation (directive order). CHECKPOINTS = the Phases view. Everything else stays reachable in "More".
    const menu = [["roadmap", "Roadmap"], ["ledger", "Ledger"], ["phases", "Checkpoints"], ["family", "Family Insights"], ["team", "Directory"], ["boards", "Mood Boards"], ["files", "Files"], ["permit", "Permit Path"], ["ffe", "FF&E"], ["billing", "Billing"]]
    const pick = (k: string) => { setTab(k); try { window.scrollTo({ top: 0, behavior: "smooth" }) } catch {} }
    return (
        <div className="wrap">
            <div className="row hdr" style={{ justifyContent: "space-between", marginBottom: 28 }}>
                <div>
                    <div className="mono">{project?.title || "Your project"}{project?.address ? ` · ${project.address}` : ""}</div>
                    <h1 style={{ fontSize: "clamp(34px,6vw,60px)", marginTop: 8 }}>Welcome, {first || p.nameOverride || "friend"}.</h1>
                </div>
                <button className="btn ghost" onClick={() => db.auth.signOut()}>Sign out</button>
            </div>
            <nav className="navgrid" aria-label="Project navigation">
                <div className="row2">
                    <button className="nv" aria-current={tab === "home" ? "page" : undefined} onClick={() => pick("home")}>Home</button>
                    <button className="nv" aria-current={tab === "meet" ? "page" : undefined} onClick={() => pick("meet")}>Meet</button>
                </div>
                <div className="row5" role="tablist" aria-label="Project sections">
                    {menu.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className="nv" onClick={() => pick(k)}>{l}</button>)}
                </div>
            </nav>
            {tab === "home" && <Home p={p} project={project} db={db} go={pick} />}
            {tab === "phases" && <Phases project={project} db={db} />}
            {tab === "roadmap" && <Roadmap p={p} />}
            {tab === "boards" && <Boards p={p} project={project} db={db} />}
            {tab === "files" && <Files p={p} project={project} db={db} client={client} />}
            {tab === "team" && <Directory project={project} db={db} />}
            {tab === "permit" && <PermitPath project={project} db={db} />}
            {tab === "ffe" && <FFE project={project} db={db} />}
            {tab === "ledger" && <Ledger project={project} db={db} go={pick} />}
            {tab === "family" && <FamilyInsights p={p} project={project} db={db} />}
            {tab === "billing" && <Billing p={p} project={project} db={db} client={client} />}
            {tab === "meet" && <Meet project={project} db={db} />}
        </div>
    )
}

function useRows(db: any, table: string, projectId: string | undefined, order = "created_at", extra?: (q: any) => any) {
    const [rows, setRows] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const reload = React.useCallback(async () => {
        if (!projectId) { setLoading(false); return }
        let q = db.from(table).select("*").eq("project_id", projectId).order(order, { ascending: true })
        if (extra) q = extra(q)
        const { data } = await q
        setRows(data || []); setLoading(false)
    }, [db, table, projectId])
    React.useEffect(() => { reload() }, [reload])
    return { rows, loading, reload }
}

function Home({ p, project, db, go }: any) {
    const ph = useRows(db, "phases", project?.id, "seq")
    const dl = useRows(db, "deliverables", project?.id)
    const act = useRows(db, "project_activity", project?.id, "created_at")
    const [live, setLive] = React.useState(false)
    const current = ph.rows.find((r: any) => r.status === "active" || r.status === "in_review")
    // "Awaiting you" = client-facing deliverables in an open phase that haven't been accepted, plus any phase the studio sent for your sign-off.
    const openIds = ph.rows.filter((r: any) => r.status === "active" || r.status === "in_review").map((r: any) => r.id)
    const pendingD = dl.rows.filter((r: any) => r.kind !== "other" && openIds.includes(r.phase_id) && r.status !== "accepted").length
    const studioH = useStudio(db)
    const [taskOpen, setTaskOpen] = React.useState(0)
    React.useEffect(() => { if (project?.id) db.from("client_tasks").select("id", { count: "exact", head: true }).eq("project_id", project.id).eq("status", "action_required").then(({ count }: any) => setTaskOpen(count || 0)) }, [db, project?.id])
    const totalPh = Math.max(1, ph.rows.filter((r: any) => r.seq <= 4).length || ph.rows.length || 4)
    const approvedN = ph.rows.filter((r: any) => r.status === "approved").length
    const overall = Math.min(100, Math.round(((approvedN + (current ? 1 : 0)) / totalPh) * 100))
    const pending = pendingD + taskOpen + ph.rows.filter((r: any) => r.status === "in_review").length
    const approved = ph.rows.filter((r: any) => r.status === "approved").length
    const notion = p.notionUrl || LINKS.notion
    return (
      <div className="grid">
        <div className="grid g4">
                    <div className="card" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => go("phases")} onKeyDown={(e) => e.key === "Enter" && go("phases")}>
                        <div className="mono">Current phase</div>
                        <h2 style={{ fontSize: 30, marginTop: 10 }}>{current ? `Phase ${current.seq}` : "—"}</h2>
                        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6, lineHeight: 1.5 }}>{current?.title}</div>
                        <div style={{ marginTop: 14, paddingTop: 12, borderTop: LINE, display: "flex", alignItems: "baseline", gap: 10 }}><span style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 30, color: "var(--accent)", lineHeight: 1 }}>{approved} / {ph.rows.filter((r: any) => r.seq <= 4).length || 4}</span><span className="mono">phases approved</span></div>
                    </div>
                    <div className="card" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => go("phases")} onKeyDown={(e) => e.key === "Enter" && go("phases")}>
                        <div className="mono">Awaiting you</div>
                        <h2 style={{ fontSize: 30, marginTop: 10 }}>{pending}</h2>
                        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>{pending ? "Open Phases to review" : "Nothing needs you right now"}</div>
                    </div>
                <div className="card snd">
                    <div className="mono">Soundtrack</div>
                    {project?.playlist_id ? (
                        <iframe title="Project playlist" style={{ border: 0, width: "100%", height: 232, marginTop: 12 }} loading="lazy"
                            allow="autoplay; clipboard-write; encrypted-media" src={`https://open.spotify.com/embed/playlist/${project.playlist_id}?utm_source=generator&theme=0`} />
                    ) : <p style={{ opacity: 0.6, fontSize: 13 }}>{project?.music_note || "A playlist curated for your project will appear here."}</p>}
                </div>
        </div>
        <div className="grid gh">
            <div className="grid">
                <div className="card">
                    <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}><div className="mono">Progress</div><div style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 30, color: "var(--accent)" }}>{overall}% complete</div></div>
                    <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                        {ph.rows.map((r: any) => (
                            <div key={r.id} title={`Phase ${r.seq} · ${r.title}`} style={{ flex: 1, height: 6, background: r.status === "approved" ? "var(--sage)" : r.status === "locked" ? "#222226" : "var(--accent)" }} />
                        ))}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>{ph.rows.map((r: any) => <div key={r.id} className="mono" style={{ flex: 1, fontSize: 9, letterSpacing: ".08em" }}>P{r.seq} · {r.status === "approved" ? "Done" : r.status === "locked" ? "Locked" : "Active"}</div>)}</div>
                    <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.7 }}>{current?.summary || "Your first phase opens as soon as your survey is filed."}</p>
                </div>
                <ClientTasks project={project} db={db} studio={studioH} />
            </div>
            <div className="grid">
                <div className="card">
                    <div className="mono">Schedule</div>
                    <p style={{ fontSize: 14, opacity: 0.75, lineHeight: 1.6 }}>Request time with the studio. We confirm to your calendar.</p>
                    <Meet project={project} db={db} compact />
                </div>
            </div>
        </div>
        <div className="card">
            <div className="mono">Recent activity</div>
            {act.rows.slice(-8).reverse().map((a: any) => {
                const d = new Date(a.created_at)
                const stamp = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()} ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                return (
                    <div key={a.id} className="actrow">
                        <span className="ts">{stamp}</span>
                        <span className="tx"><b style={{ fontWeight: 500 }}>{a.actor === "studio" ? "Studio" : a.actor === "client" ? "Client" : a.actor || ""}</b>{a.actor ? " · " : ""}{String(a.action).replace(/_/g, " ")}</span>
                    </div>
                )
            })}
            {!act.rows.length && <p style={{ opacity: 0.6, fontSize: 13 }}>Nothing yet.</p>}
        </div>
        <Upcoming project={project} db={db} go={go} />
        <div className="card">
            <div className="mono">Behind the scenes</div>
            <h2 style={{ fontSize: 28, margin: "8px 0 6px" }}>Curious where things stand?</h2>
            <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.7, margin: "0 0 14px", maxWidth: 560 }}>A live read of where each phase stands, straight from the studio's working board. Every task we tick off shows up here, and the full board in Notion has the detail.</p>
            {ph.rows.map((r: any) => {
                const t = dl.rows.filter((d: any) => d.phase_id === r.id && d.kind === "other" && !String(d.title).startsWith("__"))
                const n = t.filter((d: any) => d.status === "accepted").length
                const pct = r.status === "approved" ? 100 : t.length ? Math.round((n / t.length) * 100) : 0
                return (
                    <div key={r.id} style={{ padding: "12px 0", borderTop: ".5px solid color-mix(in srgb,var(--ink) 25%,transparent)", opacity: r.status === "locked" ? 0.45 : 1 }}>
                        <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap", gap: 10 }}>
                            <span className="brk" style={{ fontSize: 14 }}>Phase {r.seq} · {r.title}</span>
                            <span className="pill" style={{ flex: "0 0 auto" }}>{r.status === "locked" ? "Locked" : STATUS[r.status]}</span>
                        </div>
                        <div style={{ height: 4, background: "color-mix(in srgb,var(--ink) 12%,transparent)", marginTop: 10 }}><div style={{ width: pct + "%", height: "100%", background: "var(--accent)" }} /></div>
                        <div className="mono" style={{ marginTop: 6 }}>{r.status === "locked" ? "Opens when the previous phase is approved" : t.length ? `${n} of ${t.length} studio tasks done` : "Studio tasks appear here"}</div>
                    </div>
                )
            })}
            <div className="row stack-m" style={{ marginTop: 16 }}>
                <a className="btn" href={notion} target="_blank" rel="noopener" style={{ textDecoration: "none", textAlign: "center" }}>Open the full board in Notion ↗</a>
                <button className="btn ghost" onClick={() => setLive(!live)}>{live ? "Hide live view" : "Try live view here"}</button>
            </div>
            {live && (
                <div style={{ marginTop: 14 }}>
                    <iframe title="Project status (Notion)" src={notion} style={{ width: "100%", height: 560, border: ".5px solid var(--ink)", background: "#fff" }} />
                    <p className="mono" style={{ marginTop: 8 }}>If this stays blank, Notion is declining to show inside another site. Use the button above instead.</p>
                </div>
            )}
        </div>
      </div>
    )
}

function Phases({ project, db }: any) {
    const ph = useRows(db, "phases", project?.id, "seq")
    const dl = useRows(db, "deliverables", project?.id)
    const [open, setOpen] = React.useState<string | null>(null)
    const [note, setNote] = React.useState<Record<string, string>>({})
    const [err, setErr] = React.useState("")
    const [okMsg, setOkMsg] = React.useState("")
    React.useEffect(() => { if (!open && ph.rows.length) { const c = ph.rows.find((r: any) => r.status === "active" || r.status === "in_review"); if (c) setOpen(c.id) } }, [ph.rows])

    async function decideD(id: string, decision: string) {
        setErr("")
        const { error } = await db.rpc("decide_deliverable", { p_id: id, p_decision: decision, p_comment: note[id] || null })
        if (error) setErr(error.message); else { setOkMsg("Sent to the studio. Thank you."); dl.reload(); ph.reload() }
    }
    const [pmsg, setPmsg] = React.useState<Record<string, { ok: boolean; t: string }>>({})
    const [pbusy, setPbusy] = React.useState("")
    const [confirmId, setConfirmId] = React.useState("")
    async function decideP(r: any, decision: string) {
        const id = r.id
        setErr(""); setOkMsg("")
        if (decision === "request_changes" && !(note["p" + id] || "").trim()) { setPmsg({ ...pmsg, [id]: { ok: false, t: "Tell us what you'd like changed in the comment box, then send." } }); return }
        setPbusy(id + decision)
        const { error } = await db.rpc("decide_phase", { p_phase: id, p_decision: decision, p_comment: (note["p" + id] || "").trim() || null })
        setPbusy(""); setConfirmId("")
        if (error) { setPmsg({ ...pmsg, [id]: { ok: false, t: error.message } }); return }
        setPmsg({ ...pmsg, [id]: { ok: true, t: decision === "approve" ? `Phase ${r.seq} approved. The next phase is now open, and the studio has been notified.` : "Your note has gone to the studio. We'll reply with a revised round." } })
        setNote({ ...note, ["p" + id]: "" })
        await Promise.all([dl.reload(), ph.reload()])
    }
    return (
        <div className="grid">
            {err && <div className="card" role="alert" style={{ borderColor: "var(--accent)" }}>{err}</div>}
            {okMsg && <div className="card mono" role="status">{okMsg}</div>}
            {ph.rows.map((r: any) => {
                const locked = r.status === "locked"
                const items = dl.rows.filter((d: any) => d.phase_id === r.id && d.kind !== "other")
                const tasks = dl.rows.filter((d: any) => d.phase_id === r.id && d.kind === "other" && !String(d.title).startsWith("__"))
                const canDecide = r.status === "active" || r.status === "in_review"
                return (
                    <div className="card" key={r.id} style={{ opacity: locked ? 0.45 : 1 }}>
                        <button onClick={() => !locked && setOpen(open === r.id ? null : r.id)} style={{ all: "unset", cursor: locked ? "default" : "pointer", display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                            <span><span className="mono">Phase {r.seq}</span><h3 style={{ fontSize: 26, marginTop: 6 }}>{r.title}</h3></span>
                            <span className="pill">{locked ? "🔒 " : ""}{STATUS[r.status] || r.status}</span>
                        </button>
                        {open === r.id && !locked && (
                            <div style={{ marginTop: 16 }}>
                                <p style={{ opacity: 0.75, lineHeight: 1.7, fontSize: 14 }}>{r.summary}</p>
                                {items.map((d: any) => (
                                    <div key={d.id} style={{ borderTop: ".5px solid color-mix(in srgb,var(--ink) 25%,transparent)", padding: "14px 0" }}>
                                        <div className="row" style={{ justifyContent: "space-between" }}>
                                            <div><div>{d.title}</div>{d.note && <div style={{ fontSize: 12, opacity: 0.6 }}>{d.note}</div>}</div>
                                            <span className="pill">{d.status === "accepted" ? "Accepted" : d.status === "revision_requested" ? "Revision requested" : "Awaiting you"}</span>
                                        </div>
                                        {d.file_path && <FileLink db={db} path={d.file_path} label="Open file" />}
                                        {canDecide && d.status !== "accepted" && (
                                            <div style={{ marginTop: 10 }}>
                                                <textarea rows={2} placeholder="Notes (required to request a revision)" value={note[d.id] || ""} onChange={(e) => setNote({ ...note, [d.id]: e.target.value })} />
                                                <div className="row" style={{ marginTop: 10 }}>
                                                    <button className="btn" onClick={() => decideD(d.id, "accepted")}>Accept</button>
                                                    <button className="btn ghost" onClick={() => decideD(d.id, "revision_requested")}>Request revision</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {!items.length && <p style={{ opacity: 0.55, fontSize: 13 }}>Deliverables will appear here as the studio publishes them.</p>}
                                {tasks.length > 0 && (
                                    <div style={{ borderTop: ".5px solid color-mix(in srgb,var(--ink) 25%,transparent)", paddingTop: 14, marginTop: 8 }}>
                                        <div className="mono">Studio progress · {tasks.filter((t: any) => t.status === "accepted").length} of {tasks.length}</div>
                                        {tasks.map((t: any) => (
                                            <div key={t.id} style={{ fontSize: 14, padding: "6px 0", opacity: t.status === "accepted" ? 0.55 : 1 }}>
                                                <span style={{ marginRight: 10 }}>{t.status === "accepted" ? "☑" : "☐"}</span>
                                                <span style={{ textDecoration: t.status === "accepted" ? "line-through" : "none" }}>{String(t.title).split(" › ").pop()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {canDecide && (
                                    <div style={{ borderTop: ".5px solid var(--ink)", paddingTop: 16, marginTop: 8 }}>
                                        <div className="mono">Phase decision</div>
                                        <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.7, margin: "8px 0 0" }}>
                                            {r.status === "in_review" ? "The studio has sent this phase for your review. Approve to open the next phase, or tell us what to change." : "The studio is still working on this phase. You can send a note any time. Approval opens once we send the phase for your review."}
                                        </p>
                                        <textarea rows={2} placeholder="Comments for the studio" value={note["p" + r.id] || ""} onChange={(e) => setNote({ ...note, ["p" + r.id]: e.target.value })} />
                                        {confirmId === r.id ? (
                                            <div style={{ marginTop: 12 }}>
                                                <p style={{ fontSize: 14, margin: "0 0 10px" }}>Approve Phase {r.seq} and open the next phase?</p>
                                                <div className="row">
                                                    <button className="btn" disabled={!!pbusy} onClick={() => decideP(r, "approve")}>{pbusy === r.id + "approve" ? "Approving…" : "Yes, approve"}</button>
                                                    <button className="btn ghost" onClick={() => setConfirmId("")}>Not yet</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="row" style={{ marginTop: 10 }}>
                                                <button className="btn" disabled={r.status !== "in_review" || !!pbusy} title={r.status !== "in_review" ? "Opens when the studio sends this phase for review" : ""} onClick={() => setConfirmId(r.id)}>Approve &amp; advance</button>
                                                <button className="btn ghost" disabled={!!pbusy} onClick={() => decideP(r, "request_changes")}>{pbusy === r.id + "request_changes" ? "Sending…" : r.status === "in_review" ? "Request changes" : "Send a note"}</button>
                                            </div>
                                        )}
                                        {pmsg[r.id] && <p role="status" style={{ fontSize: 13, marginTop: 12, lineHeight: 1.6, color: pmsg[r.id].ok ? "inherit" : "#9a3b2e" }}>{pmsg[r.id].t}</p>}
                                    </div>
                                )}
                                {!canDecide && pmsg[r.id]?.ok && <p role="status" style={{ fontSize: 13, marginTop: 12 }}>{pmsg[r.id].t}</p>}
                            </div>
                        )}
                    </div>
                )
            })}
            {!ph.rows.length && !ph.loading && <div className="card mono">Phases appear after your survey is filed.</div>}
        </div>
    )
}

function FileLink({ db, path, label }: { db: any; path: string; label: string }) {
    const [err, setErr] = React.useState("")
    const go = async () => {
        if (path.startsWith("ext:")) { window.open(path.slice(4), "_blank", "noopener"); return }
        const { data, error } = await db.storage.from("project-files").createSignedUrl(path, 300)
        if (error) setErr("Couldn't open that file."); else if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener")
    }
    return <span><a className="mono" style={{ cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 4, display: "inline-block", marginTop: 8 }} onClick={go}>{label} ↗</a>{err && <span style={{ fontSize: 11, marginLeft: 8 }}>{err}</span>}</span>
}

/* ───────────── Roadmap (matches the signed proposal) ───────────── */
function Roadmap({ p }: any) {
    const COLS = 16
    const grid = `minmax(210px,1.7fr) repeat(${COLS}, minmax(26px,1fr))`
    const border = ".5px solid color-mix(in srgb,var(--ink) 18%,transparent)"
    const isClosure = (c: number) => CLOSURES.includes(c)
    // "We are here": week columns are W1 = days 1–7, W2 = 8–14, W3 = 15–21, W4 = 22–month end, across Oct 2026 – Jan 2027.
    const now = new Date()
    const mIdx = (now.getFullYear() - 2026) * 12 + now.getMonth() - 9
    let today: { col: number; frac: number } | null = null
    if (mIdx >= 0 && mIdx < 4) {
        const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        const d = now.getDate()
        const w = Math.min(3, Math.floor((d - 1) / 7))
        const start = w * 7 + 1, end = w === 3 ? dim : start + 6
        today = { col: mIdx * 4 + w, frac: Math.min(0.95, Math.max(0.05, (d - start + 0.5) / (end - start + 1))) }
    }
    const before = mIdx < 0, after = mIdx >= 4
    const todayLabel = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    const mobileRows = GANTT.filter((r) => r.k === "phase" || r.k === "ms")
    const wk = (c: number) => `${["Oct", "Nov", "Dec", "Jan"][Math.floor(c / 4)]} W${(c % 4) + 1}`
    return (
        <div className="grid">
            <div className="card">
                <div className="mono">Design roadmap · 12 working weeks</div>
                <div className="row" style={{ marginTop: 10, gap: 10 }}>
                    <span style={{ display: "inline-block", width: 22, borderTop: "2px dashed var(--accent)" }} />
                    <span style={{ fontSize: 13 }}>{today ? <>We are here · <b>{wk(today.col)}</b> · {todayLabel}</> : before ? "The roadmap begins in October 2026." : "The scheduled roadmap window has passed. Your dates are updated as the project moves."}</span>
                </div>
                <div className="only-m" style={{ marginTop: 14 }}>
                    {mobileRows.map((r, i) => {
                        const cols = [...(r.fill || []), ...(r.ms || [])]
                        const a = cols.length ? Math.min(...cols) : -1, b = cols.length ? Math.max(...cols) : -1
                        const here = today && a >= 0 && today.col >= a && today.col <= b
                        return (
                            <div key={i} style={{ padding: "12px 0", borderTop: ".5px solid color-mix(in srgb,var(--ink) 25%,transparent)", background: here ? "color-mix(in srgb,var(--accent) 12%,transparent)" : "transparent" }}>
                                <div style={{ fontSize: 14, fontWeight: r.k === "phase" ? 600 : 400 }}>{r.n ? <span className="mono" style={{ marginRight: 8 }}>PHASE {r.n}</span> : "◆ "}{r.t}</div>
                                <div className="mono" style={{ marginTop: 4 }}>{a < 0 ? "" : a === b ? wk(a) : `${wk(a)} → ${wk(b)}`}{here ? "  ·  we are here" : ""}</div>
                            </div>
                        )
                    })}
                    <p className="mono" style={{ marginTop: 10 }}>Turn your phone sideways, or open on a larger screen, for the full week-by-week chart.</p>
                </div>
                <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.7, maxWidth: 640 }}>From mobilization through the final LA County submittal. Shaded weeks are studio closures (Thanksgiving, Christmas week and New Year's). Target: construction complete by Spring 2027.</p>
                <div className="no-m" style={{ overflowX: "auto", marginTop: 14 }}>
                    <div style={{ minWidth: 820 }}>
                        <div style={{ display: "grid", gridTemplateColumns: grid, fontSize: 10, letterSpacing: ".12em" }}>
                            <div />
                            {MONTHS.map(([m, n]) => <div key={m} style={{ gridColumn: `span ${n}`, textAlign: "center", padding: "6px 0", background: "var(--ink)", color: "var(--paper)", borderLeft: "1px solid var(--paper)" }}>{m.toUpperCase()}</div>)}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: grid, fontSize: 10, opacity: 0.6 }}>
                            <div />
                            {Array.from({ length: COLS }).map((_, i) => <div key={i} style={{ textAlign: "center", padding: "4px 0", borderLeft: border, position: "relative", opacity: today?.col === i ? 1 : undefined, fontWeight: today?.col === i ? 700 : 400, color: today?.col === i ? "var(--accent)" : "inherit" }}>W{(i % 4) + 1}{today?.col === i && <span style={{ position: "absolute", left: `${today.frac * 100}%`, top: -1, transform: "translateX(-50%)", fontSize: 8, background: "var(--accent)", color: "#fff", padding: "1px 4px", letterSpacing: ".1em", whiteSpace: "nowrap", zIndex: 3 }}>TODAY</span>}</div>)}
                        </div>
                        {GANTT.map((r, i) => (
                            <div key={i} style={{ display: "grid", gridTemplateColumns: grid, alignItems: "stretch", borderTop: border, background: r.k === "phase" ? "color-mix(in srgb,var(--accent) 10%,transparent)" : "transparent" }}>
                                <div style={{ padding: r.k === "phase" ? "9px 8px 9px 4px" : "6px 8px 6px 4px", fontSize: r.k === "phase" ? 13 : 12, fontWeight: r.k === "phase" ? 600 : 400, letterSpacing: r.k === "phase" ? ".06em" : 0, color: r.k === "ms" ? "var(--accent)" : "inherit", lineHeight: 1.35 }}>
                                    {r.n && <span className="mono" style={{ marginRight: 8, opacity: 0.8 }}>PHASE {r.n}</span>}{r.t}
                                </div>
                                {Array.from({ length: COLS }).map((_, c) => {
                                    const filled = r.fill?.includes(c)
                                    const mile = r.ms?.includes(c)
                                    return (
                                        <div key={c} style={{ borderLeft: border, position: "relative", minHeight: r.k === "phase" ? 30 : 24, background: isClosure(c) ? "color-mix(in srgb,var(--ink) 16%,transparent)" : filled ? (r.k === "phase" ? "var(--ink)" : r.k === "ms" ? "var(--accent)" : "color-mix(in srgb,var(--accent) 38%,transparent)") : "transparent" }}>
                                            {mile && <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 15, color: r.hollow ? "var(--ink)" : "#fff", background: r.hollow ? "color-mix(in srgb,var(--accent) 55%,transparent)" : "var(--accent)" }}>{r.hollow ? "◇" : "◆"}</span>}
                                            {isClosure(c) && i === 10 && <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontWeight: 700 }}>✕</span>}
                                            {today?.col === c && <span aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: `${today.frac * 100}%`, borderLeft: "2px dashed var(--accent)", zIndex: 2, pointerEvents: "none" }} />}
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="card">
                <div className="mono">Milestones &amp; fee schedule</div>
                {FEES.map((f) => (
                    <div key={f.t} className="row" style={{ justifyContent: "space-between", padding: "12px 0", borderTop: border, fontSize: 14 }}>
                        <span>◆ {f.t}<span style={{ opacity: 0.5, fontSize: 12 }}> · {f.note}</span></span><b>${f.amt.toLocaleString()}</b>
                    </div>
                ))}
                <div className="row" style={{ justifyContent: "space-between", padding: "12px 0", borderTop: ".5px solid var(--ink)", fontSize: 14 }}><span>Total fixed design fee</span><b>$9,000</b></div>
                <p style={{ fontSize: 12, opacity: 0.6, lineHeight: 1.7, margin: "6px 0 0" }}>◇ The structural engineer is retained and paid directly by you; the studio coordinates the hand-offs. Dates are targets and are updated here as the project moves.</p>
            </div>
            {p.notionRoadmapEmbed && <iframe title="Roadmap" src={p.notionRoadmapEmbed} style={{ width: "100%", height: 560, border: ".5px solid var(--ink)", background: "#fff" }} />}
        </div>
    )
}

function Boards({ p, project, db }: any) {
    const boards = useRows(db, "moodboards", project?.id, "seq")
    const items = useRows(db, "moodboard_items", project?.id, "seq")
    const [arena, setArena] = React.useState<any[]>([])
    const [url, setUrl] = React.useState("")
    const [msg, setMsg] = React.useState("")
    const slug = p.arenaChannel || LINKS.arenaSlug
    const matter = p.matterUrl || LINKS.matter
    const isSnap = (i: any) => i.added_by === "studio" && i.url && /^material board/i.test(i.caption || "")
    const snap = [...items.rows].reverse().find(isSnap)
    React.useEffect(() => {
        fetch(`https://api.are.na/v2/channels/${slug}/contents?per=36`).then((r) => r.json()).then((j) => setArena(j.contents || [])).catch(() => {})
    }, [slug])
    React.useEffect(() => {
        const ch = db.channel("mb-" + project?.id).on("postgres_changes", { event: "*", schema: "public", table: "moodboard_items", filter: `project_id=eq.${project?.id}` }, () => items.reload()).subscribe()
        return () => { db.removeChannel(ch) }
    }, [db, project?.id])
    async function add() {
        if (!url.trim() || !project) return
        setMsg("")
        let boardId = boards.rows[0]?.id
        const { data: u } = await db.auth.getUser()
        if (!boardId) { setMsg("Your board is being set up. Please check back shortly."); return }
        const { error } = await db.from("moodboard_items").insert({ board_id: boardId, project_id: project.id, kind: "image", url: url.trim(), added_by: "client", added_by_email: u?.user?.email })
        if (error) setMsg("Couldn't add that: " + error.message); else { setMsg("Added to your board."); setUrl(""); items.reload() }
    }
    return (
        <div className="grid">
            <div className="card">
                <div className="mono">Material &amp; mood board</div>
                <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.7, maxWidth: 620 }}>Our working material direction for the courtyard: stone, masonry, metals and color. It grows as we move from the Phase 1 curation board into the Phase 2 lookbook.</p>
                {/* Mattoboard refuses to load inside other sites, so the portal shows the studio's latest snapshot of the board and opens the live board in one click. */}
                <a href={matter} target="_blank" rel="noopener" style={{ display: "block", position: "relative", color: "inherit", textDecoration: "none", border: ".5px solid var(--ink)", background: "color-mix(in srgb,var(--ink) 6%,transparent)", minHeight: snap ? 0 : 220 }}>
                    {snap ? <img src={snap.url} alt="Latest material board snapshot" style={{ width: "100%", display: "block" }} />
                        : <div style={{ minHeight: 220, display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}><div><div className="mono">Material board</div><div style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 26, marginTop: 8 }}>Open the live board</div></div></div>}
                    <span className="btn" style={{ position: "absolute", right: 12, bottom: 12, textDecoration: "none" }}>Open live board ↗</span>
                </a>
                <p className="mono" style={{ marginTop: 10 }}>{snap ? `Snapshot updated ${new Date(snap.created_at).toLocaleDateString()} · tap the image for the live, interactive board` : "The live board opens in a new tab. A snapshot appears here as the studio updates it."}</p>
            </div>
            <div className="card">
                <div className="mono">Inspiration · Are.na</div>
                <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.7, margin: "6px 0 14px" }}>The studio's running reference channel for your project. <a href={LINKS.arenaUrl} target="_blank" rel="noopener" style={{ color: "inherit" }}>Open on Are.na ↗</a></p>
                <div style={{ columnCount: 3, columnGap: 14 }} className="fy-masonry">
                    <style>{`@media(max-width:860px){.fy-masonry{column-count:2!important}}@media(max-width:520px){.fy-masonry{column-count:1!important}}`}</style>
                    {items.rows.filter((i: any) => i.url && !isSnap(i)).map((i: any) => (
                        <figure key={i.id} style={{ margin: "0 0 14px", breakInside: "avoid" }}>
                            <img src={i.url} alt={i.caption || ""} style={{ width: "100%", display: "block" }} loading="lazy" />
                            {i.caption && <figcaption className="mono" style={{ marginTop: 6 }}>{i.caption}</figcaption>}
                        </figure>
                    ))}
                    {arena.filter((b: any) => b.image?.display?.url).map((b: any) => (
                        <figure key={"a" + b.id} style={{ margin: "0 0 14px", breakInside: "avoid" }}>
                            <img src={b.image.display.url} alt={b.title || ""} style={{ width: "100%", display: "block" }} loading="lazy" />
                        </figure>
                    ))}
                </div>
                {!items.rows.length && !arena.length && <p className="mono">Reference images will appear here.</p>}
            </div>
            <div className="card">
                <div className="mono">Add your own inspiration</div>
                <div className="row" style={{ marginTop: 8 }}>
                    <input style={{ flex: 1, minWidth: 220 }} placeholder="Paste an image link" value={url} onChange={(e) => setUrl(e.target.value)} />
                    <button className="btn" onClick={add}>Add</button>
                </div>
                {msg && <p style={{ fontSize: 13, marginTop: 10 }}>{msg}</p>}
            </div>
        </div>
    )
}

function SurveyCopy({ db, client }: any) {
    const [row, setRow] = React.useState<any>(null)
    React.useEffect(() => {
        if (!client?.client_id) return
        db.from("survey_submissions").select("id,respondent_name,summary_text,submitted_at").eq("client_id", client.client_id).eq("is_test", false).order("submitted_at", { ascending: false }).limit(1).then(({ data }: any) => setRow((data || [])[0] || null))
    }, [client?.client_id])
    if (!row) return null
    const download = () => {
        const blob = new Blob([row.summary_text || ""], { type: "text/plain" })
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "FELEMAYE_Design_Intent_Survey.txt"; a.click()
    }
    return (
        <div className="card">
            <div className="mono">Your Design Intent Survey</div>
            <p style={{ fontSize: 14, opacity: 0.75, lineHeight: 1.7 }}>Filed {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : ""}. A copy is with the studio and kept here.</p>
            <details><summary className="mono" style={{ cursor: "pointer" }}>Read your responses</summary><pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.7, marginTop: 12 }}>{row.summary_text}</pre></details>
            <button className="btn ghost" style={{ marginTop: 14 }} onClick={download}>Download a copy</button>
        </div>
    )
}

const FILE_CATS: [string, string, string][] = [
    ["meeting_notes", "Meeting Notes", "Agendas, call summaries and decisions"],
    ["submittals", "Submittals", "Materials, product data, samples and approvals"],
    ["presentations", "Presentations", "Decks and design-review packets"],
    ["images", "Images", "Photos, renderings and site documentation"],
    ["drawings", "Drawings & Models", "Plans, sections, details and 3D files"],
    ["documents", "Contracts & Documents", "Agreements, permits, surveys and reports"],
    ["other", "Other", "Everything else"],
]
const guessCat = (name: string) => (/\.(png|jpe?g|gif|webp|heic|avif|tiff?)$/i.test(name) ? "images" : /\.(pptx?|key)$/i.test(name) ? "presentations" : /\.(dwg|dxf|rvt|skp|3dm|obj|ifc)$/i.test(name) ? "drawings" : /\.(docx?|pdf|txt|xlsx?)$/i.test(name) ? "documents" : "other")
function Files({ p, project, db, client }: any) {
    const files = useRows(db, "project_files", project?.id)
    const [busy, setBusy] = React.useState(false)
    const [cat, setCat] = React.useState("auto")
    const [msg, setMsg] = React.useState("")
    const inputRef = React.useRef<HTMLInputElement>(null)
    async function up(e: React.ChangeEvent<HTMLInputElement>) {
        const list = Array.from(e.target.files || [])
        if (!list.length) return
        if (!project) { setMsg("Your project isn't ready yet."); return }
        setBusy(true); setMsg("")
        const { data: u } = await db.auth.getUser()
        const email = u?.user?.email || ""
        let ok = 0
        for (const f of list) {
            const path = `${project.id}/client/${Date.now()}_${f.name.replace(/[^\w.\-]+/g, "_")}`
            const { error } = await db.storage.from("project-files").upload(path, f)
            if (error) { setMsg(`Couldn't upload ${f.name}: ${error.message}`); continue }
            const { error: e2 } = await db.from("project_files").insert({ project_id: project.id, path, name: f.name, size_bytes: f.size, direction: "client", uploaded_by: email, category: cat === "auto" ? guessCat(f.name) : cat })
            if (e2) { setMsg(`Uploaded ${f.name} but couldn't file it: ${e2.message}`); continue }
            ok++
        }
        if (ok) setMsg(`${ok} file${ok > 1 ? "s" : ""} sent. The studio has been notified.`)
        e.target.value = ""
        setBusy(false); files.reload()
    }
    const ref = files.rows.filter((f: any) => String(f.path).startsWith("ext:"))
    const rest = files.rows.filter((f: any) => !String(f.path).startsWith("ext:"))
    const drive = p.driveFolderUrl || LINKS.drive
    const line = ".5px solid color-mix(in srgb,var(--ink) 25%,transparent)"
    return (
        <div className="grid">
            <div className="card">
                <div className="mono">Send us a file</div>
                <p style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.7, margin: "8px 0 14px" }}>Surveys, photos, permits, inspiration, anything useful. The studio is notified the moment it arrives.</p>
                <input ref={inputRef} type="file" multiple onChange={up} style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
                <select aria-label="File folder" value={cat} onChange={(e) => setCat(e.target.value)} style={{ marginBottom: 14, maxWidth: 360 }}>
                    <option value="auto">File it for me</option>
                    {FILE_CATS.map(([k, l]) => <option key={k} value={k}>Folder: {l}</option>)}
                </select>
                <div className="row stack-m">
                    <button className="btn" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? "Uploading…" : "Choose files"}</button>
                    <a className="mono" href={drive} target="_blank" rel="noopener" style={{ color: "inherit" }}>Open shared Drive folder ↗</a>
                </div>
                {msg && <p style={{ fontSize: 13, marginTop: 12 }} role="status">{msg}</p>}
            </div>
            <SurveyCopy db={db} client={client} />
            {ref.length > 0 && (
                <div className="card">
                    <div className="mono">Reference library</div>
                    <p style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.7, margin: "8px 0 4px" }}>Your inspiration images, gathered from your Drive folder. The studio sorts these into the right phase as the design develops.</p>
                    {ref.map((f: any) => (
                        <div key={f.id} className="row" style={{ justifyContent: "space-between", padding: "12px 0", borderTop: line }}>
                            <span style={{ fontSize: 14 }}>{f.name}</span>
                            <FileLink db={db} path={f.path} label="Open" />
                        </div>
                    ))}
                </div>
            )}
            <div className="card">
                <div className="mono">Project archive</div>
                <p style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.7, margin: "8px 0 6px" }}>Everything filed for your project, sorted by type. Newest first.</p>
                {FILE_CATS.map(([k, label, hint]) => {
                    const inCat = rest.filter((f: any) => (f.category || guessCat(f.name || "")) === k).sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
                    return (
                        <details key={k} open={inCat.length > 0 && k !== "other"} style={{ borderTop: line }}>
                            <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "14px 0" }}>
                                <span><span style={{ fontSize: 16 }}>{label}</span><span className="brk" style={{ display: "block", fontSize: 12, opacity: 0.55, marginTop: 2 }}>{hint}</span></span>
                                <span className="pill" style={{ flex: "0 0 auto" }}>{inCat.length}</span>
                            </summary>
                            {inCat.map((f: any) => (
                                <div key={f.id} className="row" style={{ justifyContent: "space-between", padding: "10px 0 10px 12px", borderTop: ".5px dashed color-mix(in srgb,var(--ink) 20%,transparent)" }}>
                                    <span className="brk" style={{ fontSize: 14, flex: "1 1 200px" }}>{f.name} <span style={{ opacity: 0.45, fontSize: 11 }}>· {f.direction === "studio" || f.direction === "studio_to_client" ? "from the studio" : "from you"} · {new Date(f.created_at).toLocaleDateString()}</span></span>
                                    <FileLink db={db} path={f.path} label="Download" />
                                </div>
                            ))}
                            {!inCat.length && <p style={{ opacity: 0.5, fontSize: 13, margin: "0 0 14px 12px" }}>Nothing filed here yet.</p>}
                        </details>
                    )
                })}
            </div>
        </div>
    )
}

function Billing({ p, project, db, client }: any) {
    const [inv, setInv] = React.useState<any[]>([])
    React.useEffect(() => {
        if (!project) return
        db.from("invoices").select("*").eq("project_id", project.id).order("created_at", { ascending: false }).then(({ data }: any) => setInv(data || []))
    }, [project?.id])
    const line = ".5px solid color-mix(in srgb,var(--ink) 25%,transparent)"
    const due = inv.filter((i) => i.status === "sent")
    const card = p.cardPayUrl || p.stripeLink
    const summ: React.CSSProperties = { cursor: "pointer", padding: "14px 0", borderTop: line, listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 15 }
    const dt: React.CSSProperties = { fontSize: 14, lineHeight: 1.9, padding: "0 0 16px" }
    return (
        <div className="grid">
            <div className="card">
                <div className="mono">Invoices</div>
                {inv.filter((i) => i.status !== "draft").map((i) => (
                    <div key={i.id} className="row" style={{ justifyContent: "space-between", padding: "14px 0", borderTop: line }}>
                        <span>{i.number} <span style={{ opacity: 0.5, fontSize: 12 }}>· {i.description}</span></span>
                        <span className="row"><b>${Number(i.amount).toLocaleString()}</b><span className="pill">{i.status}</span></span>
                    </div>
                ))}
                {!due.length && <p style={{ fontSize: 15, margin: "12px 0 4px" }}>No invoice due at this time.</p>}
                <p style={{ opacity: 0.55, fontSize: 12, lineHeight: 1.7, margin: "10px 0 0" }}>Invoices are issued at each milestone and are due within 10 days. We'll email you when one is ready.</p>
            </div>
            <div className="card">
                <div className="mono">Fee schedule</div>
                {FEES.map((f, i) => (
                    <div key={f.t} className="row" style={{ justifyContent: "space-between", padding: "12px 0", borderTop: line, fontSize: 14 }}>
                        <span>{f.t}<span style={{ opacity: 0.5, fontSize: 12 }}> · {f.note}</span></span>
                        <span className="row"><b>${f.amt.toLocaleString()}</b>{i === 0 && <span className="pill">{client?.retainer_paid ? "Received" : "Due on signing"}</span>}</span>
                    </div>
                ))}
            </div>
            <div className="card">
                <div className="mono">How to pay</div>
                <details style={{ marginTop: 10 }}>
                    <summary style={summ}><span>Zelle · no fee</span><span className="mono">+</span></summary>
                    <div style={dt}>
                        Send to Zelle tag <b>{PAY.zelleTag}</b>, or scan with your banking app. Please add the memo <i>{PAY.memo}</i>.
                        <div><img alt="Zelle QR code for @felemaye" src={QR_ZELLE} style={{ width: 190, height: "auto", marginTop: 10, display: "block", background: "#fff", padding: 6 }} /></div>
                    </div>
                </details>
                <details>
                    <summary style={summ}><span>ACH or wire transfer · no fee</span><span className="mono">+</span></summary>
                    <div style={dt}>
                        <div><span className="mono">Payable to</span><br />{PAY.payee}</div>
                        <div style={{ marginTop: 8 }}><span className="mono">Bank</span><br />{PAY.bank}<br />Account {PAY.account} · Routing {PAY.routing}</div>
                        <div style={{ marginTop: 8 }}><span className="mono">Memo</span><br />{PAY.memo}</div>
                    </div>
                </details>
                <details>
                    <summary style={summ}><span>Credit or debit card · 3.5% processing fee</span><span className="mono">+</span></summary>
                    <div style={dt}>
                        A 3.5% processing fee applies to card payments. {card ? <a className="btn" style={{ textDecoration: "none", display: "inline-block", marginTop: 10 }} href={card} target="_blank" rel="noopener">Pay by card</a> : <>Ask the studio for a secure card link: <a href={`mailto:${LINKS.studioEmail}?subject=Card payment link`} style={{ color: "inherit" }}>{LINKS.studioEmail}</a></>}
                    </div>
                </details>
                <p style={{ opacity: 0.55, fontSize: 12, lineHeight: 1.7, margin: "12px 0 0" }}>Balances more than 15 days past the invoice date accrue 1.5% monthly interest, and the studio may pause work on an unpaid invoice. Structural engineering is contracted and paid directly by you.</p>
            </div>
        </div>
    )
}

/* ───────────── Meetings: weekdays, 9–5 Pacific, 30-minute starts ───────────── */
const SLOT_TIMES = (() => { const out: string[] = []; for (let m = 9 * 60; m <= 16 * 60 + 30; m += 30) out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`); return out })()
const fmtTime = (t: string) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}` }
const MEET_TOPICS = ["Design review", "Questions about a phase or deliverable", "Site visit or field measurements", "Materials and finishes", "Budget, scope or billing", "Permits and engineering", "General check-in", "Something else"]
function Meet({ project, db, compact }: any) {
    const [topic, setTopic] = React.useState("")
    const [comments, setComments] = React.useState("")
    const [slots, setSlots] = React.useState<{ d: string; t: string }[]>([{ d: "", t: "" }, { d: "", t: "" }])
    const [dur, setDur] = React.useState(30)
    const [done, setDone] = React.useState("")
    const [busy, setBusy] = React.useState(false)
    const tomorrow = React.useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) }, [])
    const times = SLOT_TIMES.filter((t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m + dur <= 17 * 60 })
    const set = (i: number, patch: any) => setSlots(slots.map((x, k) => (k === i ? { ...x, ...patch } : x)))
    const weekend = (d: string) => { if (!d) return false; const g = new Date(d + "T12:00:00").getDay(); return g === 0 || g === 6 }
    async function send() {
        if (!project) return
        const chosen = slots.filter((s) => s.d && s.t && !weekend(s.d))
        if (!topic) { setDone("Choose what you'd like to cover."); return }
        if (!chosen.length) { setDone("Choose at least one weekday and time."); return }
        setBusy(true); setDone("")
        const { error } = await db.rpc("request_meeting", { p_project: project.id, p_topic: topic, p_slots: chosen.map((s) => ({ start: `${s.d}T${s.t}`, label: `${s.d} ${fmtTime(s.t)} PT` })), p_duration: dur, p_notes: comments.trim() || null })
        setBusy(false)
        if (error) setDone(error.message); else { setDone("Requested. The studio has been notified and will confirm by email with a calendar invitation."); setTopic(""); setComments(""); setSlots([{ d: "", t: "" }, { d: "", t: "" }]) }
    }
    return (
        <div className={compact ? "" : "card"}>
            {!compact && <div className="mono">Request a meeting</div>}
            <p style={{ fontSize: 12, opacity: 0.6, margin: "6px 0 0" }}>Monday to Friday · 9 AM to 5 PM Pacific</p>
            <select aria-label="What would you like to cover?" value={topic} onChange={(e) => setTopic(e.target.value)} style={{ marginTop: 8 }}>
                <option value="">What would you like to cover?</option>
                {MEET_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {slots.map((s, i) => (
                <div key={i} className="row" style={{ marginTop: 10, flexWrap: "nowrap", gap: 10 }}>
                    <input type="date" min={tomorrow} aria-label={`Preferred day ${i + 1}`} value={s.d} onChange={(e) => set(i, { d: e.target.value })} style={{ flex: 1.2 }} />
                    <select aria-label={`Preferred time ${i + 1}`} value={s.t} onChange={(e) => set(i, { t: e.target.value })} style={{ flex: 1, background: "transparent", border: 0, borderBottom: ".5px solid var(--ink)", padding: "12px 2px", font: "inherit", fontSize: 16, color: "inherit" }}>
                        <option value="">Time</option>
                        {times.map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
                    </select>
                </div>
            ))}
            {slots.some((s) => weekend(s.d)) && <p style={{ fontSize: 12, margin: "8px 0 0" }}>We meet on weekdays. Please pick a Monday to Friday.</p>}
            {slots.length < 3 && <a className="mono" style={{ cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 4, display: "inline-block", marginTop: 10 }} onClick={() => setSlots([...slots, { d: "", t: "" }])}>+ Add another option</a>}
            <textarea rows={2} placeholder="Comments / notes (optional)" value={comments} onChange={(e) => setComments(e.target.value)} style={{ marginTop: 14 }} maxLength={1500} />
            <div className="row" style={{ marginTop: 16 }}>
                {[30, 60].map((d) => <button key={d} className={"btn" + (dur === d ? "" : " ghost")} onClick={() => { setDur(d); setSlots(slots.map((x) => ({ ...x, t: "" }))) }}>{d} min</button>)}
                <button className="btn" disabled={busy} onClick={send}>{busy ? "Sending" : "Request"}</button>
            </div>
            {done && <p style={{ fontSize: 13, marginTop: 12 }} role="status">{done}</p>}
        </div>
    )
}

/* ───────────── Project directory ───────────── */
/* ───────────── Additive modules: Permit Path, FF&E, Ledger, Family Insights, Upcoming ───────────── */
const LINE = "1px solid #222226"
const usd = (n: any) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function PermitPath({ project, db }: any) {
    const [d, setD] = React.useState<any>(null)
    const [view, setView] = React.useState<string | null>(null)
    const [studio, setStudio] = React.useState(false)
    const [msg, setMsg] = React.useState("")
    const load = React.useCallback(async (j?: string | null) => {
        if (!project?.id) return
        const { data, error } = await db.rpc("project_permit", { p_project: project.id, p_jur: j || null })
        if (error) setMsg("Couldn't load the permit path."); else { setD(data); setMsg("") }
    }, [db, project?.id])
    React.useEffect(() => { load(); db.rpc("is_studio").then(({ data }: any) => setStudio(!!data)) }, [load])
    const j = d?.jurisdiction || {}
    const shown = view || d?.current
    const stages: string[] = j.stages || []
    const prog = d?.progress || {}
    const fees: any[] = j.fee_chart || []
    const pick = (id: string) => { setView(id); load(id) }
    const save = async () => { const { error } = await db.rpc("set_jurisdiction", { p_project: project.id, p_jur: shown }); if (error) setMsg(error.message); else { setView(null); load() } }
    const cycle = async (s: string) => {
        if (!studio || shown !== d?.current) return
        const next = prog[s] === "done" ? "" : prog[s] === "active" ? "done" : "active"
        await db.rpc("set_permit_stage", { p_project: project.id, p_stage: s, p_state: next }); load()
    }
    return (
        <div className="grid">
            <div className="card">
                <div className="mono">Permit path</div>
                <h2 style={{ fontSize: 28, margin: "8px 0 6px" }}>{j.portal_name || "Jurisdiction"}</h2>
                <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.7, maxWidth: 640, margin: "0 0 14px" }}>
                    Where your project sits in the agency review process. The studio tracks each step here so you never have to chase the county or city for status. Fees are shown as the agency posts them.
                </p>
                {studio && <div className="row" role="tablist" aria-label="Jurisdiction (studio preview)" style={{ gap: 8, flexWrap: "wrap" }}>
                    {(d?.options || []).map((o: any) => (
                        <button key={o.id} role="tab" aria-selected={shown === o.id} className={"btn" + (shown === o.id ? "" : " ghost")} onClick={() => pick(o.id)}>{o.label}{o.id === d?.current ? " · this project" : ""}</button>
                    ))}
                </div>}
                {studio && shown !== d?.current && d && (
                    <p className="mono" style={{ marginTop: 12, opacity: 1 }}>
                        Preview only. The studio sets your project's official path.{" "}
                        {studio && <a style={{ cursor: "pointer", textDecoration: "underline" }} onClick={save}>Make this the project's path</a>}
                    </p>
                )}
                {msg && <p style={{ color: "var(--ochre)", fontSize: 13 }}>{msg}</p>}
                {j.notes && <p style={{ opacity: 0.8, fontSize: 14, lineHeight: 1.7, margin: "16px 0 0", borderTop: LINE, paddingTop: 14 }}>{typeof j.notes === "string" ? j.notes : JSON.stringify(j.notes)}</p>}
            </div>
            <div className="card">
                <div className="mono">Review stages</div>
                {stages.map((s, i) => {
                    const st = shown === d?.current ? prog[s] : ""
                    return (
                        <div key={s} className="row" onClick={() => cycle(s)} style={{ justifyContent: "space-between", flexWrap: "nowrap", gap: 12, padding: "14px 0", borderTop: LINE, cursor: studio && shown === d?.current ? "pointer" : "default" }}>
                            <span className="brk" style={{ fontSize: 15 }}><span className="mono" style={{ marginRight: 10 }}>{String(i + 1).padStart(2, "0")}</span>{s}</span>
                            <span className="pill" style={{ flex: "0 0 auto", background: "transparent", borderColor: st === "done" ? "var(--sage)" : st === "active" ? "var(--slate)" : "var(--line)", color: st === "done" ? "var(--sage)" : st === "active" ? "var(--slate)" : "var(--ink)" }}>{st === "done" ? "Complete" : st === "active" ? "Agency review" : "Upcoming"}</span>
                        </div>
                    )
                })}
                {studio && shown === d?.current && <p className="mono" style={{ marginTop: 10 }}>Studio: tap a stage to cycle Upcoming, Agency review, Complete.</p>}
            </div>
            <div className="card">
                <div className="mono">Agency fees</div>
                {fees.map((f: any) => (
                    <div key={f.fee} className="row" style={{ justifyContent: "space-between", padding: "12px 0", borderTop: LINE, fontSize: 14 }}>
                        <span>{f.fee}</span><b>{f.amount != null ? usd(f.amount) : f.status || "To be confirmed"}</b>
                    </div>
                ))}
                <p style={{ opacity: 0.55, fontSize: 12, lineHeight: 1.7, margin: "12px 0 0" }}>Agency fees are passed through at cost and logged in your Ledger. Any single item over $250 needs your written approval first.</p>
                {j.portal_url && <a className="btn" href={j.portal_url} target="_blank" rel="noopener" style={{ textDecoration: "none", display: "inline-block", marginTop: 14 }}>Open the agency portal ↗</a>}
            </div>
            <BiCoastal current={d?.current} studio={studio} />
        </div>
    )
}

const TRACKS = [
    { id: "epic_la", label: "Los Angeles County", sub: "Unincorporated LA County · Lorado Way, View Park", steps: [
        ["Regional Planning", "Zoning review through EPIC-LA (EnerGov): setbacks, height, lot coverage and any discretionary approvals."],
        ["Public Works · Building & Safety", "Plan check intake and routing to Fire, Environmental Health and the district office."],
        ["Structural plan check", "Structural engineer's wet-stamped calculations and drawings checked for code compliance."],
        ["Corrections, approval, permit", "Resubmittal until approved, then fees paid and the permit issued."],
        ["Inspections and final", "Inspections at each stage, then final sign-off."] ],
      fees: ["Planning review fee (per the County fee schedule)", "Building plan check fee (based on project valuation)", "Building permit fee (based on project valuation)", "Fire, Environmental Health and school fees where they apply"] },
    { id: "nyc_dob", label: "New York City DOB", sub: "DOB NOW: Build", steps: [
        ["DOB NOW: Build filing", "Alteration filing (Alt-CO / Alteration Type 2) submitted online with the licensed professional of record."],
        ["Plan examiner review", "Objections issued and answered until the DOB Plan Examiner approves."],
        ["Directive 14", "Where eligible, the professionally certified inspection track is used in place of some DOB inspections."],
        ["Permit issuance", "Fees paid, permit issued; landmark or historic-district projects clear LPC first."],
        ["Special Inspections and sign-off", "Required special inspections, then final inspection sign-off in DOB NOW."] ],
      fees: ["DOB filing fee (based on job type and cost)", "Plan examination and permit fee (based on estimated cost)", "Special inspection agency fees (quoted by the agency)", "LPC application fee where applicable"] },
]
function BiCoastal({ current, studio }: any) {
    const tracks = studio ? TRACKS : TRACKS.filter((t) => t.id === current)
    if (!tracks.length) return null
    return (
        <div className="card">
            <div className="mono">{studio ? "Bi-coastal permitting · studio view shows both tracks" : "Permitting milestones"}</div>
            <h2 style={{ fontSize: 24, margin: "8px 0 6px" }}>{studio ? "How a filing moves on each coast" : "How your filing moves"}</h2>
            <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.7, maxWidth: 640, margin: "0 0 6px" }}>Milestones and fee types for both agencies. Fees are set by each agency's current schedule and mostly scale with project valuation, so exact figures and the expected review window are quoted per project at intake, never guessed.</p>
            <div className="fy-bc" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 20, marginTop: 14 }}>
                {tracks.map((t) => (
                    <div key={t.id} style={{ borderTop: LINE, paddingTop: 14, minWidth: 0 }}>
                        <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <b style={{ fontSize: 17 }}>{t.label}</b>
                            {current === t.id && <span className="pill" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>This project</span>}
                        </div>
                        <div className="mono" style={{ margin: "4px 0 10px" }}>{t.sub}</div>
                        {t.steps.map(([h, b], i) => (
                            <div key={h} style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr)", gap: 8, padding: "10px 0", borderTop: LINE }}>
                                <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                                <div><div style={{ fontSize: 14 }}>{h}</div><div style={{ opacity: 0.65, fontSize: 13, lineHeight: 1.6 }}>{b}</div></div>
                            </div>
                        ))}
                        <div className="mono" style={{ margin: "14px 0 4px" }}>Fee types</div>
                        {t.fees.map((x) => <div key={x} style={{ fontSize: 13, opacity: 0.8, padding: "5px 0" }}>· {x}</div>)}
                    </div>
                ))}
            </div>
        </div>
    )
}

const FFE_STATUS: Record<string, string> = { proposed: "For your review", approved: "Approved", revision_requested: "Revision requested", declined: "Declined", ordered: "Ordered", delivered: "Delivered" }
function FFE({ project, db }: any) {
    const [rows, setRows] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [note, setNote] = React.useState<Record<string, string>>({})
    const [ask, setAsk] = React.useState<string | null>(null)
    const [err, setErr] = React.useState("")
    const load = React.useCallback(async () => {
        if (!project?.id) return
        const { data } = await db.rpc("client_ffe", { p_project: project.id }); setRows(data || []); setLoading(false)
    }, [db, project?.id])
    React.useEffect(() => { load() }, [load])
    const decide = async (id: string, decision: string) => {
        if (decision === "revision_requested" && !(note[id] || "").trim()) { setAsk(id); setErr("Tell us what to change so we can revise it."); return }
        const { error } = await db.rpc("decide_ffe", { p_item: id, p_decision: decision, p_note: note[id] || null })
        if (error) setErr("That item has already moved on.") ; else { setErr(""); setAsk(null); load() }
    }
    const rooms = Array.from(new Set(rows.map((r) => r.room || "General")))
    const approved = rows.filter((r) => ["approved", "ordered", "delivered"].includes(r.client_status)).reduce((s, r) => s + Number(r.client_price || 0) * (r.qty || 1), 0)
    return (
        <div className="grid">
            <div className="card">
                <div className="mono">FF&amp;E selections</div>
                <h2 style={{ fontSize: 28, margin: "8px 0 6px" }}>Furniture, lighting &amp; custom finishes</h2>
                <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.7, maxWidth: 640, margin: 0 }}>Each piece the studio proposes appears here with its price, lead time and specification sheet. Approve what you love, ask for a revision, or decline. We only order after you approve.</p>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 16 }}><span className="mono">Approved so far</span><b>{usd(approved)}</b></div>
                {err && <p style={{ color: "var(--ochre)", fontSize: 13 }}>{err}</p>}
            </div>
            {!rows.length && !loading && <div className="card"><p style={{ margin: 0, opacity: 0.7, fontSize: 14 }}>Selections will appear here once the studio begins Phase 3.</p></div>}
            {rooms.map((room) => (
                <div className="card" key={room}>
                    <div className="mono">{room}</div>
                    {rows.filter((r) => (r.room || "General") === room).map((r) => {
                        const open = r.client_status === "proposed" || r.client_status === "revision_requested"
                        return (
                            <div key={r.id} style={{ padding: "18px 0", borderTop: LINE, display: "grid", gridTemplateColumns: r.image_url ? "96px minmax(0,1fr)" : "minmax(0,1fr)", gap: 16 }}>
                                {r.image_url && <img alt={r.item} src={r.image_url} style={{ width: 96, height: 96, objectFit: "cover", border: LINE }} />}
                                <div>
                                    <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap", gap: 10 }}>
                                        <span className="brk" style={{ fontSize: 17 }}>{r.item}{r.qty > 1 ? ` × ${r.qty}` : ""}</span>
                                        <span className="pill" style={{ flex: "0 0 auto" }}>{FFE_STATUS[r.client_status]}</span>
                                    </div>
                                    <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }} className="brk">{r.vendor || ""}{r.lead_time_weeks ? ` · ${r.lead_time_weeks} wk lead time` : ""}</div>
                                    <div style={{ fontSize: 15, marginTop: 6 }}><b>{r.client_price != null ? usd(Number(r.client_price) * (r.qty || 1)) : "Price to follow"}</b></div>
                                    {r.cut_sheet_url && (String(r.cut_sheet_url).startsWith("http") ? <a className="mono" href={r.cut_sheet_url} target="_blank" rel="noopener" style={{ textDecoration: "underline", display: "inline-block", marginTop: 8 }}>Specification sheet ↗</a> : <FileLink db={db} path={r.cut_sheet_url} label="Specification sheet" />)}
                                    {r.client_note && !open && <p style={{ fontSize: 13, opacity: 0.7, margin: "8px 0 0" }}>Your note: {r.client_note}</p>}
                                    {open && (
                                        <div style={{ marginTop: 12 }}>
                                            {(ask === r.id || r.client_status === "revision_requested") && <textarea aria-label="What should change?" placeholder="What should we change?" value={note[r.id] || ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} style={{ width: "100%", minHeight: 70, padding: 10, font: "inherit", fontSize: 14, marginBottom: 10, boxSizing: "border-box" }} />}
                                            <div className="row stack-m" style={{ gap: 8 }}>
                                                <button className="btn" onClick={() => decide(r.id, "approved")}>Approve item</button>
                                                <button className="btn ghost" onClick={() => (ask === r.id || (note[r.id] || "").trim() ? decide(r.id, "revision_requested") : (setAsk(r.id), setErr("")))}>Request revision</button>
                                                <button className="btn ghost" onClick={() => decide(r.id, "declined")}>Decline</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ))}
        </div>
    )
}

function Ledger({ project, db, go }: any) {
    const [rows, setRows] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [err, setErr] = React.useState("")
    const load = React.useCallback(async () => {
        if (!project?.id) return
        const { data } = await db.rpc("client_reimbursables", { p_project: project.id }); setRows(data || []); setLoading(false)
    }, [db, project?.id])
    React.useEffect(() => { load() }, [load])
    const auth = async (id: string, ok: boolean) => {
        if (!window.confirm(ok ? "Give written approval for this expense?" : "Decline this expense?")) return
        const { error } = await db.rpc("authorize_reimbursable", { p_id: id, p_ok: ok }); if (error) setErr("Couldn't record that. Please try again."); else { setErr(""); load() }
    }
    const pending = (r: any) => r.needs_auth && r.auth_status !== "authorized" && r.auth_status !== "declined"
    const total = rows.filter((r) => r.auth_status !== "declined").reduce((s, r) => s + Number(r.billed || 0), 0)
    const awaiting = rows.filter(pending).reduce((s, r) => s + Number(r.billed || 0), 0)
    const cats = ["Agency fees", "Printing & plotting", "Samples & swatches", "Courier & delivery"]
    const studioL = useStudio(db)
    return (
      <div className="grid g2" style={{ alignItems: "start" }}>
        <div className="grid">
            <div className="card">
                <div className="mono">Reimbursables ledger</div>
                <h2 style={{ fontSize: 28, margin: "8px 0 6px" }}>Every pass-through expense, itemized</h2>
                <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.7, maxWidth: 640, margin: "0 0 12px" }}>Agency fees, plotting, physical samples and courier deliveries, shown with the receipt. Any single expense over $250.00 needs your written approval before it is billed.</p>
                <div className="grid g3">
                    <div><div className="mono">Total to date</div><h2 style={{ fontSize: 26, marginTop: 6 }}>{usd(total)}</h2></div>
                    <div><div className="mono">Awaiting approval</div><h2 style={{ fontSize: 26, marginTop: 6 }}>{usd(awaiting)}</h2></div>
                    <div><div className="mono">Items</div><h2 style={{ fontSize: 26, marginTop: 6 }}>{rows.length}</h2></div>
                </div>
                {err && <p style={{ color: "var(--ochre)", fontSize: 13 }}>{err}</p>}
            </div>
            <div className="card">
                {rows.map((r) => (
                    <div key={r.id} style={{ padding: "16px 0", borderTop: LINE }}>
                        <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap", gap: 10 }}>
                            <span className="brk" style={{ fontSize: 15 }}>{r.vendor || "Expense"}<span style={{ opacity: 0.55, fontSize: 12 }}> · {r.category}</span></span>
                            <b style={{ flex: "0 0 auto" }}>{usd(r.billed)}</b>
                        </div>
                        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }} className="brk">{r.spent_on} · {r.description || ""}</div>
                        <div className="row" style={{ gap: 8, marginTop: 8 }}>
                            {pending(r) && <span className="pill" style={{ borderColor: "var(--ochre)", color: "var(--ochre)" }}>PENDING APPROVAL (&gt; $250)</span>}
                            {r.auth_status === "authorized" && <span className="pill" style={{ borderColor: "var(--sage)", color: "var(--sage)" }}>Approved in writing</span>}
                            {r.auth_status === "declined" && <span className="pill">Declined</span>}
                            {r.status === "reimbursed" && <span className="pill">Paid</span>}
                            {r.receipt_path && <FileLink db={db} path={r.receipt_path} label="Receipt" />}
                        </div>
                        {pending(r) && (
                            <div className="row stack-m" style={{ gap: 8, marginTop: 12 }}>
                                <button className="btn" onClick={() => auth(r.id, true)}>Approve in writing</button>
                                <button className="btn ghost" onClick={() => auth(r.id, false)}>Decline</button>
                            </div>
                        )}
                    </div>
                ))}
                {!rows.length && !loading && <p style={{ margin: 0, opacity: 0.7, fontSize: 14 }}>No reimbursable expenses have been billed yet.</p>}
                <div className="row" style={{ marginTop: 14, gap: 8 }}>{cats.map((c) => <span key={c} className="mono">{c}</span>)}</div>
                <button className="btn" style={{ marginTop: 16 }} onClick={() => go("billing")}>How to pay →</button>
            </div>
        </div>
        <ReceiptsProof project={project} db={db} studio={studioL} />
      </div>
    )
}

function FamilyInsights({ p, project, db }: any) {
    const [s, setS] = React.useState<any>(null)
    const [copied, setCopied] = React.useState(false)
    React.useEffect(() => { if (project?.id) db.rpc("family_survey_summary", { p_project: project.id }).then(({ data }: any) => setS(data)) }, [db, project?.id])
    const [adj, setAdj] = React.useState<any>(null)
    React.useEffect(() => { if (project?.id) db.rpc("family_adjacencies", { p_project: project.id }).then(({ data }: any) => setAdj(data)) }, [db, project?.id])
    const url = p.familySurveyUrl || "https://felemaye.com/survey/lorado"
    const bars = (title: string, obj: any) => {
        const e = Object.entries(obj || {}) as [string, number][]; e.sort((a, b) => b[1] - a[1]); const max = Math.max(1, ...e.map((x) => x[1]))
        return (
            <div className="card" key={title}>
                <div className="mono">{title}</div>
                {e.map(([k, v]) => (
                    <div key={k} style={{ marginTop: 12 }}>
                        <div className="row" style={{ justifyContent: "space-between", fontSize: 14 }}><span>{k}</span><b>{v}</b></div>
                        <div style={{ height: 4, background: "color-mix(in srgb,var(--ink) 12%,transparent)", marginTop: 6 }}><div style={{ width: (v / max) * 100 + "%", height: "100%", background: "var(--accent)" }} /></div>
                    </div>
                ))}
                {!e.length && <p style={{ margin: "10px 0 0", opacity: 0.6, fontSize: 13 }}>No answers yet.</p>}
            </div>
        )
    }
    return (
        <div className="grid">
            <div className="card">
                <div className="mono">Democratic family insights</div>
                <h2 style={{ fontSize: 28, margin: "8px 0 6px" }}>The courtyard, in your children's words</h2>
                <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.7, maxWidth: 640, margin: "0 0 14px" }}>A short, playful survey for the family. It needs no login and shows nothing about billing, contracts or permits. Answers collect here and inform the Design Development direction.</p>
                <div className="row stack-m" style={{ gap: 8 }}>
                    <a className="btn" href={url} target="_blank" rel="noopener" style={{ textDecoration: "none", textAlign: "center" }}>Open the family survey ↗</a>
                    <button className="btn ghost" onClick={() => { try { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {} }}>{copied ? "Link copied" : "Copy link to share"}</button>
                </div>
                <p className="mono" style={{ marginTop: 14 }}>{s?.total ?? 0} responses so far</p>
            </div>
            {s && s.total > 0 && <div className="grid g2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>{bars("Moodboard picks", s.mood)}{bars("Lighting mood", s.lighting)}{bars("Colour palette", s.palette)}{bars("Courtyard seating", s.seating)}{bars("How a room should feel", s.room_feel)}{bars("When it will be used", s.extra?.time_of_day)}{bars("Light controls", s.extra?.light_control)}{bars("What will happen out there", s.extra?.activities)}{bars("Lives here full-time?", s.extra?.resident)}{bars("Visit frequency", s.extra?.visit_freq)}{bars("Group size", s.extra?.group_size)}{bars("Privacy (1 open, 5 tucked away)", s.extra?.privacy)}{bars("Indoor-outdoor flow (1 separate, 5 continuous)", s.extra?.flow)}{bars("Materials to touch", s.extra?.materials)}{bars("Underfoot", s.extra?.underfoot)}{bars("Sitting time", s.extra?.sit_duration)}{bars("Sun or shade", s.extra?.shade)}{bars("Seasons", s.extra?.seasons)}{bars("Staying comfortable", s.extra?.comfort)}</div>}
            <Adjacencies adj={adj} />
            <WishMatrix s={s} adj={adj} />
            {s && s.wishes?.length > 0 && (
                <div className="card">
                    <div className="mono">Wishes</div>
                    {s.wishes.map((w: any, i: number) => <p key={i} style={{ fontSize: 15, lineHeight: 1.6, margin: "12px 0 0", paddingTop: 12, borderTop: LINE }}>“{w.wish}”<span className="mono" style={{ display: "block", marginTop: 4 }}>{[w.who, w.age].filter(Boolean).join(" · ") || "A family member"}</span></p>)}
                </div>
            )}
        </div>
    )
}

function WishMatrix({ s, adj }: any) {
    const E = s?.extra?.wish_essential || {}, M = s?.extra?.wish_maybe || {}, P = s?.extra?.wish_pass || {}
    const goals: string[] = adj?.goals || []
    const words = (x: string) => String(x).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)
    const hit = (t: string) => goals.some((g) => words(g).some((w) => words(t).includes(w)))
    const items = Array.from(new Set([...Object.keys(E), ...Object.keys(M), ...Object.keys(P)])).sort((a, b) => (E[b] || 0) - (E[a] || 0) || (M[b] || 0) - (M[a] || 0))
    if (!items.length) return null
    return (
        <div className="card">
            <div className="mono">Wishlist matrix · Essential / Maybe / Pass</div>
            <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.7, maxWidth: 640, margin: "8px 0 10px" }}>How the household voted on each idea. Items that touch a primary project goal are marked.</p>
            <div className="fy-wm" style={{ display: "grid", gridTemplateColumns: "repeat(12,minmax(0,1fr))", gap: 16, padding: "10px 0", borderTop: LINE }}>
                <div className="mono" style={{ gridColumn: "span 6" }}>Idea</div><div className="mono" style={{ gridColumn: "span 2" }}>Essential</div><div className="mono" style={{ gridColumn: "span 2" }}>Maybe</div><div className="mono" style={{ gridColumn: "span 2" }}>Pass</div>
            </div>
            {items.map((it) => (
                <div key={it} className="fy-wm" style={{ display: "grid", gridTemplateColumns: "repeat(12,minmax(0,1fr))", gap: 16, padding: "10px 0", borderTop: LINE, fontSize: 14, alignItems: "center" }}>
                    <div style={{ gridColumn: "span 6", overflowWrap: "anywhere" }}>{it}{hit(it) && <span className="pill" style={{ marginLeft: 8, borderColor: "var(--sage)", color: "var(--sage)" }}>Goal overlap</span>}</div>
                    <b style={{ gridColumn: "span 2", color: "var(--accent)" }}>{E[it] || 0}</b><span style={{ gridColumn: "span 2" }}>{M[it] || 0}</span><span style={{ gridColumn: "span 2", opacity: 0.6 }}>{P[it] || 0}</span>
                </div>
            ))}
        </div>
    )
}

function Adjacencies({ adj }: any) {
    const goals: string[] = adj?.goals || []
    const pairs: any[] = adj?.pairs || []
    const words = (x: string) => String(x).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)
    const hit = (t: string) => goals.some((g) => words(g).some((w) => words(t).includes(w)))
    const max = Math.max(1, ...pairs.map((x) => x.n || 0))
    return (
        <div className="card">
            <div className="mono">Family Wishlist &amp; Spatial Adjacencies</div>
            <h2 style={{ fontSize: 24, margin: "8px 0 6px" }}>Where the family and the plan agree</h2>
            <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.7, maxWidth: 640, margin: "0 0 12px" }}>Which things the family wants together, set against the project's primary goals. Pairs that touch a goal are marked as overlap.</p>
            <div className="mono">Primary project goals</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "8px 0 16px" }}>
                {goals.length ? goals.map((g) => <span key={g} className="pill" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>{g}</span>) : <span style={{ opacity: 0.6, fontSize: 13 }}>Primary goals will appear here once the studio records them for this project.</span>}
            </div>
            <div className="mono">Wanted together</div>
            {pairs.map((x, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, padding: "12px 0", borderTop: LINE, alignItems: "center" }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, overflowWrap: "anywhere" }}>{x.a} <span style={{ opacity: 0.5 }}>+</span> {x.b}{(hit(x.a) || hit(x.b)) && <span className="pill" style={{ marginLeft: 8, borderColor: "var(--sage)", color: "var(--sage)" }}>Overlaps a goal</span>}</div>
                        <div style={{ height: 4, background: "color-mix(in srgb,var(--ink) 12%,transparent)", marginTop: 6 }}><div style={{ width: ((x.n || 0) / max) * 100 + "%", height: "100%", background: hit(x.a) || hit(x.b) ? "var(--sage)" : "var(--accent)" }} /></div>
                    </div>
                    <b>{x.n}</b>
                </div>
            ))}
            {!pairs.length && <p style={{ opacity: 0.6, fontSize: 13, borderTop: LINE, paddingTop: 12 }}>Adjacencies appear once at least two family members have answered.</p>}
        </div>
    )
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
function Upcoming({ project, db, go }: any) {
    const [ev, setEv] = React.useState<any[]>([])
    React.useEffect(() => {
        if (!project?.id) return
        db.from("calendar_events").select("id,title,kind,starts_at,ends_at,location,video_url,agenda_url,notes").eq("project_id", project.id).gte("starts_at", new Date(Date.now() - 3600e3).toISOString()).order("starts_at", { ascending: true }).limit(3).then(({ data }: any) => setEv(data || []))
    }, [db, project?.id])
    const gcal = (e: any) => { const s = new Date(e.starts_at), en = new Date(e.ends_at || s.getTime() + 3600e3); return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&dates=${icsDate(s)}/${icsDate(en)}&details=${encodeURIComponent((e.notes || "") + (e.video_url ? "\nJoin: " + e.video_url : ""))}&location=${encodeURIComponent(e.location || "")}` }
    const ics = (e: any) => {
        const s = new Date(e.starts_at), en = new Date(e.ends_at || s.getTime() + 3600e3)
        const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FELEMAYE//Portal//EN", "BEGIN:VEVENT", `UID:${e.id}@felemaye.com`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(s)}`, `DTEND:${icsDate(en)}`, `SUMMARY:${e.title}`, `LOCATION:${e.location || e.video_url || ""}`, `DESCRIPTION:${(e.notes || "").replace(/\n/g, "\\n")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n")
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" })); a.download = "felemaye-session.ics"; a.click()
    }
    return (
        <div className="card">
            <div className="mono">UPCOMING APPOINTMENTS</div>
            <h2 style={{ fontSize: 28, margin: "8px 0 6px" }}>Upcoming Appointments</h2>
            <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.7, margin: "0 0 10px" }}>Site walks, design reviews, shopping sessions and pre-design consultations.</p>
            {ev.map((e) => {
                const d = new Date(e.starts_at)
                return (
                    <div key={e.id} style={{ padding: "16px 0", borderTop: LINE }}>
                        <div className="mono" style={{ opacity: 1 }}>{d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · {d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
                        <div style={{ fontSize: 17, margin: "6px 0" }} className="brk">{e.title}{e.location ? <span style={{ opacity: 0.6, fontSize: 13 }}> · {e.location}</span> : null}</div>
                        <div className="row" style={{ gap: 14 }}>
                            {e.video_url && <a className="mono" href={e.video_url} target="_blank" rel="noopener" style={{ textDecoration: "underline", padding: "8px 0" }}>Join video call ↗</a>}
                            {e.agenda_url && <a className="mono" href={e.agenda_url} target="_blank" rel="noopener" style={{ textDecoration: "underline", padding: "8px 0" }}>Agenda ↗</a>}
                            <a className="mono" href={gcal(e)} target="_blank" rel="noopener" style={{ textDecoration: "underline", padding: "8px 0" }}>Add to Google Calendar ↗</a>
                            <a className="mono" onClick={() => ics(e)} style={{ textDecoration: "underline", cursor: "pointer", padding: "8px 0" }}>Add to Apple / Outlook (.ics)</a>
                        </div>
                    </div>
                )
            })}
            {!ev.length && <p style={{ margin: "8px 0 0", opacity: 0.7, fontSize: 14, borderTop: LINE, paddingTop: 14 }}>Nothing scheduled yet. <a style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => go("meet")}>Request a time →</a></p>}
        </div>
    )
}

/* ───────────── Master pass 2: studio flag, audit list, tasks, receipts ───────────── */
function useStudio(db: any) {
    const [studio, setStudio] = React.useState(false)
    React.useEffect(() => { db.rpc("is_studio").then(({ data }: any) => setStudio(!!data)) }, [db])
    return studio
}

function AuditList({ db, onOpen }: any) {
    const [rows, setRows] = React.useState<any[]>([])
    const [msg, setMsg] = React.useState("Loading projects…")
    React.useEffect(() => {
        (async () => {
            const { data: ok } = await db.rpc("is_studio")
            if (!ok) return setMsg("The audit view is for the studio principal only.")
            const { data: pr } = await db.from("projects").select("*").order("created_at", { ascending: false })
            const { data: cl } = await db.from("clients").select(CLIENT_COLS)
            const byId: any = {}; (cl || []).forEach((c: any) => (byId[c.client_id] = c))
            setRows((pr || []).map((x: any) => ({ pr: x, cl: byId[x.client_id] }))); setMsg("")
        })()
    }, [db])
    return (
        <div className="wrap">
            <div className="mono">Studio · admin audit</div>
            <h1 style={{ fontSize: "clamp(34px,6vw,60px)", margin: "8px 0 8px" }}>Every client suite</h1>
            <p style={{ opacity: 0.7, maxWidth: 640, lineHeight: 1.7 }}>Open any client's portal exactly as they see it, without completing or bypassing their onboarding survey. Nothing you do here changes the client's own login or survey status.</p>
            {msg && <div className="card mono">{msg}</div>}
            <div className="grid">
                {rows.map(({ pr, cl }) => (
                    <div className="card" key={pr.id}>
                        <div className="row" style={{ justifyContent: "space-between", gap: 14 }}>
                            <div>
                                <h2 style={{ fontSize: 26 }}>{pr.title || pr.slug}</h2>
                                <div className="mono" style={{ marginTop: 6 }}>{pr.address || ""}{cl?.name ? ` | Client: ${cl.name}` : ""}</div>
                                <div className="mono" style={{ marginTop: 6 }}>/suite/{pr.client_slug || pr.slug}</div>
                            </div>
                            <div className="row stack-m" style={{ gap: 8 }}>
                                <button className="btn" disabled={!cl} onClick={() => onOpen(pr, cl, "dash")}>Open dashboard</button>
                                <button className="btn ghost" disabled={!cl} onClick={() => onOpen(pr, cl, "survey")}>View survey</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

const TASK_BADGE: Record<string, [string, string]> = { action_required: ["ACTION REQUIRED", "var(--ochre)"], pending_review: ["PENDING REVIEW", "var(--slate)"], completed: ["COMPLETED", "var(--sage)"] }
function ClientTasks({ project, db, studio }: any) {
    const [rows, setRows] = React.useState<any[]>([])
    const [title, setTitle] = React.useState(""); const [due, setDue] = React.useState(""); const [msg, setMsg] = React.useState("")
    const load = React.useCallback(async () => {
        if (!project?.id) return
        const { data } = await db.from("client_tasks").select("*").eq("project_id", project.id).order("created_at", { ascending: false }); setRows(data || [])
    }, [db, project?.id])
    React.useEffect(() => { load() }, [load])
    const add = async () => {
        if (!title.trim()) return
        const { error } = await db.from("client_tasks").insert({ project_id: project.id, title: title.trim().slice(0, 140), due_on: due || null, assigned_by: "Studio" })
        if (error) setMsg("Couldn't add that task."); else { setTitle(""); setDue(""); setMsg(""); load() }
    }
    const setSt = async (id: string, st: string) => { await db.from("client_tasks").update({ status: st, updated_at: new Date().toISOString(), completed_at: st === "completed" ? new Date().toISOString() : null }).eq("id", id); load() }
    const submit = async (id: string) => { const { error } = await db.rpc("client_submit_task", { p_id: id }); if (error) setMsg("Couldn't update that."); else load() }
    return (
        <div className="card">
            <div className="mono">Action items</div>
            <h2 style={{ fontSize: 26, margin: "8px 0 10px" }}>Your checklist</h2>
            {rows.map((t) => {
                const [lab, col] = TASK_BADGE[t.status] || TASK_BADGE.action_required
                return (
                    <div key={t.id} className="fy-task" style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr) auto", gap: 12, alignItems: "start", padding: "12px 0", borderTop: LINE, opacity: t.status === "completed" ? 0.6 : 1 }}>
                        <span aria-hidden="true" style={{ width: 18, height: 18, marginTop: 2, border: `1px solid ${col}`, display: "grid", placeItems: "center", color: col, fontSize: 12 }}>{t.status === "completed" ? "✓" : t.status === "pending_review" ? "…" : ""}</span>
                        <div>
                            <div className="brk" style={{ fontSize: 15, textDecoration: t.status === "completed" ? "line-through" : "none" }}>{t.title}</div>
                            <div className="mono" style={{ marginTop: 4 }}>{t.due_on ? `Due ${new Date(t.due_on + "T12:00:00").toLocaleDateString()}` : "No due date"}{t.assigned_by ? ` · from ${t.assigned_by}` : ""}</div>
                            <div className="row" style={{ gap: 8, marginTop: 8 }}>
                                {!studio && t.status === "action_required" && <button className="btn ghost" style={{ padding: "8px 12px" }} onClick={() => submit(t.id)}>Mark done, send for review</button>}
                                {studio && t.status !== "completed" && <button className="btn ghost" style={{ padding: "8px 12px" }} onClick={() => setSt(t.id, "completed")}>Complete</button>}
                                {studio && t.status !== "action_required" && <button className="btn ghost" style={{ padding: "8px 12px" }} onClick={() => setSt(t.id, "action_required")}>Reopen</button>}
                            </div>
                        </div>
                        <span className="pill" style={{ borderColor: col, color: col, whiteSpace: "nowrap" }}>[{lab}]</span>
                    </div>
                )
            })}
            {!rows.length && <p style={{ opacity: 0.6, fontSize: 13, borderTop: LINE, paddingTop: 12, margin: 0 }}>Nothing assigned to you right now.</p>}
            {studio && (
                <div className="row stack-m" style={{ gap: 10, marginTop: 14, borderTop: LINE, paddingTop: 14, alignItems: "flex-end" }}>
                    <div style={{ flex: "1 1 240px" }}><div className="mono">Assign to client</div><input value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="Review Phase 1 Brief" /></div>
                    <div style={{ flex: "0 1 170px" }}><div className="mono">Due</div><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
                    <button className="btn" onClick={add}>Assign</button>
                </div>
            )}
            {msg && <p style={{ color: "var(--ochre)", fontSize: 13 }}>{msg}</p>}
        </div>
    )
}

function ReceiptsProof({ project, db, studio }: any) {
    const [rows, setRows] = React.useState<any[]>([])
    const [kind, setKind] = React.useState("receipt"); const [title, setTitle] = React.useState(""); const [vendor, setVendor] = React.useState(""); const [amount, setAmount] = React.useState("")
    const [file, setFile] = React.useState<File | null>(null); const [busy, setBusy] = React.useState(false); const [msg, setMsg] = React.useState("")
    const load = React.useCallback(async () => {
        if (!project?.id) return
        const { data } = await db.from("project_receipts").select("*").eq("project_id", project.id).order("created_at", { ascending: false }); setRows(data || [])
    }, [db, project?.id])
    React.useEffect(() => { load() }, [load])
    const upload = async () => {
        if (!file || !title.trim()) { setMsg("Add a title and choose a file."); return }
        if (file.size > 20 * 1024 * 1024) { setMsg("That file is over 20 MB."); return }
        setBusy(true); setMsg("")
        const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80)
        const path = `${project.id}/receipts/${Date.now()}_${safe}`
        const up = await db.storage.from("project-files").upload(path, file, { upsert: false })
        if (up.error) { setBusy(false); return setMsg("Upload failed. Please try again.") }
        const { error } = await db.from("project_receipts").insert({ project_id: project.id, kind, title: title.trim().slice(0, 120), vendor: vendor.trim().slice(0, 80) || null, amount: amount ? Number(amount) : null, file_path: path, uploaded_by: "Studio" })
        setBusy(false)
        if (error) return setMsg("Saved the file but couldn't list it.")
        setTitle(""); setVendor(""); setAmount(""); setFile(null); load()
    }
    const isNew = (r: any) => Date.now() - new Date(r.created_at).getTime() < 7 * 864e5
    const KIND: Record<string, string> = { receipt: "Receipt", invoice: "Invoice", proof: "Proof of expense" }
    return (
        <div className="card">
            <div className="mono">Receipts &amp; proof upload</div>
            <h2 style={{ fontSize: 24, margin: "8px 0 6px" }}>Vendor receipts &amp; invoices</h2>
            <p style={{ opacity: 0.7, fontSize: 13, lineHeight: 1.6, margin: "0 0 8px" }}>Every vendor receipt, invoice and proof of expense the studio files for your project lands here.</p>
            {rows.map((r) => (
                <div key={r.id} className="fy-rc" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, padding: "12px 0", borderTop: LINE }}>
                    <div>
                        <div className="brk" style={{ fontSize: 14 }}>{r.title}{isNew(r) && <span className="pill" style={{ marginLeft: 8, borderColor: "var(--accent)", color: "var(--accent)" }}>NEW</span>}</div>
                        <div className="mono" style={{ marginTop: 4 }}>{KIND[r.kind] || r.kind} · {new Date(r.created_at).toLocaleDateString()}{r.vendor ? ` · ${r.vendor}` : ""}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>{r.amount != null && <div style={{ fontSize: 14 }}>{usd(r.amount)}</div>}<FileLink db={db} path={r.file_path} label="Open" /></div>
                </div>
            ))}
            {!rows.length && <p style={{ opacity: 0.6, fontSize: 13, borderTop: LINE, paddingTop: 12, margin: 0 }}>No receipts filed yet.</p>}
            {studio && (
                <div style={{ marginTop: 14, borderTop: LINE, paddingTop: 14 }}>
                    <div className="mono">Studio upload</div>
                    <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type"><option value="receipt">Receipt</option><option value="invoice">Vendor invoice</option><option value="proof">Proof of expense</option></select>
                    <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. LA County plan check fee)" />
                    <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}><input value={vendor} maxLength={80} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor" /><input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Amount" /></div>
                    <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ fontSize: 14 }} />
                    <button className="btn" disabled={busy} style={{ marginTop: 12 }} onClick={upload}>{busy ? "Uploading…" : "Upload for client"}</button>
                </div>
            )}
            {msg && <p style={{ color: "var(--ochre)", fontSize: 13 }}>{msg}</p>}
        </div>
    )
}


function Directory({ project, db }: any) {
    const d = useRows(db, "project_directory", project?.id, "seq")
    const lnk: React.CSSProperties = { color: "inherit", textUnderlineOffset: 3 }
    const COLS = "repeat(12,minmax(0,1fr))", SPAN = [2, 2, 2, 3, 2, 1] // grid-cols-12 gap-4: Name 2 · Role 2 · Company 2 (own column) · Email 3 · Phone 2 · Status 1
    return (
        <div className="card">
            <div className="mono">Project directory</div>
            <h2 style={{ fontSize: 28, margin: "8px 0 6px" }}>Everyone on your project</h2>
            <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.7, maxWidth: 600, margin: "0 0 10px" }}>The studio, consultants and trades working on your project, with how to reach each one. Tap an email or phone number to write or call. For anything that touches scope or schedule, please copy the studio.</p>
            <div className="fy-dir fy-dir-h" style={{ display: "grid", gridTemplateColumns: COLS, gap: 16, padding: "12px 0", borderTop: LINE }}>
                {["Name", "Role", "Company", "Email", "Phone", "Status"].map((h, i) => <div key={h} className="mono" style={{ gridColumn: `span ${SPAN[i]}` }}>{h}</div>)}
            </div>
            {d.rows.map((r: any) => (
                <div key={r.id} className="fy-dir" style={{ padding: "14px 0", borderTop: LINE, display: "grid", gridTemplateColumns: COLS, gap: 16, alignItems: "start", fontSize: 14 }}>
                    <div className="brk" data-l="Name" style={{ fontSize: 15, gridColumn: "span 2" }}>{r.full_name}</div>
                    <div className="brk" data-l="Role" style={{ gridColumn: "span 2", overflowWrap: "anywhere" }}>{r.role}</div>
                    <div className="brk" data-l="Company" style={{ gridColumn: "span 2", overflowWrap: "anywhere" }}>{r.company || "—"}</div>
                    <div className="brk" data-l="Email" style={{ gridColumn: "span 3", overflowWrap: "anywhere" }}>{r.email ? <a href={`mailto:${r.email}`} style={lnk}>{r.email}</a> : "—"}</div>
                    <div className="brk" data-l="Phone" style={{ gridColumn: "span 2", overflowWrap: "anywhere" }}>{r.phone ? <a href={`tel:${String(r.phone).replace(/[^\d+]/g, "")}`} style={lnk}>{r.phone}</a> : "—"}</div>
                    <div data-l="Status" style={{ gridColumn: "span 1" }}><span className="pill" style={{ borderColor: /pending|tbd/i.test(r.status || "") ? "var(--ochre)" : "var(--sage)", color: /pending|tbd/i.test(r.status || "") ? "var(--ochre)" : "var(--sage)" }}>{r.status || "Active"}</span></div>
                </div>
            ))}
            {!d.rows.length && !d.loading && <p style={{ opacity: 0.6, fontSize: 13, borderTop: LINE, paddingTop: 14 }}>Your project team will be listed here as consultants and trades are engaged.</p>}
            <style>{`@media(max-width:860px){.fy-dir-h{display:none!important}.fy-dir{grid-template-columns:1fr 1fr!important}.fy-dir>div{grid-column:auto!important}.fy-dir>div[data-l]::before{content:attr(data-l);display:block;font:10px ui-monospace,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;opacity:.55;margin-bottom:3px}}@media(max-width:480px){.fy-dir{grid-template-columns:1fr!important}}@media(min-width:861px){.fy-dir [data-l="Status"] .pill{white-space:normal;padding:4px 6px;font-size:9px}}`}</style>
        </div>
    )
}

ClientPortal.defaultProps = {
    supabaseUrl: "https://afejhlfwymwagstyfnse.supabase.co",
    publishableKey: "sb_publishable_DxxomxoBSa8QkC6pBzYf5A_O86rctbV",
    surveyUrl: "",
    portalUrl: "https://felemaye.com/client-suite/portal",
    nameOverride: "",
    stripeLink: "",
    notionRoadmapEmbed: "",
    arenaChannel: "",
    driveFolderUrl: "",
    notionUrl: "",
    matterUrl: "",
    cardPayUrl: "",
    familySurveyUrl: "https://felemaye.com/survey/lorado",
    welcomeEyebrow: "FELEMAYE · Private Workspace",
    paper: "#0B0B0C",
    ink: "#EDE6D8",
    accent: "#D4A373",
    surface: "#141416",
    roadmap: [
        { title: "Pre-Design, Feasibility & Site Survey", from: 1, to: 2, note: "Survey, site visit, program, zoning" },
        { title: "Schematic Design (SD) & Spatial Layouts", from: 3, to: 5, note: "Spatial direction, mood, layouts" },
        { title: "Design Development (DD) & FF&E Procurement", from: 6, to: 8, note: "Surfaces, FF&E, detailing" },
        { title: "Construction Documents (CD) & Municipal Permitting", from: 9, to: 11, note: "Drawings, agency submittals" },
        { title: "Bidding, Negotiation & Construction Administration (CA)", from: 12, to: 12, note: "Bids, site advisory, handover" },
    ],
    width: 1200,
    height: 900,
}

addPropertyControls(ClientPortal, {
    supabaseUrl: { type: ControlType.String, title: "Supabase URL" },
    publishableKey: { type: ControlType.String, title: "Publishable key" },
    surveyUrl: { type: ControlType.String, title: "Survey URL" },
    portalUrl: { type: ControlType.String, title: "Portal URL" },
    nameOverride: { type: ControlType.String, title: "Name fallback" },
    stripeLink: { type: ControlType.String, title: "Stripe link" },
    notionRoadmapEmbed: { type: ControlType.String, title: "Roadmap embed (optional)" },
    notionUrl: { type: ControlType.String, title: "Notion status page" },
    matterUrl: { type: ControlType.String, title: "Material board" },
    cardPayUrl: { type: ControlType.String, title: "Card pay link" },
    familySurveyUrl: { type: ControlType.String, title: "Family survey link" },
    arenaChannel: { type: ControlType.String, title: "Are.na channel" },
    driveFolderUrl: { type: ControlType.String, title: "Drive folder" },
    welcomeEyebrow: { type: ControlType.String, title: "Eyebrow" },
    paper: { type: ControlType.Color, title: "Paper" },
    ink: { type: ControlType.Color, title: "Ink" },
    accent: { type: ControlType.Color, title: "Accent" },
    surface: { type: ControlType.Color, title: "Card" },
    roadmap: {
        type: ControlType.Array,
        title: "Roadmap",
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String },
                from: { type: ControlType.Number, min: 1, max: 12, step: 1 },
                to: { type: ControlType.Number, min: 1, max: 12, step: 1 },
                note: { type: ControlType.String },
            },
        },
    },
})

// Zelle QR for @felemaye
const QR_ZELLE = "data:image/jpeg;base64,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"
