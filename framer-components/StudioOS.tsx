// FELEMAYE — Studio OS (Framer code file, imported by MasterStudioConsole.tsx)
// 2026-10-23 · Company dashboard (targets, forecast, capacity guard, pipeline, leads, follow-ups),
// notification centre (counts, toast, tab-title badge), inbox (notifications + conversation + task templates),
// Reimbursables v2 (tax buckets, IRS mileage engine, curated client lines, batched statements),
// Proposal & Fee Builder (WBS × tiers × multiplier), Network directory, Vendor review triage.
// Needs supabase/migrations/20261023_felemaye_studio_os.sql. Every panel says so if it hasn't been run.
import * as React from "react"

/* ───────────── shared ───────────── */
const $0 = (n: any) => "$" + Math.round(Number(n || 0)).toLocaleString()
const $2 = (n: any) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (n: number) => (isFinite(n) ? Math.round(n * 100) + "%" : "—")
const today = () => new Date().toISOString().slice(0, 10)
const addDays = (d: string | Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const isMissing = (e: any) => !!e && /does not exist|schema cache|42P01|PGRST20[02]|42883/i.test((e.message || "") + (e.code || ""))
const NEEDS_SQL = "This panel needs the Studio OS update. Open Supabase › SQL editor and run 20261023_felemaye_studio_os.sql (safe to re-run)."
const OS_CSS = `
.os-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px}
.os-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.os-kpi{border:.5px solid color-mix(in srgb,var(--ink) 35%,transparent);padding:14px}
.os-kpi b{display:block;font:400 30px/1.1 'Cormorant Garamond',Georgia,serif;margin-top:6px}
.os-kpi small{display:block;font-size:12px;opacity:.7;margin-top:4px;line-height:1.4}
.os-bar{display:flex;align-items:flex-end;gap:4px;height:150px;border-bottom:.5px solid var(--ink);position:relative;padding-top:8px}
.os-bar>div{flex:1;display:flex;flex-direction:column;justify-content:flex-end;min-width:0;position:relative}
.os-bar span{display:block;width:100%}
.os-bar i{position:absolute;bottom:-18px;left:0;right:0;text-align:center;font:9px ui-monospace,Menlo,monospace;opacity:.6;font-style:normal}
.os-line{position:absolute;left:0;right:0;border-top:1px dashed var(--accent);pointer-events:none}
.os-line em{position:absolute;right:0;top:3px;font:9px ui-monospace,Menlo,monospace;font-style:normal;color:var(--accent);white-space:nowrap;background:var(--paper);padding:0 4px}
.os-board{display:grid;grid-template-columns:repeat(6,minmax(170px,1fr));gap:8px;overflow-x:auto;padding-bottom:6px}
.os-col{border-top:1px solid var(--ink);padding-top:8px;min-width:170px}
.fys .os-deal{font-size:13px;border:.5px solid color-mix(in srgb,var(--ink) 35%,transparent);padding:10px;margin:8px 0;font-size:13px;line-height:1.45;cursor:pointer;background:transparent;color:inherit;text-align:left;width:100%}
.fys .os-deal.late{border-color:var(--accent)}
.os-pill{display:inline-block;padding:2px 8px;border:.5px solid currentColor;font:10px ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;margin:2px 4px 2px 0}
.os-warn{border-left:3px solid var(--accent);padding:10px 14px;margin:10px 0;font-size:14px;line-height:1.6}
.os-thread{max-height:56vh;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:6px 2px}
.os-msg{max-width:78%;padding:12px 14px;font-size:15px;line-height:1.6;white-space:pre-wrap;border:.5px solid color-mix(in srgb,var(--ink) 35%,transparent)}
.os-msg.me{align-self:flex-end;background:var(--ink);color:var(--paper)}
.os-msg small{display:block;font:10px ui-monospace,Menlo,monospace;letter-spacing:.1em;opacity:.65;margin-top:6px}
.os-bell{position:relative;display:inline-flex;align-items:center;gap:8px}
.os-bell .n{min-width:24px;height:24px;padding:0 7px;border-radius:12px;background:var(--accent);color:var(--paper);font:600 13px/24px 'Helvetica Neue',Helvetica,Arial,sans-serif;text-align:center}
.os-drop{position:absolute;right:0;top:calc(100% + 8px);width:min(420px,92vw);max-height:70vh;overflow:auto;background:var(--paper);color:var(--ink);border:.5px solid var(--ink);z-index:50;box-shadow:0 18px 40px rgba(0,0,0,.18);padding:6px 14px}
.os-drop button.it{all:unset;box-sizing:border-box;display:block;width:100%;padding:12px 0;border-bottom:.5px solid color-mix(in srgb,var(--ink) 20%,transparent);cursor:pointer;font-size:14px;line-height:1.5}
.os-drop .unread{font-weight:600}
.os-toast{position:fixed;right:18px;bottom:18px;z-index:9999;max-width:min(380px,90vw);background:var(--ink);color:var(--paper);padding:14px 16px;font-size:14px;line-height:1.5;box-shadow:0 12px 30px rgba(0,0,0,.25)}
.os-tpl{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}
.os-tpl button{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;justify-content:flex-start;gap:2px;border:.5px solid color-mix(in srgb,var(--ink) 35%,transparent);padding:12px;font-size:13px;line-height:1.45}
.os-tpl button[aria-pressed=true]{background:var(--ink);color:var(--paper)}
.os-num{font-variant-numeric:tabular-nums;text-align:right}
@media(max-width:700px){.os-msg{max-width:92%}}
`
function OSStyle() { return <style>{OS_CSS}</style> }
function useProjects(db: any) {
    const [p, setP] = React.useState<any[]>([])
    React.useEffect(() => { db.from("projects").select("id,title,client_id,slug,client_slug,status").order("created_at", { ascending: false }).then(({ data }: any) => setP(data || [])) }, [db])
    return p
}
function Gate({ err, children }: any) { return err ? <div className="os-warn">{NEEDS_SQL}</div> : children }
const BRAND_PRINT = `<style>@page{size:letter;margin:.7in}body{font-family:Inter,Helvetica,Arial,sans-serif;color:#2B2B28;background:#F4EFE4;font-size:11pt;line-height:1.55}h1,h2{font-family:'Cormorant Garamond',Georgia,serif;font-weight:400}h1{font-size:30pt;margin:0 0 4pt}h2{font-size:17pt;margin:18pt 0 6pt}.m{font:8pt 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:#8C6F52}table{width:100%;border-collapse:collapse;font-size:10pt}th{font:8pt 'IBM Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase;text-align:left;border-bottom:.5pt solid #2B2B28;padding:5pt 4pt}td{padding:5pt 4pt;border-bottom:.3pt solid #cfc6b4}td.n,th.n{text-align:right}.tot td{border-top:.8pt solid #2B2B28;font-weight:600}.rule{height:1pt;width:46pt;background:#8C6F52;margin:10pt 0 16pt}</style><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond&family=IBM+Plex+Mono&family=Inter:wght@400;600&display=swap" rel="stylesheet">`
function printHtml(title: string, body: string) {
    const w = window.open("", "_blank")
    if (!w) return alert("Allow pop-ups to print.")
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${BRAND_PRINT}</head><body><div class="m">FELEMAYE · Los Angeles · New York</div>${body}<script>setTimeout(()=>print(),600)<\/script></body></html>`)
    w.document.close()
}
const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[c])

/* ═════════════════════ NOTIFICATION CENTRE (header) ═════════════════════ */
export function NotifCenter({ db, openTab, setFocus }: any) {
    const [items, setItems] = React.useState<any[]>([])
    const [counts, setCounts] = React.useState<any>({ unread_notifications: 0, unread_messages: 0, open_tasks: 0, pending_statements: 0 })
    const [open, setOpen] = React.useState(false)
    const [toast, setToast] = React.useState<any>(null)
    const seen = React.useRef<Set<string>>(new Set())
    const first = React.useRef(true)
    const load = React.useCallback(async () => {
        const { data } = await db.from("portal_notifications").select("id,project_id,kind,title,body,link_target,read_at,created_at,projects(title)").eq("audience", "studio").order("created_at", { ascending: false }).limit(40)
        const rows = data || []
        const fresh = rows.filter((r: any) => !seen.current.has(r.id) && !r.read_at)
        rows.forEach((r: any) => seen.current.add(r.id))
        if (!first.current && fresh.length) { setToast(fresh[0]); setTimeout(() => setToast(null), 7000) }
        first.current = false
        setItems(rows)
        const c = await db.rpc("notification_counts", { p_project: null })
        if (!c.error && c.data?.[0]) setCounts(c.data[0])
        else setCounts({ unread_notifications: rows.filter((r: any) => !r.read_at).length, unread_messages: 0, open_tasks: 0, pending_statements: 0 })
    }, [db])
    React.useEffect(() => {
        load()
        const t = setInterval(load, 30000)
        let ch: any
        try { ch = db.channel("os-studio-bell").on("postgres_changes", { event: "INSERT", schema: "public", table: "portal_notifications" }, () => load()).on("postgres_changes", { event: "INSERT", schema: "public", table: "project_messages" }, () => load()).subscribe() } catch {}
        const onVis = () => document.visibilityState === "visible" && load()
        document.addEventListener("visibilitychange", onVis)
        return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); try { ch && db.removeChannel(ch) } catch {} }
    }, [db, load])
    const total = Number(counts.unread_notifications || 0) + Number(counts.unread_messages || 0)
    React.useEffect(() => {
        const base = "FELEMAYE · Studio Console"
        document.title = total ? `(${total}) ${base}` : base
    }, [total])
    const route = (n: any) => {
        const map: Record<string, string> = { dashboard: "dashboard", lead_signals: "dashboard", ledger: "reimbursables", statement_approved: "reimbursables", message: "inbox", messages: "inbox", meetings: "meetings", cadence: "cadence", files: "clients", reimbursables: "reimbursables", family: "inbox", clients: "clients" }
        if (n.project_id) setFocus?.(n.project_id)
        openTab?.(map[n.link_target] || map[n.kind] || "inbox")
        db.from("portal_notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id).then(load)
        setOpen(false)
    }
    const readAll = async () => { await db.from("portal_notifications").update({ read_at: new Date().toISOString() }).eq("audience", "studio").is("read_at", null); load() }
    return (
        <div className="os-bell">
            <OSStyle />
            <button className={"b" + (total ? "" : " g")} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`${total} unread`}>
                Inbox {total > 0 && <span className="n" style={{ marginLeft: 8, display: "inline-block" }}>{total}</span>}
            </button>
            {(counts.open_tasks > 0 || counts.pending_statements > 0) && (
                <span className="mono" style={{ opacity: 0.9 }}>
                    {counts.open_tasks > 0 && <>{counts.open_tasks} to review</>} {counts.pending_statements > 0 && <> · {counts.pending_statements} statement{counts.pending_statements > 1 ? "s" : ""} approved</>}
                </span>
            )}
            {open && (
                <div className="os-drop" role="dialog" aria-label="Studio notifications">
                    <div className="r" style={{ justifyContent: "space-between", padding: "8px 0" }}>
                        <span className="mono">{counts.unread_notifications} unread · {counts.unread_messages} messages</span>
                        <button className="b g" onClick={readAll}>Mark all read</button>
                    </div>
                    {items.map((n) => (
                        <button key={n.id} className={"it" + (n.read_at ? "" : " unread")} onClick={() => route(n)}>
                            <span className="mono" style={{ display: "block" }}>{n.projects?.title || ""} · {new Date(n.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                            {n.title}
                            {n.body && <span style={{ display: "block", opacity: 0.7, fontWeight: 400, fontSize: 13 }}>{String(n.body).slice(0, 160)}</span>}
                        </button>
                    ))}
                    {!items.length && <p style={{ fontSize: 14 }}>Nothing yet.</p>}
                </div>
            )}
            {toast && (
                <div className="os-toast" role="status" onClick={() => route(toast)} style={{ cursor: "pointer" }}>
                    <div style={{ font: "10px ui-monospace,Menlo,monospace", letterSpacing: ".18em", textTransform: "uppercase", opacity: 0.7 }}>{toast.projects?.title || "Portal"}</div>
                    {toast.title}
                </div>
            )}
        </div>
    )
}

/* ═════════════════════ INBOX: notifications · conversation · tasks ═════════════════════ */
export function InboxTab({ db, focus }: any) {
    const projects = useProjects(db)
    const [pid, setPid] = React.useState<string>(focus || "")
    React.useEffect(() => { if (focus) setPid(focus) }, [focus])
    React.useEffect(() => { if (!pid && projects[0]) setPid(projects[0].id) }, [projects, pid])
    const [unread, setUnread] = React.useState<Record<string, number>>({})
    const [err, setErr] = React.useState<any>(null)
    const loadUnread = React.useCallback(async () => {
        const { data, error } = await db.from("project_messages").select("project_id").eq("sender_role", "client").is("read_by_studio_at", null)
        if (isMissing(error)) return setErr(error)
        const m: Record<string, number> = {}
        ;(data || []).forEach((r: any) => (m[r.project_id] = (m[r.project_id] || 0) + 1))
        setUnread(m)
    }, [db])
    React.useEffect(() => { loadUnread() }, [loadUnread])
    return (
        <div>
            <OSStyle />
            <p style={{ maxWidth: 720, lineHeight: 1.7, fontSize: 14 }}>One place for everything clients do. Messages here appear in the client's portal immediately and are emailed to them; their replies come back here, to your inbox and to your email. Assign a task from a template and the client is notified the same way.</p>
            <div className="r" style={{ marginBottom: 12 }}>
                {projects.map((p) => (
                    <button key={p.id} className={"b" + (pid === p.id ? "" : " g")} onClick={() => setPid(p.id)}>
                        {p.title} {unread[p.id] ? <span className="badge" style={{ marginLeft: 6 }}>{unread[p.id]}</span> : null}
                    </button>
                ))}
            </div>
            <Gate err={err}>
                {pid && (
                    <div className="os-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))" }}>
                        <Conversation db={db} pid={pid} onRead={loadUnread} />
                        <div>
                            <TaskAssign db={db} pid={pid} />
                            <ProjectFeed db={db} pid={pid} />
                        </div>
                    </div>
                )}
            </Gate>
        </div>
    )
}

function Conversation({ db, pid, onRead }: any) {
    const [rows, setRows] = React.useState<any[]>([])
    const [body, setBody] = React.useState("")
    const [files, setFiles] = React.useState<File[]>([])
    const [busy, setBusy] = React.useState(false)
    const [msg, setMsg] = React.useState("")
    const end = React.useRef<HTMLDivElement>(null)
    const fileRef = React.useRef<HTMLInputElement>(null)
    const load = React.useCallback(async () => {
        const { data } = await db.from("project_messages").select("*").eq("project_id", pid).order("created_at")
        setRows(data || [])
        await db.rpc("mark_messages_read", { p_project: pid })
        onRead?.()
        setTimeout(() => end.current?.scrollIntoView({ block: "end" }), 50)
    }, [db, pid])
    React.useEffect(() => {
        load()
        let ch: any
        try { ch = db.channel("os-thread-" + pid).on("postgres_changes", { event: "INSERT", schema: "public", table: "project_messages", filter: `project_id=eq.${pid}` }, () => load()).subscribe() } catch {}
        const t = setInterval(load, 45000)
        return () => { clearInterval(t); try { ch && db.removeChannel(ch) } catch {} }
    }, [db, pid, load])
    const open = async (path: string) => { const { data } = await db.storage.from("project-files").createSignedUrl(path, 300); if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener") }
    async function send(e: React.FormEvent) {
        e.preventDefault()
        if (!body.trim()) return
        setBusy(true); setMsg("")
        const att: any[] = []
        for (const f of files) {
            const path = `${pid}/studio/messages/${Date.now()}_${f.name.replace(/[^\w.\-]+/g, "_")}`
            const { error } = await db.storage.from("project-files").upload(path, f)
            if (error) { setMsg("Attachment failed: " + error.message); setBusy(false); return }
            att.push({ name: f.name, path })
        }
        const { error } = await db.rpc("post_message", { p_project: pid, p_body: body, p_attachments: att })
        setBusy(false)
        if (error) return setMsg(error.message)
        setBody(""); setFiles([]); load()
    }
    return (
        <div className="c">
            <div className="mono">Conversation</div>
            <div className="os-thread" aria-live="polite">
                {rows.map((m) => (
                    <div key={m.id} className={"os-msg" + (m.sender_role === "studio" ? " me" : "")}>
                        {m.body}
                        {(m.attachments || []).map((a: any) => (
                            <button key={a.path} className="b g" style={{ marginTop: 8, display: "block", color: "inherit", borderColor: "currentColor" }} onClick={() => open(a.path)}>{a.name}</button>
                        ))}
                        <small>{m.sender_role === "studio" ? "You" : m.sender_name || "Client"} · {new Date(m.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{m.sender_role === "studio" && m.read_by_client_at ? " · seen" : ""}</small>
                    </div>
                ))}
                {!rows.length && <p style={{ fontSize: 14, opacity: 0.7 }}>No messages yet. Write the first one; the client gets it in the portal and by email.</p>}
                <div ref={end} />
            </div>
            <form onSubmit={send} style={{ marginTop: 10 }}>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Write to the client…" style={{ width: "100%", minHeight: 80 }} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(e as any) }} />
                <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                <div className="r" style={{ marginTop: 8 }}>
                    <button className="b" disabled={busy || !body.trim()}>{busy ? "Sending…" : "Send"}</button>
                    <button type="button" className="b g" onClick={() => fileRef.current?.click()}>{files.length ? `${files.length} attached` : "Attach"}</button>
                    <span className="mono">⌘/Ctrl + Enter sends</span>
                </div>
                {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
            </form>
        </div>
    )
}

function TaskAssign({ db, pid }: any) {
    const [tpls, setTpls] = React.useState<any[]>([])
    const [sel, setSel] = React.useState<string>("")
    const [title, setTitle] = React.useState("")
    const [detail, setDetail] = React.useState("")
    const [due, setDue] = React.useState("")
    const [tasks, setTasks] = React.useState<any[]>([])
    const [responses, setResponses] = React.useState<number>(0)
    const [msg, setMsg] = React.useState("")
    const [err, setErr] = React.useState<any>(null)
    const load = React.useCallback(async () => {
        const [t, k, f] = await Promise.all([
            db.from("task_templates").select("*").order("sort"),
            db.from("client_tasks").select("*").eq("project_id", pid).order("created_at", { ascending: false }).limit(20),
            db.from("family_survey_responses").select("id", { count: "exact", head: true }).eq("project_id", pid),
        ])
        if (isMissing(t.error)) setErr(t.error)
        setTpls(t.data || []); setTasks(k.data || []); setResponses(f.count || 0)
    }, [db, pid])
    React.useEffect(() => { load() }, [load])
    const tpl = tpls.find((t) => t.key === sel)
    React.useEffect(() => { setTitle(tpl?.title || ""); setDetail(tpl?.detail || ""); setDue(tpl ? addDays(new Date(), tpl.default_due_days || 7).toISOString().slice(0, 10) : "") }, [sel])
    async function assign() {
        const { error } = await db.rpc("studio_assign_task", { p_project: pid, p_template: sel || null, p_title: title, p_detail: detail, p_due: due || null })
        setMsg(error ? error.message : "Assigned. The client has been notified in the portal and by email.")
        if (!error) { setSel(""); load() }
    }
    const setStatus = async (t: any, status: string) => { await db.from("client_tasks").update({ status, completed_at: status === "completed" ? new Date().toISOString() : null }).eq("id", t.id); load() }
    const copy = (s: string) => navigator.clipboard?.writeText(s).then(() => setMsg("Link copied."))
    return (
        <div className="c">
            <div className="mono">Assign a task</div>
            <Gate err={err}>
                <div className="os-tpl" style={{ marginTop: 10 }}>
                    {tpls.map((t) => (
                        <button key={t.key} aria-pressed={sel === t.key} onClick={() => setSel(sel === t.key ? "" : t.key)}>
                            <b style={{ display: "block", marginBottom: 4 }}>{t.title}</b>
                            <span style={{ opacity: 0.75 }}>{t.share ? "Share link for family & guests" : t.link_label}</span>
                        </button>
                    ))}
                </div>
                {sel && (
                    <div style={{ marginTop: 12 }}>
                        <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%" }} aria-label="Task title" />
                        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} style={{ width: "100%", marginTop: 8 }} aria-label="Task detail" />
                        <div className="r" style={{ marginTop: 8 }}>
                            <label className="mono">Due <input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
                            <button className="b" onClick={assign}>Assign & notify</button>
                        </div>
                    </div>
                )}
                {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
                <div className="tw" style={{ marginTop: 12 }}>
                    <table>
                        <thead><tr><th>Task</th><th>Due</th><th>Status</th><th></th></tr></thead>
                        <tbody>
                            {tasks.map((t) => (
                                <tr key={t.id}>
                                    <td>{t.title}{t.template_key === "family_survey" && <div className="mono" style={{ marginTop: 4 }}>{responses} response{responses === 1 ? "" : "s"} · <a href="#" onClick={(e) => { e.preventDefault(); copy(t.share_url || t.link_url) }}>copy link</a></div>}</td>
                                    <td>{t.due_on || ""}</td>
                                    <td><span className="os-pill">{String(t.status).replace("_", " ")}</span></td>
                                    <td>{t.status !== "completed" ? <button className="b g" onClick={() => setStatus(t, "completed")}>Mark done</button> : <button className="b g" onClick={() => setStatus(t, "action_required")}>Reopen</button>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!tasks.length && <p className="mono">No tasks yet.</p>}
                </div>
            </Gate>
        </div>
    )
}

function ProjectFeed({ db, pid }: any) {
    const [rows, setRows] = React.useState<any[]>([])
    React.useEffect(() => { db.from("portal_notifications").select("*").eq("project_id", pid).order("created_at", { ascending: false }).limit(25).then(({ data }: any) => setRows(data || [])) }, [db, pid])
    return (
        <div className="c">
            <div className="mono">What happened (both sides)</div>
            {rows.map((n) => (
                <div key={n.id} style={{ padding: "10px 0", borderBottom: ".5px solid color-mix(in srgb,var(--ink) 18%,transparent)", fontSize: 14, lineHeight: 1.5 }}>
                    <span className="os-pill">{n.audience === "client" ? "to client" : "to studio"}</span>
                    <b style={{ fontWeight: n.read_at ? 400 : 600 }}>{n.title}</b>
                    <span className="mono" style={{ display: "block" }}>{new Date(n.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {n.read_at ? "read" : "unread"}</span>
                </div>
            ))}
            {!rows.length && <p className="mono">Nothing yet.</p>}
        </div>
    )
}

/* ═════════════════════ REIMBURSABLES v2 ═════════════════════ */
const CLIENT_CATS: [string, string][] = [["mileage", "Site travel (mileage)"], ["printing", "Printing & plotting"], ["filing_fees", "Agency / filing fees"], ["samples", "Material samples"], ["courier", "Courier & sample delivery"], ["consultant", "Consultant pass-through"], ["other", "Other pass-through"]]
const OPEX_CATS: [string, string][] = [["software", "Software (BIM, Adobe…)"], ["hosting", "Hosting & domains"], ["legal", "Legal"], ["insurance", "Professional insurance"], ["vehicle", "Studio vehicle maintenance"], ["equipment", "Studio equipment"], ["admin", "General admin"], ["meals", "Meals (business)"], ["other", "Other"]]
const NEVER = "Never billed to clients: gas receipts (use mileage), personal meals, general software, studio equipment."

export function ReimbursablesV2({ db, focus }: any) {
    const projects = useProjects(db)
    const [rows, setRows] = React.useState<any[]>([])
    const [rates, setRates] = React.useState<any[]>([])
    const [stmts, setStmts] = React.useState<any[]>([])
    const [err, setErr] = React.useState<any>(null)
    const [msg, setMsg] = React.useState("")
    const blank = { bucket: "client_reimbursable", spent_on: today(), project_id: focus || "", category: "mileage", vendor: "", description: "", amount: "", markup_pct: "0", miles: "", trip_from: "", trip_to: "", flat: false, flat_fee: "75", list_price: "", trade_cost: "", client_label: "", receipt_client_visible: false, internal_notes: "" }
    const [f, setF] = React.useState<any>(blank)
    const [receipt, setReceipt] = React.useState<File | null>(null)
    const fileRef = React.useRef<HTMLInputElement>(null)
    const load = React.useCallback(async () => {
        const [r, k, s] = await Promise.all([
            db.from("studio_reimbursables").select("*").order("spent_on", { ascending: false }).limit(400),
            db.from("irs_mileage_rates").select("*").order("effective_from", { ascending: false }),
            db.from("reimbursable_statements").select("*").order("created_at", { ascending: false }),
        ])
        if (isMissing(k.error) || isMissing(s.error)) setErr(k.error || s.error)
        setRows(r.data || []); setRates(k.data || []); setStmts(s.data || [])
    }, [db])
    React.useEffect(() => { load() }, [load])
    React.useEffect(() => { if (focus) setF((x: any) => ({ ...x, project_id: focus })) }, [focus])
    const rateOn = (d: string) => rates.find((r) => d >= r.effective_from && d <= r.effective_to)?.rate
    const rate = rateOn(f.spent_on)
    const mileAmt = f.flat ? Number(f.flat_fee || 0) : Number(f.miles || 0) * Number(rate || 0)
    const isMileage = f.bucket === "client_reimbursable" && f.category === "mileage"
    const preview = isMileage ? mileAmt : Number(f.list_price || 0) || Number(f.amount || 0) * (1 + Number(f.markup_pct || 0) / 100)
    const shown = focus ? rows.filter((r) => r.project_id === focus) : rows

    async function save(e: React.FormEvent) {
        e.preventDefault(); setMsg("")
        if (f.bucket === "client_reimbursable" && !f.project_id) return setMsg("Client reimbursables belong to a project. Pick one, or switch to Studio OPEX.")
        let path: string | null = null
        if (receipt) {
            const ext = (receipt.name.split(".").pop() || "pdf").toLowerCase()
            const amt = (isMileage ? mileAmt : Number(f.amount || 0)).toFixed(2)
            path = `${f.project_id || "studio"}/studio/receipts/${f.spent_on}_${(f.vendor || f.category).replace(/[^\w]+/g, "-")}_${amt}.${ext}`
            const { error } = await db.storage.from("project-files").upload(path, receipt, { upsert: true })
            if (error) return setMsg("Receipt upload failed: " + error.message)
        }
        const { data: u } = await db.auth.getUser()
        const row: any = {
            bucket: f.bucket, spent_on: f.spent_on, project_id: f.project_id || null, category: f.category,
            vendor: f.vendor || (isMileage ? "Site visit" : null), description: f.description || null,
            billable: f.bucket === "client_reimbursable", receipt_path: path, entered_by: u?.user?.email,
            client_label: f.client_label || null, internal_notes: f.internal_notes || null,
            receipt_client_visible: !!f.receipt_client_visible && !isMileage,
        }
        if (isMileage) {
            row.trip_from = f.trip_from || null; row.trip_to = f.trip_to || null
            if (f.flat) { row.flat_fee = Number(f.flat_fee); row.amount = Number(f.flat_fee) } else { row.miles = Number(f.miles); row.amount = Math.max(0.01, mileAmt) }
        } else {
            row.amount = Number(f.amount); row.markup_pct = Number(f.markup_pct) || 0
            if (f.list_price) row.list_price = Number(f.list_price)
            if (f.trade_cost) row.trade_cost = Number(f.trade_cost)
        }
        const { error } = await db.from("studio_reimbursables").insert(row)
        setMsg(error ? error.message : "Saved.")
        if (!error) { setF({ ...blank, bucket: f.bucket, project_id: f.project_id, category: f.category }); setReceipt(null); load() }
    }
    const del = async (r: any) => { if (r.statement_id) return setMsg("This item is on a statement; void the statement first."); if (!confirm("Delete this entry?")) return; await db.from("studio_reimbursables").delete().eq("id", r.id); load() }
    const toggleReceipt = async (r: any) => { await db.from("studio_reimbursables").update({ receipt_client_visible: !r.receipt_client_visible }).eq("id", r.id); load() }
    const openReceipt = async (p: string) => { const { data } = await db.storage.from("project-files").createSignedUrl(p, 300); if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener") }
    const billed = (r: any) => (r.bucket === "client_reimbursable" ? Number(r.list_price ?? Number(r.amount) * (1 + Number(r.markup_pct || 0) / 100)) : 0)
    const y = String(new Date().getFullYear())
    const ytd = rows.filter((r) => String(r.spent_on).startsWith(y))
    const passThrough = ytd.filter((r) => r.bucket === "client_reimbursable").reduce((a, r) => a + Number(r.amount), 0)
    const opex = ytd.filter((r) => r.bucket === "studio_opex").reduce((a, r) => a + Number(r.amount), 0)
    const unbilled = rows.filter((r) => r.bucket === "client_reimbursable" && r.billable && !r.statement_id && r.status === "logged").reduce((a, r) => a + billed(r), 0)
    const miles = ytd.reduce((a, r) => a + Number(r.miles || 0), 0)
    const pname = (id: string) => projects.find((p) => p.id === id)?.title || "Studio"
    const cats = f.bucket === "client_reimbursable" ? CLIENT_CATS : OPEX_CATS

    return (
        <div>
            <OSStyle />
            <Gate err={err}>
                <div className="os-kpis" style={{ marginBottom: 14 }}>
                    <div className="os-kpi"><span className="mono">Pass-through {y}</span><b>{$0(passThrough)}</b><small>Billed back 1:1 · net tax effect $0</small></div>
                    <div className="os-kpi"><span className="mono">Studio OPEX {y}</span><b>{$0(opex)}</b><small>Deductible · est. tax saved {$0(opex * 0.25)}–{$0(opex * 0.35)}</small></div>
                    <div className="os-kpi"><span className="mono">Unbilled</span><b>{$0(unbilled)}</b><small>Ready to batch into a statement</small></div>
                    <div className="os-kpi"><span className="mono">Miles logged {y}</span><b>{Math.round(miles).toLocaleString()}</b><small>IRS rate today {rateOn(today()) ? "$" + Number(rateOn(today())).toFixed(3) : "—"}/mi</small></div>
                </div>
                <form onSubmit={save} className="c">
                    <div className="v4-mode" role="group" aria-label="Bucket" style={{ marginBottom: 10 }}>
                        <button type="button" aria-pressed={f.bucket === "client_reimbursable"} onClick={() => setF({ ...f, bucket: "client_reimbursable", category: "mileage" })}>Client reimbursable</button>
                        <button type="button" aria-pressed={f.bucket === "studio_opex"} onClick={() => setF({ ...f, bucket: "studio_opex", category: "software", project_id: "" })}>Studio OPEX (write-off)</button>
                    </div>
                    <p className="mono" style={{ margin: "4px 0 10px", lineHeight: 1.6 }}>{f.bucket === "client_reimbursable" ? NEVER : "Deductible against gross revenue (federal Schedule C / 1065 / 1120S, CA FTB, NYS). Never shown to clients."}</p>
                    <div className="r">
                        <input type="date" required value={f.spent_on} onChange={(e) => setF({ ...f, spent_on: e.target.value })} aria-label="Date" />
                        {f.bucket === "client_reimbursable" && (
                            <select value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })} aria-label="Project">
                                <option value="">Choose project…</option>
                                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                        )}
                        <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="Category">
                            {cats.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                        {!isMileage && <input placeholder="Vendor" value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} />}
                    </div>
                    {isMileage ? (
                        <div className="r" style={{ marginTop: 8 }}>
                            <input placeholder="From" value={f.trip_from} onChange={(e) => setF({ ...f, trip_from: e.target.value })} />
                            <input placeholder="To" value={f.trip_to} onChange={(e) => setF({ ...f, trip_to: e.target.value })} />
                            {!f.flat && <input inputMode="decimal" placeholder="Miles (round trip)" value={f.miles} onChange={(e) => setF({ ...f, miles: e.target.value })} style={{ width: 160 }} />}
                            <label className="mono"><input type="checkbox" checked={f.flat} onChange={(e) => setF({ ...f, flat: e.target.checked })} /> flat site-visit fee (per contract)</label>
                            {f.flat && <input inputMode="decimal" value={f.flat_fee} onChange={(e) => setF({ ...f, flat_fee: e.target.value })} style={{ width: 100 }} aria-label="Flat fee" />}
                            <span className="mono" style={{ opacity: 1 }}>{f.flat ? `Flat ${$2(f.flat_fee)}` : rate ? `${f.miles || 0} mi × $${Number(rate).toFixed(3)} = ${$2(mileAmt)}` : "No IRS rate on file for this date"}</span>
                        </div>
                    ) : (
                        <div className="r" style={{ marginTop: 8 }}>
                            <input required inputMode="decimal" placeholder={f.bucket === "client_reimbursable" ? "Your cost $" : "Amount $"} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} style={{ width: 130 }} />
                            {f.bucket === "client_reimbursable" && <>
                                <input inputMode="decimal" placeholder="Markup %" value={f.markup_pct} onChange={(e) => setF({ ...f, markup_pct: e.target.value })} style={{ width: 100 }} />
                                {f.category === "samples" && <>
                                    <input inputMode="decimal" placeholder="Client price (list / net)" value={f.list_price} onChange={(e) => setF({ ...f, list_price: e.target.value })} style={{ width: 190 }} />
                                    <input inputMode="decimal" placeholder="Trade cost (internal)" value={f.trade_cost} onChange={(e) => setF({ ...f, trade_cost: e.target.value })} style={{ width: 170 }} />
                                </>}
                            </>}
                            <input placeholder="Internal note" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} style={{ flex: "2 1 200px" }} />
                        </div>
                    )}
                    {f.bucket === "client_reimbursable" && (
                        <div className="r" style={{ marginTop: 8 }}>
                            <input placeholder="Client sees (optional — auto-labelled)" value={f.client_label} onChange={(e) => setF({ ...f, client_label: e.target.value })} style={{ flex: "2 1 280px" }} />
                            {!isMileage && <label className="mono"><input type="checkbox" checked={f.receipt_client_visible} onChange={(e) => setF({ ...f, receipt_client_visible: e.target.checked })} /> show receipt to client</label>}
                        </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => setReceipt(e.target.files?.[0] || null)} />
                    <div className="r" style={{ marginTop: 12 }}>
                        <button type="button" className="b g" onClick={() => fileRef.current?.click()}>{receipt ? receipt.name : isMileage ? "Attach odometer / map (optional)" : "Attach receipt"}</button>
                        <button className="b">Save</button>
                        {f.bucket === "client_reimbursable" && <span className="mono" style={{ opacity: 1 }}>Client line: {$2(preview)}</span>}
                    </div>
                    {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
                </form>

                <Statements db={db} projects={projects} focus={focus} stmts={stmts} rows={rows} reload={load} setMsg={setMsg} />

                <div className="c tw">
                    <div className="mono">Ledger · studio view (client sees the right-hand column only)</div>
                    <table style={{ marginTop: 8 }}>
                        <thead><tr><th>Date</th><th>Project</th><th>Bucket</th><th>Internal detail</th><th className="os-num">Cost</th><th>Client sees</th><th className="os-num">Billed</th><th>Status</th><th></th></tr></thead>
                        <tbody>
                            {shown.map((r) => (
                                <tr key={r.id}>
                                    <td>{r.spent_on}</td>
                                    <td>{pname(r.project_id)}</td>
                                    <td><span className="os-pill">{r.bucket === "studio_opex" ? "OPEX" : "pass-through"}</span></td>
                                    <td>{r.vendor ? <b>{r.vendor}</b> : null} {r.description}{r.trade_cost ? ` · trade ${$2(r.trade_cost)}` : ""}{r.internal_notes ? ` · ${r.internal_notes}` : ""}</td>
                                    <td className="os-num">{$2(r.amount)}</td>
                                    <td>{r.bucket === "client_reimbursable" ? r.client_label : "—"}{r.receipt_path && r.bucket === "client_reimbursable" && r.category !== "mileage" && <div><a href="#" onClick={(e) => { e.preventDefault(); toggleReceipt(r) }} className="mono">{r.receipt_client_visible ? "receipt shown" : "receipt hidden"}</a></div>}</td>
                                    <td className="os-num">{r.bucket === "client_reimbursable" ? $2(billed(r)) : "—"}</td>
                                    <td><span className="os-pill">{r.statement_id ? stmts.find((s) => s.id === r.statement_id)?.number || "on statement" : r.status}</span>{r.amount > 250 && r.bucket === "client_reimbursable" && <span className="os-pill">{r.client_auth_status || "needs written OK"}</span>}</td>
                                    <td className="r" style={{ gap: 6 }}>{r.receipt_path && <button className="b g" onClick={() => openReceipt(r.receipt_path)}>Receipt</button>}<button className="b g" onClick={() => del(r)}>Delete</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!shown.length && <p className="mono">No entries yet.</p>}
                </div>
                <RatesPanel db={db} rates={rates} reload={load} />
            </Gate>
        </div>
    )
}

function Statements({ db, projects, focus, stmts, rows, reload, setMsg }: any) {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const [pid, setPid] = React.useState(focus || "")
    const [start, setStart] = React.useState(first)
    const [end, setEnd] = React.useState(today())
    const [basis, setBasis] = React.useState("monthly")
    const [label, setLabel] = React.useState("")
    const [note, setNote] = React.useState("")
    const [pay, setPay] = React.useState("")
    React.useEffect(() => { if (focus) setPid(focus) }, [focus])
    const build = async () => {
        if (!pid) return setMsg("Choose the project for the statement.")
        const { error } = await db.rpc("studio_build_statement", { p_project: pid, p_start: start, p_end: end, p_label: label || null, p_basis: basis })
        setMsg(error ? error.message : "Draft statement created. Preview it, then send.")
        reload()
    }
    const send = async (s: any) => {
        const { error } = await db.rpc("studio_send_statement", { p_id: s.id, p_note: note || null, p_pay_url: pay || null })
        setMsg(error ? error.message : "Sent. The client has a one-click approval in their Ledger and an email.")
        reload()
    }
    const paid = async (s: any) => { const { error } = await db.rpc("studio_mark_statement_paid", { p_id: s.id }); setMsg(error ? error.message : "Marked paid."); reload() }
    const voidS = async (s: any) => { if (!confirm("Void this statement and release its items?")) return; await db.from("studio_reimbursables").update({ statement_id: null, status: "logged" }).eq("statement_id", s.id); await db.from("reimbursable_statements").update({ status: "void" }).eq("id", s.id); reload() }
    const lines = (s: any) => {
        const m: Record<string, { n: number; amt: number }> = {}
        rows.filter((r: any) => r.statement_id === s.id).forEach((r: any) => { const k = r.client_label || "Reimbursable Expense"; m[k] = m[k] || { n: 0, amt: 0 }; m[k].n++; m[k].amt += Number(r.list_price ?? Number(r.amount) * (1 + Number(r.markup_pct || 0) / 100)) })
        return Object.entries(m)
    }
    const pname = (id: string) => projects.find((p: any) => p.id === id)?.title || ""
    const printS = (s: any) => printHtml(`${s.number} · Reimbursable Statement`, `<h1>Reimbursable Statement</h1><div class="rule"></div><p><b>${esc(pname(s.project_id))}</b><br>${esc(s.period_label)} · ${esc(s.number)}</p>${s.client_note ? `<p>${esc(s.client_note)}</p>` : ""}<table><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Amount</th></tr></thead><tbody>${lines(s).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${v.n}</td><td class="n">${$2(v.amt)}</td></tr>`).join("")}<tr class="tot"><td>Total</td><td></td><td class="n">${$2(s.total)}</td></tr></tbody></table><p class="m" style="margin-top:24pt">Pass-through expenses incurred on your behalf, billed at cost or per the agreed markup. Items over $250 were approved in writing in advance.</p>`)
    const visible = stmts.filter((s: any) => (!focus || s.project_id === focus) && s.status !== "void")
    return (
        <div className="c">
            <div className="mono">Statements · batch small items into one monthly or milestone statement</div>
            <div className="r" style={{ marginTop: 8 }}>
                <select value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Project"><option value="">Project…</option>{projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
                <select value={basis} onChange={(e) => setBasis(e.target.value)} aria-label="Basis"><option value="monthly">Monthly</option><option value="milestone">Milestone</option></select>
                <label className="mono">From <input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
                <label className="mono">To <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
                <input placeholder={basis === "milestone" ? "e.g. Schematic Design reimbursables" : "Label (optional)"} value={label} onChange={(e) => setLabel(e.target.value)} />
                <button className="b" onClick={build}>Build draft</button>
            </div>
            {visible.map((s: any) => (
                <div key={s.id} style={{ borderTop: ".5px solid color-mix(in srgb,var(--ink) 25%,transparent)", marginTop: 12, paddingTop: 12 }}>
                    <div className="r" style={{ justifyContent: "space-between" }}>
                        <div><b>{s.number}</b> · {pname(s.project_id)} · {s.period_label} <span className="os-pill">{s.status}</span></div>
                        <b style={{ fontSize: 20 }}>{$2(s.total)}</b>
                    </div>
                    <div className="tw"><table style={{ marginTop: 6 }}><tbody>{lines(s).map(([k, v]) => <tr key={k}><td>{k}</td><td className="os-num">{v.n}</td><td className="os-num">{$2(v.amt)}</td></tr>)}</tbody></table></div>
                    {s.client_reply && <p style={{ fontSize: 14 }}>Client: “{s.client_reply}”</p>}
                    <div className="r" style={{ marginTop: 8 }}>
                        {s.status === "draft" && <>
                            <input placeholder="Note to client (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: "2 1 240px" }} />
                            <input placeholder="Payment link (optional)" value={pay} onChange={(e) => setPay(e.target.value)} />
                            <button className="b" onClick={() => send(s)}>Send for approval</button>
                        </>}
                        {s.status === "approved" && <button className="b" onClick={() => paid(s)}>Mark paid</button>}
                        <button className="b g" onClick={() => printS(s)}>Print / PDF</button>
                        {(s.status === "draft" || s.status === "sent") && <button className="b g" onClick={() => voidS(s)}>Void</button>}
                    </div>
                </div>
            ))}
        </div>
    )
}

function RatesPanel({ db, rates, reload }: any) {
    const [f, setF] = React.useState({ effective_from: "2027-01-01", effective_to: "2027-12-31", rate: "", source: "IRS notice" })
    const add = async () => { if (!f.rate) return; await db.from("irs_mileage_rates").upsert({ ...f, rate: Number(f.rate) }); reload() }
    return (
        <details className="c">
            <summary className="mono" style={{ cursor: "pointer" }}>IRS standard mileage rates</summary>
            <table style={{ marginTop: 8 }}><thead><tr><th>From</th><th>To</th><th className="os-num">Rate</th><th>Source</th></tr></thead>
                <tbody>{rates.map((r: any) => <tr key={r.effective_from}><td>{r.effective_from}</td><td>{r.effective_to}</td><td className="os-num">${Number(r.rate).toFixed(3)}</td><td>{r.source}</td></tr>)}</tbody></table>
            <div className="r" style={{ marginTop: 8 }}>
                <input type="date" value={f.effective_from} onChange={(e) => setF({ ...f, effective_from: e.target.value })} />
                <input type="date" value={f.effective_to} onChange={(e) => setF({ ...f, effective_to: e.target.value })} />
                <input inputMode="decimal" placeholder="0.000" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} style={{ width: 90 }} />
                <input value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} />
                <button className="b g" onClick={add}>Add rate</button>
            </div>
        </details>
    )
}

/* ═════════════════════ PROPOSAL & FEE BUILDER ═════════════════════ */
type Tier = "principal" | "pm" | "designer" | "admin"
const TIERS: [Tier, string, string, string][] = [["principal", "Principal", "$250–400/h", "owner time"], ["pm", "Senior PM", "$150–250/h", "cost $50–80/h"], ["designer", "Designer / Drafter", "$85–135/h", "cost $28–45/h"], ["admin", "Admin / Field", "$50–85/h", "cost $20–30/h"]]
const DEFAULT_TIERS = { principal: { bill: 300, cost: 95 }, pm: { bill: 195, cost: 65 }, designer: { bill: 110, cost: 36 }, admin: { bill: 65, cost: 25 } }
type H = Record<Tier, number>
const h = (principal: number, pm: number, designer: number, admin: number): H => ({ principal, pm, designer, admin })
const WBS_TEMPLATES: Record<string, { label: string; type: "residential" | "commercial"; phases: { key: string; name: string; on: boolean; tasks: { name: string; hours: H }[] }[] }> = {
    res_small: {
        label: "Residential · small exterior (courtyard, gate, facade)", type: "residential",
        phases: [
            { key: "P1", name: "Pre-Design · site survey & feasibility", on: true, tasks: [{ name: "Site visit, measure & photo survey", hours: h(3, 0, 4, 1) }, { name: "Zoning & code feasibility", hours: h(2, 2, 2, 0) }, { name: "Existing-conditions base drawings", hours: h(0, 1, 6, 0) }, { name: "Programming & kickoff with client", hours: h(2, 0, 0, 1) }] },
            { key: "P2", name: "Schematic Design", on: true, tasks: [{ name: "Concept options (2) & precedents", hours: h(4, 1, 8, 0) }, { name: "Site plan, elevations, massing", hours: h(1, 2, 8, 0) }, { name: "Presentation & revisions", hours: h(2, 1, 3, 1) }] },
            { key: "P3", name: "Design Development & coordination", on: true, tasks: [{ name: "Develop chosen scheme, materials", hours: h(3, 2, 10, 0) }, { name: "Structural engineer coordination", hours: h(1, 3, 3, 1) }, { name: "Outline specs & cost check with GC", hours: h(2, 2, 4, 1) }] },
            { key: "P4", name: "Construction Documents & permitting", on: false, tasks: [{ name: "Permit set (A/S sheets coordination)", hours: h(2, 6, 24, 0) }, { name: "Plan check submittal & corrections", hours: h(2, 6, 8, 3) }] },
            { key: "P5", name: "Construction Administration & procurement", on: false, tasks: [{ name: "Site visits & RFIs", hours: h(4, 6, 2, 2) }, { name: "Submittals & procurement tracking", hours: h(1, 4, 2, 4) }, { name: "Punch list & close-out", hours: h(2, 2, 1, 1) }] },
        ],
    },
    res_addition: {
        label: "Residential · addition / ADU / major remodel", type: "residential",
        phases: [
            { key: "P1", name: "Pre-Design · site survey & feasibility", on: true, tasks: [{ name: "As-built survey & photo documentation", hours: h(4, 4, 16, 2) }, { name: "Zoning, overlays, setbacks, FAR", hours: h(4, 6, 4, 0) }, { name: "Programming & budget alignment", hours: h(4, 2, 2, 1) }] },
            { key: "P2", name: "Schematic Design", on: true, tasks: [{ name: "Options, plans, massing", hours: h(8, 6, 30, 0) }, { name: "Client reviews (2) & revisions", hours: h(6, 4, 10, 2) }] },
            { key: "P3", name: "Design Development & coordination", on: true, tasks: [{ name: "Plans/sections/elevations developed", hours: h(6, 10, 40, 0) }, { name: "Structural / MEP / T-24 coordination", hours: h(4, 12, 8, 2) }, { name: "Finish & fixture selections", hours: h(6, 4, 12, 2) }] },
            { key: "P4", name: "Construction Documents & permitting", on: true, tasks: [{ name: "Permit & construction set", hours: h(6, 20, 70, 2) }, { name: "Plan check (2 rounds)", hours: h(4, 12, 20, 6) }] },
            { key: "P5", name: "Construction Administration & procurement", on: true, tasks: [{ name: "Site visits (biweekly) & RFIs", hours: h(12, 20, 6, 4) }, { name: "Submittals, procurement, change orders", hours: h(4, 14, 6, 10) }, { name: "Punch & close-out", hours: h(3, 4, 2, 2) }] },
        ],
    },
    com_ti: {
        label: "Commercial · tenant improvement (retail / restaurant / office)", type: "commercial",
        phases: [
            { key: "P1", name: "Pre-Design · survey, lease & code review", on: true, tasks: [{ name: "Field survey & existing drawings", hours: h(3, 6, 20, 2) }, { name: "Code analysis (occupancy, egress, ADA)", hours: h(3, 8, 6, 0) }, { name: "Test fit & program", hours: h(4, 4, 12, 0) }] },
            { key: "P2", name: "Schematic Design", on: true, tasks: [{ name: "Layout options & brand concept", hours: h(8, 8, 30, 0) }, { name: "Owner / landlord review", hours: h(4, 4, 4, 2) }] },
            { key: "P3", name: "Design Development & coordination", on: true, tasks: [{ name: "Design development set", hours: h(6, 14, 50, 0) }, { name: "MEP/FP & structural coordination", hours: h(4, 18, 12, 2) }, { name: "FF&E and finishes", hours: h(4, 6, 16, 4) }] },
            { key: "P4", name: "Construction Documents & permitting", on: true, tasks: [{ name: "CD set & specifications", hours: h(6, 24, 90, 4) }, { name: "Permit submittal & corrections", hours: h(4, 14, 24, 8) }] },
            { key: "P5", name: "Construction Administration & procurement", on: true, tasks: [{ name: "OAC meetings, site visits, RFIs", hours: h(10, 30, 10, 6) }, { name: "Submittals & procurement", hours: h(4, 18, 10, 12) }, { name: "Punch, close-out, as-builts", hours: h(3, 6, 6, 3) }] },
        ],
    },
}
const ADDERS: Record<"residential" | "commercial", { key: string; label: string; hours: H; per?: string }[]> = {
    residential: [
        { key: "zoning", label: "Zoning variance / yard modification / historic / HOA review", hours: h(6, 8, 6, 2) },
        { key: "meetings", label: "Additional client meetings", hours: h(1.5, 0.5, 0, 0.5), per: "meeting" },
        { key: "finishes", label: "Finish schedules & selections package", hours: h(3, 2, 10, 2) },
        { key: "renderings", label: "Photoreal renderings", hours: h(1, 0, 6, 0), per: "view" },
    ],
    commercial: [
        { key: "ada", label: "ADA / accessibility compliance package", hours: h(2, 6, 8, 0) },
        { key: "egress", label: "Egress & fire / life-safety plans", hours: h(2, 6, 10, 0) },
        { key: "mep", label: "MEP coordination (extended)", hours: h(2, 14, 8, 2) },
        { key: "plancheck", label: "Plan check iteration", hours: h(1, 6, 8, 2), per: "round" },
        { key: "landlord", label: "Landlord review cycle", hours: h(1, 4, 4, 1), per: "cycle" },
    ],
}
export function ProposalBuilder({ db, focus }: any) {
    const projects = useProjects(db)
    const [tplKey, setTplKey] = React.useState("res_small")
    const [title, setTitle] = React.useState("The Lorado Courtyard · fee check")
    const [projectId, setProjectId] = React.useState<string>(focus || "67663797-dbb1-410b-b00b-a99452c6a660")
    const [tiers, setTiers] = React.useState<any>(DEFAULT_TIERS)
    const [wbs, setWbs] = React.useState<any[]>(() => JSON.parse(JSON.stringify(WBS_TEMPLATES.res_small.phases)))
    const [adders, setAdders] = React.useState<Record<string, number>>({})
    const [mult, setMult] = React.useState(3.0)
    const [overheadX, setOverheadX] = React.useState(1.0)
    const [scale, setScale] = React.useState(1)
    const [cont, setCont] = React.useState(15)
    const [reimb, setReimb] = React.useState(350)
    const [quoted, setQuoted] = React.useState<number | "">(9000)
    const [saved, setSaved] = React.useState<any[]>([])
    const [savedId, setSavedId] = React.useState<string | null>(null)
    const [msg, setMsg] = React.useState("")
    const [err, setErr] = React.useState<any>(null)
    const type = WBS_TEMPLATES[tplKey]?.type || "residential"
    const loadSaved = React.useCallback(async () => { const { data, error } = await db.from("proposal_estimates").select("*").order("updated_at", { ascending: false }).limit(30); if (isMissing(error)) setErr(error); setSaved(data || []) }, [db])
    React.useEffect(() => { loadSaved() }, [loadSaved])
    const pickTemplate = (k: string) => { setTplKey(k); setWbs(JSON.parse(JSON.stringify(WBS_TEMPLATES[k].phases))); setAdders({}) }
    // totals
    const tierHours: H = { principal: 0, pm: 0, designer: 0, admin: 0 }
    const phaseRows = wbs.map((p: any) => {
        const ph: H = { principal: 0, pm: 0, designer: 0, admin: 0 }
        if (p.on) p.tasks.forEach((t: any) => (Object.keys(ph) as Tier[]).forEach((k) => (ph[k] += Number(t.hours[k] || 0) * scale)))
        ;(Object.keys(ph) as Tier[]).forEach((k) => (tierHours[k] += ph[k]))
        return { ...p, ph }
    })
    ADDERS[type].forEach((a) => { const n = Number(adders[a.key] || 0); if (n) (Object.keys(tierHours) as Tier[]).forEach((k) => (tierHours[k] += a.hours[k] * n)) })
    const hoursTotal = (Object.values(tierHours) as number[]).reduce((a, b) => a + b, 0)
    const labor = (Object.keys(tierHours) as Tier[]).reduce((a, k) => a + tierHours[k] * Number(tiers[k].cost), 0)
    const atRates = (Object.keys(tierHours) as Tier[]).reduce((a, k) => a + tierHours[k] * Number(tiers[k].bill), 0)
    const target = labor * mult
    const fee = Math.ceil((target * (1 + cont / 100)) / 50) * 50
    const overhead = labor * overheadX
    const margin = fee ? (fee - labor - overhead) / fee : 0
    const q = Number(quoted || 0)
    const qMult = labor ? q / labor : 0
    const qMargin = q ? (q - labor - overhead) / q : 0
    const qHours = q && hoursTotal ? (q / (1 + cont / 100) / mult) / (labor / hoursTotal) : 0
    const blended = hoursTotal ? labor / hoursTotal : 0
    const totals = { hours: tierHours, hoursTotal, labor, atRates, target, fee, overhead, margin, quoted: q, qMult, qMargin }
    async function save() {
        const row = { title, project_id: projectId || null, project_type: type, tiers, wbs, adders: Object.entries(adders).filter(([, v]) => v).map(([k, v]) => ({ key: k, n: v })), multiplier: mult, contingency_pct: cont, reimbursables: reimb, quoted_fee: q || null, totals, notes: `template:${tplKey};scale:${scale};overheadX:${overheadX}` }
        const res = savedId ? await db.from("proposal_estimates").update(row).eq("id", savedId).select().single() : await db.from("proposal_estimates").insert(row).select().single()
        if (res.error) return setMsg(res.error.message)
        setSavedId(res.data.id); setMsg("Saved."); loadSaved()
    }
    const open = (e: any) => {
        setSavedId(e.id); setTitle(e.title); setProjectId(e.project_id || ""); setTiers(e.tiers); setWbs(e.wbs); setMult(Number(e.multiplier)); setCont(Number(e.contingency_pct)); setReimb(Number(e.reimbursables)); setQuoted(e.quoted_fee ? Number(e.quoted_fee) : "")
        const n = String(e.notes || ""); const tk = /template:(\w+)/.exec(n)?.[1]; if (tk) setTplKey(tk); const sc = /scale:([\d.]+)/.exec(n)?.[1]; if (sc) setScale(Number(sc)); const ox = /overheadX:([\d.]+)/.exec(n)?.[1]; if (ox) setOverheadX(Number(ox))
        const a: Record<string, number> = {}; (e.adders || []).forEach((x: any) => (a[x.key] = x.n)); setAdders(a)
    }
    const setTask = (pi: number, ti: number, k: Tier, v: string) => { const w = JSON.parse(JSON.stringify(wbs)); w[pi].tasks[ti].hours[k] = Number(v) || 0; setWbs(w) }
    const printProposal = () => printHtml(title, `<h1>Fee Proposal</h1><div class="rule"></div><p><b>${esc(title)}</b><br>${esc(WBS_TEMPLATES[tplKey]?.label || "")}</p><h2>Scope & fee by phase</h2><table><thead><tr><th>Phase</th><th class="n">Hours</th><th class="n">Fee</th></tr></thead><tbody>${phaseRows.filter((p) => p.on).map((p) => { const ph = (Object.values(p.ph) as number[]).reduce((a, b) => a + b, 0); const share = labor ? (Object.keys(p.ph) as Tier[]).reduce((a, k) => a + p.ph[k] * tiers[k].cost, 0) / labor : 0; return `<tr><td>${esc(p.name)}</td><td class="n">${Math.round(ph)}</td><td class="n">${$0(fee * share)}</td></tr>` }).join("")}<tr class="tot"><td>Fixed professional fee (includes ${cont}% contingency)</td><td class="n">${Math.round(hoursTotal)}</td><td class="n">${$0(fee)}</td></tr></tbody></table><p>Reimbursable expenses (mileage at the IRS standard rate, printing, agency filing fees, samples, courier) are billed at cost on monthly statements; estimated ${$0(reimb)}. Consultant fees (structural, civil, MEP) are contracted directly between the client and the consultant.</p>`)
    return (
        <div>
            <OSStyle />
            <Gate err={err}>
                <p style={{ maxWidth: 760, lineHeight: 1.7, fontSize: 14 }}>Build a fee from the bottom up: hours per task for each staff tier, direct labor at cost, a 3.0–3.5× multiplier (≈ 1× labor + 1× overhead + 1× profit), {type === "residential" ? "residential" : "commercial"} adders, and a contingency. Compare against a quoted fee to see the real multiplier and margin.</p>
                <div className="c">
                    <div className="r">
                        <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: "2 1 260px" }} aria-label="Estimate title" />
                        <select value={tplKey} onChange={(e) => pickTemplate(e.target.value)} aria-label="Template">{Object.entries(WBS_TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select>
                        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project"><option value="">Prospect (no project)</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
                    </div>
                    <div className="tw" style={{ marginTop: 12 }}>
                        <table>
                            <thead><tr><th>Tier</th><th>Range</th><th className="os-num">Billing $/h</th><th className="os-num">Cost $/h</th><th className="os-num">Hours</th><th className="os-num">Labor cost</th></tr></thead>
                            <tbody>{TIERS.map(([k, l, range, cost]) => (
                                <tr key={k}><td>{l}</td><td className="mono">{range} · {cost}</td>
                                    <td className="os-num"><input inputMode="decimal" value={tiers[k].bill} onChange={(e) => setTiers({ ...tiers, [k]: { ...tiers[k], bill: Number(e.target.value) || 0 } })} style={{ width: 70, textAlign: "right" }} /></td>
                                    <td className="os-num"><input inputMode="decimal" value={tiers[k].cost} onChange={(e) => setTiers({ ...tiers, [k]: { ...tiers[k], cost: Number(e.target.value) || 0 } })} style={{ width: 70, textAlign: "right" }} /></td>
                                    <td className="os-num">{tierHours[k].toFixed(1)}</td><td className="os-num">{$0(tierHours[k] * tiers[k].cost)}</td></tr>
                            ))}</tbody>
                        </table>
                    </div>
                </div>
                <div className="c tw">
                    <div className="r" style={{ justifyContent: "space-between" }}><span className="mono">Work breakdown · hours per task</span><label className="mono">Size / complexity × <input type="number" step="0.1" min="0.3" max="4" value={scale} onChange={(e) => setScale(Number(e.target.value) || 1)} style={{ width: 70 }} /></label></div>
                    <table style={{ marginTop: 8 }}>
                        <thead><tr><th>Phase / task</th>{TIERS.map(([k, l]) => <th key={k} className="os-num">{l.split(" ")[0]}</th>)}<th className="os-num">Hours</th></tr></thead>
                        <tbody>
                            {wbs.map((p: any, pi: number) => (
                                <React.Fragment key={p.key}>
                                    <tr><td colSpan={6} style={{ paddingTop: 14 }}><label><input type="checkbox" checked={p.on} onChange={(e) => { const w = [...wbs]; w[pi] = { ...p, on: e.target.checked }; setWbs(w) }} /> <b>{p.key} · {p.name}</b></label>{!p.on && <span className="mono"> · not in this contract</span>}</td></tr>
                                    {p.on && p.tasks.map((t: any, ti: number) => (
                                        <tr key={ti}><td style={{ paddingLeft: 22 }}>{t.name}</td>
                                            {(["principal", "pm", "designer", "admin"] as Tier[]).map((k) => <td key={k} className="os-num"><input inputMode="decimal" value={t.hours[k]} onChange={(e) => setTask(pi, ti, k, e.target.value)} style={{ width: 52, textAlign: "right" }} aria-label={`${t.name} ${k} hours`} /></td>)}
                                            <td className="os-num">{((Object.values(t.hours) as number[]).reduce((a, b) => a + Number(b), 0) * scale).toFixed(1)}</td></tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                    <div className="mono" style={{ marginTop: 14 }}>{type} adders</div>
                    <div className="r" style={{ marginTop: 6 }}>
                        {ADDERS[type].map((a) => (
                            <label key={a.key} style={{ fontSize: 14, display: "flex", gap: 6, alignItems: "center" }}>
                                <input type="number" min={0} value={adders[a.key] || 0} onChange={(e) => setAdders({ ...adders, [a.key]: Number(e.target.value) || 0 })} style={{ width: 54 }} /> {a.label}{a.per ? ` (per ${a.per})` : ""}
                            </label>
                        ))}
                    </div>
                </div>
                <div className="c">
                    <div className="r">
                        <label className="mono">Multiplier <input type="number" step="0.1" min="2" max="4" value={mult} onChange={(e) => setMult(Number(e.target.value) || 3)} style={{ width: 70 }} /></label>
                        <label className="mono">Overhead × labor <input type="number" step="0.1" value={overheadX} onChange={(e) => setOverheadX(Number(e.target.value) || 0)} style={{ width: 70 }} /></label>
                        <label className="mono">Contingency % <input type="number" value={cont} onChange={(e) => setCont(Number(e.target.value) || 0)} style={{ width: 70 }} /></label>
                        <label className="mono">Reimbursables $ <input inputMode="decimal" value={reimb} onChange={(e) => setReimb(Number(e.target.value) || 0)} style={{ width: 90 }} /></label>
                        <label className="mono">Quoted / contract fee $ <input inputMode="decimal" value={quoted} onChange={(e) => setQuoted(e.target.value === "" ? "" : Number(e.target.value))} style={{ width: 100 }} /></label>
                    </div>
                    <div className="tw" style={{ marginTop: 12 }}>
                        <table>
                            <thead><tr><th>Summary</th><th className="os-num">Value</th><th>Note</th></tr></thead>
                            <tbody>
                                {TIERS.map(([k, l]) => <tr key={k}><td>Hours · {l}</td><td className="os-num">{tierHours[k].toFixed(1)}</td><td></td></tr>)}
                                <tr><td><b>Total hours</b></td><td className="os-num"><b>{hoursTotal.toFixed(1)}</b></td><td>Blended cost {$2(blended)}/h</td></tr>
                                <tr><td>Direct labor cost</td><td className="os-num">{$0(labor)}</td><td>Hours × cost rates</td></tr>
                                <tr><td>Value at billing rates</td><td className="os-num">{$0(atRates)}</td><td>Hourly-billing equivalent</td></tr>
                                <tr><td>{mult.toFixed(1)}× billable target</td><td className="os-num">{$0(target)}</td><td>Labor × multiplier</td></tr>
                                <tr><td>Reimbursables / pass-throughs</td><td className="os-num">{$0(reimb)}</td><td>Billed at cost on statements — not in the fee</td></tr>
                                <tr><td><b>Recommended fixed fee (+{cont}% contingency)</b></td><td className="os-num"><b>{$0(fee)}</b></td><td>Rounded to $50</td></tr>
                                <tr><td>Net margin %</td><td className="os-num">{pct(margin)}</td><td>(fee − labor − overhead at {overheadX}× labor) ÷ fee</td></tr>
                                {q > 0 && <>
                                    <tr><td colSpan={3} style={{ paddingTop: 14 }} className="mono">Against the quoted fee of {$0(q)}</td></tr>
                                    <tr><td>Effective multiplier</td><td className="os-num">{qMult.toFixed(2)}×</td><td>{qMult >= mult ? "At or above target" : `Below the ${mult.toFixed(1)}× target by ${$0(target - q)}`}</td></tr>
                                    <tr><td>Net margin at quoted fee</td><td className="os-num">{pct(qMargin)}</td><td></td></tr>
                                    <tr><td>Hours the quoted fee supports at target</td><td className="os-num">{qHours.toFixed(0)}</td><td>{qHours < hoursTotal ? `${(hoursTotal - qHours).toFixed(0)} h over — tighten scope or plan an additional-services change order` : "Within budget"}</td></tr>
                                </>}
                            </tbody>
                        </table>
                    </div>
                    <div className="r" style={{ marginTop: 12 }}>
                        <button className="b" onClick={save}>{savedId ? "Save changes" : "Save estimate"}</button>
                        {savedId && <button className="b g" onClick={() => { setSavedId(null); setTitle(title + " (copy)") }}>Save as new</button>}
                        <button className="b g" onClick={printProposal}>Print client fee summary</button>
                        {msg && <span className="mono">{msg}</span>}
                    </div>
                </div>
                {saved.length > 0 && (
                    <div className="c tw">
                        <div className="mono">Saved estimates</div>
                        <table style={{ marginTop: 6 }}><thead><tr><th>Title</th><th>Type</th><th className="os-num">Fee</th><th className="os-num">Quoted</th><th className="os-num">Margin</th><th>Updated</th><th></th></tr></thead>
                            <tbody>{saved.map((e) => <tr key={e.id}><td>{e.title}</td><td>{e.project_type}</td><td className="os-num">{$0(e.totals?.fee)}</td><td className="os-num">{e.quoted_fee ? $0(e.quoted_fee) : "—"}</td><td className="os-num">{pct(Number(e.totals?.margin))}</td><td>{String(e.updated_at).slice(0, 10)}</td><td><button className="b g" onClick={() => open(e)}>Open</button></td></tr>)}</tbody></table>
                    </div>
                )}
            </Gate>
        </div>
    )
}

/* ═════════════════════ GROWTH · company dashboard ═════════════════════ */
const STAGES: [string, string, number][] = [["lead", "Lead", 0.1], ["qualified", "Qualified", 0.25], ["proposal", "Proposal sent", 0.5], ["negotiation", "Negotiation", 0.7], ["won", "Won", 1], ["on_hold", "On hold", 0.05]]
const stageP = (s: string) => STAGES.find((x) => x[0] === s)?.[2] ?? 0
const prob = (d: any) => (d.probability != null ? Number(d.probability) : stageP(d.stage))
const monday = (d: Date) => { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); x.setHours(0, 0, 0, 0); return x }

export function GrowthDashboard({ db, openTab }: any) {
    const [deals, setDeals] = React.useState<any[]>([])
    const [targets, setTargets] = React.useState<any[]>([])
    const [invoices, setInvoices] = React.useState<any[]>([])
    const [leads, setLeads] = React.useState<any[]>([])
    const [follow, setFollow] = React.useState<any[]>([])
    const [opex, setOpex] = React.useState(0)
    const [err, setErr] = React.useState<any>(null)
    const [edit, setEdit] = React.useState<any>(null)
    const [msg, setMsg] = React.useState("")
    const year = new Date().getFullYear()
    const load = React.useCallback(async () => {
        const [d, t, i, l, f, o] = await Promise.all([
            db.from("pipeline_deals").select("*").order("updated_at", { ascending: false }),
            db.from("studio_targets").select("*").order("year"),
            db.from("invoices").select("id,project_id,amount,amount_paid,status,issued_at,paid_at"),
            db.from("lead_signals").select("*").in("status", ["new", "reviewing", "pursue"]).order("score", { ascending: false, nullsFirst: false }).limit(30),
            db.from("follow_up_reminders").select("*").eq("status", "open").order("due_on").limit(30),
            db.from("studio_reimbursables").select("amount,spent_on,bucket").eq("bucket", "studio_opex").gte("spent_on", `${year}-01-01`),
        ])
        if (isMissing(d.error) || isMissing(t.error)) return setErr(d.error || t.error)
        setDeals(d.data || []); setTargets(t.data || []); setInvoices(i.data || []); setLeads(l.data || []); setFollow(f.data || [])
        setOpex((o.data || []).reduce((a: number, r: any) => a + Number(r.amount), 0))
    }, [db, year])
    React.useEffect(() => { load() }, [load])
    const tgt = targets.find((t) => t.year === year) || { revenue_target: 0, profit_target: 0, max_weekly_hours: 40, max_active_projects: 3, avg_fee_target: 0 }
    const collected = invoices.filter((i) => i.paid_at && String(i.paid_at).startsWith(String(year))).reduce((a, i) => a + Number(i.amount_paid ?? i.amount ?? 0), 0)
    const outstanding = invoices.filter((i) => i.status !== "paid" && i.status !== "void" && i.issued_at).reduce((a, i) => a + Number(i.amount || 0) - Number(i.amount_paid || 0), 0)
    const invoicedByProject: Record<string, number> = {}
    invoices.forEach((i) => { if (i.project_id) invoicedByProject[i.project_id] = (invoicedByProject[i.project_id] || 0) + Number(i.amount || 0) })
    const won = deals.filter((d) => d.stage === "won")
    const backlog = won.reduce((a, d) => a + Math.max(0, Number(d.est_fee || 0) - (d.project_id ? invoicedByProject[d.project_id] || 0 : 0)), 0)
    const open = deals.filter((d) => !["won", "lost"].includes(d.stage))
    const weighted = open.reduce((a, d) => a + Number(d.est_fee || 0) * prob(d), 0)
    const gap = Math.max(0, Number(tgt.revenue_target) - collected - outstanding - backlog)
    const avgFee = Number(tgt.avg_fee_target) || (won.length ? won.reduce((a, d) => a + Number(d.est_fee || 0), 0) / won.length : 9000)
    const needDeals = avgFee ? Math.ceil(gap / avgFee) : 0
    // forecast by month (12 months): spread each fee evenly over its weeks from start, × probability
    const months: { key: string; label: string; won: number; weighted: number }[] = []
    const base = new Date(); base.setDate(1)
    for (let i = 0; i < 12; i++) { const m = new Date(base.getFullYear(), base.getMonth() + i, 1); months.push({ key: m.toISOString().slice(0, 7), label: m.toLocaleString([], { month: "short" }), won: 0, weighted: 0 }) }
    deals.filter((d) => d.stage !== "lost" && d.est_fee && d.expected_start).forEach((d) => {
        const weeks = Math.max(1, Number(d.duration_weeks || 12)); const per = Number(d.est_fee) / weeks; const p = prob(d)
        for (let w = 0; w < weeks; w++) { const k = addDays(d.expected_start, w * 7).toISOString().slice(0, 7); const m = months.find((x) => x.key === k); if (m) { if (d.stage === "won") m.won += per; else m.weighted += per * p } }
    })
    const monthlyTarget = Number(tgt.revenue_target) / 12
    const maxBar = Math.max(monthlyTarget, ...months.map((m) => m.won + m.weighted), 1)
    // capacity: next 16 weeks
    const weeks: { start: Date; committed: number; likely: number }[] = []
    const w0 = monday(new Date())
    for (let i = 0; i < 16; i++) weeks.push({ start: addDays(w0, i * 7), committed: 0, likely: 0 })
    deals.filter((d) => d.stage !== "lost" && d.expected_start).forEach((d) => {
        const s = monday(new Date(d.expected_start)); const e = addDays(s, Math.max(1, Number(d.duration_weeks || 12)) * 7); const hrs = Number(d.weekly_hours || 0)
        weeks.forEach((w) => { if (w.start >= s && w.start < e) { if (d.stage === "won") w.committed += hrs; else if (prob(d) >= 0.5) w.likely += hrs * prob(d) } })
    })
    const maxH = Number(tgt.max_weekly_hours || 40)
    const over = weeks.filter((w) => w.committed + w.likely > maxH)
    const activeNow = won.filter((d) => { const s = new Date(d.expected_start || 0); const e = addDays(s, Number(d.duration_weeks || 12) * 7); return s <= new Date() && e >= new Date() }).length
    const nextOpen = (hrs: number) => weeks.find((w) => w.committed + w.likely + hrs <= maxH)
    const late = (d: any) => d.next_step_on && d.next_step_on < today()
    async function saveDeal(e: React.FormEvent) {
        e.preventDefault()
        const row = { ...edit }; delete row.id; delete row.created_at; delete row.updated_at
        ;["est_fee", "probability", "duration_weeks", "weekly_hours"].forEach((k) => (row[k] = row[k] === "" || row[k] == null ? null : Number(row[k])))
        ;["expected_start", "next_step_on"].forEach((k) => (row[k] = row[k] || null))
        const res = edit.id ? await db.from("pipeline_deals").update(row).eq("id", edit.id) : await db.from("pipeline_deals").insert(row)
        setMsg(res.error ? res.error.message : "Saved."); if (!res.error) { setEdit(null); load() }
    }
    const move = async (d: any, stage: string) => { await db.from("pipeline_deals").update({ stage }).eq("id", d.id); load() }
    const leadTo = async (l: any, status: string) => {
        await db.from("lead_signals").update({ status }).eq("id", l.id)
        if (status === "pursue") await db.from("pipeline_deals").insert({ name: `${l.address || "Lead"} · ${l.work_type || l.permit_type || ""}`.slice(0, 120), market: l.market, source: "lead_signal:" + l.source, stage: "lead", lead_signal_id: l.id, notes: l.description, next_step: "Research & first outreach", next_step_on: today() })
        load()
    }
    const fuDone = async (f: any, status: string) => { await db.from("follow_up_reminders").update({ status, due_on: status === "snoozed" ? addDays(new Date(), 3).toISOString().slice(0, 10) : f.due_on }).eq("id", f.id); load() }
    const saveTarget = async (t: any) => { const { error } = await db.from("studio_targets").upsert({ ...t, updated_at: new Date().toISOString() }); setMsg(error ? error.message : "Targets saved."); load() }
    const estProfit = collected - opex
    return (
        <div>
            <OSStyle />
            <Gate err={err}>
                <div className="os-kpis">
                    <div className="os-kpi"><span className="mono">Collected {year}</span><b>{$0(collected)}</b><small>{tgt.revenue_target ? pct(collected / tgt.revenue_target) + " of " + $0(tgt.revenue_target) : "Set a target below"}</small></div>
                    <div className="os-kpi"><span className="mono">Invoiced, unpaid</span><b>{$0(outstanding)}</b><small>Chase anything past 14 days</small></div>
                    <div className="os-kpi"><span className="mono">Booked backlog</span><b>{$0(backlog)}</b><small>Won, not yet invoiced</small></div>
                    <div className="os-kpi"><span className="mono">Weighted pipeline</span><b>{$0(weighted)}</b><small>{open.length} open deal{open.length === 1 ? "" : "s"}</small></div>
                    <div className="os-kpi"><span className="mono">Gap to target</span><b>{$0(gap)}</b><small>{gap ? `≈ ${needDeals} more project${needDeals === 1 ? "" : "s"} at ${$0(avgFee)}` : "Covered by collected + backlog"}</small></div>
                    <div className="os-kpi"><span className="mono">Est. profit {year}</span><b>{$0(estProfit)}</b><small>Collected − OPEX logged ({$0(opex)}) · target {$0(tgt.profit_target)}</small></div>
                </div>

                <div className="os-grid" style={{ marginTop: 14 }}>
                    <div className="c">
                        <div className="mono">Revenue forecast · next 12 months</div>
                        <div className="os-bar" style={{ marginTop: 14, marginBottom: 26 }}>
                            {monthlyTarget > 0 && <div className="os-line" style={{ bottom: `${(monthlyTarget / maxBar) * 142}px` }}><em>target {$0(monthlyTarget)}/mo</em></div>}
                            {months.map((m) => (
                                <div key={m.key} title={`${m.label}: won ${$0(m.won)} · weighted ${$0(m.weighted)}`}>
                                    <span style={{ height: `${(m.weighted / maxBar) * 142}px`, background: "color-mix(in srgb,var(--ink) 30%,transparent)" }} />
                                    <span style={{ height: `${(m.won / maxBar) * 142}px`, background: "var(--ink)" }} />
                                    <i>{m.label}</i>
                                </div>
                            ))}
                        </div>
                        <p className="mono">Solid = won · light = weighted by stage probability</p>
                    </div>
                    <div className="c">
                        <div className="mono">Capacity · burnout guard (next 16 weeks)</div>
                        <div className="os-bar" style={{ marginTop: 14, marginBottom: 26 }}>
                            <div className="os-line" style={{ bottom: `${(maxH / Math.max(maxH * 1.4, ...weeks.map((w) => w.committed + w.likely))) * 142}px` }}><em>max {maxH} h/wk</em></div>
                            {weeks.map((w, i) => { const top = Math.max(maxH * 1.4, ...weeks.map((x) => x.committed + x.likely)); return (
                                <div key={i} title={`Week of ${w.start.toLocaleDateString()}: ${w.committed.toFixed(0)} h committed + ${w.likely.toFixed(0)} h likely`}>
                                    <span style={{ height: `${(w.likely / top) * 142}px`, background: "color-mix(in srgb,var(--accent) 45%,transparent)" }} />
                                    <span style={{ height: `${(w.committed / top) * 142}px`, background: w.committed + w.likely > maxH ? "var(--accent)" : "var(--ink)" }} />
                                    <i>{i % 2 === 0 ? w.start.toLocaleDateString([], { month: "numeric", day: "numeric" }) : ""}</i>
                                </div>) })}
                        </div>
                        {over.length ? <div className="os-warn">{over.length} week{over.length > 1 ? "s" : ""} over {maxH} h starting {over[0].start.toLocaleDateString()}. Push a start date, phase the work, or bring in a drafter before saying yes to more.</div>
                            : <p style={{ fontSize: 14 }}>Within capacity. A new {avgFee >= 15000 ? "15" : "10"} h/week project could start the week of {nextOpen(avgFee >= 15000 ? 15 : 10)?.start.toLocaleDateString() || "—"}.</p>}
                        <p className="mono">{activeNow} active project{activeNow === 1 ? "" : "s"} · limit {tgt.max_active_projects}</p>
                    </div>
                </div>

                <div className="c">
                    <div className="r" style={{ justifyContent: "space-between" }}><span className="mono">Pipeline</span><button className="b" onClick={() => setEdit({ name: "", client_name: "", market: "LA", project_type: "residential", source: "", stage: "lead", est_fee: "", expected_start: "", duration_weeks: 12, weekly_hours: 10, next_step: "", next_step_on: today() })}>+ Deal</button></div>
                    {edit && (
                        <form onSubmit={saveDeal} style={{ margin: "12px 0", borderTop: ".5px solid var(--ink)", paddingTop: 12 }}>
                            <div className="r">
                                <input required placeholder="Project name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} style={{ flex: "2 1 220px" }} />
                                <input placeholder="Client / contact" value={edit.client_name || ""} onChange={(e) => setEdit({ ...edit, client_name: e.target.value })} />
                                <input placeholder="Email" value={edit.contact_email || ""} onChange={(e) => setEdit({ ...edit, contact_email: e.target.value })} />
                                <select value={edit.market} onChange={(e) => setEdit({ ...edit, market: e.target.value })}><option>LA</option><option>NY</option></select>
                                <select value={edit.project_type} onChange={(e) => setEdit({ ...edit, project_type: e.target.value })}>{["residential", "commercial", "hospitality", "retail", "other"].map((x) => <option key={x}>{x}</option>)}</select>
                                <select value={edit.stage} onChange={(e) => setEdit({ ...edit, stage: e.target.value })}>{[...STAGES.map((s) => s[0]), "lost"].map((x) => <option key={x}>{x}</option>)}</select>
                            </div>
                            <div className="r" style={{ marginTop: 8 }}>
                                <input placeholder="Source (referral, realtor…)" value={edit.source || ""} onChange={(e) => setEdit({ ...edit, source: e.target.value })} />
                                <input inputMode="decimal" placeholder="Est. fee $" value={edit.est_fee ?? ""} onChange={(e) => setEdit({ ...edit, est_fee: e.target.value })} style={{ width: 110 }} />
                                <input inputMode="decimal" placeholder="Prob. 0–1 (blank = by stage)" value={edit.probability ?? ""} onChange={(e) => setEdit({ ...edit, probability: e.target.value })} style={{ width: 190 }} />
                                <label className="mono">Start <input type="date" value={edit.expected_start || ""} onChange={(e) => setEdit({ ...edit, expected_start: e.target.value })} /></label>
                                <label className="mono">Weeks <input type="number" value={edit.duration_weeks ?? 12} onChange={(e) => setEdit({ ...edit, duration_weeks: e.target.value })} style={{ width: 60 }} /></label>
                                <label className="mono">h/week <input type="number" value={edit.weekly_hours ?? 10} onChange={(e) => setEdit({ ...edit, weekly_hours: e.target.value })} style={{ width: 60 }} /></label>
                            </div>
                            <div className="r" style={{ marginTop: 8 }}>
                                <input placeholder="Next step" value={edit.next_step || ""} onChange={(e) => setEdit({ ...edit, next_step: e.target.value })} style={{ flex: "2 1 240px" }} />
                                <input type="date" value={edit.next_step_on || ""} onChange={(e) => setEdit({ ...edit, next_step_on: e.target.value })} />
                                <button className="b">Save deal</button><button type="button" className="b g" onClick={() => setEdit(null)}>Cancel</button>
                                {edit.expected_start && edit.weekly_hours && <span className="mono">{(() => { const s = monday(new Date(edit.expected_start)); const w = weeks.find((x) => x.start.getTime() === s.getTime()); return w && w.committed + w.likely + Number(edit.weekly_hours) > maxH ? "⚠ that start week would put you over capacity" : "fits capacity" })()}</span>}
                            </div>
                        </form>
                    )}
                    <div className="os-board" style={{ marginTop: 10 }}>
                        {STAGES.map(([k, l]) => (
                            <div key={k} className="os-col">
                                <div className="mono">{l} · {$0(deals.filter((d) => d.stage === k).reduce((a, d) => a + Number(d.est_fee || 0), 0))}</div>
                                {deals.filter((d) => d.stage === k).map((d) => (
                                    <button key={d.id} className={"os-deal" + (late(d) ? " late" : "")} onClick={() => setEdit(d)}>
                                        <b>{d.name}</b><br />{d.est_fee ? $0(d.est_fee) : "fee tbd"} · {d.market}{d.source ? " · " + d.source : ""}
                                        {d.next_step && <><br /><span style={{ opacity: 0.75 }}>{late(d) ? "Overdue: " : "Next: "}{d.next_step}{d.next_step_on ? " · " + d.next_step_on : ""}</span></>}
                                        <span className="r" style={{ gap: 4, marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                                            {STAGES.findIndex((s) => s[0] === k) < 4 && <span className="os-pill" role="button" onClick={() => move(d, STAGES[STAGES.findIndex((s) => s[0] === k) + 1][0])}>advance →</span>}
                                            {k !== "won" && <span className="os-pill" role="button" onClick={() => move(d, "lost")}>lost</span>}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                    {msg && <p className="mono">{msg}</p>}
                </div>

                <div className="os-grid">
                    <div className="c">
                        <div className="r" style={{ justifyContent: "space-between" }}><span className="mono">Lead signals · LA + NY public permit filings</span><span className="r" style={{ gap: 8 }}><span className="mono">weekly · Mondays</span><button className="b g" onClick={async () => { const { error } = await db.rpc("run_lead_scout", { p_days: 7 }); setMsg(error ? error.message : "Lead scout started — new signals appear here in about a minute."); setTimeout(load, 60000) }}>Run now</button></span></div>
                        {leads.map((l) => (
                            <div key={l.id} style={{ padding: "10px 0", borderBottom: ".5px solid color-mix(in srgb,var(--ink) 18%,transparent)", fontSize: 14, lineHeight: 1.5 }}>
                                <span className="os-pill">{l.market}</span><span className="os-pill">score {l.score ?? "–"}</span><b>{l.address}</b>{l.neighborhood ? ` · ${l.neighborhood}` : ""}
                                <div style={{ opacity: 0.8 }}>{[l.permit_type, l.work_type].filter(Boolean).join(" · ")}{l.valuation ? ` · ${$0(l.valuation)}` : ""}{l.filed_on ? ` · ${l.filed_on}` : ""}</div>
                                {l.description && <div style={{ opacity: 0.7, fontSize: 13 }}>{String(l.description).slice(0, 220)}</div>}
                                {l.score_why && <div className="mono">{l.score_why}</div>}
                                <div className="r" style={{ marginTop: 6 }}><button className="b" onClick={() => leadTo(l, "pursue")}>Pursue → pipeline</button><button className="b g" onClick={() => leadTo(l, "dismissed")}>Dismiss</button>{l.url && <a className="mono" href={l.url} target="_blank" rel="noopener">record ↗</a>}</div>
                            </div>
                        ))}
                        {!leads.length && <p style={{ fontSize: 14, opacity: 0.75 }}>No new signals. The lead scout runs weekly (Mondays) and scores fresh permit filings against your rules: neighborhoods, project types and minimum valuation.</p>}
                    </div>
                    <div className="c">
                        <div className="mono">Follow-ups due (from your Gmail)</div>
                        {follow.map((f) => (
                            <div key={f.id} style={{ padding: "10px 0", borderBottom: ".5px solid color-mix(in srgb,var(--ink) 18%,transparent)", fontSize: 14 }}>
                                <span className="os-pill">{f.category}</span><b>{f.counterpart}</b> · {f.subject}
                                <div className="mono">{f.last_sent_on ? `last sent ${f.last_sent_on} · ` : ""}due {f.due_on || "—"}</div>
                                {f.suggestion && <div style={{ opacity: 0.8, fontSize: 13 }}>{f.suggestion}</div>}
                                <div className="r" style={{ marginTop: 6 }}>{f.thread_id && <a className="b g" href={`https://mail.google.com/mail/u/0/#all/${f.thread_id}`} target="_blank" rel="noopener">Open thread</a>}<button className="b g" onClick={() => fuDone(f, "snoozed")}>+3 days</button><button className="b g" onClick={() => fuDone(f, "done")}>Done</button></div>
                            </div>
                        ))}
                        {!follow.length && <p style={{ fontSize: 14, opacity: 0.75 }}>Nothing waiting. The daily inbox check lists threads where you're owed a reply or owe one.</p>}
                    </div>
                </div>

                <VendorTriage db={db} compact openTab={openTab} />

                <details className="c">
                    <summary className="mono" style={{ cursor: "pointer" }}>Targets</summary>
                    {targets.map((t) => <TargetRow key={t.year} t={t} onSave={saveTarget} />)}
                    <button className="b g" style={{ marginTop: 8 }} onClick={() => saveTarget({ year: (targets.at(-1)?.year || year) + 1, revenue_target: 0, max_active_projects: 4, max_weekly_hours: 40 })}>+ Year</button>
                </details>
            </Gate>
        </div>
    )
}
function TargetRow({ t, onSave }: any) {
    const [f, setF] = React.useState<any>(t)
    const num = (k: string) => <label className="mono">{k.replace(/_/g, " ")} <input inputMode="decimal" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value === "" ? null : Number(e.target.value) })} style={{ width: 110 }} /></label>
    return (
        <div className="r" style={{ marginTop: 10 }}>
            <b style={{ width: 50 }}>{t.year}</b>{num("revenue_target")}{num("profit_target")}{num("owner_pay_target")}{num("avg_fee_target")}{num("max_active_projects")}{num("max_weekly_hours")}
            <button className="b g" onClick={() => onSave({ ...f, notes: null })}>Save</button>
        </div>
    )
}

/* ═════════════════════ VENDOR REVIEW TRIAGE ═════════════════════ */
const ACTIONS: Record<string, { label: string; you: string; button?: string }> = {
    email_rep: { label: "No application form online", you: "Send the trade-request email (copy below) to the vendor's trade/sales address. When they reply, the daily inbox check files the rep automatically.", button: "Copy email" },
    fix_link: { label: "Bot landed on the wrong page", you: "Paste the real trade-program URL and press Retry. The bot applies on the next run.", button: "Save link & retry" },
    check_inbox: { label: "Submitted, no confirmation seen", you: "Search your inbox for the vendor name. If a confirmation is there, mark Pending; if not, press Retry.", button: "Mark pending" },
    finish_form: { label: "Form needs a field the bot couldn't fill", you: "Open the form and finish it yourself (usually a dropdown, a document upload or a free-text box). Takes 2–4 minutes each.", button: "Open form" },
    assist_captcha: { label: "reCAPTCHA needs a person", you: "Open the form and submit it yourself. The studio never bypasses CAPTCHAs.", button: "Open form" },
    retry: { label: "Bot error (timeout / page change)", you: "Press Retry once. If it fails again it moves to finish_form.", button: "Retry" },
    find_link: { label: "No trade program found", you: "Check the site footer for Trade / Designers / Professionals. Paste a link if you find one; otherwise send the trade-request email.", button: "Save link & retry" },
}
const TRADE_EMAIL = `Subject: Trade account inquiry — FELEMAYE (interior & spatial design, Los Angeles / New York)

Hello,

I'm Felema Yemaneberhan, principal of FELEMAYE, a design studio working on residential and hospitality projects in Los Angeles and New York. We'd like to open a trade account to specify and purchase your products for client projects.

Could you send your trade application or let me know the right person to speak with? We can provide our resale certificate (CA / NY), EIN letter and business documentation.

Thank you,
Felema Yemaneberhan
Principal, FELEMAYE
felema@felemaye.com · felemaye.com`
export function VendorTriage({ db, compact, openTab }: any) {
    const [rows, setRows] = React.useState<any[]>([])
    const [act, setAct] = React.useState<string>("")
    const [links, setLinks] = React.useState<Record<string, string>>({})
    const [msg, setMsg] = React.useState("")
    const [err, setErr] = React.useState<any>(null)
    const load = React.useCallback(async () => { const { data, error } = await db.from("v_vendor_review_queue").select("*").limit(1000); if (isMissing(error)) return setErr(error); setRows(data || []) }, [db])
    React.useEffect(() => { load() }, [load])
    const counts: Record<string, number> = {}
    rows.forEach((r) => (counts[r.action] = (counts[r.action] || 0) + 1))
    const retry = async (r: any, url?: string) => {
        if (url) await db.from("trade_accounts").update({ application_url: url, review_reason: null, status: "Not Applied", discovery_status: "found" }).eq("id", r.trade_account_id)
        const { error } = await db.from("trade_jobs").insert({ vendor_id: r.vendor_id, trade_account_id: r.trade_account_id, kind: "apply" })
        setMsg(error ? (/duplicate|unique/i.test(error.message) ? "Already queued." : error.message) : `Queued ${r.name}.`); load()
    }
    const pending = async (r: any) => { await db.from("trade_accounts").update({ status: "Pending", review_reason: null }).eq("id", r.trade_account_id); load() }
    const retryAll = async () => { const list = rows.filter((r) => r.action === "retry"); for (const r of list) await db.from("trade_jobs").insert({ vendor_id: r.vendor_id, trade_account_id: r.trade_account_id, kind: "apply" }); setMsg(`Queued ${list.length} retries.`); load() }
    const order = ["finish_form", "assist_captcha", "fix_link", "check_inbox", "email_rep", "find_link", "retry"]
    return (
        <div className="c">
            <OSStyle />
            <div className="r" style={{ justifyContent: "space-between" }}><span className="mono">Vendor review queue · {rows.length} need a decision</span>{compact && <button className="b g" onClick={() => openTab?.("vendors")}>Open vendors</button>}</div>
            <Gate err={err}>
                <div className="os-tpl" style={{ marginTop: 10 }}>
                    {order.filter((k) => counts[k]).map((k) => (
                        <button key={k} aria-pressed={act === k} onClick={() => setAct(act === k ? "" : k)}>
                            <b style={{ display: "block", fontSize: 22, fontFamily: "'Cormorant Garamond',Georgia,serif", fontWeight: 400 }}>{counts[k]}</b>
                            <b style={{ display: "block" }}>{ACTIONS[k].label}</b>
                            <span style={{ opacity: 0.8 }}>{ACTIONS[k].you}</span>
                        </button>
                    ))}
                </div>
                {act === "retry" && <button className="b" style={{ marginTop: 10 }} onClick={retryAll}>Retry all {counts.retry}</button>}
                {(act === "email_rep" || act === "find_link") && (
                    <div style={{ marginTop: 10 }}>
                        <textarea readOnly value={TRADE_EMAIL} rows={9} style={{ width: "100%", fontSize: 13 }} />
                        <button className="b g" onClick={() => navigator.clipboard?.writeText(TRADE_EMAIL).then(() => setMsg("Email copied."))}>Copy email</button>
                    </div>
                )}
                {act && (
                    <div className="tw" style={{ marginTop: 10, maxHeight: compact ? 360 : 640, overflow: "auto" }}>
                        <table><thead><tr><th>Vendor</th><th>Reason</th><th>Action</th></tr></thead>
                            <tbody>{rows.filter((r) => r.action === act).map((r) => (
                                <tr key={r.trade_account_id}>
                                    <td><b>{r.name}</b>{r.website && <div><a className="mono" href={r.website} target="_blank" rel="noopener">{String(r.website).replace(/^https?:\/\/(www\.)?/, "").slice(0, 34)}</a></div>}</td>
                                    <td style={{ fontSize: 12, maxWidth: 320 }}>{String(r.review_reason || r.discovery_status || "").replace(/^Trade Bot [\d-]+:\s*/, "")}</td>
                                    <td className="r" style={{ gap: 6 }}>
                                        {(act === "fix_link" || act === "find_link") && <><input placeholder="https://…/trade" value={links[r.trade_account_id] || ""} onChange={(e) => setLinks({ ...links, [r.trade_account_id]: e.target.value })} style={{ minWidth: 180 }} /><button className="b" onClick={() => retry(r, links[r.trade_account_id])} disabled={!links[r.trade_account_id]}>Save & retry</button></>}
                                        {(act === "finish_form" || act === "assist_captcha") && <a className="b" href={r.application_url || r.website} target="_blank" rel="noopener">Open form</a>}
                                        {(act === "finish_form" || act === "assist_captcha" || act === "check_inbox") && <button className="b g" onClick={() => pending(r)}>Submitted → Pending</button>}
                                        {act === "check_inbox" && <a className="b g" href={`https://mail.google.com/mail/u/0/#search/${encodeURIComponent(r.name)}`} target="_blank" rel="noopener">Search inbox</a>}
                                        {(act === "retry" || act === "check_inbox") && <button className="b g" onClick={() => retry(r)}>Retry</button>}
                                        {act === "email_rep" && r.website && <a className="b g" href={r.website} target="_blank" rel="noopener">Find contact</a>}
                                    </td>
                                </tr>))}</tbody></table>
                    </div>
                )}
                {msg && <p className="mono">{msg}</p>}
            </Gate>
        </div>
    )
}

/* ═════════════════════ NETWORK DIRECTORY ═════════════════════ */
const KINDS = ["realtor", "broker", "expediter", "lender", "attorney", "contractor", "developer", "other"]
const REL = ["cold", "intro_sent", "warm", "active", "partner"]
export function NetworkDirectory({ db }: any) {
    const [rows, setRows] = React.useState<any[]>([])
    const [kind, setKind] = React.useState("")
    const [market, setMarket] = React.useState("")
    const [q, setQ] = React.useState("")
    const [edit, setEdit] = React.useState<any>(null)
    const [msg, setMsg] = React.useState("")
    const [err, setErr] = React.useState<any>(null)
    const load = React.useCallback(async () => { const { data, error } = await db.from("network_contacts").select("*").order("kind").order("firm"); if (isMissing(error)) return setErr(error); setRows(data || []) }, [db])
    React.useEffect(() => { load() }, [load])
    const shown = rows.filter((r) => (!kind || r.kind === kind) && (!market || r.market === market || r.market === "both") && (!q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())))
    const save = async (e: React.FormEvent) => { e.preventDefault(); const row = { ...edit }; delete row.id; delete row.created_at; ["last_contact_date", "next_follow_up"].forEach((k) => (row[k] = row[k] || null)); const res = edit.id ? await db.from("network_contacts").update(row).eq("id", edit.id) : await db.from("network_contacts").insert(row); setMsg(res.error ? res.error.message : "Saved."); if (!res.error) { setEdit(null); load() } }
    const touch = async (r: any, relationship: string) => { await db.from("network_contacts").update({ relationship, last_contact_date: today(), next_follow_up: addDays(new Date(), 21).toISOString().slice(0, 10) }).eq("id", r.id); load() }
    const intro = (r: any) => {
        const first = (r.name || "").split(" ")[0] || "there"
        const body = r.kind === "expediter"
            ? `Hi ${first},\n\nI'm Felema Yemaneberhan, principal of FELEMAYE, a design studio in Los Angeles and New York. We're building a short list of expediters we trust for ${r.market === "NY" ? "DOB NOW and LPC" : "LADBS and LA County (EPIC-LA)"} filings on residential and small commercial work, and your name came up.\n\nWould you be open to a 20-minute call to compare how you like to receive drawing sets and what you see slowing approvals right now?\n\nBest,\nFelema\nfelemaye.com`
            : `Hi ${first},\n\nI'm Felema Yemaneberhan, principal of FELEMAYE, an architecture and spatial design studio. We work on homes in ${r.area || "View Park, Baldwin Hills and Leimert Park"} — courtyards, additions, facade restorations and interiors — and we often meet buyers who need a clear picture of what a house can become before they commit.\n\nI'd love to offer your clients a short design-feasibility consult (what's allowed, what it costs, what it adds) and to be a resource for your listings. Coffee next week?\n\nBest,\nFelema\nfelemaye.com`
        window.open(`mailto:${encodeURIComponent(r.email || "")}?subject=${encodeURIComponent(r.kind === "expediter" ? "Expediting partnership — FELEMAYE" : "Design partner for your clients — FELEMAYE")}&body=${encodeURIComponent(body)}`)
    }
    const due = rows.filter((r) => r.next_follow_up && r.next_follow_up <= today()).length
    return (
        <div>
            <OSStyle />
            <Gate err={err}>
                <p style={{ maxWidth: 760, lineHeight: 1.7, fontSize: 14 }}>Realtors, brokers and expediters for referral collaborations. Entries start as <b>to verify</b>; mark them verified after a call or a check of their license and recent work. "Draft intro" opens a pre-written email in your mail app; nothing is sent until you press send there.</p>
                <div className="r">
                    <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind"><option value="">All kinds</option>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
                    <select value={market} onChange={(e) => setMarket(e.target.value)} aria-label="Market"><option value="">LA + NY</option><option>LA</option><option>NY</option></select>
                    <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
                    <button className="b" onClick={() => setEdit({ kind: "realtor", market: "LA", name: "", firm: "", vetting_status: "to_verify", relationship: "cold" })}>+ Contact</button>
                    <span className="mono">{shown.length} shown · {due} follow-up{due === 1 ? "" : "s"} due</span>
                </div>
                {edit && (
                    <form onSubmit={save} className="c" style={{ marginTop: 10 }}>
                        <div className="r">
                            <select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
                            <select value={edit.market} onChange={(e) => setEdit({ ...edit, market: e.target.value })}><option>LA</option><option>NY</option><option>both</option></select>
                            {["name", "firm", "area", "email", "phone", "website", "license_no", "source_url"].map((k) => <input key={k} placeholder={k.replace("_", " ")} value={edit[k] || ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />)}
                        </div>
                        <div className="r" style={{ marginTop: 8 }}>
                            <input placeholder="Why they matter (facts)" value={edit.why || ""} onChange={(e) => setEdit({ ...edit, why: e.target.value })} style={{ flex: "2 1 260px" }} />
                            <input placeholder="Collaboration idea" value={edit.collaboration || ""} onChange={(e) => setEdit({ ...edit, collaboration: e.target.value })} style={{ flex: "2 1 260px" }} />
                            <select value={edit.vetting_status} onChange={(e) => setEdit({ ...edit, vetting_status: e.target.value })}>{["to_verify", "verified", "warm", "do_not_use"].map((k) => <option key={k}>{k}</option>)}</select>
                            <select value={edit.relationship} onChange={(e) => setEdit({ ...edit, relationship: e.target.value })}>{REL.map((k) => <option key={k}>{k}</option>)}</select>
                            <label className="mono">Follow up <input type="date" value={edit.next_follow_up || ""} onChange={(e) => setEdit({ ...edit, next_follow_up: e.target.value })} /></label>
                            <button className="b">Save</button><button type="button" className="b g" onClick={() => setEdit(null)}>Cancel</button>
                        </div>
                    </form>
                )}
                <div className="c tw" style={{ marginTop: 10 }}>
                    <table>
                        <thead><tr><th>Kind</th><th>Name / firm</th><th>Market · area</th><th>Why · idea</th><th>Status</th><th></th></tr></thead>
                        <tbody>{shown.map((r) => (
                            <tr key={r.id}>
                                <td><span className="os-pill">{r.kind}</span></td>
                                <td><b>{r.name || r.firm}</b>{r.name && r.firm ? <div>{r.firm}</div> : null}<div className="mono">{[r.email, r.phone].filter(Boolean).join(" · ")}</div>{r.website && <a className="mono" href={r.website} target="_blank" rel="noopener">site ↗</a>} {r.source_url && <a className="mono" href={r.source_url} target="_blank" rel="noopener">source ↗</a>}</td>
                                <td>{r.market}{r.area ? ` · ${r.area}` : ""}</td>
                                <td style={{ fontSize: 13, maxWidth: 340 }}>{r.why}{r.collaboration && <div style={{ opacity: 0.75 }}>→ {r.collaboration}</div>}</td>
                                <td><span className="os-pill">{r.vetting_status.replace("_", " ")}</span><span className="os-pill">{r.relationship.replace("_", " ")}</span>{r.next_follow_up && <div className="mono" style={{ color: r.next_follow_up <= today() ? "var(--accent)" : undefined }}>follow up {r.next_follow_up}</div>}</td>
                                <td className="r" style={{ gap: 6 }}><button className="b g" onClick={() => intro(r)}>Draft intro</button><button className="b g" onClick={() => touch(r, r.relationship === "cold" ? "intro_sent" : r.relationship)}>Contacted today</button><button className="b g" onClick={() => setEdit(r)}>Edit</button></td>
                            </tr>))}</tbody>
                    </table>
                    {!shown.length && <p className="mono">No contacts match.</p>}
                </div>
                {msg && <p className="mono">{msg}</p>}
            </Gate>
        </div>
    )
}
