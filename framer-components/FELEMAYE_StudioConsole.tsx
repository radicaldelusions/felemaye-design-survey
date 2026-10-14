// FELEMAYE — Studio Console (Framer code component) — place on a hidden /studio page.
// Login: magic link, restricted by the is_studio() RPC (allow-listed emails in Supabase). Everyone else is signed out.
// Tabs: Clients (add, resend credentials, retainer toggle, inspect what the client sees) · Survey images (upload PNG/JPG per card).
import * as React from "react"
import { addPropertyControls, ControlType } from "framer"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

type Props = { supabaseUrl: string; publishableKey: string; studioUrl: string; portalUrl: string; paper: string; ink: string; accent: string }

const OPTIONS: Record<string, string[]> = {
    Materials: ["Hand-troweled plaster", "Terracotta tile", "Talavera tile", "Natural stone", "Wrought iron", "Warm timber", "Board-formed concrete", "Pebble & gravel", "Aged brass", "Clay vessels", "Woven textiles", "Climbing vines"],
    Plants: ["Citrus trees", "Bougainvillea", "Olive tree", "Succulents", "Herb garden", "Lavender", "Roses", "Palms", "Wildflowers", "Jacaranda canopy", "Jasmine", "Ornamental grasses"],
    Lighting: ["Glass lanterns", "Sculpted sconces", "Festoon lights", "Uplit trees & walls", "Hearth fire glow", "Candlelit niches", "Step & path lighting", "Moonlit minimal", "Paper lanterns"],
}


// Standard phase checklists (group › item). "Load standard checklists" seeds them once; tick items off, attach a Notion link per item.
const TEMPLATES: Record<number, string[]> = {
    1: ["Work › Site survey: field measurements, porch transitions, facade condition and photography", "Work › Zoning research: front-yard setbacks, height limits and property lines (LA County Regional Planning)", "Work › Structural & material feasibility assessment", "Deliverables › Existing Site Plan and Survey Sketch", "Deliverables › Zoning & Code Analysis Summary (setbacks, height and transparency rules)", "Deliverables › Preliminary Structural Option Comparison (A: Modified Gate/Pilasters, B: Masonry Enclosure)", "Deliverables › Material Curation Board (stone, local masonry and color palette direction)", "Review › Consolidated round of design refinements"],
    2: ["Work › Spatial layout & courtyard flow: entry points, gate placement, pedestrian pathways", "Work › Design concepts & material selection: wall finishes, gate styles, wrought iron, hardscape", "Deliverables › Schematic Courtyard Floor Plan & Hardscape Layout", "Deliverables › Concept Layout Design Options (existing gate vs. new masonry enclosure)", "Deliverables › 3D Exterior Renderings (key elevations and massing)", "Deliverables › Preliminary Material Lookbook", "Deliverables › Initial Elevation Sketches (wall and gate heights)", "Deliverables › Surface Lighting Study", "Review › Consolidated round of design refinements", "Milestone › SD sign-off and Milestone 2 payment"],
    3: ["Work › Permit set: title sheet, dimensioned site plan, exterior wall elevations, wall and gate details", "Work › Engineering handoff: Revit/CAD files and parameters to the Structural Engineer of Record", "Work › Specification strategy: material and finish schedule with sourcing", "Deliverables › High-Fidelity 3D Exterior Renderings", "Deliverables › 75% Construction Drawings & Material Specifications", "Deliverables › Handoff Package for Structural Engineer Review", "Milestone › DD client review and Milestone 3 payment", "Milestone › Structural Engineer retainer (paid directly by client)"],
    4: ["Work › CAD background handoff to Structural Engineer", "Work › Third-party engineering calculations & detailing", "Work › Stamped structural sheet integration", "Deliverables › Complete Permit Drawing Set (PDF) for LA County submittal", "Deliverables › Plan-check response support (one round)", "Milestone › Final package submitted to LA County"],
    5: ["Optional › Periodic site walkthroughs at key milestones", "Optional › Contractor RFIs & submittal reviews", "Optional › Design clarifications for field conditions"],
}
// Checklist rows live in `deliverables` with kind='other' (done = status 'accepted', Notion link = note).
let _db: any
const getDb = (u: string, k: string) => (_db ||= createClient(u, k, { auth: { persistSession: true, detectSessionInUrl: true } }))

export default function StudioConsole(p: Props) {
    const db = getDb(p.supabaseUrl, p.publishableKey)
    const [state, setState] = React.useState<"boot" | "login" | "denied" | "ok">("boot")
    const [email, setEmail] = React.useState("")
    const [msg, setMsg] = React.useState("")
    const [tab, setTab] = React.useState("clients")

    const check = React.useCallback(async () => {
        const { data } = await db.auth.getSession()
        if (!data.session) return setState("login")
        const { error: ue } = await db.auth.getUser()
        if (ue) { await db.auth.signOut(); setMsg("Your session expired. Send yourself a fresh sign-in link."); return setState("login") }
        const { data: ok } = await db.rpc("is_studio")
        if (ok) setState("ok")
        else { await db.auth.signOut(); setState("denied") }
    }, [db])
    React.useEffect(() => {
        check()
        const { data: s } = db.auth.onAuthStateChange((ev: string) => { if (ev === "SIGNED_IN") setTimeout(check, 0) })
        return () => s.subscription.unsubscribe()
    }, [db, check])

    async function login(e: React.FormEvent) {
        e.preventDefault()
        const { error } = await db.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo: window.location.origin + window.location.pathname, shouldCreateUser: false } })
        setMsg(error ? "Could not send a link to that address." : "Link sent. Open it on this device.")
    }

    const css = `.fys{--paper:${p.paper};--ink:${p.ink};--accent:${p.accent};background:var(--paper);color:var(--ink);min-height:100%;width:100%;font-family:Inter,system-ui,sans-serif;box-sizing:border-box;padding:clamp(18px,4vw,56px)}
    .fys *{box-sizing:border-box}.fys .mono{font:10px ui-monospace,Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;opacity:.65}
    .fys h1{font:400 clamp(30px,5vw,48px) 'Cormorant Garamond',Georgia,serif;margin:6px 0 20px}
    .fys button{font:inherit;cursor:pointer}.fys .b{background:var(--ink);color:var(--paper);border:0;padding:10px 16px;font-size:11px;letter-spacing:.16em;text-transform:uppercase}
    .fys .b.g{background:transparent;color:var(--ink);border:.5px solid var(--ink)}
    .fys input,.fys select{background:transparent;border:0;border-bottom:.5px solid var(--ink);padding:10px 2px;font:inherit;font-size:16px;color:inherit;outline:none;min-width:0}
    .fys .c{border:.5px solid color-mix(in srgb,var(--ink) 45%,transparent);padding:16px;margin-bottom:12px;background:rgba(255,255,255,.35)}
    .fys .r{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
    .fys table{border-collapse:collapse;width:100%;font-size:13px}.fys th{font:10px ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;text-align:left;opacity:.65;padding:6px 8px;border-bottom:.5px solid var(--ink)}.fys td{padding:8px;border-bottom:.5px solid color-mix(in srgb,var(--ink) 20%,transparent);vertical-align:top}.fys .tw{overflow-x:auto}.fys textarea,.fys select{background:transparent;border-bottom:.5px solid var(--ink);border-top:0;border-left:0;border-right:0;font:inherit;font-size:16px;color:inherit}@media(max-width:700px){.fys .b{min-height:42px}.fys .r>*{flex:1 1 auto}}.fys .gr{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}`

    if (state !== "ok")
        return (
            <div className="fys" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
                <style>{css}</style>
                <form onSubmit={login} className="c" style={{ width: "min(440px,100%)" }}>
                    <div className="mono">Studio only</div>
                    <h1>Console</h1>
                    {state === "denied" && <p>That account isn't on the studio list.</p>}
                    <input type="email" required placeholder="Studio email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%" }} />
                    <div className="r" style={{ marginTop: 16 }}><button className="b" type="submit">Send sign-in link</button></div>
                    {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
                </form>
            </div>
        )

    return (
        <div className="fys">
            <style>{css}</style>
            <div className="r" style={{ justifyContent: "space-between" }}>
                <div><div className="mono">FELEMAYE · Studio</div><h1>Console</h1></div>
                <div className="r">
                    {["clients", "meetings", "time", "reimbursables", "ffe", "calendar", "permits", "survey images"].map((t) => <button key={t} className={"b" + (tab === t ? "" : " g")} onClick={() => setTab(t)}>{t}</button>)}
                    <button className="b g" onClick={() => db.auth.signOut().then(check)}>Sign out</button>
                </div>
            </div>
            {tab === "clients" ? <Clients db={db} portalUrl={p.portalUrl} supabaseUrl={p.supabaseUrl} /> : tab === "meetings" ? <Meetings db={db} /> : tab === "time" ? <TimeTracker db={db} /> : tab === "reimbursables" ? <Reimbursables db={db} /> : tab === "ffe" ? <FFEManager db={db} /> : tab === "calendar" ? <CalendarManager db={db} /> : tab === "permits" ? <PermitManager db={db} /> : <SurveyImages db={db} supabaseUrl={p.supabaseUrl} />}
        </div>
    )
}

function Clients({ db, portalUrl, supabaseUrl }: any) {
    const [upCat, setUpCat] = React.useState("auto")
    const [rows, setRows] = React.useState<any[]>([])
    const [sel, setSel] = React.useState<any>(null)
    const [detail, setDetail] = React.useState<any>(null)
    const [f, setF] = React.useState({ name: "", email: "", phone: "", address: "", retainer: false })
    const [note, setNote] = React.useState("")
    const fileRef = React.useRef<HTMLInputElement>(null)
    const load = async () => { const { data, error } = await db.from("studio_overview").select("*").order("created_at", { ascending: false }); if (error) { setNote("Couldn't load clients: " + error.message + ". Sign out and sign back in."); } setRows(data || []) }
    React.useEffect(() => { load() }, [])

    async function add(e: React.FormEvent) {
        e.preventDefault()
        const { data, error } = await db.rpc("studio_add_client", { p_name: f.name, p_email: f.email, p_phone: f.phone || null, p_address: f.address || null, p_role: "client", p_notes: null, p_retainer: f.retainer, p_send: f.retainer })
        setNote(error ? (/studio only/i.test(error.message) ? "Your sign-in expired. Sign out, then send yourself a new link." : error.message) : `Created ${data?.[0]?.client_id}. ${f.retainer ? "Credentials emailed." : "Mark the retainer paid to release credentials."}`)
        setF({ name: "", email: "", phone: "", address: "", retainer: false }); load()
    }
    async function retainer(c: any) { await db.rpc("studio_set_retainer", { p_client: c.client_id, p_paid: !c.retainer_paid }); load() }
    async function resend(c: any) { const { error } = await db.rpc("studio_resend_credentials", { p_client: c.client_id }); setNote(error ? error.message : `Credentials re-sent to ${c.email}.`) }
    async function inspect(c: any) {
        setSel(c)
        const [ph, dl, fl, act] = await Promise.all([
            db.from("phases").select("*").eq("project_id", c.project_id).order("seq"),
            db.from("deliverables").select("*").eq("project_id", c.project_id).order("created_at"),
            db.from("project_files").select("*").eq("project_id", c.project_id),
            db.from("project_activity").select("*").eq("project_id", c.project_id).order("created_at", { ascending: false }).limit(10),
        ])
        setDetail({ ph: ph.data || [], dl: dl.data || [], fl: fl.data || [], act: act.data || [] })
    }
    async function setEmail(c: any) {
        const v = prompt("Client email address", c.email || "")
        if (v === null) return
        const em = v.trim().toLowerCase()
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { setNote("That doesn't look like an email."); return }
        const { error } = await db.rpc("studio_set_email", { p_client: c.client_id, p_email: em })
        setNote(error ? error.message : `Email saved for ${c.client_name}. Now press Resend key.`); load()
    }
    async function setPlaylist(c: any) {
        const v = prompt("Spotify playlist ID or URL", c.playlist_id || "")
        if (v === null) return
        const id = (v.match(/playlist\/([A-Za-z0-9]+)/)?.[1] || v).trim()
        await db.from("projects").update({ playlist_id: id }).eq("id", c.project_id); load()
    }
    async function phaseStatus(ph: any, status: string) { await db.from("phases").update({ status }).eq("id", ph.id); inspect(sel) }
    async function addDeliverable(ph: any) {
        const title = prompt("Deliverable title"); if (!title) return
        await db.from("deliverables").insert({ project_id: sel.project_id, phase_id: ph.id, title, kind: "document", status: "pending" }); inspect(sel)
    }
    async function uploadStudioFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]; if (!file || !sel) return
        if (!sel.project_id) { setNote("This client has no project yet, so there is nowhere to file it. Use the Lorado Courtyard row."); e.target.value = ""; return }
        const path = `${sel.project_id}/studio/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_")}`
        setNote("Uploading " + file.name + "…")
        const { error } = await db.storage.from("project-files").upload(path, file)
        if (error) { setNote("Upload failed: " + error.message); return }
        const { error: e2 } = await db.from("project_files").insert({ project_id: sel.project_id, path, name: file.name, size_bytes: file.size, direction: "studio", category: upCat === "auto" ? guessCat(file.name) : upCat })
        setNote(e2 ? "Saved file but could not list it: " + e2.message : file.name + " is now in " + sel.client_name + "'s Files tab.")
        e.target.value = ""
        inspect(sel)
    }

    return (
        <div>
            <form onSubmit={add} className="c">
                <div className="mono">Add client</div>
                <div className="r" style={{ marginTop: 8 }}>
                    <input required placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
                    <input required type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
                    <input placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
                    <input placeholder="Project address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
                    <label className="mono"><input type="checkbox" checked={f.retainer} onChange={(e) => setF({ ...f, retainer: e.target.checked })} /> retainer paid</label>
                    <button className="b" type="submit">Create</button>
                </div>
                {note && <p style={{ fontSize: 13 }}>{note}</p>}
            </form>
            {rows.map((c) => (
                <div key={c.client_id} className="c">
                    <div className="r" style={{ justifyContent: "space-between" }}>
                        <div><b>{c.client_name}</b> <span style={{ opacity: 0.55 }}>· {c.project_title} · {c.email}</span>
                            <div className="mono" style={{ marginTop: 4 }}>stage {c.portal_stage} · phase {c.current_phase} · {c.pending_items} pending · {c.change_requests} revisions · {c.open_meetings} meetings</div></div>
                        <div className="r">
                            <button className="b g" onClick={() => retainer(c)}>{c.retainer_paid ? "Retainer ✓" : "Mark retainer paid"}</button>
                            <button className="b g" onClick={() => setEmail(c)}>{c.email ? "Edit email" : "⚠ Set email"}</button>
                            <button className="b g" onClick={() => resend(c)}>Resend key</button>
                            <button className="b g" onClick={() => setPlaylist(c)}>Playlist</button>
                            <button className="b" onClick={() => inspect(c)}>Inspect</button>
                            <a className="b" style={{ textDecoration: "none" }} href={`${portalUrl}?preview=${c.client_id}`} target="_blank" rel="noopener">See as client ↗</a>
                            <a className="b g" style={{ textDecoration: "none" }} href={`${portalUrl}?preview=${c.client_id}&stage=survey`} target="_blank" rel="noopener">Survey view ↗</a>
                        </div>
                    </div>
                </div>
            ))}
            {sel && detail && (
                <div className="c" style={{ borderColor: "var(--accent)" }}>
                    <div className="r" style={{ justifyContent: "space-between" }}>
                        <div><div className="mono">What {sel.client_name} sees — {sel.project_title}</div>{note && <div style={{ fontSize: 13, marginTop: 4 }}>{note}</div>}</div>
                        <span className="r"><select aria-label="Folder" value={upCat} onChange={(e) => setUpCat(e.target.value)}><option value="auto">Folder: auto</option>{FILE_CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><input ref={fileRef} type="file" style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} onChange={uploadStudioFile} /><button className="b g" onClick={() => fileRef.current?.click()}>Upload to client</button></span>
                    </div>
                    {detail.ph.map((ph: any) => (
                        <div key={ph.id} style={{ borderTop: ".5px solid var(--ink)", padding: "10px 0", opacity: ph.status === "locked" ? 0.5 : 1 }}>
                            <div className="r" style={{ justifyContent: "space-between" }}>
                                <span>Phase {ph.seq} · {ph.title} <span className="mono">[{ph.status}]</span></span>
                                <span className="r">
                                    <select value={ph.status} onChange={(e) => phaseStatus(ph, e.target.value)}>{["locked", "active", "in_review", "approved"].map((s) => <option key={s}>{s}</option>)}</select>
                                    {ph.status === "active" && <button className="b" onClick={() => phaseStatus(ph, "in_review")}>Send for client review</button>}
                                    <button className="b g" onClick={() => addDeliverable(ph)}>+ deliverable</button>
                                </span>
                            </div>
                            <Checklist ph={ph} items={detail.dl.filter((d: any) => d.phase_id === ph.id && d.kind === "other" && !String(d.title).startsWith("__"))} notion={detail.dl.find((d: any) => d.phase_id === ph.id && d.title === "__notion__")} db={db} refresh={() => inspect(sel)} projectId={sel.project_id} />
                            {detail.dl.filter((d: any) => d.phase_id === ph.id && d.kind !== "other").map((d: any) => (
                                <div key={d.id} style={{ fontSize: 13, paddingLeft: 14, opacity: 0.8 }}>— {d.title} <span className="mono">[{d.status}]</span>{d.client_comment ? ` “${d.client_comment}”` : ""}</div>
                            ))}
                        </div>
                    ))}
                    <Extras db={db} sel={sel} supabaseUrl={supabaseUrl} />
                    <div className="mono" style={{ marginTop: 12 }}>Files {detail.fl.length} · Recent: {detail.act.map((a: any) => a.action).join(", ") || "none"}</div>
                </div>
            )}
        </div>
    )
}


const FILE_CATS: [string, string][] = [["meeting_notes", "Meeting Notes"], ["submittals", "Submittals"], ["presentations", "Presentations"], ["images", "Images"], ["drawings", "Drawings & Models"], ["documents", "Contracts & Documents"], ["other", "Other"]]
const guessCat = (name: string) => (/\.(png|jpe?g|gif|webp|heic|avif|tiff?)$/i.test(name) ? "images" : /\.(pptx?|key)$/i.test(name) ? "presentations" : /\.(dwg|dxf|rvt|skp|3dm|obj|ifc)$/i.test(name) ? "drawings" : /\.(docx?|pdf|txt|xlsx?)$/i.test(name) ? "documents" : "other")

/* Project directory manager + Mattoboard snapshot, per selected project */
function Extras({ db, sel, supabaseUrl }: any) {
    const [rows, setRows] = React.useState<any[]>([])
    const [f, setF] = React.useState({ full_name: "", role: "", company: "", email: "", phone: "" })
    const [msg, setMsg] = React.useState("")
    const snapRef = React.useRef<HTMLInputElement>(null)
    const load = async () => { const { data, error } = await db.from("project_directory").select("*").eq("project_id", sel.project_id).order("seq").order("created_at"); if (error) setMsg(error.message); setRows(data || []) }
    React.useEffect(() => { if (sel?.project_id) load() }, [sel?.project_id])
    async function add(e: React.FormEvent) {
        e.preventDefault()
        const { error } = await db.from("project_directory").insert({ project_id: sel.project_id, ...f, seq: rows.length + 1 })
        setMsg(error ? error.message : `${f.full_name} added to the directory.`)
        if (!error) setF({ full_name: "", role: "", company: "", email: "", phone: "" }); load()
    }
    async function remove(r: any) { if (!confirm(`Remove ${r.full_name} from the directory?`)) return; const { error } = await db.from("project_directory").delete().eq("id", r.id); setMsg(error ? error.message : "Removed."); load() }
    async function snap(file: File) {
        setMsg("Uploading snapshot…")
        const { data: b } = await db.from("moodboards").select("id").eq("project_id", sel.project_id).order("seq").limit(1)
        const path = `board-${sel.project_id}-${Date.now()}.${(file.name.split(".").pop() || "png").toLowerCase()}`
        const { error } = await db.storage.from("survey-assets").upload(path, file, { contentType: file.type || "image/png" })
        if (error) return setMsg("Upload failed: " + error.message)
        const url = `${supabaseUrl}/storage/v1/object/public/survey-assets/${path}`
        const { error: e2 } = await db.from("moodboard_items").insert({ board_id: b?.[0]?.id, project_id: sel.project_id, kind: "image", url, caption: "Material board · " + new Date().toLocaleDateString(), added_by: "studio" })
        setMsg(e2 ? "Saved image but could not post it: " + e2.message : "Snapshot posted. It now heads the client's Mood Boards tab.")
    }
    return (
        <div style={{ borderTop: ".5px solid var(--ink)", marginTop: 14, paddingTop: 12 }}>
            <div className="r" style={{ justifyContent: "space-between" }}>
                <div className="mono">Project directory · shown to the client</div>
                <span><input ref={snapRef} type="file" accept="image/*" style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} onChange={(e) => { const x = e.target.files?.[0]; if (x) snap(x); e.target.value = "" }} /><button className="b g" onClick={() => snapRef.current?.click()}>Post Mattoboard snapshot</button></span>
            </div>
            {rows.map((r) => (
                <div key={r.id} className="r" style={{ justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
                    <span><b>{r.full_name}</b> · {r.role}{r.company ? ` · ${r.company}` : ""} · {r.email || "no email"} · {r.phone || "no phone"}</span>
                    <button className="b g" onClick={() => remove(r)}>×</button>
                </div>
            ))}
            <form onSubmit={add} className="r" style={{ marginTop: 8 }}>
                <input required placeholder="Full name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
                <input required placeholder="Role (e.g. Structural Engineer)" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} />
                <input placeholder="Company" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
                <input type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
                <input placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
                <button className="b" type="submit">Add</button>
            </form>
            {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
        </div>
    )
}

/* Meeting requests inbox — every client request lands here AND in your email. */
function Meetings({ db }: any) {
    const [rows, setRows] = React.useState<any[]>([])
    const [msg, setMsg] = React.useState("")
    const load = async () => {
        const { data, error } = await db.from("meeting_requests").select("*, projects(title)").order("created_at", { ascending: false }).limit(50)
        if (error) setMsg(error.message); setRows(data || [])
    }
    React.useEffect(() => { load() }, [])
    async function setStatus(r: any, status: string) { const { error } = await db.from("meeting_requests").update({ status }).eq("id", r.id); setMsg(error ? error.message : `Marked ${status}.`); load() }
    return (
        <div>
            <p style={{ maxWidth: 640, lineHeight: 1.7, fontSize: 14 }}>Each client request is emailed to you and filed here. Confirm by sending a calendar invite, then mark it confirmed.</p>
            {msg && <p style={{ fontSize: 13, fontWeight: 600 }}>{msg}</p>}
            {rows.map((r) => (
                <div key={r.id} className="c">
                    <div className="r" style={{ justifyContent: "space-between" }}>
                        <div><b>{r.topic}</b> <span style={{ opacity: 0.55 }}>· {r.projects?.title} · {r.requested_by} · {r.duration_min} min</span>
                            <div className="mono" style={{ marginTop: 4 }}>{r.status} · {new Date(r.created_at).toLocaleString()}</div></div>
                        <div className="r">
                            <button className="b g" onClick={() => setStatus(r, "confirmed")}>Confirm</button>
                            <button className="b g" onClick={() => setStatus(r, "declined")}>Decline</button>
                        </div>
                    </div>
                    <div style={{ fontSize: 13, marginTop: 8 }}>{(Array.isArray(r.preferred_slots) ? r.preferred_slots : []).map((s: any) => s.label || s.start).join("  ·  ")}</div>
                    {r.notes && <div style={{ fontSize: 13, marginTop: 6, opacity: 0.8 }}>“{r.notes}”</div>}
                </div>
            ))}
            {!rows.length && <p className="mono">No requests yet.</p>}
        </div>
    )
}

const csvDownload = (name: string, rows: any[][]) => {
    const esc = (v: any) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t }
    const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click()
}
const money = (n: number) => "$" + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function useProjects(db: any) {
    const [list, setList] = React.useState<any[]>([])
    React.useEffect(() => { db.from("projects").select("id,title").order("title").then(({ data }: any) => setList(data || [])) }, [])
    return list
}
const TIME_CATS = ["design", "drawings / CAD", "client meeting", "site visit", "procurement / sourcing", "coordination", "admin / business", "research / writing"]

/* Hours tracking — your own time, by project, billable or not, with a running timer */
function TimeTracker({ db }: any) {
    const projects = useProjects(db)
    const [rows, setRows] = React.useState<any[]>([])
    const [msg, setMsg] = React.useState("")
    const [month, setMonth] = React.useState(new Date().toISOString().slice(0, 7))
    const [f, setF] = React.useState({ work_date: new Date().toISOString().slice(0, 10), project_id: "", category: TIME_CATS[0], description: "", hours: "", billable: true })
    const [rate, setRate] = React.useState<string>(() => { try { return localStorage.getItem("fy_rate") || "" } catch { return "" } })
    const [timerStart, setTimerStart] = React.useState<number>(() => { try { return Number(localStorage.getItem("fy_timer") || 0) } catch { return 0 } })
    const [tick, setTick] = React.useState(0)
    React.useEffect(() => { if (!timerStart) return; const i = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(i) }, [timerStart])
    const load = async () => {
        const from = month + "-01", to = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1).toISOString().slice(0, 10)
        const { data, error } = await db.from("studio_time_entries").select("*").gte("work_date", from).lt("work_date", to).order("work_date", { ascending: false }).order("created_at", { ascending: false })
        if (error) setMsg(error.message); setRows(data || [])
    }
    React.useEffect(() => { load() }, [month])
    const pname = (id: string) => projects.find((p) => p.id === id)?.title || "Studio / no project"
    function startStop() {
        if (!timerStart) { const t = Date.now(); setTimerStart(t); try { localStorage.setItem("fy_timer", String(t)) } catch {} return }
        const hrs = Math.max(0.05, (Date.now() - timerStart) / 3600000)
        setF({ ...f, hours: (Math.round(hrs * 4) / 4 || 0.25).toString() }); setTimerStart(0); try { localStorage.removeItem("fy_timer") } catch {}
        setMsg("Timer stopped. Add a description and save the entry.")
    }
    async function save(e: React.FormEvent) {
        e.preventDefault()
        const minutes = Math.round(parseFloat(f.hours) * 60)
        if (!minutes || minutes < 1) { setMsg("Enter hours, e.g. 1.5"); return }
        try { localStorage.setItem("fy_rate", rate) } catch {}
        const { data: u } = await db.auth.getUser()
        const { error } = await db.from("studio_time_entries").insert({ work_date: f.work_date, project_id: f.project_id || null, category: f.category, description: f.description, minutes, billable: f.billable, rate: Number(rate) || 0, entered_by: u?.user?.email })
        setMsg(error ? error.message : "Saved."); if (!error) setF({ ...f, description: "", hours: "" }); load()
    }
    async function del(r: any) { if (!confirm("Delete this entry?")) return; const { error } = await db.from("studio_time_entries").delete().eq("id", r.id); setMsg(error ? error.message : "Deleted."); load() }
    const hrs = (r: any) => r.minutes / 60
    const total = rows.reduce((a, r) => a + hrs(r), 0)
    const bill = rows.filter((r) => r.billable).reduce((a, r) => a + hrs(r), 0)
    const value = rows.filter((r) => r.billable).reduce((a, r) => a + hrs(r) * Number(r.rate || 0), 0)
    const byProj: Record<string, { h: number; b: number; v: number }> = {}
    rows.forEach((r) => { const k = pname(r.project_id); byProj[k] = byProj[k] || { h: 0, b: 0, v: 0 }; byProj[k].h += hrs(r); if (r.billable) { byProj[k].b += hrs(r); byProj[k].v += hrs(r) * Number(r.rate || 0) } })
    const elapsed = timerStart ? Math.floor((Date.now() - timerStart) / 1000) : 0
    const clock = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
    return (
        <div>
            <p style={{ maxWidth: 680, lineHeight: 1.7, fontSize: 14 }}>Log your own hours by project. Start the timer while you work, or type hours in afterwards. Rate is your billing rate for the entry (it is remembered on this device). Switch to the reimbursables tab for out-of-pocket costs.</p>
            <div className="c r" style={{ justifyContent: "space-between" }}>
                <div><div className="mono">Timer</div><div style={{ fontSize: 30, fontFamily: "ui-monospace,Menlo,monospace" }} data-tick={tick}>{timerStart ? clock : "00:00:00"}</div></div>
                <button className="b" onClick={startStop}>{timerStart ? "Stop timer" : "Start timer"}</button>
            </div>
            <form onSubmit={save} className="c">
                <div className="mono">Add time</div>
                <div className="r" style={{ marginTop: 8 }}>
                    <input type="date" required value={f.work_date} onChange={(e) => setF({ ...f, work_date: e.target.value })} />
                    <select value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}><option value="">Studio / no project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
                    <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{TIME_CATS.map((c) => <option key={c}>{c}</option>)}</select>
                    <input required placeholder="What did you do?" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} style={{ flex: "2 1 240px" }} />
                    <input required inputMode="decimal" placeholder="Hours (1.5)" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} style={{ width: 110 }} />
                    <input inputMode="decimal" placeholder="Rate $/hr" value={rate} onChange={(e) => setRate(e.target.value)} style={{ width: 110 }} />
                    <label className="mono"><input type="checkbox" checked={f.billable} onChange={(e) => setF({ ...f, billable: e.target.checked })} /> billable</label>
                    <button className="b" type="submit">Save entry</button>
                </div>
                {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
            </form>
            <div className="c">
                <div className="r" style={{ justifyContent: "space-between" }}>
                    <div className="r"><span className="mono">Month</span><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
                    <button className="b g" onClick={() => csvDownload(`${month}_FELEMAYE_Time.csv`, [["Date", "Project", "Category", "Description", "Hours", "Billable", "Rate", "Value"], ...rows.map((r) => [r.work_date, pname(r.project_id), r.category, r.description, hrs(r).toFixed(2), r.billable ? "yes" : "no", r.rate, r.billable ? (hrs(r) * Number(r.rate || 0)).toFixed(2) : "0.00"])])}>Export CSV</button>
                </div>
                <div className="r" style={{ margin: "12px 0", gap: 28 }}>
                    <div><div className="mono">Total hours</div><b style={{ fontSize: 22 }}>{total.toFixed(2)}</b></div>
                    <div><div className="mono">Billable hours</div><b style={{ fontSize: 22 }}>{bill.toFixed(2)}</b></div>
                    <div><div className="mono">Billable value</div><b style={{ fontSize: 22 }}>{money(value)}</b></div>
                </div>
                <div className="tw"><table><thead><tr><th>Project</th><th>Hours</th><th>Billable</th><th>Value</th></tr></thead><tbody>{Object.entries(byProj).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.h.toFixed(2)}</td><td>{v.b.toFixed(2)}</td><td>{money(v.v)}</td></tr>)}</tbody></table></div>
            </div>
            <div className="c tw">
                <table><thead><tr><th>Date</th><th>Project</th><th>Task</th><th>Hours</th><th>$</th><th /></tr></thead>
                    <tbody>{rows.map((r) => <tr key={r.id}><td>{r.work_date}</td><td>{pname(r.project_id)}</td><td>{r.description}<div className="mono">{r.category}{r.billable ? "" : " · non-billable"}</div></td><td>{hrs(r).toFixed(2)}</td><td>{r.billable ? money(hrs(r) * Number(r.rate || 0)) : "—"}</td><td><button className="b g" onClick={() => del(r)}>×</button></td></tr>)}</tbody></table>
                {!rows.length && <p className="mono">No entries this month.</p>}
            </div>
        </div>
    )
}

const REIMB_CATS = ["materials / samples", "printing / plotting", "travel / mileage", "meals", "shipping / freight", "software / subscriptions", "consultant", "permits / fees", "other"]
const REIMB_STATUS = ["logged", "invoiced", "reimbursed", "written_off"]

/* Reimbursables — out-of-pocket costs, markup, receipts, billing status */
function Reimbursables({ db }: any) {
    const projects = useProjects(db)
    const [rows, setRows] = React.useState<any[]>([])
    const [msg, setMsg] = React.useState("")
    const [month, setMonth] = React.useState("all")
    const [f, setF] = React.useState({ spent_on: new Date().toISOString().slice(0, 10), project_id: "", vendor: "", category: REIMB_CATS[0], description: "", amount: "", markup_pct: "0", billable: true })
    const fileRef = React.useRef<HTMLInputElement>(null)
    const [receipt, setReceipt] = React.useState<File | null>(null)
    const load = async () => { const { data, error } = await db.from("studio_reimbursables").select("*").order("spent_on", { ascending: false }).order("created_at", { ascending: false }); if (error) setMsg(error.message); setRows(data || []) }
    React.useEffect(() => { load() }, [])
    const pname = (id: string) => projects.find((p) => p.id === id)?.title || "Studio / no project"
    async function save(e: React.FormEvent) {
        e.preventDefault()
        const amount = parseFloat(f.amount)
        if (!amount || amount <= 0) { setMsg("Enter the amount."); return }
        let path: string | null = null
        if (receipt) {
            // Naming rule from the studio standard: YYYY-MM-DD_Vendor_Amount
            const ext = (receipt.name.split(".").pop() || "pdf").toLowerCase()
            path = `studio/receipts/${f.spent_on}_${f.vendor.replace(/[^\w]+/g, "-")}_${amount.toFixed(2)}.${ext}`
            const { error: ue } = await db.storage.from("project-files").upload(path, receipt, { upsert: true })
            if (ue) { setMsg("Receipt upload failed: " + ue.message); return }
        }
        const { data: u } = await db.auth.getUser()
        const { error } = await db.from("studio_reimbursables").insert({ spent_on: f.spent_on, project_id: f.project_id || null, vendor: f.vendor, category: f.category, description: f.description || null, amount, markup_pct: Number(f.markup_pct) || 0, billable: f.billable, receipt_path: path, entered_by: u?.user?.email })
        setMsg(error ? error.message : "Saved."); if (!error) { setF({ ...f, vendor: "", description: "", amount: "" }); setReceipt(null) } load()
    }
    async function setStatus(r: any, status: string) { if ((status === "invoiced" || status === "reimbursed") && r.billable && Number(r.amount) > 250 && r.client_auth_status !== "authorized") { await db.from("studio_reimbursables").update({ client_auth_status: "requested" }).eq("id", r.id); setMsg("Over $250: the client must approve this in writing first. It now shows PENDING WRITTEN APPROVAL in their Ledger."); load(); return } const { error } = await db.from("studio_reimbursables").update({ status }).eq("id", r.id); if (error) setMsg(error.message); load() }
    async function del(r: any) { if (!confirm("Delete this entry?")) return; const { error } = await db.from("studio_reimbursables").delete().eq("id", r.id); setMsg(error ? error.message : "Deleted."); load() }
    async function openReceipt(r: any) { const { data } = await db.storage.from("project-files").createSignedUrl(r.receipt_path, 300); if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener") }
    const shown = month === "all" ? rows : rows.filter((r) => String(r.spent_on).startsWith(month))
    const billAmt = (r: any) => (r.billable ? Number(r.amount) * (1 + Number(r.markup_pct || 0) / 100) : 0)
    const spent = shown.reduce((a, r) => a + Number(r.amount), 0)
    const billable = shown.reduce((a, r) => a + billAmt(r), 0)
    const outstanding = shown.filter((r) => r.billable && r.status === "logged").reduce((a, r) => a + billAmt(r), 0)
    const group = (key: (r: any) => string) => { const m: Record<string, { s: number; b: number }> = {}; shown.forEach((r) => { const k = key(r); m[k] = m[k] || { s: 0, b: 0 }; m[k].s += Number(r.amount); m[k].b += billAmt(r) }); return Object.entries(m) }
    return (
        <div>
            <p style={{ maxWidth: 680, lineHeight: 1.7, fontSize: 14 }}>Log every out-of-pocket cost against its project, add any markup, attach the receipt, and track whether it has been invoiced or reimbursed. "Outstanding" is billable cost you have paid but not yet invoiced to the client. Receipts are filed as YYYY-MM-DD_Vendor_Amount.</p>
            <form onSubmit={save} className="c">
                <div className="mono">Add reimbursable</div>
                <div className="r" style={{ marginTop: 8 }}>
                    <input type="date" required value={f.spent_on} onChange={(e) => setF({ ...f, spent_on: e.target.value })} />
                    <select value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}><option value="">Studio / no project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
                    <input required placeholder="Vendor" value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} />
                    <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{REIMB_CATS.map((c) => <option key={c}>{c}</option>)}</select>
                    <input placeholder="Note (optional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} style={{ flex: "2 1 220px" }} />
                    <input required inputMode="decimal" placeholder="Amount $" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} style={{ width: 110 }} />
                    <input inputMode="decimal" placeholder="Markup %" value={f.markup_pct} onChange={(e) => setF({ ...f, markup_pct: e.target.value })} style={{ width: 100 }} />
                    <label className="mono"><input type="checkbox" checked={f.billable} onChange={(e) => setF({ ...f, billable: e.target.checked })} /> billable to client</label>
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} onChange={(e) => setReceipt(e.target.files?.[0] || null)} />
                    <button type="button" className="b g" onClick={() => fileRef.current?.click()}>{receipt ? receipt.name.slice(0, 22) : "Attach receipt"}</button>
                    <button className="b" type="submit">Save</button>
                </div>
                {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
            </form>
            <div className="c">
                <div className="r" style={{ justifyContent: "space-between" }}>
                    <div className="r"><span className="mono">Show</span><select value={month} onChange={(e) => setMonth(e.target.value)}><option value="all">All time</option>{Array.from(new Set(rows.map((r) => String(r.spent_on).slice(0, 7)))).map((m) => <option key={m}>{m}</option>)}</select></div>
                    <button className="b g" onClick={() => csvDownload("FELEMAYE_Reimbursables.csv", [["Date", "Project", "Vendor", "Category", "Note", "Amount", "Markup %", "Billable total", "Billable", "Status"], ...shown.map((r) => [r.spent_on, pname(r.project_id), r.vendor, r.category, r.description, Number(r.amount).toFixed(2), r.markup_pct, billAmt(r).toFixed(2), r.billable ? "yes" : "no", r.status])])}>Export CSV</button>
                </div>
                <div className="r" style={{ margin: "12px 0", gap: 28 }}>
                    <div><div className="mono">Spent</div><b style={{ fontSize: 22 }}>{money(spent)}</b></div>
                    <div><div className="mono">Billable incl. markup</div><b style={{ fontSize: 22 }}>{money(billable)}</b></div>
                    <div><div className="mono">Outstanding to invoice</div><b style={{ fontSize: 22 }}>{money(outstanding)}</b></div>
                </div>
                <div className="tw"><table><thead><tr><th>By project</th><th>Spent</th><th>Billable</th></tr></thead><tbody>{group((r) => pname(r.project_id)).map(([k, v]) => <tr key={k}><td>{k}</td><td>{money(v.s)}</td><td>{money(v.b)}</td></tr>)}</tbody></table></div>
                <div className="tw" style={{ marginTop: 12 }}><table><thead><tr><th>By category</th><th>Spent</th><th>Billable</th></tr></thead><tbody>{group((r) => r.category).map(([k, v]) => <tr key={k}><td>{k}</td><td>{money(v.s)}</td><td>{money(v.b)}</td></tr>)}</tbody></table></div>
            </div>
            <div className="c tw">
                <table><thead><tr><th>Date</th><th>Project</th><th>Vendor</th><th>Amount</th><th>Billable</th><th>Status</th><th /></tr></thead>
                    <tbody>{shown.map((r) => <tr key={r.id}><td>{r.spent_on}</td><td>{pname(r.project_id)}</td><td>{r.vendor}<div className="mono">{r.category}{r.description ? " · " + r.description : ""}</div>{r.receipt_path && <a className="mono" style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => openReceipt(r)}>receipt ↗</a>}</td><td>{money(Number(r.amount))}</td><td>{r.billable ? money(billAmt(r)) : "—"}{Number(r.markup_pct) ? <div className="mono">+{r.markup_pct}%</div> : null}</td><td><select value={r.status} onChange={(e) => setStatus(r, e.target.value)}>{REIMB_STATUS.map((s) => <option key={s}>{s}</option>)}</select></td><td><button className="b g" onClick={() => del(r)}>×</button></td></tr>)}</tbody></table>
                {!shown.length && <p className="mono">Nothing logged yet.</p>}
            </div>
        </div>
    )
}

/* ───────────── FF&E procurement (private: trade price, markup, vendor contact, internal lead notes) ───────────── */
const FFE_STATES = ["proposed", "approved", "revision_requested", "declined", "ordered", "delivered"]
function FFEManager({ db }: any) {
    const projects = useProjects(db)
    const [pid, setPid] = React.useState("")
    const [rows, setRows] = React.useState<any[]>([])
    const [msg, setMsg] = React.useState("")
    const blank = { room: "", item: "", vendor: "", vendor_contact: "", sku: "", qty: "1", trade_price: "", markup_pct: "30", lead_time_weeks: "", internal_lead_notes: "", cut_sheet_url: "", image_url: "" }
    const [f, setF] = React.useState<any>(blank)
    React.useEffect(() => { if (!pid && projects[0]) setPid(projects[0].id) }, [projects])
    const load = async () => { if (!pid) return; const { data, error } = await db.from("procurement_ffe").select("*").eq("project_id", pid).order("room").order("created_at"); if (error) setMsg(error.message); setRows(data || []) }
    React.useEffect(() => { load() }, [pid])
    const clientPrice = (trade: number, mk: number) => Math.round(trade * (1 + mk / 100) * 100) / 100
    async function add(e: React.FormEvent) {
        e.preventDefault()
        const trade = parseFloat(f.trade_price), mk = parseFloat(f.markup_pct) || 0
        if (!pid || !f.item) { setMsg("Choose a project and name the item."); return }
        const { error } = await db.from("procurement_ffe").insert({ project_id: pid, room: f.room || null, item: f.item, vendor: f.vendor || null, vendor_contact: f.vendor_contact || null, sku: f.sku || null, qty: parseInt(f.qty) || 1, trade_price: isNaN(trade) ? null : trade, markup_pct: mk, client_price: isNaN(trade) ? null : clientPrice(trade, mk), lead_time_weeks: f.lead_time_weeks ? parseInt(f.lead_time_weeks) : null, internal_lead_notes: f.internal_lead_notes || null, cut_sheet_url: f.cut_sheet_url ? (f.cut_sheet_url.startsWith("http") ? f.cut_sheet_url : f.cut_sheet_url) : null, image_url: f.image_url || null })
        setMsg(error ? error.message : "Added. The client sees it as 'For your review' with the client price only."); if (!error) setF({ ...blank, room: f.room }); load()
    }
    async function setState(r: any, client_status: string) { const { error } = await db.from("procurement_ffe").update({ client_status }).eq("id", r.id); if (error) setMsg(error.message); load() }
    const tot = (k: string) => rows.filter((r) => r.client_status !== "declined").reduce((a, r) => a + Number(r[k] || 0) * (r.qty || 1), 0)
    const margin = tot("client_price") - tot("trade_price")
    return (
        <div>
            <p style={{ maxWidth: 680, lineHeight: 1.7, fontSize: 14 }}>Private catalog. Trade price, markup, vendor contact and internal lead notes live only here. Clients see the client price, lead time, cut sheet and the Approve / Request revision / Decline buttons. Paste a cut-sheet link (https://…) or a Drive share link.</p>
            <div className="r"><select value={pid} onChange={(e) => setPid(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
                <button className="b g" onClick={() => csvDownload("FELEMAYE_FFE.csv", [["Room", "Item", "Vendor", "Qty", "Trade", "Markup %", "Client", "Lead wks", "Status"], ...rows.map((r) => [r.room, r.item, r.vendor, r.qty, r.trade_price, r.markup_pct, r.client_price, r.lead_time_weeks, r.client_status])])}>Export CSV</button></div>
            <form onSubmit={add} className="c">
                <div className="mono">Add item</div>
                <div className="r" style={{ marginTop: 8 }}>
                    <input placeholder="Room" value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} style={{ width: 130 }} />
                    <input required placeholder="Item" value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} style={{ flex: "2 1 200px" }} />
                    <input placeholder="Vendor" value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} />
                    <input placeholder="Vendor contact" value={f.vendor_contact} onChange={(e) => setF({ ...f, vendor_contact: e.target.value })} />
                    <input placeholder="SKU" value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} style={{ width: 100 }} />
                    <input inputMode="numeric" placeholder="Qty" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} style={{ width: 60 }} />
                    <input inputMode="decimal" placeholder="Trade $" value={f.trade_price} onChange={(e) => setF({ ...f, trade_price: e.target.value })} style={{ width: 100 }} />
                    <input inputMode="decimal" placeholder="Markup %" value={f.markup_pct} onChange={(e) => setF({ ...f, markup_pct: e.target.value })} style={{ width: 90 }} />
                    <input inputMode="numeric" placeholder="Lead wks" value={f.lead_time_weeks} onChange={(e) => setF({ ...f, lead_time_weeks: e.target.value })} style={{ width: 90 }} />
                    <input placeholder="Cut sheet link" value={f.cut_sheet_url} onChange={(e) => setF({ ...f, cut_sheet_url: e.target.value })} />
                    <input placeholder="Image link" value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} />
                    <input placeholder="Internal lead notes (private)" value={f.internal_lead_notes} onChange={(e) => setF({ ...f, internal_lead_notes: e.target.value })} style={{ flex: "2 1 220px" }} />
                    <button className="b" type="submit">Add</button>
                </div>
                {f.trade_price && <p className="mono">Client price: {money(clientPrice(parseFloat(f.trade_price) || 0, parseFloat(f.markup_pct) || 0))} each</p>}
                {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
            </form>
            <div className="c">
                <div className="r" style={{ gap: 28 }}>
                    <div><div className="mono">Client total</div><b style={{ fontSize: 22 }}>{money(tot("client_price"))}</b></div>
                    <div><div className="mono">Trade cost</div><b style={{ fontSize: 22 }}>{money(tot("trade_price"))}</b></div>
                    <div><div className="mono">Gross margin</div><b style={{ fontSize: 22 }}>{money(margin)}</b></div>
                </div>
            </div>
            <div className="c tw"><table><thead><tr><th>Room</th><th>Item</th><th>Vendor</th><th>Qty</th><th>Trade</th><th>Client</th><th>Lead</th><th>Status</th></tr></thead>
                <tbody>{rows.map((r) => <tr key={r.id}><td>{r.room}</td><td>{r.item}<div className="mono">{r.sku}{r.internal_lead_notes ? " · " + r.internal_lead_notes : ""}{r.client_note ? " · CLIENT: " + r.client_note : ""}</div></td><td>{r.vendor}<div className="mono">{r.vendor_contact}</div></td><td>{r.qty}</td><td>{money(r.trade_price)}</td><td>{money(r.client_price)}</td><td>{r.lead_time_weeks ? r.lead_time_weeks + " wk" : ""}</td>
                    <td><select value={r.client_status} onChange={(e) => setState(r, e.target.value)}>{FFE_STATES.map((s) => <option key={s}>{s}</option>)}</select></td></tr>)}</tbody></table>
                {!rows.length && <p className="mono">No items yet.</p>}</div>
        </div>
    )
}

/* ───────────── Calendar events shown on the client's Home ("Upcoming") ───────────── */
function CalendarManager({ db }: any) {
    const projects = useProjects(db)
    const [pid, setPid] = React.useState("")
    const [rows, setRows] = React.useState<any[]>([])
    const [msg, setMsg] = React.useState("")
    const [f, setF] = React.useState({ title: "", kind: "site walk", date: "", time: "10:00", mins: "60", location: "", video_url: "", agenda_url: "", notes: "" })
    React.useEffect(() => { if (!pid && projects[0]) setPid(projects[0].id) }, [projects])
    const load = async () => { if (!pid) return; const { data } = await db.from("calendar_events").select("*").eq("project_id", pid).order("starts_at"); setRows(data || []) }
    React.useEffect(() => { load() }, [pid])
    async function add(e: React.FormEvent) {
        e.preventDefault()
        const s = new Date(`${f.date}T${f.time}`); if (isNaN(s.getTime())) { setMsg("Pick a date and time."); return }
        const en = new Date(s.getTime() + (parseInt(f.mins) || 60) * 60000)
        const { error } = await db.from("calendar_events").insert({ project_id: pid, title: f.title, kind: f.kind, starts_at: s.toISOString(), ends_at: en.toISOString(), location: f.location || null, video_url: f.video_url || null, agenda_url: f.agenda_url || null, notes: f.notes || null })
        setMsg(error ? error.message : "Added. It appears on the client's Home under Upcoming."); if (!error) setF({ ...f, title: "", notes: "" }); load()
    }
    return (
        <div>
            <p style={{ maxWidth: 680, lineHeight: 1.7, fontSize: 14 }}>Site walks and reviews shown to the client with a video link, agenda and Add-to-calendar buttons. Times are entered in your local time zone.</p>
            <div className="r"><select value={pid} onChange={(e) => setPid(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
            <form onSubmit={add} className="c">
                <div className="mono">Add event</div>
                <div className="r" style={{ marginTop: 8 }}>
                    <input required placeholder="Title (e.g. Site walk, Concept review)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={{ flex: "2 1 220px" }} />
                    <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{["site walk", "design review", "meeting", "permit", "install"].map((k) => <option key={k}>{k}</option>)}</select>
                    <input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
                    <input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
                    <input inputMode="numeric" placeholder="Minutes" value={f.mins} onChange={(e) => setF({ ...f, mins: e.target.value })} style={{ width: 90 }} />
                    <input placeholder="Location / address" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
                    <input placeholder="Zoom or Meet link" value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })} />
                    <input placeholder="Agenda link" value={f.agenda_url} onChange={(e) => setF({ ...f, agenda_url: e.target.value })} />
                    <input placeholder="Notes for the client" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} style={{ flex: "2 1 220px" }} />
                    <button className="b" type="submit">Add</button>
                </div>
                {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
            </form>
            <div className="c tw"><table><thead><tr><th>When</th><th>Event</th><th>Where</th><th /></tr></thead>
                <tbody>{rows.map((r) => <tr key={r.id}><td>{new Date(r.starts_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</td><td>{r.title}<div className="mono">{r.kind}</div></td><td>{r.location || r.video_url || ""}</td><td><button className="b g" onClick={async () => { if (!confirm("Remove this event?")) return; await db.from("calendar_events").delete().eq("id", r.id); load() }}>Remove</button></td></tr>)}</tbody></table>
                {!rows.length && <p className="mono">Nothing scheduled.</p>}</div>
        </div>
    )
}

/* ───────────── Permit path: set the project's jurisdiction and step the review stages ───────────── */
function PermitManager({ db }: any) {
    const projects = useProjects(db)
    const [pid, setPid] = React.useState("")
    const [d, setD] = React.useState<any>(null)
    const [msg, setMsg] = React.useState("")
    React.useEffect(() => { if (!pid && projects[0]) setPid(projects[0].id) }, [projects])
    const load = async () => { if (!pid) return; const { data, error } = await db.rpc("project_permit", { p_project: pid, p_jur: null }); if (error) setMsg(error.message); setD(data) }
    React.useEffect(() => { load() }, [pid])
    const setJ = async (id: string) => { const { error } = await db.rpc("set_jurisdiction", { p_project: pid, p_jur: id }); setMsg(error ? error.message : "Jurisdiction updated. The client's Permit Path switched stages, links and fees."); load() }
    const step = async (s: string, cur: string) => { const next = cur === "done" ? "" : cur === "active" ? "done" : "active"; await db.rpc("set_permit_stage", { p_project: pid, p_stage: s, p_state: next }); load() }
    const j = d?.jurisdiction || {}
    return (
        <div>
            <p style={{ maxWidth: 680, lineHeight: 1.7, fontSize: 14 }}>Lock the project's jurisdiction with the toggle. Clients never see the municipal switches: their Permit Path shows only the milestones for the jurisdiction you lock here. Tap a stage to cycle Upcoming, In review, Complete.</p>
            <div className="r"><select value={pid} onChange={(e) => setPid(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
            <div className="mono" style={{ margin: "14px 0 6px" }}>Project jurisdiction (locks what the client sees)</div>
            <div role="group" aria-label="Jurisdiction" style={{ display: "inline-flex", flexWrap: "wrap", border: ".5px solid color-mix(in srgb,var(--ink) 35%,transparent)" }}>
                {[["epic_la", "LA County (EPIC / Public Works)"], ["nyc_dob", "NYC (DOB NOW / LPC)"]].map(([id, label], i) => (
                    <button key={id} aria-pressed={d?.current === id} className={"b" + (d?.current === id ? "" : " g")} style={{ borderRadius: 0, border: 0, borderLeft: i ? ".5px solid color-mix(in srgb,var(--ink) 35%,transparent)" : 0, minHeight: 44 }} onClick={() => setJ(id)}>[ {label} ]</button>
                ))}
            </div>
            {(d?.options || []).filter((o: any) => o.id !== "epic_la" && o.id !== "nyc_dob").map((o: any) => <button key={o.id} className={"b" + (o.id === d?.current ? "" : " g")} style={{ marginLeft: 8 }} onClick={() => setJ(o.id)}>{o.label}</button>)}
            {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
            <div className="c"><div className="mono">{j.portal_name}</div>
                {(j.stages || []).map((s: string) => { const st = (d?.progress || {})[s] || ""; return <div key={s} className="r" style={{ justifyContent: "space-between", padding: "10px 0", borderTop: ".5px solid color-mix(in srgb,var(--ink) 20%,transparent)", cursor: "pointer" }} onClick={() => step(s, st)}><span>{s}</span><span className="mono" style={{ opacity: 1 }}>{st === "done" ? "complete" : st === "active" ? "in review" : "upcoming"}</span></div> })}
            </div>
        </div>
    )
}

function Checklist({ ph, items, notion, db, refresh, projectId }: any) {
    const [open, setOpen] = React.useState(true)
    const [err, setErr] = React.useState("")
    const [custom, setCustom] = React.useState("")
    const done = items.filter((i: any) => i.status === "accepted").length
    const grouped: Record<string, any[]> = {}
    items.forEach((i: any) => { const [g, ...r] = String(i.title).split(" › "); const k = r.length ? g : "Tasks"; (grouped[k] ||= []).push({ ...i, label: r.length ? r.join(" › ") : i.title }) })
    async function seed() {
        const have = new Set(items.map((i: any) => i.title))
        const rows = (TEMPLATES[ph.seq] || []).filter((t) => !have.has(t)).map((t) => ({ project_id: projectId, phase_id: ph.id, title: t, kind: "other", status: "pending" }))
        if (!rows.length) return
        const { error } = await db.from("deliverables").insert(rows); setErr(error ? error.message : ""); refresh()
    }
    async function tick(i: any) { const { error } = await db.from("deliverables").update({ status: i.status === "accepted" ? "pending" : "accepted", decided_at: i.status === "accepted" ? null : new Date().toISOString() }).eq("id", i.id); setErr(error ? error.message : ""); refresh() }
    async function link() {
        const v = prompt("Notion page for " + ph.title + " (blank to remove)", notion?.note || ""); if (v === null) return
        const url = v.trim()
        let error: any
        if (notion) ({ error } = url ? await db.from("deliverables").update({ note: url }).eq("id", notion.id) : await db.from("deliverables").delete().eq("id", notion.id))
        else if (url) ({ error } = await db.from("deliverables").insert({ project_id: projectId, phase_id: ph.id, title: "__notion__", kind: "other", status: "pending", note: url }))
        setErr(error ? error.message : ""); refresh()
    }
    async function addOwn() {
        if (!custom.trim()) return
        const { error } = await db.from("deliverables").insert({ project_id: projectId, phase_id: ph.id, title: custom.trim(), kind: "other", status: "pending" })
        setErr(error ? error.message : ""); setCustom(""); refresh()
    }
    async function remove(i: any) { if (!confirm("Remove this item?")) return; await db.from("deliverables").delete().eq("id", i.id); refresh() }
    return (
        <div style={{ margin: "8px 28px 8px 14px" }}>
            <div className="r">
                <button className="b g" onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"} checklist · {done}/{items.length}</button>
                <button className="b g" onClick={seed}>Load standard checklist</button>
                <button className="b g" onClick={link}>{notion ? "Edit Notion link" : "+ Notion for this phase"}</button>
                {notion?.note ? <a href={notion.note} target="_blank" rel="noopener" className="mono">Open in Notion ↗</a> : null}
            </div>
            {err && <p style={{ fontSize: 13, color: "#8a2b2b" }}>{err}</p>}
            {open && (
                <div style={{ marginTop: 8 }}>
                    {Object.entries(grouped).map(([g, list]) => (
                        <div key={g} style={{ marginBottom: 8 }}>
                            <div className="mono" style={{ margin: "8px 0 4px" }}>{g}</div>
                            {list.map((i: any) => (
                                <div key={i.id} className="r" style={{ padding: "4px 0", fontSize: 14, flexWrap: "nowrap" }}>
                                    <input type="checkbox" checked={i.status === "accepted"} onChange={() => tick(i)} style={{ width: 18, height: 18 }} />
                                    <span style={{ flex: 1, textDecoration: i.status === "accepted" ? "line-through" : "none", opacity: i.status === "accepted" ? 0.55 : 1 }}>{i.label}</span>
                                    <button className="b g" style={{ padding: "2px 9px", marginRight: 16 }} onClick={() => remove(i)} aria-label="Remove">×</button>
                                </div>
                            ))}
                        </div>
                    ))}
                    <div className="r" style={{ marginTop: 6 }}>
                        <input placeholder="Add your own item" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addOwn()} style={{ flex: 1 }} />
                        <button className="b g" onClick={addOwn}>Add</button>
                    </div>
                </div>
            )}
        </div>
    )
}

function SurveyImages({ db, supabaseUrl }: any) {
    const [map, setMap] = React.useState<Record<string, string>>({})
    const [busy, setBusy] = React.useState("")
    const [msg, setMsg] = React.useState("")
    const refs = React.useRef<Record<string, HTMLInputElement | null>>({})
    const load = async () => { const { data, error } = await db.from("survey_card_images").select("option,url"); if (error) setMsg(error.message); const m: any = {}; (data || []).forEach((r: any) => (m[r.option] = r.url)); setMap(m) }
    React.useEffect(() => { load() }, [])
    async function up(opt: string, file: File) {
        setBusy(opt); setMsg("")
        const ext = (file.name.split(".").pop() || "png").toLowerCase()
        const path = `${opt.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}.${ext}`
        const { error } = await db.storage.from("survey-assets").upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" })
        if (error) { setMsg(`Upload failed for ${opt}: ${error.message}`); setBusy(""); return }
        const url = `${supabaseUrl}/storage/v1/object/public/survey-assets/${path}`
        const rows = [{ option: opt, url, updated_at: new Date().toISOString() }]
        if (opt === "Moonlit minimal") rows.push({ option: "Minimal", url, updated_at: new Date().toISOString() })
        const { error: e2 } = await db.from("survey_card_images").upsert(rows, { onConflict: "option" })
        setMsg(e2 ? `Saved file but could not link it: ${e2.message}` : `${opt} updated. The survey shows it on next load.`)
        setBusy(""); load()
    }
    const logoUrl = `${supabaseUrl}/storage/v1/object/public/survey-assets/brand/felemaye-logo.png`
    const [logoV, setLogoV] = React.useState(Date.now())
    const logoRef = React.useRef<HTMLInputElement>(null)
    async function upLogo(file: File) {
        setMsg("Uploading logo…")
        const { error } = await db.storage.from("survey-assets").upload("brand/felemaye-logo.png", file, { upsert: true, contentType: file.type || "image/png", cacheControl: "300" })
        setMsg(error ? "Logo upload failed: " + error.message : "Logo saved. Every studio email now uses it."); setLogoV(Date.now())
    }
    return (
        <div>
            <div className="c" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <img src={`${logoUrl}?v=${logoV}`} alt="" style={{ width: 72, height: 72, objectFit: "contain", background: "#fff" }} onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden" }} />
                <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="mono">Brand logo mark · used in client emails</div>
                    <div style={{ fontSize: 13, opacity: 0.75, margin: "4px 0 8px" }}>PNG on a white background, about 400px wide.</div>
                    <input ref={logoRef} type="file" accept="image/png,image/jpeg" style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} onChange={(e) => { const x = e.target.files?.[0]; if (x) upLogo(x); e.target.value = "" }} />
                    <button className="b g" onClick={() => logoRef.current?.click()}>Upload / replace logo</button>
                </div>
            </div>
            <p style={{ maxWidth: 640, lineHeight: 1.7, fontSize: 14 }}>Click any card to upload a PNG or JPG. The survey picks it up on the next load; cards without an upload keep their default image.</p>
            {msg && <p style={{ fontSize: 13, fontWeight: 600 }}>{msg}</p>}
            {Object.entries(OPTIONS).map(([group, list]) => (
                <div key={group}>
                    <div className="mono" style={{ margin: "22px 0 10px" }}>{group}</div>
                    <div className="gr">
                        {list.map((o) => (
                            <div key={o} className="c" style={{ cursor: "pointer", margin: 0 }} onClick={() => refs.current[o]?.click()}>
                                <div style={{ aspectRatio: "4/3", backgroundColor: "rgba(0,0,0,.07)", backgroundImage: map[o] ? `url("${map[o]}")` : "none", backgroundSize: "cover", backgroundPosition: "center", marginBottom: 8 }} />
                                <div style={{ fontSize: 13 }}>{o}</div>
                                <div className="mono">{busy === o ? "uploading…" : map[o] ? "replace" : "upload"}</div>
                                <input ref={(el) => { refs.current[o] = el }} type="file" accept="image/*" style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} onClick={(e) => e.stopPropagation()} onChange={(e) => { const f = e.target.files?.[0]; if (f) up(o, f); e.target.value = "" }} />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

StudioConsole.defaultProps = {
    supabaseUrl: "https://afejhlfwymwagstyfnse.supabase.co",
    publishableKey: "sb_publishable_DxxomxoBSa8QkC6pBzYf5A_O86rctbV",
    studioUrl: "https://felemaye.com/studio",
    portalUrl: "https://felemaye.com/client-suite/portal",
    paper: "#F4EFE4",
    ink: "#2B2B28",
    accent: "#8C6F52",
    width: 1200,
    height: 900,
}
addPropertyControls(StudioConsole, {
    supabaseUrl: { type: ControlType.String, title: "Supabase URL" },
    publishableKey: { type: ControlType.String, title: "Publishable key" },
    studioUrl: { type: ControlType.String, title: "Studio URL" },
    portalUrl: { type: ControlType.String, title: "Portal URL" },
    paper: { type: ControlType.Color, title: "Paper" },
    ink: { type: ControlType.Color, title: "Ink" },
    accent: { type: ControlType.Color, title: "Accent" },
})
