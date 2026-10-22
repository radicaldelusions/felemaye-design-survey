// FELEMAYE — Studio Console (Framer code component) — place on a hidden /studio page.
// Login: magic link, restricted by the is_studio() RPC (allow-listed emails in Supabase). Everyone else is signed out.
// Tabs: Clients (add, resend credentials, retainer toggle, inspect what the client sees) · Survey images (upload PNG/JPG per card).
// v2 (2026-10-14): client filter across every tab · per-client Meet / Permits / Directory / Inspect panels ·
// permit agencies per project (stored in projects.permit_progress.__agencies, read by the client portal) ·
// directory edit-in-place · studio uploads stamp uploaded_by.
// v3 (2026-10-14): Master Studio Log (totals, permit tracks, booking links, live client event stream + badges) ·
// client portal cards with + Add new client portal · stage tag advances from data · row-level directory Edit / Save changes
// with portal access · per-client booking page (TidyCal/Calendly) · site footer hidden on the console page.
// v4 (2026-10-14): Finances tab: 5-bucket cash allocation engine (needs 20261015_financial_engine.sql).
// v5 (2026-10-15): Vendors tab: Master Vendor Vault & Trade CRM (VendorVaultTab.tsx + 20261015_vendor_vault.sql).
import * as React from "react"
import { addPropertyControls, ControlType } from "framer"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"
// Second Framer code file in the same project (Assets › Code › VendorVaultTab.tsx)
import VendorVaultTab from "./VendorVaultTab.tsx"
// v7 (2026-10-17): Surface Studio tab (SurfaceStudioTab.tsx + 20261017_surface_studio.sql).
// v8 (2026-10-18): FF&E pricing policy engine (MSRP / net + markup / procurement fee, floors enforced in the database) and
// Compliance tab: CA + NY resale certificates and licences in a private bucket (needs 20261018b SQL).
import SurfaceStudioTab from "./SurfaceStudioTab.tsx"
// v9 (2026-10-20): Vignettes desk: inventory status, live staging calendar, bookings, invoices with use tax,
// usage agreement, capital and tax ledger (VignetteStudioConsole.tsx + 20261020_vignettes_ops_ledger.sql).
import VignetteStudioConsole from "./VignetteStudioConsole.tsx"
// V4 MASTER (2026-10-22) — MasterStudioConsole: Atelier palette + Studio Admin / Client Experience view toggle,
// Time Bank & EHR with burn alerts, 50/25/25 waterfall, Zoning/Muni engine + Sheet A-001, sub-consultant RFP matrix,
// trade-bot job queue and Studio Admin Drive refs (needs 20261022_felemaye_master_ecosystem.sql).
// Every v9 tab, hook and property control is preserved.
// V4.2 (2026-10-22c): Zoning & permit intelligence (document upload + analysis), consultant directory, standing review
// time, branded Friday progress notes with images + Welcome Kit (print / PDF). Needs 20261022c SQL.
// V4.1 (2026-10-22b): Cadence tab — 12-week plan, live-review scheduling + 3-part agendas, Friday updates,
// presentations with A/B decisions, booking boundaries, studio notification inbox (needs 20261022b SQL).

type Props = {
    supabaseUrl: string
    publishableKey: string
    studioUrl: string
    portalUrl: string
    paper: string
    ink: string
    accent: string
    theme?: "atelier" | "paper"
    oxblood?: string
    ochre?: string
    slate?: string
    moss?: string
    background?: string
    defaultView?: "admin" | "client"
}
const ADMIN_TABS = [
    "clients",
    "meetings",
    "cadence",
    "time",
    "time bank",
    "reimbursables",
    "ffe",
    "vendors",
    "surface studio",
    "vignettes",
    "calendar",
    "permits",
    "zoning",
    "consultants",
    "finances",
    "waterfall",
    "compliance",
    "survey images",
]

const OPTIONS: Record<string, string[]> = {
    Materials: [
        "Hand-troweled plaster",
        "Terracotta tile",
        "Talavera tile",
        "Natural stone",
        "Wrought iron",
        "Warm timber",
        "Board-formed concrete",
        "Pebble & gravel",
        "Aged brass",
        "Clay vessels",
        "Woven textiles",
        "Climbing vines",
    ],
    Plants: [
        "Citrus trees",
        "Bougainvillea",
        "Olive tree",
        "Succulents",
        "Herb garden",
        "Lavender",
        "Roses",
        "Palms",
        "Wildflowers",
        "Jacaranda canopy",
        "Jasmine",
        "Ornamental grasses",
    ],
    Lighting: [
        "Glass lanterns",
        "Sculpted sconces",
        "Festoon lights",
        "Uplit trees & walls",
        "Hearth fire glow",
        "Candlelit niches",
        "Step & path lighting",
        "Moonlit minimal",
        "Paper lanterns",
    ],
}

// Standard phase checklists (group › item). "Load standard checklists" seeds them once; tick items off, attach a Notion link per item.
const TEMPLATES: Record<number, string[]> = {
    1: [
        "Work › Site survey: field measurements, porch transitions, facade condition and photography",
        "Work › Zoning research: front-yard setbacks, height limits and property lines (LA County Regional Planning)",
        "Work › Structural & material feasibility assessment",
        "Deliverables › Existing Site Plan and Survey Sketch",
        "Deliverables › Zoning & Code Analysis Summary (setbacks, height and transparency rules)",
        "Deliverables › Preliminary Structural Option Comparison (A: Modified Gate/Pilasters, B: Masonry Enclosure)",
        "Deliverables › Material Curation Board (stone, local masonry and color palette direction)",
        "Review › Consolidated round of design refinements",
    ],
    2: [
        "Work › Spatial layout & courtyard flow: entry points, gate placement, pedestrian pathways",
        "Work › Design concepts & material selection: wall finishes, gate styles, wrought iron, hardscape",
        "Deliverables › Schematic Courtyard Floor Plan & Hardscape Layout",
        "Deliverables › Concept Layout Design Options (existing gate vs. new masonry enclosure)",
        "Deliverables › 3D Exterior Renderings (key elevations and massing)",
        "Deliverables › Preliminary Material Lookbook",
        "Deliverables › Initial Elevation Sketches (wall and gate heights)",
        "Deliverables › Surface Lighting Study",
        "Review › Consolidated round of design refinements",
        "Milestone › SD sign-off and Milestone 2 payment",
    ],
    3: [
        "Work › Permit set: title sheet, dimensioned site plan, exterior wall elevations, wall and gate details",
        "Work › Engineering handoff: Revit/CAD files and parameters to the Structural Engineer of Record",
        "Work › Specification strategy: material and finish schedule with sourcing",
        "Deliverables › High-Fidelity 3D Exterior Renderings",
        "Deliverables › 75% Construction Drawings & Material Specifications",
        "Deliverables › Handoff Package for Structural Engineer Review",
        "Milestone › DD client review and Milestone 3 payment",
        "Milestone › Structural Engineer retainer (paid directly by client)",
    ],
    4: [
        "Work › CAD background handoff to Structural Engineer",
        "Work › Third-party engineering calculations & detailing",
        "Work › Stamped structural sheet integration",
        "Deliverables › Complete Permit Drawing Set (PDF) for LA County submittal",
        "Deliverables › Plan-check response support (one round)",
        "Milestone › Final package submitted to LA County",
    ],
    5: [
        "Optional › Periodic site walkthroughs at key milestones",
        "Optional › Contractor RFIs & submittal reviews",
        "Optional › Design clarifications for field conditions",
    ],
}
// Permit agencies. Ticked per project in Permits; the list is saved to projects.permit_progress.__agencies
// and the client portal shows only the ticked agencies with these links.
export const AGENCIES: {
    id: string
    group: string
    label: string
    portal?: string
    links: [string, string][]
    optional?: boolean
}[] = [
    { id: "la_county_drp", group: "Unincorporated LA County", label: "LA County Regional Planning", portal: "EPIC-LA",
      links: [["LA County Regional Planning", "https://planning.lacounty.gov"], ["EPIC-LA permit portal", "https://epicla.lacounty.gov"], ["Title 22 Zoning Code", "https://library.municode.com/ca/los_angeles_county/codes/code_of_ordinances?nodeId=TIT22PLZO"]] },
    { id: "la_county_bs", group: "Unincorporated LA County", label: "LA County Public Works · Building & Safety", portal: "EPIC-LA",
      links: [["LA County Public Works", "https://pw.lacounty.gov"], ["EPIC-LA permit portal", "https://epicla.lacounty.gov"]] },
    { id: "la_city_planning", group: "City of Los Angeles", label: "LA City Planning",
      links: [["LA City Planning", "https://planning.lacity.gov"]] },
    { id: "ladbs", group: "City of Los Angeles", label: "LADBS · Building & Safety", portal: "ePlanLA",
      links: [["LADBS", "https://www.ladbs.org"]] },
    { id: "nyc_dob", group: "New York City", label: "NYC Department of Buildings", portal: "DOB NOW",
      links: [["NYC Department of Buildings", "https://www.nyc.gov/site/buildings/index.page"]] },
    { id: "nyc_lpc", group: "New York City", label: "Landmarks Preservation Commission", optional: true,
      links: [["NYC Landmarks Preservation Commission", "https://www.nyc.gov/site/lpc/index.page"]] },
]
// Checklist rows live in `deliverables` with kind='other' (done = status 'accepted', Notion link = note).
let _db: any
const getDb = (u: string, k: string) =>
    (_db ||= createClient(u, k, {
        auth: { persistSession: true, detectSessionInUrl: true },
    }))

export default function MasterStudioConsole(p: Props) {
    const db = getDb(p.supabaseUrl, p.publishableKey)
    const [state, setState] = React.useState<
        "boot" | "login" | "denied" | "ok"
    >("boot")
    const [email, setEmail] = React.useState("")
    const [msg, setMsg] = React.useState("")
    const [tab, setTab] = React.useState("clients")
    // V4: Studio Admin (net costs, discounts, burn, raw notes) vs Client Experience Portal (client-safe only)
    const [viewMode, setViewModeRaw] = React.useState<"admin" | "client">(() => {
        try {
            return (localStorage.getItem("fy_view") as any) || p.defaultView || "admin"
        } catch {
            return p.defaultView || "admin"
        }
    })
    const setViewMode = (v: "admin" | "client") => {
        setViewModeRaw(v)
        try {
            localStorage.setItem("fy_view", v)
        } catch {}
    }
    const dark = (p.theme || "atelier") === "atelier"
    const pal = {
        oxblood: p.oxblood || V4.oxblood,
        ochre: p.ochre || V4.ochre,
        slate: p.slate || V4.slate,
        moss: p.moss || V4.moss,
        bg: p.background || V4.bg,
    }
    // Client filter for the whole console ("" = all clients). Remembered on this device.
    const [focus, setFocusRaw] = React.useState<string>(() => {
        try {
            return localStorage.getItem("fy_focus") || ""
        } catch {
            return ""
        }
    })
    const setFocus = (v: string) => {
        setFocusRaw(v)
        try {
            localStorage.setItem("fy_focus", v)
        } catch {}
    }

    const check = React.useCallback(async () => {
        const { data } = await db.auth.getSession()
        if (!data.session) return setState("login")
        const { error: ue } = await db.auth.getUser()
        if (ue) {
            await db.auth.signOut()
            setMsg("Your session expired. Send yourself a fresh sign-in link.")
            return setState("login")
        }
        const { data: ok } = await db.rpc("is_studio")
        if (ok) setState("ok")
        else {
            await db.auth.signOut()
            setState("denied")
        }
    }, [db])
    React.useEffect(() => {
        check()
        const { data: s } = db.auth.onAuthStateChange((ev: string) => {
            if (ev === "SIGNED_IN") setTimeout(check, 0)
        })
        return () => s.subscription.unsubscribe()
    }, [db, check])

    async function login(e: React.FormEvent) {
        e.preventDefault()
        const { error } = await db.auth.signInWithOtp({
            email: email.trim().toLowerCase(),
            options: {
                emailRedirectTo:
                    window.location.origin + window.location.pathname,
                shouldCreateUser: false,
            },
        })
        setMsg(
            error
                ? "Could not send a link to that address."
                : "Link sent. Open it on this device."
        )
    }

    const css = `.fys{--paper:${p.paper};--ink:${p.ink};--accent:${p.accent};background:var(--paper);color:var(--ink);min-height:100%;width:100%;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;box-sizing:border-box;padding:clamp(18px,4vw,56px)}
    .fys *{box-sizing:border-box}
    /* Studio Console page: hide the site footer and trailing padding while the console is on screen */
    body:has(.fys) footer, body:has(.fys) [data-framer-name="Footer" i], body:has(.fys) [data-framer-name*="footer" i]{display:none!important}
    .fys .badge{display:inline-block;min-width:18px;padding:1px 6px;border-radius:0;background:var(--accent);color:var(--paper);font:600 10px/16px 'Helvetica Neue',Helvetica,Arial,sans-serif;text-align:center;letter-spacing:0}
    .fys .tag{display:inline-block;padding:2px 8px;border:.5px solid var(--ink);font:10px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase}
    .fys .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin:6px 0 14px}
    .fys .card{all:unset;box-sizing:border-box;cursor:pointer;display:block;padding:14px;border:.5px solid color-mix(in srgb,var(--ink) 45%,transparent);background:rgba(255,255,255,.35)}
    .fys .card[aria-pressed=true]{border-color:var(--ink);background:var(--ink);color:var(--paper)}
    .fys .card[aria-pressed=true] .tag{border-color:var(--paper)}
    .fys .card:focus-visible,.fys button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    .fys .stats{display:flex;flex-wrap:wrap;gap:24px 36px}.fys .stats b{display:block;font:400 26px 'Cormorant Garamond',Georgia,serif}.fys .mono{font:10px ui-monospace,Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;opacity:.65}
    .fys h1{font:400 clamp(30px,5vw,48px) 'Cormorant Garamond',Georgia,serif;margin:6px 0 20px}
    .fys button{font:inherit;cursor:pointer}.fys .b{background:var(--ink);color:var(--paper);border:0;padding:10px 16px;font-size:11px;letter-spacing:.16em;text-transform:uppercase}
    .fys .b.g{background:transparent;color:var(--ink);border:.5px solid var(--ink)}
    .fys input,.fys select{background:transparent;border:0;border-bottom:.5px solid var(--ink);padding:10px 2px;font:inherit;font-size:16px;color:inherit;outline:none;min-width:0}
    .fys .c{border:.5px solid color-mix(in srgb,var(--ink) 45%,transparent);padding:16px;margin-bottom:12px;background:rgba(255,255,255,.35)}
    .fys .r{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
    .fys table{border-collapse:collapse;width:100%;font-size:13px}.fys th{font:10px ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;text-align:left;opacity:.65;padding:6px 8px;border-bottom:.5px solid var(--ink)}.fys td{padding:8px;border-bottom:.5px solid color-mix(in srgb,var(--ink) 20%,transparent);vertical-align:top}.fys .tw{overflow-x:auto}.fys textarea,.fys select{background:transparent;border-bottom:.5px solid var(--ink);border-top:0;border-left:0;border-right:0;font:inherit;font-size:16px;color:inherit}@media(max-width:700px){.fys .b{min-height:42px}.fys .r>*{flex:1 1 auto}}.fys .gr{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}` + v4Css(pal, dark)

    if (state !== "ok")
        return (
            <div
                className={"fys" + (dark ? " v4dark" : "")}
                style={{
                    display: "grid",
                    placeItems: "center",
                    minHeight: "100vh",
                }}
            >
                <style>{css}</style>
                <form
                    onSubmit={login}
                    className="c"
                    style={{ width: "min(440px,100%)" }}
                >
                    <div className="mono">Studio only</div>
                    <h1>Console</h1>
                    {state === "denied" && (
                        <p>That account isn't on the studio list.</p>
                    )}
                    <input
                        type="email"
                        required
                        placeholder="Studio email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{ width: "100%" }}
                    />
                    <div className="r" style={{ marginTop: 16 }}>
                        <button className="b" type="submit">
                            Send sign-in link
                        </button>
                    </div>
                    {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
                </form>
            </div>
        )

    return (
        <div className={"fys" + (dark ? " v4dark" : "")}>
            <style>{css}</style>
            <div className="r" style={{ justifyContent: "space-between" }}>
                <div>
                    <div className="mono">FELEMAYE · Studio{viewMode === "client" ? " · client view" : ""}</div>
                    <h1>Console</h1>
                    <div className="v4-mode" role="group" aria-label="View mode">
                        <button aria-pressed={viewMode === "admin"} onClick={() => setViewMode("admin")}>
                            Studio admin
                        </button>
                        <button aria-pressed={viewMode === "client"} onClick={() => setViewMode("client")}>
                            Client experience
                        </button>
                    </div>
                </div>
                <div className="r">
                    {(viewMode === "admin" ? ADMIN_TABS : []).map((t) => (
                        <button
                            key={t}
                            className={"b" + (tab === t ? "" : " g")}
                            onClick={() => setTab(t)}
                        >
                            {t}
                        </button>
                    ))}
                    <button
                        className="b g"
                        onClick={() => db.auth.signOut().then(check)}
                    >
                        Sign out
                    </button>
                </div>
            </div>
            {viewMode === "client" ? (
                <ClientExperience db={db} focus={focus} portalUrl={p.portalUrl} />
            ) : (
            <>
            <MasterLog
                db={db}
                focus={focus}
                setFocus={setFocus}
                onNewClient={() => {
                    setFocus("")
                    setTab("clients")
                    setTimeout(() => {
                        const el = document.getElementById("fy-add-name") as HTMLInputElement | null
                        el?.scrollIntoView({ behavior: "smooth", block: "center" })
                        el?.focus()
                    }, 60)
                }}
                openTab={setTab}
            />
            {tab === "clients" ? (
                <Clients
                    db={db}
                    portalUrl={p.portalUrl}
                    supabaseUrl={p.supabaseUrl}
                    focus={focus}
                />
            ) : tab === "meetings" ? (
                <Meetings db={db} projectId={focus} />
            ) : tab === "time" ? (
                <TimeTracker db={db} focus={focus} />
            ) : tab === "cadence" ? (
                <CadenceStudio db={db} focus={focus} />
            ) : tab === "time bank" ? (
                <TimeBank db={db} focus={focus} />
            ) : tab === "zoning" ? (
                <ZoningMuniEngine db={db} focus={focus} />
            ) : tab === "consultants" ? (
                <ConsultantsCRM db={db} focus={focus} />
            ) : tab === "waterfall" ? (
                <Waterfall db={db} />
            ) : tab === "reimbursables" ? (
                <Reimbursables db={db} focus={focus} />
            ) : tab === "ffe" ? (
                <FFEManager db={db} projectId={focus} />
            ) : tab === "calendar" ? (
                <CalendarManager db={db} projectId={focus} />
            ) : tab === "permits" ? (
                <PermitManager db={db} projectId={focus} />
            ) : tab === "vendors" ? (
                <>
                    <TradeJobsPanel db={db} />
                    <VendorVaultTab db={db} focus={focus} />
                </>
            ) : tab === "surface studio" ? (
                <SurfaceStudioTab db={db} />
            ) : tab === "vignettes" ? (
                <VignetteStudioConsole db={db} />
            ) : tab === "finances" ? (
                <FinanceEngine db={db} focus={focus} />
            ) : tab === "compliance" ? (
                <ComplianceVault db={db} />
            ) : (
                <SurveyImages db={db} supabaseUrl={p.supabaseUrl} />
            )}
            </>
            )}
        </div>
    )
}

/* ───────────── Compliance: resale certificates and licences ───────────── */
const DOC_TYPES: [string, string, string][] = [
    ["ca_sellers_permit", "CA seller's permit (CDTFA)", "CA"],
    ["ca_resale_certificate", "CA resale certificate (CDTFA-230)", "CA"],
    ["ny_certificate_of_authority", "NY Certificate of Authority", "NY"],
    ["ny_resale_certificate", "NY resale certificate (ST-120)", "NY"],
    ["ein_letter", "IRS EIN letter (CP 575 / 147C)", ""],
    ["business_license", "Business licence", ""],
    ["w9", "W-9", ""],
    ["certificate_of_insurance", "Certificate of insurance", ""],
    ["other", "Other", ""],
]
function ComplianceVault({ db }: any) {
    const [rows, setRows] = React.useState<any[]>([])
    const [msg, setMsg] = React.useState("")
    const blank = { doc_type: "ca_sellers_permit", number: "", issued_on: "", expires_on: "", notes: "" }
    const [f, setF] = React.useState<any>(blank)
    const [file, setFile] = React.useState<File | null>(null)
    const load = async () => {
        const { data, error } = await db
            .from("studio_compliance_docs")
            .select("*, vendors(name)")
            .order("doc_type")
            .order("created_at", { ascending: false })
        if (error) setMsg(error.message.includes("does not exist") ? "Run 20261018b_procurement_pricing_compliance.sql first." : error.message)
        setRows(data || [])
    }
    React.useEffect(() => {
        load()
    }, [])
    async function add(e: React.FormEvent) {
        e.preventDefault()
        const state = (DOC_TYPES.find((d) => d[0] === f.doc_type) || ["", "", ""])[2] || null
        let storage_path: string | null = null
        if (file) {
            storage_path = `${f.doc_type}/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_")}`
            const up = await db.storage.from("studio-compliance").upload(storage_path, file, { upsert: false })
            if (up.error) {
                setMsg(up.error.message)
                return
            }
        }
        const { error } = await db.from("studio_compliance_docs").insert({
            doc_type: f.doc_type,
            state,
            number: f.number || null,
            issued_on: f.issued_on || null,
            expires_on: f.expires_on || null,
            notes: f.notes || null,
            storage_path,
        })
        setMsg(error ? error.message : "Saved. The file is private to the studio.")
        if (!error) {
            setF(blank)
            setFile(null)
        }
        load()
    }
    async function open(r: any) {
        const { data, error } = await db.storage.from("studio-compliance").createSignedUrl(r.storage_path, 120)
        if (error) setMsg(error.message)
        else window.open(data.signedUrl, "_blank", "noopener")
    }
    const today = new Date().toISOString().slice(0, 10)
    const soon = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10)
    const have = (t: string) => rows.some((r) => r.doc_type === t && r.status === "active")
    const missing = ["ca_sellers_permit", "ca_resale_certificate", "ny_certificate_of_authority", "ny_resale_certificate"].filter((t) => !have(t))
    return (
        <div>
            <p style={{ maxWidth: 680, lineHeight: 1.7, fontSize: 14 }}>
                Resale certificates, permits and licences for both operating states. Files sit in a private bucket and open
                through two-minute links. Vendors ask for the CA seller's permit number and a signed CDTFA-230, or the NY
                Certificate of Authority and a signed ST-120. Keep one blanket certificate per vendor on file.
            </p>
            {missing.length > 0 && (
                <div className="c" style={{ borderColor: "#b4542e" }}>
                    <div className="mono">Missing</div>
                    {missing.map((t) => (DOC_TYPES.find((d) => d[0] === t) || ["", t])[1]).join(" · ")}
                </div>
            )}
            <form onSubmit={add} className="c">
                <div className="mono">Add a document</div>
                <div className="r" style={{ marginTop: 8 }}>
                    <select value={f.doc_type} onChange={(e) => setF({ ...f, doc_type: e.target.value })}>
                        {DOC_TYPES.map(([v, l]) => (
                            <option key={v} value={v}>
                                {l}
                            </option>
                        ))}
                    </select>
                    <input placeholder="Number" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} />
                    <label className="mono">
                        Issued <input type="date" value={f.issued_on} onChange={(e) => setF({ ...f, issued_on: e.target.value })} />
                    </label>
                    <label className="mono">
                        Expires <input type="date" value={f.expires_on} onChange={(e) => setF({ ...f, expires_on: e.target.value })} />
                    </label>
                    <input placeholder="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} style={{ flex: "2 1 200px" }} />
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    <button className="b" type="submit">
                        Save
                    </button>
                </div>
                {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
            </form>
            <div className="c tw">
                <table>
                    <thead>
                        <tr>
                            <th>Document</th>
                            <th>State</th>
                            <th>Number</th>
                            <th>Issued</th>
                            <th>Expires</th>
                            <th>File</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td>
                                    {(DOC_TYPES.find((d) => d[0] === r.doc_type) || ["", r.doc_type])[1]}
                                    <div className="mono">
                                        {r.vendors?.name ? r.vendors.name + " · " : ""}
                                        {r.notes || ""}
                                    </div>
                                </td>
                                <td>{r.state || ""}</td>
                                <td>{r.number || ""}</td>
                                <td>{r.issued_on || ""}</td>
                                <td style={{ color: r.expires_on && r.expires_on <= soon ? "#b4542e" : undefined }}>
                                    {r.expires_on || "No expiry"}
                                    {r.expires_on && r.expires_on < today ? " · expired" : r.expires_on && r.expires_on <= soon ? " · renew" : ""}
                                </td>
                                <td>
                                    {r.storage_path ? (
                                        <button className="b g" onClick={() => open(r)}>
                                            Open
                                        </button>
                                    ) : (
                                        ""
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

/* ───────────── Stage, settings and event helpers ───────────── */
// The client's stage advances on its own from the data: retainer → welcome/survey → active phase.
function stageLabel(c: any, phaseTitle?: string) {
    if (!c.retainer_paid) return "Retainer pending"
    if (!c.survey_completed_at) return "Welcome · survey pending"
    return `Phase ${c.current_phase || 1}${phaseTitle ? " · " + phaseTitle : ""} active`
}
// Per-project settings live beside permit progress in projects.permit_progress (keys starting "__").
async function saveProjectSetting(db: any, pid: string, key: string, value: any) {
    const { data: cur } = await db
        .from("projects")
        .select("permit_progress")
        .eq("id", pid)
        .single()
    return db
        .from("projects")
        .update({ permit_progress: { ...(cur?.permit_progress || {}), [key]: value } })
        .eq("id", pid)
}
const EVENT_LABELS: Record<string, string> = {
    survey_submitted: "completed the Design Intent Survey",
    family_survey_submitted: "completed the Family Survey",
    file_uploaded: "uploaded a file",
    file_from_client: "uploaded a file",
    deliverable_accepted: "approved a deliverable",
    deliverable_revision_requested: "asked for a revision",
    phase_approve: "approved a phase",
    phase_request_changes: "requested changes on a phase",
    meeting_requested: "requested a meeting",
    ffe_approved: "approved an FF&E item",
    ffe_revision_requested: "asked for an FF&E revision",
    ffe_declined: "declined an FF&E item",
    retainer_paid: "paid the retainer",
    portal_login: "signed in to the portal",
}
const eventText = (a: string) => EVENT_LABELS[a] || String(a || "").replace(/_/g, " ")
const fmtWhen = (t: string) => {
    const d = new Date(t)
    const mins = Math.round((Date.now() - d.getTime()) / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return mins + " min ago"
    if (mins < 60 * 24) return Math.round(mins / 60) + " h ago"
    return d.toLocaleDateString([], { month: "short", day: "numeric" })
}
const readSeen = (): Record<string, string> => {
    try {
        return JSON.parse(localStorage.getItem("fy_seen") || "{}")
    } catch {
        return {}
    }
}
const writeSeen = (m: Record<string, string>) => {
    try {
        localStorage.setItem("fy_seen", JSON.stringify(m))
    } catch {}
}

/* ───────────── Master Studio Log: totals, client cards, permits, scheduling, live event stream ───────────── */
function MasterLog({ db, focus, setFocus, onNewClient, openTab }: any) {
    const [d, setD] = React.useState<any>({ ov: [], act: [], pr: [], ph: [], ffe: [], dl: [], mr: [] })
    const [seen, setSeenState] = React.useState<Record<string, string>>(readSeen)
    const [open, setOpen] = React.useState(false)
    const [toast, setToast] = React.useState("")
    const lastTop = React.useRef<string>("")
    const load = React.useCallback(async () => {
        const [ov, act, pr, ph, ffe, dl, mr] = await Promise.all([
            db.from("studio_overview").select("*").order("created_at", { ascending: false }),
            db.from("project_activity").select("*").order("created_at", { ascending: false }).limit(60),
            db.from("projects").select("id,title,client_id,jurisdiction_id,permit_progress"),
            db.from("phases").select("project_id,seq,title,status"),
            db.from("procurement_ffe").select("project_id,client_status"),
            db.from("deliverables").select("project_id,kind,status"),
            db.from("meeting_requests").select("project_id,status"),
        ])
        const next = {
            ov: ov.data || [],
            act: act.data || [],
            pr: pr.data || [],
            ph: ph.data || [],
            ffe: ffe.data || [],
            dl: dl.data || [],
            mr: mr.data || [],
        }
        // Toast the newest client event that arrived since the last refresh.
        const top = next.act[0]
        if (top && lastTop.current && top.created_at > lastTop.current) {
            const who = next.ov.find((c: any) => c.project_id === top.project_id)?.client_name || "A client"
            setToast(`${who} ${eventText(top.action)}`)
            setTimeout(() => setToast(""), 9000)
        }
        if (top) lastTop.current = top.created_at
        setD(next)
    }, [db])
    React.useEffect(() => {
        load()
        const iv = setInterval(load, 30000)
        // Live updates where the database broadcasts them (phases, deliverables); polling covers the rest.
        let ch: any
        try {
            ch = db
                .channel("fy-master-log")
                .on("postgres_changes", { event: "*", schema: "public", table: "deliverables" }, load)
                .on("postgres_changes", { event: "*", schema: "public", table: "phases" }, load)
                .subscribe()
        } catch {}
        return () => {
            clearInterval(iv)
            try {
                ch && db.removeChannel(ch)
            } catch {}
        }
    }, [load])

    const markSeen = (pid: string) => {
        const m = { ...seen, [pid]: new Date().toISOString() }
        setSeenState(m)
        writeSeen(m)
    }
    const fresh = (pid: string) =>
        d.act.filter((a: any) => a.project_id === pid && (!seen[pid] || a.created_at > seen[pid])).length
    const phaseTitle = (pid: string, seq: number) =>
        d.ph.find((x: any) => x.project_id === pid && x.seq === seq)?.title
    const inScope = (pid: string) => !focus || pid === focus
    const awaitingClient = (pid?: string) =>
        d.ph.filter((x: any) => x.status === "in_review" && (!pid || x.project_id === pid)).length +
        d.dl.filter((x: any) => x.kind !== "other" && x.status === "pending" && (!pid || x.project_id === pid)).length +
        d.ffe.filter((x: any) => x.client_status === "proposed" && (!pid || x.project_id === pid)).length
    const awaitingStudio = (pid?: string) =>
        d.dl.filter((x: any) => x.status === "revision_requested" && (!pid || x.project_id === pid)).length +
        d.ffe.filter((x: any) => x.client_status === "revision_requested" && (!pid || x.project_id === pid)).length +
        d.mr.filter((x: any) => x.status === "requested" && (!pid || x.project_id === pid)).length
    const permitLine = (p: any) => {
        const prog = p.permit_progress || {}
        const ag = (prog.__agencies || []).length
        const active = Object.keys(prog).find((k) => !k.startsWith("__") && prog[k] === "active")
        const done = Object.keys(prog).filter((k) => !k.startsWith("__") && prog[k] === "done").length
        return {
            track: p.jurisdiction_id === "ladbs" ? "LADBS" : p.jurisdiction_id === "epic_la" ? "LA County EPIC" : p.jurisdiction_id === "nyc_dob" ? "NYC DOB" : "Not set",
            agencies: ag,
            status: active ? "In review: " + active : done ? done + " stages complete" : "Not started",
        }
    }
    const projects = d.pr.filter((p: any) => inScope(p.id))
    const events = d.act.filter((a: any) => inScope(a.project_id))
    const newCount = d.ov.reduce((n: number, c: any) => n + (c.project_id ? fresh(c.project_id) : 0), 0)
    const nameFor = (pid: string) => d.ov.find((c: any) => c.project_id === pid)?.client_name || "Client"

    return (
        <section aria-label="Master Studio Log" style={{ margin: "4px 0 18px" }}>
            {toast && (
                <div role="status" className="c" style={{ borderColor: "var(--accent)", fontSize: 14 }}>
                    <span className="badge">new</span> {toast}
                </div>
            )}
            <div className="c">
                <div className="r" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div className="mono">Master Studio Log{focus ? " · " + (d.pr.find((p: any) => p.id === focus)?.title || "") : " · all projects"}</div>
                    <button className={"b" + (open ? "" : " g")} onClick={() => setOpen(!open)} aria-expanded={open}>
                        Notifications {newCount ? <span className="badge">{newCount}</span> : null}
                    </button>
                </div>
                <div className="stats" style={{ marginTop: 10 }}>
                    <div>
                        <span className="mono">Active projects</span>
                        <b>{projects.length}</b>
                    </div>
                    <div>
                        <span className="mono">Awaiting client approval</span>
                        <b>{awaitingClient(focus || undefined)}</b>
                    </div>
                    <div>
                        <span className="mono">Needs studio action</span>
                        <b>{awaitingStudio(focus || undefined)}</b>
                    </div>
                    <div>
                        <span className="mono">Client events (7 days)</span>
                        <b>{events.filter((a: any) => Date.now() - new Date(a.created_at).getTime() < 7 * 864e5).length}</b>
                    </div>
                </div>
                <div className="tw" style={{ marginTop: 12 }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Project</th>
                                <th>Permit track</th>
                                <th>Agencies</th>
                                <th>Permit status</th>
                                <th>Scheduling</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projects.map((p: any) => {
                                const pl = permitLine(p)
                                const book = p.permit_progress?.__booking_url
                                return (
                                    <tr key={p.id}>
                                        <td>{p.title}</td>
                                        <td>{pl.track}</td>
                                        <td>{pl.agencies || "none ticked"}</td>
                                        <td>{pl.status}</td>
                                        <td>
                                            {book ? (
                                                <a href={book} target="_blank" rel="noopener noreferrer">
                                                    Booking page
                                                </a>
                                            ) : (
                                                <button
                                                    className="b g"
                                                    style={{ padding: "4px 10px" }}
                                                    onClick={() => {
                                                        setFocus(p.id)
                                                        openTab("calendar")
                                                    }}
                                                >
                                                    Add booking link
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                {open && (
                    <div style={{ marginTop: 14 }}>
                        <div className="r" style={{ justifyContent: "space-between" }}>
                            <div className="mono">Client event stream</div>
                            <button
                                className="b g"
                                onClick={() => {
                                    const m = { ...seen }
                                    d.ov.forEach((c: any) => c.project_id && (m[c.project_id] = new Date().toISOString()))
                                    setSeenState(m)
                                    writeSeen(m)
                                }}
                            >
                                Mark all read
                            </button>
                        </div>
                        {events.slice(0, 25).map((a: any) => {
                            const isNew = !seen[a.project_id] || a.created_at > seen[a.project_id]
                            return (
                                <div
                                    key={a.id}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "110px 1fr",
                                        gap: 12,
                                        padding: "7px 0",
                                        borderTop: ".5px solid color-mix(in srgb,var(--ink) 20%,transparent)",
                                        fontSize: 13,
                                        fontWeight: isNew ? 600 : 400,
                                    }}
                                >
                                    <span className="mono">{fmtWhen(a.created_at)}</span>
                                    <span>
                                        {nameFor(a.project_id)} {eventText(a.action)}
                                        {isNew ? <span className="badge" style={{ marginLeft: 8 }}>new</span> : null}
                                    </span>
                                </div>
                            )
                        })}
                        {!events.length && <p className="mono">No client events yet.</p>}
                    </div>
                )}
            </div>
            <div className="cards" role="group" aria-label="Client portals">
                <button className="card" aria-pressed={!focus} onClick={() => setFocus("")}>
                    <div className="mono" style={{ opacity: 1 }}>All clients</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>{d.ov.length} portals</div>
                </button>
                {d.ov.map((c: any) => {
                    const n = c.project_id ? fresh(c.project_id) : 0
                    return (
                        <button
                            key={c.client_id}
                            className="card"
                            aria-pressed={focus === c.project_id}
                            onClick={() => {
                                if (!c.project_id) return
                                setFocus(focus === c.project_id ? "" : c.project_id)
                                markSeen(c.project_id)
                            }}
                        >
                            <div className="r" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                                <b style={{ fontSize: 14 }}>{c.client_name}</b>
                                {n ? <span className="badge" aria-label={n + " new events"}>{n}</span> : null}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75, margin: "3px 0 8px" }}>
                                {c.address || c.project_title || "No project yet"}
                            </div>
                            <span className="tag">{stageLabel(c, phaseTitle(c.project_id, c.current_phase))}</span>
                        </button>
                    )
                })}
                <button className="card" onClick={onNewClient} style={{ borderStyle: "dashed" }}>
                    <div className="mono" style={{ opacity: 1 }}>+ Add new client portal</div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Name, email, address, retainer</div>
                </button>
            </div>
        </section>
    )
}

function Clients({ db, portalUrl, supabaseUrl, focus }: any) {
    const [upCat, setUpCat] = React.useState("auto")
    // Which per-client panel is open: { id: client_id, view: "meet" | "permits" | "directory" }
    const [panel, setPanel] = React.useState<{ id: string; view: string } | null>(null)
    const toggle = (c: any, view: string) =>
        setPanel(panel?.id === c.client_id && panel.view === view ? null : { id: c.client_id, view })
    const [rows, setRows] = React.useState<any[]>([])
    const [sel, setSel] = React.useState<any>(null)
    const [detail, setDetail] = React.useState<any>(null)
    const [f, setF] = React.useState({
        name: "",
        email: "",
        phone: "",
        address: "",
        retainer: false,
    })
    const [note, setNote] = React.useState("")
    const fileRef = React.useRef<HTMLInputElement>(null)
    const load = async () => {
        const { data, error } = await db
            .from("studio_overview")
            .select("*")
            .order("created_at", { ascending: false })
        if (error) {
            setNote(
                "Couldn't load clients: " +
                    error.message +
                    ". Sign out and sign back in."
            )
        }
        setRows(data || [])
    }
    React.useEffect(() => {
        load()
    }, [])

    async function add(e: React.FormEvent) {
        e.preventDefault()
        const { data, error } = await db.rpc("studio_add_client", {
            p_name: f.name,
            p_email: f.email,
            p_phone: f.phone || null,
            p_address: f.address || null,
            p_role: "client",
            p_notes: null,
            p_retainer: f.retainer,
            p_send: f.retainer,
        })
        setNote(
            error
                ? /studio only/i.test(error.message)
                    ? "Your sign-in expired. Sign out, then send yourself a new link."
                    : error.message
                : `Created ${data?.[0]?.client_id}. ${f.retainer ? "Credentials emailed." : "Mark the retainer paid to release credentials."}`
        )
        setF({ name: "", email: "", phone: "", address: "", retainer: false })
        load()
    }
    async function retainer(c: any) {
        await db.rpc("studio_set_retainer", {
            p_client: c.client_id,
            p_paid: !c.retainer_paid,
        })
        load()
    }
    async function resend(c: any) {
        const { error } = await db.rpc("studio_resend_credentials", {
            p_client: c.client_id,
        })
        setNote(error ? error.message : `Credentials re-sent to ${c.email}.`)
    }
    async function inspect(c: any) {
        setSel(c)
        const [ph, dl, fl, act] = await Promise.all([
            db
                .from("phases")
                .select("*")
                .eq("project_id", c.project_id)
                .order("seq"),
            db
                .from("deliverables")
                .select("*")
                .eq("project_id", c.project_id)
                .order("created_at"),
            db.from("project_files").select("*").eq("project_id", c.project_id),
            db
                .from("project_activity")
                .select("*")
                .eq("project_id", c.project_id)
                .order("created_at", { ascending: false })
                .limit(10),
        ])
        setDetail({
            ph: ph.data || [],
            dl: dl.data || [],
            fl: fl.data || [],
            act: act.data || [],
        })
    }
    async function setEmail(c: any) {
        const v = prompt("Client email address", c.email || "")
        if (v === null) return
        const em = v.trim().toLowerCase()
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
            setNote("That doesn't look like an email.")
            return
        }
        const { error } = await db.rpc("studio_set_email", {
            p_client: c.client_id,
            p_email: em,
        })
        setNote(
            error
                ? error.message
                : `Email saved for ${c.client_name}. Now press Resend key.`
        )
        load()
    }
    async function setPlaylist(c: any) {
        const v = prompt("Spotify playlist ID or URL", c.playlist_id || "")
        if (v === null) return
        const id = (v.match(/playlist\/([A-Za-z0-9]+)/)?.[1] || v).trim()
        await db
            .from("projects")
            .update({ playlist_id: id })
            .eq("id", c.project_id)
        load()
    }
    async function phaseStatus(ph: any, status: string) {
        await db.from("phases").update({ status }).eq("id", ph.id)
        inspect(sel)
    }
    async function addDeliverable(ph: any) {
        const title = prompt("Deliverable title")
        if (!title) return
        await db
            .from("deliverables")
            .insert({
                project_id: sel.project_id,
                phase_id: ph.id,
                title,
                kind: "document",
                status: "pending",
            })
        inspect(sel)
    }
    async function uploadStudioFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !sel) return
        if (!sel.project_id) {
            setNote(
                "This client has no project yet, so there is nowhere to file it. Use the Lorado Courtyard row."
            )
            e.target.value = ""
            return
        }
        const path = `${sel.project_id}/studio/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_")}`
        setNote("Uploading " + file.name + "…")
        const { error } = await db.storage
            .from("project-files")
            .upload(path, file)
        if (error) {
            setNote("Upload failed: " + error.message)
            return
        }
        const { data: who } = await db.auth.getUser()
        const { error: e2 } = await db
            .from("project_files")
            .insert({
                project_id: sel.project_id,
                uploaded_by: who?.user?.email || "studio",
                path,
                name: file.name,
                size_bytes: file.size,
                direction: "studio",
                category: upCat === "auto" ? guessCat(file.name) : upCat,
            })
        setNote(
            e2
                ? "Saved file but could not list it: " + e2.message
                : file.name + " is now in " + sel.client_name + "'s Files tab."
        )
        e.target.value = ""
        inspect(sel)
    }

    return (
        <div>
            <form onSubmit={add} className="c">
                <div className="mono">Add client</div>
                <div className="r" style={{ marginTop: 8 }}>
                    <input
                        required
                        id="fy-add-name"
                        placeholder="Name"
                        value={f.name}
                        onChange={(e) => setF({ ...f, name: e.target.value })}
                    />
                    <input
                        required
                        type="email"
                        placeholder="Email"
                        value={f.email}
                        onChange={(e) => setF({ ...f, email: e.target.value })}
                    />
                    <input
                        placeholder="Phone"
                        value={f.phone}
                        onChange={(e) => setF({ ...f, phone: e.target.value })}
                    />
                    <input
                        placeholder="Project address"
                        value={f.address}
                        onChange={(e) =>
                            setF({ ...f, address: e.target.value })
                        }
                    />
                    <label className="mono">
                        <input
                            type="checkbox"
                            checked={f.retainer}
                            onChange={(e) =>
                                setF({ ...f, retainer: e.target.checked })
                            }
                        />{" "}
                        retainer paid
                    </label>
                    <button className="b" type="submit">
                        Create
                    </button>
                </div>
                {note && <p style={{ fontSize: 13 }}>{note}</p>}
            </form>
            {rows
                .filter((c) => !focus || c.project_id === focus)
                .map((c) => (
                <div key={c.client_id} className="c">
                    <div
                        className="r"
                        style={{ justifyContent: "space-between" }}
                    >
                        <div>
                            <b>{c.client_name}</b>{" "}
                            <span style={{ opacity: 0.55 }}>
                                · {c.project_title} · {c.email}
                            </span>
                            <div className="mono" style={{ marginTop: 4 }}>
                                {stageLabel(c)} · {c.pending_items} open tasks ·{" "}
                                {c.change_requests} revisions ·{" "}
                                {c.open_meetings} meetings
                            </div>
                        </div>
                        <div className="r">
                            <button className="b g" onClick={() => retainer(c)}>
                                {c.retainer_paid
                                    ? "Retainer paid"
                                    : "Mark retainer paid"}
                            </button>
                            <button className="b g" onClick={() => setEmail(c)}>
                                {c.email ? "Edit email" : "⚠ Set email"}
                            </button>
                            <button className="b g" onClick={() => resend(c)}>
                                Resend key
                            </button>
                            <button
                                className="b g"
                                onClick={() => setPlaylist(c)}
                            >
                                Playlist
                            </button>
                            <button
                                className={"b" + (panel?.id === c.client_id && panel.view === "meet" ? "" : " g")}
                                onClick={() => toggle(c, "meet")}
                            >
                                Meet
                            </button>
                            <button
                                className={"b" + (panel?.id === c.client_id && panel.view === "permits" ? "" : " g")}
                                onClick={() => toggle(c, "permits")}
                            >
                                Permits
                            </button>
                            <button
                                className={"b" + (panel?.id === c.client_id && panel.view === "directory" ? "" : " g")}
                                onClick={() => toggle(c, "directory")}
                            >
                                Directory
                            </button>
                            <button className="b" onClick={() => inspect(c)}>
                                Inspect
                            </button>
                            <a
                                className="b"
                                style={{ textDecoration: "none" }}
                                href={`${portalUrl}?preview=${c.client_id}`}
                                target="_blank"
                                rel="noopener"
                            >
                                See as client
                            </a>
                            <a
                                className="b g"
                                style={{ textDecoration: "none" }}
                                href={`${portalUrl}?preview=${c.client_id}&stage=survey`}
                                target="_blank"
                                rel="noopener"
                            >
                                Survey view
                            </a>
                        </div>
                    </div>
                    {panel?.id === c.client_id &&
                        (!c.project_id ? (
                            <p className="mono" style={{ marginTop: 12 }}>
                                This client has no project yet.
                            </p>
                        ) : (
                            <div
                                style={{
                                    borderTop: ".5px solid var(--accent)",
                                    marginTop: 14,
                                    paddingTop: 4,
                                }}
                            >
                                {panel.view === "meet" ? (
                                    <>
                                        <Meetings db={db} projectId={c.project_id} />
                                        <CalendarManager db={db} projectId={c.project_id} />
                                    </>
                                ) : panel.view === "permits" ? (
                                    <PermitManager db={db} projectId={c.project_id} />
                                ) : (
                                    <Extras db={db} sel={c} supabaseUrl={supabaseUrl} />
                                )}
                            </div>
                        ))}
                </div>
            ))}
            {sel && detail && (
                <div className="c" style={{ borderColor: "var(--accent)" }}>
                    <div
                        className="r"
                        style={{ justifyContent: "space-between" }}
                    >
                        <div>
                            <div className="mono">
                                What {sel.client_name} sees —{" "}
                                {sel.project_title}
                            </div>
                            {note && (
                                <div style={{ fontSize: 13, marginTop: 4 }}>
                                    {note}
                                </div>
                            )}
                        </div>
                        <span className="r">
                            <select
                                aria-label="Folder"
                                value={upCat}
                                onChange={(e) => setUpCat(e.target.value)}
                            >
                                <option value="auto">Folder: auto</option>
                                {FILE_CATS.map(([k, l]) => (
                                    <option key={k} value={k}>
                                        {l}
                                    </option>
                                ))}
                            </select>
                            <input
                                ref={fileRef}
                                type="file"
                                style={{
                                    position: "absolute",
                                    width: 1,
                                    height: 1,
                                    opacity: 0,
                                    pointerEvents: "none",
                                }}
                                onChange={uploadStudioFile}
                            />
                            <button
                                className="b g"
                                onClick={() => fileRef.current?.click()}
                            >
                                Upload to client
                            </button>
                        </span>
                    </div>
                    {detail.ph.map((ph: any) => (
                        <div
                            key={ph.id}
                            style={{
                                borderTop: ".5px solid var(--ink)",
                                padding: "10px 0",
                                opacity: ph.status === "locked" ? 0.5 : 1,
                            }}
                        >
                            <div
                                className="r"
                                style={{ justifyContent: "space-between" }}
                            >
                                <span>
                                    Phase {ph.seq} · {ph.title}{" "}
                                    <span className="mono">[{ph.status}]</span>
                                </span>
                                <span className="r">
                                    <select
                                        value={ph.status}
                                        onChange={(e) =>
                                            phaseStatus(ph, e.target.value)
                                        }
                                    >
                                        {[
                                            "locked",
                                            "active",
                                            "in_review",
                                            "approved",
                                        ].map((s) => (
                                            <option key={s}>{s}</option>
                                        ))}
                                    </select>
                                    {ph.status === "active" && (
                                        <button
                                            className="b"
                                            onClick={() =>
                                                phaseStatus(ph, "in_review")
                                            }
                                        >
                                            Send for client review
                                        </button>
                                    )}
                                    <button
                                        className="b g"
                                        onClick={() => addDeliverable(ph)}
                                    >
                                        + deliverable
                                    </button>
                                </span>
                            </div>
                            <Checklist
                                ph={ph}
                                items={detail.dl.filter(
                                    (d: any) =>
                                        d.phase_id === ph.id &&
                                        d.kind === "other" &&
                                        !String(d.title).startsWith("__")
                                )}
                                notion={detail.dl.find(
                                    (d: any) =>
                                        d.phase_id === ph.id &&
                                        d.title === "__notion__"
                                )}
                                db={db}
                                refresh={() => inspect(sel)}
                                projectId={sel.project_id}
                            />
                            {detail.dl
                                .filter(
                                    (d: any) =>
                                        d.phase_id === ph.id &&
                                        d.kind !== "other"
                                )
                                .map((d: any) => (
                                    <div
                                        key={d.id}
                                        style={{
                                            fontSize: 13,
                                            paddingLeft: 14,
                                            opacity: 0.8,
                                        }}
                                    >
                                        — {d.title}{" "}
                                        <span className="mono">
                                            [{d.status}]
                                        </span>
                                        {d.client_comment
                                            ? ` “${d.client_comment}”`
                                            : ""}
                                    </div>
                                ))}
                        </div>
                    ))}
                    <Extras db={db} sel={sel} supabaseUrl={supabaseUrl} />
                    <div className="mono" style={{ marginTop: 12 }}>
                        Files {detail.fl.length} · Recent activity
                    </div>
                    {detail.act.map((a: any) => {
                        const d = new Date(a.created_at)
                        const stamp = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()} ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                        return (
                            <div
                                key={a.id}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                        "repeat(12,minmax(0,1fr))",
                                    gap: 16,
                                    padding: "8px 0",
                                    borderTop:
                                        ".5px solid color-mix(in srgb,var(--ink) 20%,transparent)",
                                    fontSize: 13,
                                    alignItems: "baseline",
                                }}
                            >
                                <span
                                    className="mono"
                                    style={{
                                        gridColumn: "span 3",
                                        whiteSpace: "nowrap",
                                        opacity: 0.6,
                                    }}
                                >
                                    {stamp}
                                </span>
                                <span
                                    style={{
                                        gridColumn: "span 9",
                                        minWidth: 0,
                                        overflowWrap: "anywhere",
                                    }}
                                >
                                    {a.actor ? `${a.actor} · ` : ""}
                                    {String(a.action).replace(/_/g, " ")}
                                </span>
                            </div>
                        )
                    })}
                    {!detail.act.length && <div className="mono">none</div>}
                </div>
            )}
        </div>
    )
}

const FILE_CATS: [string, string][] = [
    ["meeting_notes", "Meeting Notes"],
    ["submittals", "Submittals"],
    ["presentations", "Presentations"],
    ["images", "Images"],
    ["drawings", "Drawings & Models"],
    ["documents", "Contracts & Documents"],
    ["other", "Other"],
]
const guessCat = (name: string) =>
    /\.(png|jpe?g|gif|webp|heic|avif|tiff?)$/i.test(name)
        ? "images"
        : /\.(pptx?|key)$/i.test(name)
          ? "presentations"
          : /\.(dwg|dxf|rvt|skp|3dm|obj|ifc)$/i.test(name)
            ? "drawings"
            : /\.(docx?|pdf|txt|xlsx?)$/i.test(name)
              ? "documents"
              : "other"

/* Project stakeholder directory: shown to the client. Edit any row in place, then Save changes. */
const DIR_COLS: [string, string][] = [
    ["full_name", "Name"],
    ["role", "Role / discipline"],
    ["company", "Company"],
    ["phone", "Phone"],
    ["email", "Email"],
    ["status", "Portal access"],
]
const ACCESS = ["Active", "View only", "No portal access", "Pending Selection / TBD"]
const blankDir = { full_name: "", role: "", company: "", phone: "", email: "", status: "Active" }
function Extras({ db, sel }: any) {
    const [rows, setRows] = React.useState<any[]>([])
    const [f, setF] = React.useState<any>(blankDir)
    const [editId, setEditId] = React.useState<string>("")
    const [draft, setDraft] = React.useState<any>({})
    const [msg, setMsg] = React.useState("")
    const load = async () => {
        const { data, error } = await db
            .from("project_directory")
            .select("*")
            .eq("project_id", sel.project_id)
            .order("seq")
            .order("created_at")
        if (error) setMsg(error.message)
        setRows(data || [])
    }
    React.useEffect(() => {
        if (sel?.project_id) load()
    }, [sel?.project_id])
    async function add(e?: any) {
        e?.preventDefault?.()
        if (!f.full_name.trim()) {
            setMsg("Add a name first. Everything else can be filled in later.")
            return
        }
        const clean: any = {}
        Object.keys(blankDir).forEach((k) => (clean[k] = String(f[k] || "").trim() || null))
        const { error } = await db
            .from("project_directory")
            .insert({ project_id: sel.project_id, ...clean, seq: rows.length + 1 })
        setMsg(error ? error.message : `${f.full_name} added to the directory.`)
        if (!error) setF(blankDir)
        load()
    }
    function startEdit(r: any) {
        setEditId(r.id)
        const dft: any = {}
        Object.keys(blankDir).forEach((k) => (dft[k] = r[k] || ""))
        setDraft(dft)
        setMsg("")
    }
    async function saveRow(r: any) {
        if (!String(draft.full_name || "").trim()) {
            setMsg("A directory entry needs a name.")
            return
        }
        const patch: any = {}
        Object.keys(blankDir).forEach((k) => {
            const v = String(draft[k] || "").trim()
            if ((r[k] || "") !== v) patch[k] = v || null
        })
        if (!Object.keys(patch).length) {
            setEditId("")
            return
        }
        const { error } = await db.from("project_directory").update(patch).eq("id", r.id)
        setMsg(error ? error.message : `Saved ${draft.full_name}. The client's directory is updated.`)
        if (!error) setEditId("")
        load()
    }
    async function remove(r: any) {
        if (!confirm(`Remove ${r.full_name} from the directory?`)) return
        const { error } = await db.from("project_directory").delete().eq("id", r.id)
        setMsg(error ? error.message : "Removed.")
        load()
    }
    const field = (k: string, val: string, set: (v: string) => void, onEnter?: () => void) =>
        k === "status" ? (
            <select aria-label="Portal access" value={val || "Active"} onChange={(e) => set(e.target.value)} style={{ width: "100%", fontSize: 13 }}>
                {Array.from(new Set([...ACCESS, val].filter(Boolean))).map((o) => (
                    <option key={o}>{o}</option>
                ))}
            </select>
        ) : (
            <input
                aria-label={DIR_COLS.find((c) => c[0] === k)?.[1]}
                type={k === "email" ? "email" : k === "phone" ? "tel" : "text"}
                placeholder={k === "role" ? "e.g. Structural Engineer" : DIR_COLS.find((c) => c[0] === k)?.[1]}
                value={val}
                onChange={(e) => set(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onEnter && onEnter()}
                style={{ width: "100%", fontSize: 13 }}
            />
        )
    return (
        <div style={{ borderTop: ".5px solid var(--ink)", marginTop: 14, paddingTop: 12 }}>
            <div className="mono">Project directory · shown to the client</div>
            <p style={{ fontSize: 12, opacity: 0.7, margin: "6px 0" }}>
                Press Edit on any row to fill in or correct a phone, email or role, then Save changes. No need to delete and re-add.
            </p>
            <div className="tw">
                <table>
                    <thead>
                        <tr>
                            {DIR_COLS.map(([k, l]) => (
                                <th key={k}>{l}</th>
                            ))}
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) =>
                            editId === r.id ? (
                                <tr key={r.id} style={{ background: "color-mix(in srgb,var(--accent) 10%,transparent)" }}>
                                    {DIR_COLS.map(([k]) => (
                                        <td key={k} style={{ padding: 4 }}>
                                            {field(k, draft[k], (v) => setDraft({ ...draft, [k]: v }), () => saveRow(r))}
                                        </td>
                                    ))}
                                    <td style={{ whiteSpace: "nowrap" }}>
                                        <button className="b" style={{ padding: "6px 10px" }} onClick={() => saveRow(r)}>
                                            Save changes
                                        </button>{" "}
                                        <button className="b g" style={{ padding: "6px 10px" }} onClick={() => setEditId("")}>
                                            Cancel
                                        </button>
                                    </td>
                                </tr>
                            ) : (
                                <tr key={r.id}>
                                    {DIR_COLS.map(([k, l]) => (
                                        <td key={k} style={{ opacity: r[k] ? 1 : 0.4 }}>
                                            {r[k] || (k === "status" ? "Active" : "add " + l.toLowerCase())}
                                        </td>
                                    ))}
                                    <td style={{ whiteSpace: "nowrap" }}>
                                        <button className="b g" style={{ padding: "6px 10px" }} onClick={() => startEdit(r)}>
                                            Edit
                                        </button>{" "}
                                        <button
                                            className="b g"
                                            style={{ padding: "6px 10px" }}
                                            onClick={() => remove(r)}
                                            aria-label={"Remove " + r.full_name}
                                        >
                                            ×
                                        </button>
                                    </td>
                                </tr>
                            )
                        )}
                        <tr>
                            {DIR_COLS.map(([k]) => (
                                <td key={k} style={{ padding: 4 }}>
                                    {field(k, f[k], (v) => setF({ ...f, [k]: v }), add)}
                                </td>
                            ))}
                            <td>
                                <button className="b" onClick={add}>
                                    Add
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
        </div>
    )
}

/* Meeting requests inbox — every client request lands here AND in your email. */
function Meetings({ db, projectId }: any) {
    const [rows, setRows] = React.useState<any[]>([])
    const [msg, setMsg] = React.useState("")
    const load = async () => {
        let q = db
            .from("meeting_requests")
            .select("*, projects(title)")
            .order("created_at", { ascending: false })
            .limit(50)
        if (projectId) q = q.eq("project_id", projectId)
        const { data, error } = await q
        if (error) setMsg(error.message)
        setRows(data || [])
    }
    React.useEffect(() => {
        load()
    }, [projectId])
    async function setStatus(r: any, status: string) {
        const { error } = await db
            .from("meeting_requests")
            .update({ status })
            .eq("id", r.id)
        setMsg(error ? error.message : `Marked ${status}.`)
        load()
    }
    return (
        <div>
            <p style={{ maxWidth: 640, lineHeight: 1.7, fontSize: 14 }}>
                Each client request is emailed to you and filed here. Confirm by
                sending a calendar invite, then mark it confirmed.
            </p>
            {msg && <p style={{ fontSize: 13, fontWeight: 600 }}>{msg}</p>}
            {rows.map((r) => (
                <div key={r.id} className="c">
                    <div
                        className="r"
                        style={{ justifyContent: "space-between" }}
                    >
                        <div>
                            <b>{r.topic}</b>{" "}
                            <span style={{ opacity: 0.55 }}>
                                · {r.projects?.title} · {r.requested_by} ·{" "}
                                {r.duration_min} min
                            </span>
                            <div className="mono" style={{ marginTop: 4 }}>
                                {r.status} ·{" "}
                                {new Date(r.created_at).toLocaleString()}
                            </div>
                        </div>
                        <div className="r">
                            <button
                                className="b g"
                                onClick={() => setStatus(r, "confirmed")}
                            >
                                Confirm
                            </button>
                            <button
                                className="b g"
                                onClick={() => setStatus(r, "declined")}
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                    <div style={{ fontSize: 13, marginTop: 8 }}>
                        {(Array.isArray(r.preferred_slots)
                            ? r.preferred_slots
                            : []
                        )
                            .map((s: any) => s.label || s.start)
                            .join("  ·  ")}
                    </div>
                    {r.notes && (
                        <div
                            style={{ fontSize: 13, marginTop: 6, opacity: 0.8 }}
                        >
                            “{r.notes}”
                        </div>
                    )}
                </div>
            ))}
            {!rows.length && <p className="mono">No requests yet.</p>}
        </div>
    )
}

const csvDownload = (name: string, rows: any[][]) => {
    const esc = (v: any) => {
        const t = String(v ?? "")
        return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t
    }
    const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], {
        type: "text/csv",
    })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
}
const money = (n: number) =>
    "$" +
    (Number(n) || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
function useProjects(db: any, dep?: any) {
    const [list, setList] = React.useState<any[]>([])
    React.useEffect(() => {
        db.from("projects")
            .select("id,title,client_id")
            .order("title")
            .then(({ data }: any) => setList(data || []))
    }, [dep])
    return list
}
const TIME_CATS = [
    "design",
    "drawings / CAD",
    "client meeting",
    "site visit",
    "procurement / sourcing",
    "coordination",
    "admin / business",
    "research / writing",
]

/* Hours tracking — your own time, by project, billable or not, with a running timer */
function TimeTracker({ db, focus }: any) {
    const projects = useProjects(db)
    const [allRows, setRows] = React.useState<any[]>([])
    const rows = focus ? allRows.filter((r) => r.project_id === focus) : allRows
    const [msg, setMsg] = React.useState("")
    const [month, setMonth] = React.useState(
        new Date().toISOString().slice(0, 7)
    )
    const [f, setF] = React.useState({
        work_date: new Date().toISOString().slice(0, 10),
        project_id: focus || "",
        category: TIME_CATS[0],
        description: "",
        hours: "",
        billable: true,
    })
    const [rate, setRate] = React.useState<string>(() => {
        try {
            return localStorage.getItem("fy_rate") || ""
        } catch {
            return ""
        }
    })
    const [timerStart, setTimerStart] = React.useState<number>(() => {
        try {
            return Number(localStorage.getItem("fy_timer") || 0)
        } catch {
            return 0
        }
    })
    const [tick, setTick] = React.useState(0)
    React.useEffect(() => {
        if (!timerStart) return
        const i = setInterval(() => setTick((x) => x + 1), 1000)
        return () => clearInterval(i)
    }, [timerStart])
    const load = async () => {
        const from = month + "-01",
            to = new Date(
                Number(month.slice(0, 4)),
                Number(month.slice(5, 7)),
                1
            )
                .toISOString()
                .slice(0, 10)
        const { data, error } = await db
            .from("studio_time_entries")
            .select("*")
            .gte("work_date", from)
            .lt("work_date", to)
            .order("work_date", { ascending: false })
            .order("created_at", { ascending: false })
        if (error) setMsg(error.message)
        setRows(data || [])
    }
    React.useEffect(() => {
        load()
    }, [month])
    const pname = (id: string) =>
        projects.find((p) => p.id === id)?.title || "Studio / no project"
    function startStop() {
        if (!timerStart) {
            const t = Date.now()
            setTimerStart(t)
            try {
                localStorage.setItem("fy_timer", String(t))
            } catch {}
            return
        }
        const hrs = Math.max(0.05, (Date.now() - timerStart) / 3600000)
        setF({ ...f, hours: (Math.round(hrs * 4) / 4 || 0.25).toString() })
        setTimerStart(0)
        try {
            localStorage.removeItem("fy_timer")
        } catch {}
        setMsg("Timer stopped. Add a description and save the entry.")
    }
    async function save(e: React.FormEvent) {
        e.preventDefault()
        const minutes = Math.round(parseFloat(f.hours) * 60)
        if (!minutes || minutes < 1) {
            setMsg("Enter hours, e.g. 1.5")
            return
        }
        try {
            localStorage.setItem("fy_rate", rate)
        } catch {}
        const { data: u } = await db.auth.getUser()
        const { error } = await db
            .from("studio_time_entries")
            .insert({
                work_date: f.work_date,
                project_id: f.project_id || null,
                category: f.category,
                description: f.description,
                minutes,
                billable: f.billable,
                rate: Number(rate) || 0,
                entered_by: u?.user?.email,
            })
        setMsg(error ? error.message : "Saved.")
        if (!error) setF({ ...f, description: "", hours: "" })
        load()
    }
    async function del(r: any) {
        if (!confirm("Delete this entry?")) return
        const { error } = await db
            .from("studio_time_entries")
            .delete()
            .eq("id", r.id)
        setMsg(error ? error.message : "Deleted.")
        load()
    }
    const hrs = (r: any) => r.minutes / 60
    const total = rows.reduce((a, r) => a + hrs(r), 0)
    const bill = rows.filter((r) => r.billable).reduce((a, r) => a + hrs(r), 0)
    const value = rows
        .filter((r) => r.billable)
        .reduce((a, r) => a + hrs(r) * Number(r.rate || 0), 0)
    const byProj: Record<string, { h: number; b: number; v: number }> = {}
    rows.forEach((r) => {
        const k = pname(r.project_id)
        byProj[k] = byProj[k] || { h: 0, b: 0, v: 0 }
        byProj[k].h += hrs(r)
        if (r.billable) {
            byProj[k].b += hrs(r)
            byProj[k].v += hrs(r) * Number(r.rate || 0)
        }
    })
    const elapsed = timerStart
        ? Math.floor((Date.now() - timerStart) / 1000)
        : 0
    const clock = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
    return (
        <div>
            <p style={{ maxWidth: 680, lineHeight: 1.7, fontSize: 14 }}>
                Log your own hours by project. Start the timer while you work,
                or type hours in afterwards. Rate is your billing rate for the
                entry (it is remembered on this device). Switch to the
                reimbursables tab for out-of-pocket costs.
            </p>
            <div className="c r" style={{ justifyContent: "space-between" }}>
                <div>
                    <div className="mono">Timer</div>
                    <div
                        style={{
                            fontSize: 30,
                            fontFamily: "ui-monospace,Menlo,monospace",
                        }}
                        data-tick={tick}
                    >
                        {timerStart ? clock : "00:00:00"}
                    </div>
                </div>
                <button className="b" onClick={startStop}>
                    {timerStart ? "Stop timer" : "Start timer"}
                </button>
            </div>
            <form onSubmit={save} className="c">
                <div className="mono">Add time</div>
                <div className="r" style={{ marginTop: 8 }}>
                    <input
                        type="date"
                        required
                        value={f.work_date}
                        onChange={(e) =>
                            setF({ ...f, work_date: e.target.value })
                        }
                    />
                    <select
                        value={f.project_id}
                        onChange={(e) =>
                            setF({ ...f, project_id: e.target.value })
                        }
                    >
                        <option value="">Studio / no project</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.title}
                            </option>
                        ))}
                    </select>
                    <select
                        value={f.category}
                        onChange={(e) =>
                            setF({ ...f, category: e.target.value })
                        }
                    >
                        {TIME_CATS.map((c) => (
                            <option key={c}>{c}</option>
                        ))}
                    </select>
                    <input
                        required
                        placeholder="What did you do?"
                        value={f.description}
                        onChange={(e) =>
                            setF({ ...f, description: e.target.value })
                        }
                        style={{ flex: "2 1 240px" }}
                    />
                    <input
                        required
                        inputMode="decimal"
                        placeholder="Hours (1.5)"
                        value={f.hours}
                        onChange={(e) => setF({ ...f, hours: e.target.value })}
                        style={{ width: 110 }}
                    />
                    <input
                        inputMode="decimal"
                        placeholder="Rate $/hr"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        style={{ width: 110 }}
                    />
                    <label className="mono">
                        <input
                            type="checkbox"
                            checked={f.billable}
                            onChange={(e) =>
                                setF({ ...f, billable: e.target.checked })
                            }
                        />{" "}
                        billable
                    </label>
                    <button className="b" type="submit">
                        Save entry
                    </button>
                </div>
                {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
            </form>
            <div className="c">
                <div className="r" style={{ justifyContent: "space-between" }}>
                    <div className="r">
                        <span className="mono">Month</span>
                        <input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                        />
                    </div>
                    <button
                        className="b g"
                        onClick={() =>
                            csvDownload(`${month}_FELEMAYE_Time.csv`, [
                                [
                                    "Date",
                                    "Project",
                                    "Category",
                                    "Description",
                                    "Hours",
                                    "Billable",
                                    "Rate",
                                    "Value",
                                ],
                                ...rows.map((r) => [
                                    r.work_date,
                                    pname(r.project_id),
                                    r.category,
                                    r.description,
                                    hrs(r).toFixed(2),
                                    r.billable ? "yes" : "no",
                                    r.rate,
                                    r.billable
                                        ? (
                                              hrs(r) * Number(r.rate || 0)
                                          ).toFixed(2)
                                        : "0.00",
                                ]),
                            ])
                        }
                    >
                        Export CSV
                    </button>
                </div>
                <div className="r" style={{ margin: "12px 0", gap: 28 }}>
                    <div>
                        <div className="mono">Total hours</div>
                        <b style={{ fontSize: 22 }}>{total.toFixed(2)}</b>
                    </div>
                    <div>
                        <div className="mono">Billable hours</div>
                        <b style={{ fontSize: 22 }}>{bill.toFixed(2)}</b>
                    </div>
                    <div>
                        <div className="mono">Billable value</div>
                        <b style={{ fontSize: 22 }}>{money(value)}</b>
                    </div>
                </div>
                <div className="tw">
                    <table>
                        <thead>
                            <tr>
                                <th>Project</th>
                                <th>Hours</th>
                                <th>Billable</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(byProj).map(([k, v]) => (
                                <tr key={k}>
                                    <td>{k}</td>
                                    <td>{v.h.toFixed(2)}</td>
                                    <td>{v.b.toFixed(2)}</td>
                                    <td>{money(v.v)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="c tw">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Project</th>
                            <th>Task</th>
                            <th>Hours</th>
                            <th>$</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td>{r.work_date}</td>
                                <td>{pname(r.project_id)}</td>
                                <td>
                                    {r.description}
                                    <div className="mono">
                                        {r.category}
                                        {r.billable ? "" : " · non-billable"}
                                    </div>
                                </td>
                                <td>{hrs(r).toFixed(2)}</td>
                                <td>
                                    {r.billable
                                        ? money(hrs(r) * Number(r.rate || 0))
                                        : "—"}
                                </td>
                                <td>
                                    <button
                                        className="b g"
                                        onClick={() => del(r)}
                                    >
                                        ×
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!rows.length && <p className="mono">No entries this month.</p>}
            </div>
        </div>
    )
}

const REIMB_CATS = [
    "materials / samples",
    "printing / plotting",
    "travel / mileage",
    "meals",
    "shipping / freight",
    "software / subscriptions",
    "consultant",
    "permits / fees",
    "other",
]
const REIMB_STATUS = ["logged", "invoiced", "reimbursed", "written_off"]

/* Reimbursables — out-of-pocket costs, markup, receipts, billing status */
function Reimbursables({ db, focus }: any) {
    const projects = useProjects(db)
    const [allRows, setRows] = React.useState<any[]>([])
    const rows = focus ? allRows.filter((r) => r.project_id === focus) : allRows
    const [msg, setMsg] = React.useState("")
    const [month, setMonth] = React.useState("all")
    const [f, setF] = React.useState({
        spent_on: new Date().toISOString().slice(0, 10),
        project_id: focus || "",
        vendor: "",
        category: REIMB_CATS[0],
        description: "",
        amount: "",
        markup_pct: "0",
        billable: true,
    })
    const fileRef = React.useRef<HTMLInputElement>(null)
    const [receipt, setReceipt] = React.useState<File | null>(null)
    const load = async () => {
        const { data, error } = await db
            .from("studio_reimbursables")
            .select("*")
            .order("spent_on", { ascending: false })
            .order("created_at", { ascending: false })
        if (error) setMsg(error.message)
        setRows(data || [])
    }
    React.useEffect(() => {
        load()
    }, [])
    const pname = (id: string) =>
        projects.find((p) => p.id === id)?.title || "Studio / no project"
    async function save(e: React.FormEvent) {
        e.preventDefault()
        const amount = parseFloat(f.amount)
        if (!amount || amount <= 0) {
            setMsg("Enter the amount.")
            return
        }
        let path: string | null = null
        if (receipt) {
            // Naming rule from the studio standard: YYYY-MM-DD_Vendor_Amount
            const ext = (receipt.name.split(".").pop() || "pdf").toLowerCase()
            path = `studio/receipts/${f.spent_on}_${f.vendor.replace(/[^\w]+/g, "-")}_${amount.toFixed(2)}.${ext}`
            const { error: ue } = await db.storage
                .from("project-files")
                .upload(path, receipt, { upsert: true })
            if (ue) {
                setMsg("Receipt upload failed: " + ue.message)
                return
            }
        }
        const { data: u } = await db.auth.getUser()
        const { error } = await db
            .from("studio_reimbursables")
            .insert({
                spent_on: f.spent_on,
                project_id: f.project_id || null,
                vendor: f.vendor,
                category: f.category,
                description: f.description || null,
                amount,
                markup_pct: Number(f.markup_pct) || 0,
                billable: f.billable,
                receipt_path: path,
                entered_by: u?.user?.email,
            })
        setMsg(error ? error.message : "Saved.")
        if (!error) {
            setF({ ...f, vendor: "", description: "", amount: "" })
            setReceipt(null)
        }
        load()
    }
    async function setStatus(r: any, status: string) {
        if (
            (status === "invoiced" || status === "reimbursed") &&
            r.billable &&
            Number(r.amount) > 250 &&
            r.client_auth_status !== "authorized"
        ) {
            await db
                .from("studio_reimbursables")
                .update({ client_auth_status: "requested" })
                .eq("id", r.id)
            setMsg(
                "Over $250: the client must approve this in writing first. It now shows PENDING WRITTEN APPROVAL in their Ledger."
            )
            load()
            return
        }
        const { error } = await db
            .from("studio_reimbursables")
            .update({ status })
            .eq("id", r.id)
        if (error) setMsg(error.message)
        load()
    }
    async function del(r: any) {
        if (!confirm("Delete this entry?")) return
        const { error } = await db
            .from("studio_reimbursables")
            .delete()
            .eq("id", r.id)
        setMsg(error ? error.message : "Deleted.")
        load()
    }
    async function openReceipt(r: any) {
        const { data } = await db.storage
            .from("project-files")
            .createSignedUrl(r.receipt_path, 300)
        if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener")
    }
    const shown =
        month === "all"
            ? rows
            : rows.filter((r) => String(r.spent_on).startsWith(month))
    const billAmt = (r: any) =>
        r.billable
            ? Number(r.amount) * (1 + Number(r.markup_pct || 0) / 100)
            : 0
    const spent = shown.reduce((a, r) => a + Number(r.amount), 0)
    const billable = shown.reduce((a, r) => a + billAmt(r), 0)
    const outstanding = shown
        .filter((r) => r.billable && r.status === "logged")
        .reduce((a, r) => a + billAmt(r), 0)
    const group = (key: (r: any) => string) => {
        const m: Record<string, { s: number; b: number }> = {}
        shown.forEach((r) => {
            const k = key(r)
            m[k] = m[k] || { s: 0, b: 0 }
            m[k].s += Number(r.amount)
            m[k].b += billAmt(r)
        })
        return Object.entries(m)
    }
    return (
        <div>
            <p style={{ maxWidth: 680, lineHeight: 1.7, fontSize: 14 }}>
                Log every out-of-pocket cost against its project, add any
                markup, attach the receipt, and track whether it has been
                invoiced or reimbursed. "Outstanding" is billable cost you have
                paid but not yet invoiced to the client. Receipts are filed as
                YYYY-MM-DD_Vendor_Amount.
            </p>
            <form onSubmit={save} className="c">
                <div className="mono">Add reimbursable</div>
                <div className="r" style={{ marginTop: 8 }}>
                    <input
                        type="date"
                        required
                        value={f.spent_on}
                        onChange={(e) =>
                            setF({ ...f, spent_on: e.target.value })
                        }
                    />
                    <select
                        value={f.project_id}
                        onChange={(e) =>
                            setF({ ...f, project_id: e.target.value })
                        }
                    >
                        <option value="">Studio / no project</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.title}
                            </option>
                        ))}
                    </select>
                    <input
                        required
                        placeholder="Vendor"
                        value={f.vendor}
                        onChange={(e) => setF({ ...f, vendor: e.target.value })}
                    />
                    <select
                        value={f.category}
                        onChange={(e) =>
                            setF({ ...f, category: e.target.value })
                        }
                    >
                        {REIMB_CATS.map((c) => (
                            <option key={c}>{c}</option>
                        ))}
                    </select>
                    <input
                        placeholder="Note (optional)"
                        value={f.description}
                        onChange={(e) =>
                            setF({ ...f, description: e.target.value })
                        }
                        style={{ flex: "2 1 220px" }}
                    />
                    <input
                        required
                        inputMode="decimal"
                        placeholder="Amount $"
                        value={f.amount}
                        onChange={(e) => setF({ ...f, amount: e.target.value })}
                        style={{ width: 110 }}
                    />
                    <input
                        inputMode="decimal"
                        placeholder="Markup %"
                        value={f.markup_pct}
                        onChange={(e) =>
                            setF({ ...f, markup_pct: e.target.value })
                        }
                        style={{ width: 100 }}
                    />
                    <label className="mono">
                        <input
                            type="checkbox"
                            checked={f.billable}
                            onChange={(e) =>
                                setF({ ...f, billable: e.target.checked })
                            }
                        />{" "}
                        billable to client
                    </label>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*,application/pdf"
                        style={{
                            position: "absolute",
                            width: 1,
                            height: 1,
                            opacity: 0,
                            pointerEvents: "none",
                        }}
                        onChange={(e) =>
                            setReceipt(e.target.files?.[0] || null)
                        }
                    />
                    <button
                        type="button"
                        className="b g"
                        onClick={() => fileRef.current?.click()}
                    >
                        {receipt ? receipt.name.slice(0, 22) : "Attach receipt"}
                    </button>
                    <button className="b" type="submit">
                        Save
                    </button>
                </div>
                {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
            </form>
            <div className="c">
                <div className="r" style={{ justifyContent: "space-between" }}>
                    <div className="r">
                        <span className="mono">Show</span>
                        <select
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                        >
                            <option value="all">All time</option>
                            {Array.from(
                                new Set(
                                    rows.map((r) =>
                                        String(r.spent_on).slice(0, 7)
                                    )
                                )
                            ).map((m) => (
                                <option key={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        className="b g"
                        onClick={() =>
                            csvDownload("FELEMAYE_Reimbursables.csv", [
                                [
                                    "Date",
                                    "Project",
                                    "Vendor",
                                    "Category",
                                    "Note",
                                    "Amount",
                                    "Markup %",
                                    "Billable total",
                                    "Billable",
                                    "Status",
                                ],
                                ...shown.map((r) => [
                                    r.spent_on,
                                    pname(r.project_id),
                                    r.vendor,
                                    r.category,
                                    r.description,
                                    Number(r.amount).toFixed(2),
                                    r.markup_pct,
                                    billAmt(r).toFixed(2),
                                    r.billable ? "yes" : "no",
                                    r.status,
                                ]),
                            ])
                        }
                    >
                        Export CSV
                    </button>
                </div>
                <div className="r" style={{ margin: "12px 0", gap: 28 }}>
                    <div>
                        <div className="mono">Spent</div>
                        <b style={{ fontSize: 22 }}>{money(spent)}</b>
                    </div>
                    <div>
                        <div className="mono">Billable incl. markup</div>
                        <b style={{ fontSize: 22 }}>{money(billable)}</b>
                    </div>
                    <div>
                        <div className="mono">Outstanding to invoice</div>
                        <b style={{ fontSize: 22 }}>{money(outstanding)}</b>
                    </div>
                </div>
                <div className="tw">
                    <table>
                        <thead>
                            <tr>
                                <th>By project</th>
                                <th>Spent</th>
                                <th>Billable</th>
                            </tr>
                        </thead>
                        <tbody>
                            {group((r) => pname(r.project_id)).map(([k, v]) => (
                                <tr key={k}>
                                    <td>{k}</td>
                                    <td>{money(v.s)}</td>
                                    <td>{money(v.b)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="tw" style={{ marginTop: 12 }}>
                    <table>
                        <thead>
                            <tr>
                                <th>By category</th>
                                <th>Spent</th>
                                <th>Billable</th>
                            </tr>
                        </thead>
                        <tbody>
                            {group((r) => r.category).map(([k, v]) => (
                                <tr key={k}>
                                    <td>{k}</td>
                                    <td>{money(v.s)}</td>
                                    <td>{money(v.b)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="c tw">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Project</th>
                            <th>Vendor</th>
                            <th>Amount</th>
                            <th>Billable</th>
                            <th>Status</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((r) => (
                            <tr key={r.id}>
                                <td>{r.spent_on}</td>
                                <td>{pname(r.project_id)}</td>
                                <td>
                                    {r.vendor}
                                    <div className="mono">
                                        {r.category}
                                        {r.description
                                            ? " · " + r.description
                                            : ""}
                                    </div>
                                    {r.receipt_path && (
                                        <a
                                            className="mono"
                                            style={{
                                                cursor: "pointer",
                                                textDecoration: "underline",
                                            }}
                                            onClick={() => openReceipt(r)}
                                        >
                                            receipt
                                        </a>
                                    )}
                                </td>
                                <td>{money(Number(r.amount))}</td>
                                <td>
                                    {r.billable ? money(billAmt(r)) : "—"}
                                    {Number(r.markup_pct) ? (
                                        <div className="mono">
                                            +{r.markup_pct}%
                                        </div>
                                    ) : null}
                                </td>
                                <td>
                                    <select
                                        value={r.status}
                                        onChange={(e) =>
                                            setStatus(r, e.target.value)
                                        }
                                    >
                                        {REIMB_STATUS.map((s) => (
                                            <option key={s}>{s}</option>
                                        ))}
                                    </select>
                                </td>
                                <td>
                                    <button
                                        className="b g"
                                        onClick={() => del(r)}
                                    >
                                        ×
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!shown.length && <p className="mono">Nothing logged yet.</p>}
            </div>
        </div>
    )
}

/* ───────────── FF&E procurement (private: trade price, markup, vendor contact, internal lead notes) ───────────── */
const FFE_STATES = [
    "proposed",
    "approved",
    "revision_requested",
    "declined",
    "ordered",
    "delivered",
]
// Procurement pricing policy (mirrors public.ffe_price() in 20261018b SQL; the database has the final say)
const PRICING = { markupMin: 30, markupDefault: 35, feeMin: 15, feeDefault: 20, lowDiscount: 20 }
const PRICING_RULES: [string, string][] = [
    ["", "Auto (policy picks)"],
    ["msrp", "MSRP (standard)"],
    ["trade_markup", "Net + markup (trade-only / custom)"],
    ["procurement_fee", "Procurement fee (low-discount brand)"],
    ["manual", "Manual price"],
]
function priceFor(net: number, msrp: number, rule: string, pct: number, manual?: number) {
    const r2 = (n: number) => Math.round(n * 100) / 100
    const disc = msrp && net ? Math.round((1 - net / msrp) * 1000) / 10 : NaN // same rounding as the database
    let applied = rule || (!msrp ? "trade_markup" : disc >= PRICING.lowDiscount ? "msrp" : "procurement_fee")
    if (applied === "msrp" && !msrp) applied = "trade_markup"
    if (!net && applied !== "msrp") return { applied, price: NaN, pct: NaN, disc }
    if (applied === "msrp") return { applied, price: msrp, pct: net ? (msrp / net - 1) * 100 : NaN, disc }
    if (applied === "trade_markup") {
        const p = Math.max(pct || PRICING.markupDefault, PRICING.markupMin)
        return { applied, price: r2(net * (1 + p / 100)), pct: p, disc }
    }
    if (applied === "procurement_fee") {
        const p = Math.max(pct || PRICING.feeDefault, PRICING.feeMin)
        return { applied, price: r2(Math.max(msrp || 0, net * (1 + p / 100))), pct: p, disc }
    }
    const floor = msrp ? Math.max(msrp, r2(net * (1 + PRICING.feeMin / 100))) : r2(net * (1 + PRICING.markupMin / 100))
    const price = Math.max(manual || 0, floor)
    return { applied, price, pct: (price / net - 1) * 100, disc }
}
function FFEManager({ db, projectId }: any) {
    const projects = useProjects(db)
    const [pid, setPid] = React.useState(projectId || "")
    React.useEffect(() => {
        if (projectId) setPid(projectId)
    }, [projectId])
    const [rows, setRows] = React.useState<any[]>([])
    const [msg, setMsg] = React.useState("")
    const blank = {
        room: "",
        item: "",
        vendor: "",
        vendor_contact: "",
        sku: "",
        qty: "1",
        trade_price: "",
        retail_msrp: "",
        pricing_rule: "",
        markup_pct: "",
        manual_price: "",
        lead_time_weeks: "",
        internal_lead_notes: "",
        cut_sheet_url: "",
        image_url: "",
    }
    const [f, setF] = React.useState<any>(blank)
    React.useEffect(() => {
        if (!pid && projects[0]) setPid(projects[0].id)
    }, [projects])
    const load = async () => {
        if (!pid) return
        const { data, error } = await db
            .from("procurement_ffe")
            .select("*")
            .eq("project_id", pid)
            .order("room")
            .order("created_at")
        if (error) setMsg(error.message)
        setRows(data || [])
    }
    React.useEffect(() => {
        load()
    }, [pid])
    const quote = (x: any) =>
        priceFor(
            parseFloat(x.trade_price) || 0,
            parseFloat(x.retail_msrp) || 0,
            x.pricing_rule,
            parseFloat(x.markup_pct) || 0,
            parseFloat(x.manual_price) || 0
        )
    async function add(e: React.FormEvent) {
        e.preventDefault()
        const trade = parseFloat(f.trade_price),
            msrp = parseFloat(f.retail_msrp),
            q = quote(f)
        if (!pid || !f.item) {
            setMsg("Choose a project and name the item.")
            return
        }
        const { error } = await db
            .from("procurement_ffe")
            .insert({
                project_id: pid,
                room: f.room || null,
                item: f.item,
                vendor: f.vendor || null,
                vendor_contact: f.vendor_contact || null,
                sku: f.sku || null,
                qty: parseInt(f.qty) || 1,
                trade_price: isNaN(trade) ? null : trade,
                net_cost: isNaN(trade) ? null : trade,
                retail_msrp: isNaN(msrp) ? null : msrp,
                pricing_rule: f.pricing_rule || null,
                markup_pct: parseFloat(f.markup_pct) || null,
                client_price: isNaN(q.price) ? null : q.price,
                lead_time_weeks: f.lead_time_weeks
                    ? parseInt(f.lead_time_weeks)
                    : null,
                internal_lead_notes: f.internal_lead_notes || null,
                cut_sheet_url: f.cut_sheet_url
                    ? f.cut_sheet_url.startsWith("http")
                        ? f.cut_sheet_url
                        : f.cut_sheet_url
                    : null,
                image_url: f.image_url || null,
            })
        setMsg(
            error
                ? error.message
                : "Added. The client sees it as 'For your review' with the client price only."
        )
        if (!error) setF({ ...blank, room: f.room })
        load()
    }
    async function setState(r: any, client_status: string) {
        const { error } = await db
            .from("procurement_ffe")
            .update({ client_status })
            .eq("id", r.id)
        if (error) setMsg(error.message)
        load()
    }
    const tot = (k: string) =>
        rows
            .filter((r) => r.client_status !== "declined")
            .reduce((a, r) => a + Number(r[k] || 0) * (r.qty || 1), 0)
    const margin = tot("client_price") - tot("trade_price")
    return (
        <div>
            <p style={{ maxWidth: 680, lineHeight: 1.7, fontSize: 14 }}>
                Private catalog. Designer net, MSRP, markup, vendor contact and
                internal notes stay here. Clients see one price per item, the
                lead time, the cut sheet and the Approve / Request revision /
                Decline buttons. Pricing follows the studio policy: MSRP when
                the brand publishes one, net plus at least 30% for trade-only or
                custom pieces, and at least a 15% procurement fee for
                low-discount brands.
            </p>
            <div className="r">
                <select
                    value={pid}
                    onChange={(e) => setPid(e.target.value)}
                    style={{ display: projectId ? "none" : undefined }}
                >
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.title}
                        </option>
                    ))}
                </select>
                <button
                    className="b g"
                    onClick={() =>
                        csvDownload("FELEMAYE_FFE.csv", [
                            [
                                "Room",
                                "Item",
                                "Vendor",
                                "Qty",
                                "Designer net",
                                "MSRP",
                                "Rule",
                                "Markup %",
                                "Client",
                                "Lead wks",
                                "Status",
                            ],
                            ...rows.map((r) => [
                                r.room,
                                r.item,
                                r.vendor,
                                r.qty,
                                r.trade_price,
                                r.retail_msrp,
                                r.pricing_applied,
                                r.markup_pct,
                                r.client_price,
                                r.lead_time_weeks,
                                r.client_status,
                            ]),
                        ])
                    }
                >
                    Export CSV
                </button>
            </div>
            <form onSubmit={add} className="c">
                <div className="mono">Add item</div>
                <div className="r" style={{ marginTop: 8 }}>
                    <input
                        placeholder="Room"
                        value={f.room}
                        onChange={(e) => setF({ ...f, room: e.target.value })}
                        style={{ width: 130 }}
                    />
                    <input
                        required
                        placeholder="Item"
                        value={f.item}
                        onChange={(e) => setF({ ...f, item: e.target.value })}
                        style={{ flex: "2 1 200px" }}
                    />
                    <input
                        placeholder="Vendor"
                        value={f.vendor}
                        onChange={(e) => setF({ ...f, vendor: e.target.value })}
                    />
                    <input
                        placeholder="Vendor contact"
                        value={f.vendor_contact}
                        onChange={(e) =>
                            setF({ ...f, vendor_contact: e.target.value })
                        }
                    />
                    <input
                        placeholder="SKU"
                        value={f.sku}
                        onChange={(e) => setF({ ...f, sku: e.target.value })}
                        style={{ width: 100 }}
                    />
                    <input
                        inputMode="numeric"
                        placeholder="Qty"
                        value={f.qty}
                        onChange={(e) => setF({ ...f, qty: e.target.value })}
                        style={{ width: 60 }}
                    />
                    <input
                        inputMode="decimal"
                        placeholder="Designer net $"
                        value={f.trade_price}
                        onChange={(e) =>
                            setF({ ...f, trade_price: e.target.value })
                        }
                        style={{ width: 120 }}
                    />
                    <input
                        inputMode="decimal"
                        placeholder="MSRP $ (if published)"
                        value={f.retail_msrp}
                        onChange={(e) =>
                            setF({ ...f, retail_msrp: e.target.value })
                        }
                        style={{ width: 150 }}
                    />
                    <select
                        value={f.pricing_rule}
                        onChange={(e) =>
                            setF({ ...f, pricing_rule: e.target.value })
                        }
                    >
                        {PRICING_RULES.map(([v, l]) => (
                            <option key={v} value={v}>
                                {l}
                            </option>
                        ))}
                    </select>
                    {f.pricing_rule === "manual" ? (
                        <input
                            inputMode="decimal"
                            placeholder="Client price $"
                            value={f.manual_price}
                            onChange={(e) =>
                                setF({ ...f, manual_price: e.target.value })
                            }
                            style={{ width: 120 }}
                        />
                    ) : (
                        <input
                            inputMode="decimal"
                            placeholder="Markup / fee % (blank = default)"
                            value={f.markup_pct}
                            onChange={(e) =>
                                setF({ ...f, markup_pct: e.target.value })
                            }
                            style={{ width: 210 }}
                        />
                    )}
                    <input
                        inputMode="numeric"
                        placeholder="Lead wks"
                        value={f.lead_time_weeks}
                        onChange={(e) =>
                            setF({ ...f, lead_time_weeks: e.target.value })
                        }
                        style={{ width: 90 }}
                    />
                    <input
                        placeholder="Cut sheet link"
                        value={f.cut_sheet_url}
                        onChange={(e) =>
                            setF({ ...f, cut_sheet_url: e.target.value })
                        }
                    />
                    <input
                        placeholder="Image link"
                        value={f.image_url}
                        onChange={(e) =>
                            setF({ ...f, image_url: e.target.value })
                        }
                    />
                    <input
                        placeholder="Internal lead notes (private)"
                        value={f.internal_lead_notes}
                        onChange={(e) =>
                            setF({ ...f, internal_lead_notes: e.target.value })
                        }
                        style={{ flex: "2 1 220px" }}
                    />
                    <button className="b" type="submit">
                        Add
                    </button>
                </div>
                {(f.trade_price || f.retail_msrp) &&
                    (() => {
                        const q = quote(f)
                        const label = (PRICING_RULES.find((r) => r[0] === q.applied) || ["", q.applied])[1]
                        return (
                            <p className="mono">
                                Client price: {isNaN(q.price) ? "enter the designer net" : money(q.price)} each ·{" "}
                                {label}
                                {!isNaN(q.disc) ? ` · trade discount ${q.disc.toFixed(0)}%` : ""}
                                {!isNaN(q.pct) ? ` · margin on net ${q.pct.toFixed(0)}%` : ""}
                                {f.pricing_rule === "manual" && parseFloat(f.manual_price) < q.price
                                    ? " · raised to the policy floor"
                                    : ""}
                            </p>
                        )
                    })()}
                {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
            </form>
            <div className="c">
                <div className="r" style={{ gap: 28 }}>
                    <div>
                        <div className="mono">Client total</div>
                        <b style={{ fontSize: 22 }}>
                            {money(tot("client_price"))}
                        </b>
                    </div>
                    <div>
                        <div className="mono">Trade cost</div>
                        <b style={{ fontSize: 22 }}>
                            {money(tot("trade_price"))}
                        </b>
                    </div>
                    <div>
                        <div className="mono">Gross margin</div>
                        <b style={{ fontSize: 22 }}>{money(margin)}</b>
                    </div>
                </div>
            </div>
            <div className="c tw">
                <table>
                    <thead>
                        <tr>
                            <th>Room</th>
                            <th>Item</th>
                            <th>Vendor</th>
                            <th>Qty</th>
                            <th>Net</th>
                            <th>Client</th>
                            <th>Rule</th>
                            <th>Lead</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td>{r.room}</td>
                                <td>
                                    {r.item}
                                    <div className="mono">
                                        {r.sku}
                                        {r.internal_lead_notes
                                            ? " · " + r.internal_lead_notes
                                            : ""}
                                        {r.client_note
                                            ? " · CLIENT: " + r.client_note
                                            : ""}
                                    </div>
                                </td>
                                <td>
                                    {r.vendor}
                                    <div className="mono">
                                        {r.vendor_contact}
                                    </div>
                                </td>
                                <td>{r.qty}</td>
                                <td>{money(r.trade_price)}</td>
                                <td>{money(r.client_price)}</td>
                                <td className="mono">
                                    {(r.pricing_applied || "").replace("_", " ")}
                                    {r.markup_pct ? ` ${Number(r.markup_pct).toFixed(0)}%` : ""}
                                </td>
                                <td>
                                    {r.lead_time_weeks
                                        ? r.lead_time_weeks + " wk"
                                        : ""}
                                </td>
                                <td>
                                    <select
                                        value={r.client_status}
                                        onChange={(e) =>
                                            setState(r, e.target.value)
                                        }
                                    >
                                        {FFE_STATES.map((s) => (
                                            <option key={s}>{s}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!rows.length && <p className="mono">No items yet.</p>}
            </div>
        </div>
    )
}

/* Per-client booking page (TidyCal, Calendly or Google booking link). The client portal reads
   projects.permit_progress.__booking_url; the studio can book from here on the client's behalf. */
function BookingLink({ db, pid }: any) {
    const [url, setUrl] = React.useState("")
    const [saved, setSaved] = React.useState("")
    const [show, setShow] = React.useState(false)
    const [msg, setMsg] = React.useState("")
    React.useEffect(() => {
        db.from("projects")
            .select("permit_progress")
            .eq("id", pid)
            .single()
            .then(({ data }: any) => {
                const u = data?.permit_progress?.__booking_url || ""
                setUrl(u)
                setSaved(u)
            })
    }, [pid])
    async function save() {
        const u = url.trim()
        if (u && !/^https:\/\//i.test(u)) {
            setMsg("Paste the full https:// link from TidyCal, Calendly or Google Calendar.")
            return
        }
        const { error } = await saveProjectSetting(db, pid, "__booking_url", u || null)
        setMsg(error ? error.message : u ? "Saved. The client can book from their Meet tab." : "Booking link removed.")
        if (!error) setSaved(u)
    }
    return (
        <div className="c">
            <div className="mono">Booking page for this client</div>
            <div className="r" style={{ marginTop: 8 }}>
                <input
                    placeholder="https://tidycal.com/felemaye/site-walk  or  https://calendly.com/…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    style={{ flex: "3 1 320px" }}
                />
                <button className="b" onClick={save}>
                    Save link
                </button>
                {saved && (
                    <button className="b g" onClick={() => setShow(!show)}>
                        {show ? "Hide" : "Book from studio side"}
                    </button>
                )}
            </div>
            {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
            {show && saved && (
                <iframe
                    title="Booking page"
                    src={saved}
                    style={{ width: "100%", height: 680, border: 0, marginTop: 10, background: "#fff" }}
                />
            )}
        </div>
    )
}

/* ───────────── Finances: 5-Bucket Cash Allocation Engine ─────────────
   Paid invoices are split by the database (fn_calculate_payment_allocations + trigger on invoices).
   This tab shows the live totals, a test-fee simulator, invoices per client, and the owner's draw schedule. */
const ENGINE = {
    baseline: 9000,
    drawPerPeriod: 800,
    drawPeriods: 6,
    buckets: [
        { key: "compliance", col: "compliance_amount", label: "Entity compliance", target: 910,
          items: [["CA FTB Form 3522 (annual LLC tax)", 800], ["CA Form LLC-12 (Statement of Information)", 20], ["Foreign filings", 90]] },
        { key: "tech", col: "tech_overhead_amount", label: "Studio tech & overhead", target: 347,
          items: [["Home Depot laser", 27], ["Claude Pro", 20], ["Autodesk Revit earmark", 300]] },
        { key: "tax", col: "tax_reserve_amount", label: "Tax reserve", target: 1927.06,
          items: [["IRS self-employment tax (Schedule SE)", 1094.06], ["Federal income tax", 717], ["CA state income tax", 116]] },
        { key: "savings", col: "retained_savings_amount", label: "Retained savings buffer", target: 1015.94,
          items: [["Emergency fund and capital reinvestment", 1015.94]] },
        { key: "draw", col: "owners_draw_amount", label: "Owner's draw pool", target: 4800,
          items: [["Bi-weekly draw: $800.00 × 6 pay periods over 12 weeks", 4800]] },
    ] as { key: string; col: string; label: string; target: number; items: [string, number][] }[],
}
const r2 = (n: number) => Math.round(n * 100) / 100
// Same rule as the database: slice of a running total against the $9,000 baseline; draw absorbs the cents.
function allocate(gross: number, prior = 0) {
    const out: Record<string, number> = {}
    let used = 0
    ENGINE.buckets.slice(0, 4).forEach((b) => {
        const v = r2(r2(((prior + gross) * b.target) / ENGINE.baseline) - r2((prior * b.target) / ENGINE.baseline))
        out[b.key] = v
        used += v
    })
    out.draw = r2(gross - used)
    return out
}

function FinanceEngine({ db, focus }: any) {
    const projects = useProjects(db)
    const [inv, setInv] = React.useState<any[]>([])
    const [draws, setDraws] = React.useState<any[]>([])
    const [msg, setMsg] = React.useState("")
    const [testFee, setTestFee] = React.useState<number>(9000)
    const [mode, setMode] = React.useState<"live" | "test">("live")
    const [openKey, setOpenKey] = React.useState<string>("")
    const [f, setF] = React.useState({ project_id: focus || "", number: "", description: "", amount: "", status: "sent" })
    const [drawStart, setDrawStart] = React.useState<string>(() => {
        try {
            return localStorage.getItem("fy_draw_start") || new Date().toISOString().slice(0, 10)
        } catch {
            return new Date().toISOString().slice(0, 10)
        }
    })
    React.useEffect(() => setF((x) => ({ ...x, project_id: focus || x.project_id })), [focus])
    const load = async () => {
        const [a, b] = await Promise.all([
            db.from("invoices").select("*").order("created_at", { ascending: false }),
            db.from("owner_draws").select("*").order("paid_on", { ascending: false }),
        ])
        if (a.error)
            setMsg(
                /column|relation|does not exist/i.test(a.error.message)
                    ? "Run 20261015_financial_engine.sql in Supabase first; it adds the bucket columns, the draw ledger and studio access to invoices."
                    : a.error.message
            )
        setInv(a.data || [])
        setDraws(b.data || [])
    }
    React.useEffect(() => {
        load()
    }, [])
    const pname = (id: string) => projects.find((p: any) => p.id === id)?.title || "Studio / no project"
    const scoped = inv.filter((i) => !focus || i.project_id === focus)
    const paid = scoped.filter((i) => i.status === "paid")
    const live: Record<string, number> = {}
    ENGINE.buckets.forEach((b) => (live[b.key] = r2(paid.reduce((n, i) => n + Number(i[b.col] || 0), 0))))
    const gross = r2(paid.reduce((n, i) => n + Number(i.amount_paid ?? i.amount ?? 0), 0))
    const shown = mode === "test" ? allocate(testFee) : live
    const base = mode === "test" ? testFee : gross
    const locked = r2((shown.compliance || 0) + (shown.tech || 0) + (shown.tax || 0))
    const drawn = r2(draws.reduce((n, d) => n + Number(d.amount || 0), 0))
    const drawAvail = mode === "test" ? shown.draw || 0 : r2((live.draw || 0) - (focus ? 0 : drawn))
    const periods = Array.from({ length: ENGINE.drawPeriods }, (_, k) => {
        const d = new Date(drawStart + "T12:00:00")
        d.setDate(d.getDate() + k * 14)
        return d
    })
    const fundedPeriods = Math.floor(((mode === "test" ? shown.draw : live.draw) || 0) / ENGINE.drawPerPeriod)

    async function addInvoice(e: React.FormEvent) {
        e.preventDefault()
        const amount = parseFloat(f.amount)
        if (!amount || amount <= 0) return setMsg("Enter the invoice amount.")
        const { error } = await db.from("invoices").insert({
            project_id: f.project_id || null,
            number: f.number || null,
            description: f.description || null,
            amount,
            status: f.status,
            issued_at: new Date().toISOString(),
            paid_at: f.status === "paid" ? new Date().toISOString() : null,
        })
        setMsg(error ? error.message : f.status === "paid" ? "Recorded and allocated across the five buckets." : "Invoice recorded.")
        if (!error) setF({ ...f, number: "", description: "", amount: "" })
        load()
    }
    async function setStatus(i: any, status: string) {
        const patch: any = { status }
        if (status === "paid") patch.paid_at = i.paid_at || new Date().toISOString()
        const { error } = await db.from("invoices").update(patch).eq("id", i.id)
        setMsg(error ? error.message : status === "paid" ? "Marked paid. Buckets updated." : "Updated.")
        load()
    }
    async function recordDraw(when: Date) {
        const { error } = await db.from("owner_draws").insert({
            paid_on: when.toISOString().slice(0, 10),
            amount: ENGINE.drawPerPeriod,
            note: "Bi-weekly owner's draw",
        })
        setMsg(error ? error.message : "Draw recorded.")
        load()
    }
    const card = (title: string, amount: number, sub: string, strong?: boolean) => (
        <div className="c" style={{ margin: 0, borderColor: strong ? "var(--ink)" : undefined }}>
            <div className="mono">{title}</div>
            <b style={{ display: "block", font: "400 30px 'Cormorant Garamond',Georgia,serif", margin: "6px 0" }}>{money(amount)}</b>
            <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>{sub}</div>
        </div>
    )
    return (
        <div>
            <p style={{ maxWidth: 720, lineHeight: 1.7, fontSize: 14 }}>
                Every paid invoice is split automatically: compliance, tech &amp; overhead and tax reserve stay locked in the
                business account; the savings buffer is retained capital; the rest funds your bi-weekly draw. Milestones are
                pro-rated against the $9,000 baseline, so $4,500 + $2,250 + $2,250 lands exactly on each target.
            </p>
            {msg && <p style={{ fontSize: 13, fontWeight: 600 }}>{msg}</p>}

            <div className="c">
                <div className="r" style={{ justifyContent: "space-between" }}>
                    <div role="group" aria-label="Data source" style={{ display: "inline-flex" }}>
                        <button className={"b" + (mode === "live" ? "" : " g")} onClick={() => setMode("live")}>
                            Live: collected {money(gross)}
                        </button>
                        <button className={"b" + (mode === "test" ? "" : " g")} onClick={() => setMode("test")}>
                            Test a fee
                        </button>
                    </div>
                    {mode === "test" && (
                        <label className="r" style={{ gap: 10, flex: "1 1 320px" }}>
                            <input
                                type="range"
                                min={500}
                                max={50000}
                                step={250}
                                value={testFee}
                                onChange={(e) => setTestFee(Number(e.target.value))}
                                aria-label="Contract fee"
                                style={{ flex: 1, borderBottom: 0 }}
                            />
                            <input
                                inputMode="decimal"
                                value={testFee}
                                onChange={(e) => setTestFee(Number(e.target.value.replace(/[^\d.]/g, "")) || 0)}
                                aria-label="Contract fee amount"
                                style={{ width: 110 }}
                            />
                        </label>
                    )}
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginBottom: 12 }}>
                {card("Non-negotiable locked cash", locked, "Compliance + tech & overhead + tax reserve. Must stay in the business account.", true)}
                {card("Retained studio capital", shown.savings || 0, "Emergency buffer and reinvestment pool: true liquid reserves.")}
                {card(
                    "Bi-weekly owner's draw",
                    ENGINE.drawPerPeriod,
                    `${money(ENGINE.drawPerPeriod)} every 2 weeks · ${Math.min(fundedPeriods, ENGINE.drawPeriods)} of ${ENGINE.drawPeriods} periods funded · ${money(drawAvail)} ${mode === "test" ? "in pool" : focus ? "accrued on this project" : "available after draws taken"}`
                )}
            </div>

            <div className="c">
                <div className="mono" style={{ marginBottom: 6 }}>
                    Breakdown on {money(base)}
                </div>
                {ENGINE.buckets.map((b) => {
                    const amt = shown[b.key] || 0
                    const scale = base / ENGINE.baseline
                    const isOpen = openKey === b.key
                    return (
                        <div key={b.key} style={{ borderTop: ".5px solid color-mix(in srgb,var(--ink) 20%,transparent)" }}>
                            <button
                                onClick={() => setOpenKey(isOpen ? "" : b.key)}
                                aria-expanded={isOpen}
                                style={{ all: "unset", cursor: "pointer", display: "flex", width: "100%", justifyContent: "space-between", padding: "10px 0", fontSize: 14, boxSizing: "border-box" }}
                            >
                                <span>
                                    {isOpen ? "–" : "+"} {b.label}{" "}
                                    <span className="mono">{((b.target / ENGINE.baseline) * 100).toFixed(1)}%</span>
                                </span>
                                <b>{money(amt)}</b>
                            </button>
                            {isOpen && (
                                <div style={{ padding: "0 0 10px 18px" }}>
                                    {b.items.map(([label, full]) => (
                                        <div key={label} className="r" style={{ justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                                            <span>{label}</span>
                                            <span className="mono" style={{ opacity: 1 }}>
                                                {money(r2(full * scale))} <span style={{ opacity: 0.6 }}>of {money(full)} target</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            <div className="c">
                <div className="r" style={{ justifyContent: "space-between" }}>
                    <div className="mono">Owner's draw schedule</div>
                    <label className="r" style={{ gap: 8 }}>
                        <span className="mono">First draw</span>
                        <input
                            type="date"
                            value={drawStart}
                            onChange={(e) => {
                                setDrawStart(e.target.value)
                                try {
                                    localStorage.setItem("fy_draw_start", e.target.value)
                                } catch {}
                            }}
                        />
                    </label>
                </div>
                {periods.map((d, k) => {
                    const iso = d.toISOString().slice(0, 10)
                    const taken = draws.find((x) => x.paid_on === iso)
                    const funded = k < fundedPeriods
                    return (
                        <div key={iso} className="r" style={{ justifyContent: "space-between", padding: "7px 0", borderTop: ".5px solid color-mix(in srgb,var(--ink) 20%,transparent)", fontSize: 13 }}>
                            <span>
                                <span className="tag">PP{k + 1}</span>{" "}
                                {d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} · {money(ENGINE.drawPerPeriod)}
                            </span>
                            {taken ? (
                                <span className="mono">paid</span>
                            ) : funded ? (
                                <button className="b g" style={{ padding: "4px 10px" }} onClick={() => recordDraw(d)}>
                                    Record draw
                                </button>
                            ) : (
                                <span className="mono">not yet funded</span>
                            )}
                        </div>
                    )
                })}
            </div>

            <form onSubmit={addInvoice} className="c">
                <div className="mono">Record an invoice or payment</div>
                <div className="r" style={{ marginTop: 8 }}>
                    <select value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
                        <option value="">Studio / no project</option>
                        {projects.map((p: any) => (
                            <option key={p.id} value={p.id}>
                                {p.title}
                            </option>
                        ))}
                    </select>
                    <input placeholder="Invoice no. (e.g. LOR-001)" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} style={{ width: 170 }} />
                    <input placeholder="Description (e.g. Phase 1 retainer)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} style={{ flex: "2 1 220px" }} />
                    <input required inputMode="decimal" placeholder="Amount $" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} style={{ width: 110 }} />
                    <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                        <option value="sent">sent</option>
                        <option value="paid">paid</option>
                        <option value="draft">draft</option>
                    </select>
                    <button className="b" type="submit">
                        Save
                    </button>
                </div>
            </form>

            <div className="c tw">
                <table>
                    <thead>
                        <tr>
                            <th>Invoice</th>
                            <th>Project</th>
                            <th>Amount</th>
                            <th>Locked</th>
                            <th>Savings</th>
                            <th>Draw</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scoped.map((i) => (
                            <tr key={i.id}>
                                <td>
                                    {i.number || "—"}
                                    <div className="mono">{i.description}</div>
                                </td>
                                <td>{pname(i.project_id)}</td>
                                <td>{money(Number(i.amount_paid ?? i.amount))}</td>
                                <td>{i.status === "paid" ? money(Number(i.compliance_amount || 0) + Number(i.tech_overhead_amount || 0) + Number(i.tax_reserve_amount || 0)) : "—"}</td>
                                <td>{i.status === "paid" ? money(Number(i.retained_savings_amount || 0)) : "—"}</td>
                                <td>{i.status === "paid" ? money(Number(i.owners_draw_amount || 0)) : "—"}</td>
                                <td>
                                    <select value={i.status} onChange={(e) => setStatus(i, e.target.value)}>
                                        {["draft", "sent", "paid", "void"].map((s) => (
                                            <option key={s}>{s}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!scoped.length && <p className="mono">No invoices recorded yet. Add the $4,500 Phase 1 retainer above as paid.</p>}
            </div>
        </div>
    )
}

/* ───────────── Calendar events shown on the client's Home ("Upcoming") ───────────── */
function CalendarManager({ db, projectId }: any) {
    const projects = useProjects(db)
    const [pid, setPid] = React.useState(projectId || "")
    React.useEffect(() => {
        if (projectId) setPid(projectId)
    }, [projectId])
    const [rows, setRows] = React.useState<any[]>([])
    const [msg, setMsg] = React.useState("")
    const [f, setF] = React.useState({
        title: "",
        kind: "site walk",
        date: "",
        time: "10:00",
        mins: "60",
        location: "",
        video_url: "",
        agenda_url: "",
        notes: "",
    })
    React.useEffect(() => {
        if (!pid && projects[0]) setPid(projects[0].id)
    }, [projects])
    const load = async () => {
        if (!pid) return
        const { data } = await db
            .from("calendar_events")
            .select("*")
            .eq("project_id", pid)
            .order("starts_at")
        setRows(data || [])
    }
    React.useEffect(() => {
        load()
    }, [pid])
    async function add(e: React.FormEvent) {
        e.preventDefault()
        const s = new Date(`${f.date}T${f.time}`)
        if (isNaN(s.getTime())) {
            setMsg("Pick a date and time.")
            return
        }
        const en = new Date(s.getTime() + (parseInt(f.mins) || 60) * 60000)
        const { error } = await db
            .from("calendar_events")
            .insert({
                project_id: pid,
                title: f.title,
                kind: f.kind,
                starts_at: s.toISOString(),
                ends_at: en.toISOString(),
                location: f.location || null,
                video_url: f.video_url || null,
                agenda_url: f.agenda_url || null,
                notes: f.notes || null,
            })
        setMsg(
            error
                ? error.message
                : "Added. It appears on the client's Home under Upcoming."
        )
        if (!error) setF({ ...f, title: "", notes: "" })
        load()
    }
    return (
        <div>
            <p style={{ maxWidth: 680, lineHeight: 1.7, fontSize: 14 }}>
                Site walks and reviews shown to the client with a video link,
                agenda and Add-to-calendar buttons. Times are entered in your
                local time zone.
            </p>
            {pid && <BookingLink db={db} pid={pid} />}
            <div className="r">
                <select
                    value={pid}
                    onChange={(e) => setPid(e.target.value)}
                    style={{ display: projectId ? "none" : undefined }}
                >
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.title}
                        </option>
                    ))}
                </select>
            </div>
            <form onSubmit={add} className="c">
                <div className="mono">Add event</div>
                <div className="r" style={{ marginTop: 8 }}>
                    <input
                        required
                        placeholder="Title (e.g. Site walk, Concept review)"
                        value={f.title}
                        onChange={(e) => setF({ ...f, title: e.target.value })}
                        style={{ flex: "2 1 220px" }}
                    />
                    <select
                        value={f.kind}
                        onChange={(e) => setF({ ...f, kind: e.target.value })}
                    >
                        {[
                            "site walk",
                            "design review",
                            "meeting",
                            "permit",
                            "install",
                        ].map((k) => (
                            <option key={k}>{k}</option>
                        ))}
                    </select>
                    <input
                        type="date"
                        required
                        value={f.date}
                        onChange={(e) => setF({ ...f, date: e.target.value })}
                    />
                    <input
                        type="time"
                        value={f.time}
                        onChange={(e) => setF({ ...f, time: e.target.value })}
                    />
                    <input
                        inputMode="numeric"
                        placeholder="Minutes"
                        value={f.mins}
                        onChange={(e) => setF({ ...f, mins: e.target.value })}
                        style={{ width: 90 }}
                    />
                    <input
                        placeholder="Location / address"
                        value={f.location}
                        onChange={(e) =>
                            setF({ ...f, location: e.target.value })
                        }
                    />
                    <input
                        placeholder="Zoom or Meet link"
                        value={f.video_url}
                        onChange={(e) =>
                            setF({ ...f, video_url: e.target.value })
                        }
                    />
                    <input
                        placeholder="Agenda link"
                        value={f.agenda_url}
                        onChange={(e) =>
                            setF({ ...f, agenda_url: e.target.value })
                        }
                    />
                    <input
                        placeholder="Notes for the client"
                        value={f.notes}
                        onChange={(e) => setF({ ...f, notes: e.target.value })}
                        style={{ flex: "2 1 220px" }}
                    />
                    <button className="b" type="submit">
                        Add
                    </button>
                </div>
                {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
            </form>
            <div className="c tw">
                <table>
                    <thead>
                        <tr>
                            <th>When</th>
                            <th>Event</th>
                            <th>Where</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td>
                                    {new Date(r.starts_at).toLocaleString([], {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                    })}
                                </td>
                                <td>
                                    {r.title}
                                    <div className="mono">{r.kind}</div>
                                </td>
                                <td>{r.location || r.video_url || ""}</td>
                                <td>
                                    <button
                                        className="b g"
                                        onClick={async () => {
                                            if (!confirm("Remove this event?"))
                                                return
                                            await db
                                                .from("calendar_events")
                                                .delete()
                                                .eq("id", r.id)
                                            load()
                                        }}
                                    >
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!rows.length && <p className="mono">Nothing scheduled.</p>}
            </div>
        </div>
    )
}

/* ───────────── Permits: jurisdiction, agencies and review stages for one project ───────────── */
function PermitManager({ db, projectId }: any) {
    const projects = useProjects(db)
    const [pid, setPid] = React.useState(projectId || "")
    const [d, setD] = React.useState<any>(null)
    const [msg, setMsg] = React.useState("")
    React.useEffect(() => {
        if (projectId) setPid(projectId)
        else if (!pid && projects[0]) setPid(projects[0].id)
    }, [projects, projectId])
    const load = async () => {
        if (!pid) return
        const { data, error } = await db.rpc("project_permit", {
            p_project: pid,
            p_jur: null,
        })
        if (error) setMsg(error.message)
        setD(data)
    }
    React.useEffect(() => {
        load()
    }, [pid])
    const setJ = async (id: string) => {
        const { error } = await db.rpc("set_jurisdiction", {
            p_project: pid,
            p_jur: id,
        })
        setMsg(
            error
                ? error.message
                : "Jurisdiction updated. The client's Permit Path switched stages, links and fees."
        )
        load()
    }
    const step = async (s: string, cur: string) => {
        const next = cur === "done" ? "" : cur === "active" ? "done" : "active"
        await db.rpc("set_permit_stage", {
            p_project: pid,
            p_stage: s,
            p_state: next,
        })
        load()
    }
    const on: string[] = Array.isArray(d?.progress?.__agencies)
        ? d.progress.__agencies
        : []
    async function toggleAgency(id: string) {
        const next = on.includes(id) ? on.filter((x) => x !== id) : [...on, id]
        const { error } = await saveProjectSetting(db, pid, "__agencies", next)
        setMsg(error ? error.message : "Saved. The client's Permit Path now shows these agencies.")
        load()
    }
    const j = d?.jurisdiction || {}
    const groups = Array.from(new Set(AGENCIES.map((a) => a.group)))
    return (
        <div>
            <p style={{ maxWidth: 680, lineHeight: 1.7, fontSize: 14 }}>
                Tick the agencies this project goes through. The client's
                Permit Path shows only the ticked agencies and their links,
                plus the review stages for the jurisdiction locked below. Tap a
                stage to cycle Upcoming, In review, Complete.
            </p>
            <div className="r">
                <select
                    value={pid}
                    onChange={(e) => setPid(e.target.value)}
                    style={{ display: projectId ? "none" : undefined }}
                >
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.title}
                        </option>
                    ))}
                </select>
            </div>
            <div className="mono" style={{ margin: "14px 0 6px" }}>
                Agencies (shown to the client)
            </div>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                    gap: 14,
                }}
            >
                {groups.map((g) => (
                    <div key={g} className="c" style={{ margin: 0 }}>
                        <div className="mono" style={{ marginBottom: 6 }}>
                            {g}
                        </div>
                        {AGENCIES.filter((a) => a.group === g).map((a) => (
                            <label
                                key={a.id}
                                className="r"
                                style={{
                                    flexWrap: "nowrap",
                                    padding: "5px 0",
                                    fontSize: 14,
                                    cursor: "pointer",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={on.includes(a.id)}
                                    onChange={() => toggleAgency(a.id)}
                                    style={{ width: 18, height: 18 }}
                                />
                                <span>
                                    {a.label}
                                    {a.optional ? (
                                        <span className="mono"> · if applicable</span>
                                    ) : null}
                                </span>
                            </label>
                        ))}
                    </div>
                ))}
            </div>
            {on.length > 0 && (
                <div className="c" style={{ marginTop: 12 }}>
                    <div className="mono" style={{ marginBottom: 6 }}>
                        Resources the client sees
                    </div>
                    {AGENCIES.filter((a) => on.includes(a.id)).map((a) => (
                        <div key={a.id} style={{ fontSize: 13, padding: "4px 0" }}>
                            <b>{a.label}</b>
                            {a.portal ? ` · ${a.portal}` : ""} —{" "}
                            {a.links.map(([t, u], i) => (
                                <span key={u}>
                                    {i ? " · " : ""}
                                    <a href={u} target="_blank" rel="noopener">
                                        {t}
                                    </a>
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
            )}
            <div className="mono" style={{ margin: "18px 0 6px" }}>
                Review stages follow
            </div>
            <div
                role="group"
                aria-label="Jurisdiction"
                style={{
                    display: "inline-flex",
                    flexWrap: "wrap",
                    border: ".5px solid color-mix(in srgb,var(--ink) 35%,transparent)",
                }}
            >
                {(d?.options || []).map((o: any, i: number) => (
                    <button
                        key={o.id}
                        aria-pressed={d?.current === o.id}
                        className={"b" + (d?.current === o.id ? "" : " g")}
                        style={{
                            borderRadius: 0,
                            border: 0,
                            borderLeft: i
                                ? ".5px solid color-mix(in srgb,var(--ink) 35%,transparent)"
                                : 0,
                            minHeight: 44,
                        }}
                        onClick={() => setJ(o.id)}
                    >
                        {o.label}
                    </button>
                ))}
            </div>
            {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
            <div className="c" style={{ marginTop: 12 }}>
                <div className="mono">{j.portal_name}</div>
                {(j.stages || []).map((s: string) => {
                    const st = (d?.progress || {})[s] || ""
                    return (
                        <div
                            key={s}
                            className="r"
                            style={{
                                justifyContent: "space-between",
                                padding: "10px 0",
                                borderTop:
                                    ".5px solid color-mix(in srgb,var(--ink) 20%,transparent)",
                                cursor: "pointer",
                            }}
                            onClick={() => step(s, st)}
                        >
                            <span>{s}</span>
                            <span className="mono" style={{ opacity: 1 }}>
                                {st === "done"
                                    ? "complete"
                                    : st === "active"
                                      ? "in review"
                                      : "upcoming"}
                            </span>
                        </div>
                    )
                })}
                {j.notes && (
                    <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
                        {j.notes}
                    </p>
                )}
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
    items.forEach((i: any) => {
        const [g, ...r] = String(i.title).split(" › ")
        const k = r.length ? g : "Tasks"
        ;(grouped[k] ||= []).push({
            ...i,
            label: r.length ? r.join(" › ") : i.title,
        })
    })
    async function seed() {
        const have = new Set(items.map((i: any) => i.title))
        const rows = (TEMPLATES[ph.seq] || [])
            .filter((t) => !have.has(t))
            .map((t) => ({
                project_id: projectId,
                phase_id: ph.id,
                title: t,
                kind: "other",
                status: "pending",
            }))
        if (!rows.length) return
        const { error } = await db.from("deliverables").insert(rows)
        setErr(error ? error.message : "")
        refresh()
    }
    async function tick(i: any) {
        const { error } = await db
            .from("deliverables")
            .update({
                status: i.status === "accepted" ? "pending" : "accepted",
                decided_at:
                    i.status === "accepted" ? null : new Date().toISOString(),
            })
            .eq("id", i.id)
        setErr(error ? error.message : "")
        refresh()
    }
    async function link() {
        const v = prompt(
            "Notion page for " + ph.title + " (blank to remove)",
            notion?.note || ""
        )
        if (v === null) return
        const url = v.trim()
        let error: any
        if (notion)
            ({ error } = url
                ? await db
                      .from("deliverables")
                      .update({ note: url })
                      .eq("id", notion.id)
                : await db.from("deliverables").delete().eq("id", notion.id))
        else if (url)
            ({ error } = await db
                .from("deliverables")
                .insert({
                    project_id: projectId,
                    phase_id: ph.id,
                    title: "__notion__",
                    kind: "other",
                    status: "pending",
                    note: url,
                }))
        setErr(error ? error.message : "")
        refresh()
    }
    async function addOwn() {
        if (!custom.trim()) return
        const { error } = await db
            .from("deliverables")
            .insert({
                project_id: projectId,
                phase_id: ph.id,
                title: custom.trim(),
                kind: "other",
                status: "pending",
            })
        setErr(error ? error.message : "")
        setCustom("")
        refresh()
    }
    async function remove(i: any) {
        if (!confirm("Remove this item?")) return
        await db.from("deliverables").delete().eq("id", i.id)
        refresh()
    }
    return (
        <div style={{ margin: "8px 28px 8px 14px" }}>
            <div className="r">
                <button className="b g" onClick={() => setOpen(!open)}>
                    {open ? "Hide" : "Show"} checklist · {done}/{items.length}
                </button>
                <button className="b g" onClick={seed}>
                    Load standard checklist
                </button>
                <button className="b g" onClick={link}>
                    {notion ? "Edit Notion link" : "+ Notion for this phase"}
                </button>
                {notion?.note ? (
                    <a
                        href={notion.note}
                        target="_blank"
                        rel="noopener"
                        className="mono"
                    >
                        Open in Notion
                    </a>
                ) : null}
            </div>
            {err && <p style={{ fontSize: 13, color: "#8a2b2b" }}>{err}</p>}
            {open && (
                <div style={{ marginTop: 8 }}>
                    {Object.entries(grouped).map(([g, list]) => (
                        <div key={g} style={{ marginBottom: 8 }}>
                            <div
                                className="mono"
                                style={{ margin: "8px 0 4px" }}
                            >
                                {g}
                            </div>
                            {list.map((i: any) => (
                                <div
                                    key={i.id}
                                    className="r"
                                    style={{
                                        padding: "4px 0",
                                        fontSize: 14,
                                        flexWrap: "nowrap",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={i.status === "accepted"}
                                        onChange={() => tick(i)}
                                        style={{ width: 18, height: 18 }}
                                    />
                                    <span
                                        style={{
                                            flex: 1,
                                            textDecoration:
                                                i.status === "accepted"
                                                    ? "line-through"
                                                    : "none",
                                            opacity:
                                                i.status === "accepted"
                                                    ? 0.55
                                                    : 1,
                                        }}
                                    >
                                        {i.label}
                                    </span>
                                    <button
                                        className="b g"
                                        style={{
                                            padding: "2px 9px",
                                            marginRight: 16,
                                        }}
                                        onClick={() => remove(i)}
                                        aria-label="Remove"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    ))}
                    <div className="r" style={{ marginTop: 6 }}>
                        <input
                            placeholder="Add your own item"
                            value={custom}
                            onChange={(e) => setCustom(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addOwn()}
                            style={{ flex: 1 }}
                        />
                        <button className="b g" onClick={addOwn}>
                            Add
                        </button>
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
    const load = async () => {
        const { data, error } = await db
            .from("survey_card_images")
            .select("option,url")
        if (error) setMsg(error.message)
        const m: any = {}
        ;(data || []).forEach((r: any) => (m[r.option] = r.url))
        setMap(m)
    }
    React.useEffect(() => {
        load()
    }, [])
    async function up(opt: string, file: File) {
        setBusy(opt)
        setMsg("")
        const ext = (file.name.split(".").pop() || "png").toLowerCase()
        const path = `${opt.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}.${ext}`
        const { error } = await db.storage
            .from("survey-assets")
            .upload(path, file, {
                upsert: true,
                contentType: file.type || "image/jpeg",
            })
        if (error) {
            setMsg(`Upload failed for ${opt}: ${error.message}`)
            setBusy("")
            return
        }
        const url = `${supabaseUrl}/storage/v1/object/public/survey-assets/${path}`
        const rows = [
            { option: opt, url, updated_at: new Date().toISOString() },
        ]
        if (opt === "Moonlit minimal")
            rows.push({
                option: "Minimal",
                url,
                updated_at: new Date().toISOString(),
            })
        const { error: e2 } = await db
            .from("survey_card_images")
            .upsert(rows, { onConflict: "option" })
        setMsg(
            e2
                ? `Saved file but could not link it: ${e2.message}`
                : `${opt} updated. The survey shows it on next load.`
        )
        setBusy("")
        load()
    }
    const logoUrl = `${supabaseUrl}/storage/v1/object/public/survey-assets/brand/felemaye-logo.png`
    const [logoV, setLogoV] = React.useState(Date.now())
    const logoRef = React.useRef<HTMLInputElement>(null)
    async function upLogo(file: File) {
        setMsg("Uploading logo…")
        const { error } = await db.storage
            .from("survey-assets")
            .upload("brand/felemaye-logo.png", file, {
                upsert: true,
                contentType: file.type || "image/png",
                cacheControl: "300",
            })
        setMsg(
            error
                ? "Logo upload failed: " + error.message
                : "Logo saved. Every studio email now uses it."
        )
        setLogoV(Date.now())
    }
    return (
        <div>
            <div
                className="c"
                style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                    flexWrap: "wrap",
                }}
            >
                <img
                    src={`${logoUrl}?v=${logoV}`}
                    alt=""
                    style={{
                        width: 72,
                        height: 72,
                        objectFit: "contain",
                        background: "#fff",
                    }}
                    onError={(e) => {
                        ;(e.target as HTMLImageElement).style.visibility =
                            "hidden"
                    }}
                />
                <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="mono">
                        Brand logo mark · used in client emails
                    </div>
                    <div
                        style={{
                            fontSize: 13,
                            opacity: 0.75,
                            margin: "4px 0 8px",
                        }}
                    >
                        PNG on a white background, about 400px wide.
                    </div>
                    <input
                        ref={logoRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        style={{
                            position: "absolute",
                            width: 1,
                            height: 1,
                            opacity: 0,
                            pointerEvents: "none",
                        }}
                        onChange={(e) => {
                            const x = e.target.files?.[0]
                            if (x) upLogo(x)
                            e.target.value = ""
                        }}
                    />
                    <button
                        className="b g"
                        onClick={() => logoRef.current?.click()}
                    >
                        Upload / replace logo
                    </button>
                </div>
            </div>
            <p style={{ maxWidth: 640, lineHeight: 1.7, fontSize: 14 }}>
                Click any card to upload a PNG or JPG. The survey picks it up on
                the next load; cards without an upload keep their default image.
            </p>
            {msg && <p style={{ fontSize: 13, fontWeight: 600 }}>{msg}</p>}
            {Object.entries(OPTIONS).map(([group, list]) => (
                <div key={group}>
                    <div className="mono" style={{ margin: "22px 0 10px" }}>
                        {group}
                    </div>
                    <div className="gr">
                        {list.map((o) => (
                            <div
                                key={o}
                                className="c"
                                style={{ cursor: "pointer", margin: 0 }}
                                onClick={() => refs.current[o]?.click()}
                            >
                                <div
                                    style={{
                                        aspectRatio: "4/3",
                                        backgroundColor: "rgba(0,0,0,.07)",
                                        backgroundImage: map[o]
                                            ? `url("${map[o]}")`
                                            : "none",
                                        backgroundSize: "cover",
                                        backgroundPosition: "center",
                                        marginBottom: 8,
                                    }}
                                />
                                <div style={{ fontSize: 13 }}>{o}</div>
                                <div className="mono">
                                    {busy === o
                                        ? "uploading…"
                                        : map[o]
                                          ? "replace"
                                          : "upload"}
                                </div>
                                <input
                                    ref={(el) => {
                                        refs.current[o] = el
                                    }}
                                    type="file"
                                    accept="image/*"
                                    style={{
                                        position: "absolute",
                                        width: 1,
                                        height: 1,
                                        opacity: 0,
                                        pointerEvents: "none",
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                        const f = e.target.files?.[0]
                                        if (f) up(o, f)
                                        e.target.value = ""
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

MasterStudioConsole.defaultProps = {
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
addPropertyControls(MasterStudioConsole, {
    supabaseUrl: { type: ControlType.String, title: "Supabase URL" },
    publishableKey: { type: ControlType.String, title: "Publishable key" },
    studioUrl: { type: ControlType.String, title: "Studio URL" },
    portalUrl: { type: ControlType.String, title: "Portal URL" },
    paper: { type: ControlType.Color, title: "Paper" },
    ink: { type: ControlType.Color, title: "Ink" },
    accent: { type: ControlType.Color, title: "Accent" },
    theme: { type: ControlType.Enum, title: "Theme", options: ["atelier", "paper"], optionTitles: ["Atelier dark (V4)", "Paper (v9)"], defaultValue: "atelier" },
    defaultView: { type: ControlType.Enum, title: "Default view", options: ["admin", "client"], optionTitles: ["Studio admin", "Client experience"], defaultValue: "admin" },
    oxblood: { type: ControlType.Color, title: "Oxblood", defaultValue: "#6E2B2B", hidden: (p: any) => p.theme === "paper" },
    ochre: { type: ControlType.Color, title: "Ochre", defaultValue: "#B8863B", hidden: (p: any) => p.theme === "paper" },
    slate: { type: ControlType.Color, title: "Slate", defaultValue: "#3F5A6B", hidden: (p: any) => p.theme === "paper" },
    moss: { type: ControlType.Color, title: "Moss", defaultValue: "#55603F", hidden: (p: any) => p.theme === "paper" },
    background: { type: ControlType.Color, title: "Background", defaultValue: "#121212", hidden: (p: any) => p.theme === "paper" },
})

/* ════════════════════════════════════════════════════════════════════════════
   V4 MASTER ENGINES (2026-10-22) — needs 20261022_felemaye_master_ecosystem.sql
   Time Bank & EHR · 50/25/25 Waterfall · Zoning/Muni Engine + Sheet A-001 ·
   Sub-consultant CRM & RFP matrix · Trade job queue · Studio Admin Drive refs ·
   Client Experience Portal (client-safe columns only).
   ════════════════════════════════════════════════════════════════════════════ */

const V4 = {
    oxblood: "#6E2B2B",
    ochre: "#B8863B",
    slate: "#3F5A6B",
    moss: "#55603F",
    bg: "#121212",
}

/** Monday of the ISO week, as YYYY-MM-DD. */
function weekOf(d: string) {
    const t = new Date(d + "T12:00:00")
    const day = (t.getDay() + 6) % 7
    t.setDate(t.getDate() - day)
    return t.toISOString().slice(0, 10)
}
const hrs = (m: number) => (Math.round((m / 60) * 10) / 10).toFixed(1)
const pct = (n: any) => (n == null || isNaN(+n) ? "—" : `${Math.round(+n)}%`)

function usePick(db: any, focus: string) {
    const projects = useProjects(db)
    const [pid, setPid] = React.useState(focus || "")
    React.useEffect(() => {
        if (focus) setPid(focus)
        else if (!pid && projects.length) setPid(projects[0].id)
    }, [focus, projects.length])
    const picker = !focus && (
        <select value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Project">
            {projects.map((p: any) => (
                <option key={p.id} value={p.id}>
                    {p.title}
                </option>
            ))}
        </select>
    )
    return { pid, picker, projects }
}

function Meter({ value, max = 100, tone = "var(--ochre)", label }: any) {
    const w = Math.max(0, Math.min(100, (100 * (+value || 0)) / (max || 1)))
    return (
        <div className="v4-meter" role="meter" aria-valuenow={Math.round(w)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
            <i style={{ width: w + "%", background: tone }} />
        </div>
    )
}

/* ───────────── 1 · TIME BANK, EHR & BURN ───────────── */
function TimeBank({ db, focus }: any) {
    const { pid, picker } = usePick(db, focus)
    const [bank, setBank] = React.useState<any>(null)
    const [burn, setBurn] = React.useState<any[]>([])
    const [rows, setRows] = React.useState<any[]>([])
    const [codes, setCodes] = React.useState<any[]>([])
    const [msg, setMsg] = React.useState("")
    const today = new Date().toISOString().slice(0, 10)
    const [f, setF] = React.useState({ work_date: today, phase_id: "", activity_code: "", hours: "", task_notes: "" })

    const load = React.useCallback(async () => {
        if (!pid) return
        const [b, ph, t, c] = await Promise.all([
            db.from("v_time_bank").select("*").eq("project_id", pid).maybeSingle(),
            db.from("v_phase_burn").select("*").eq("project_id", pid).order("seq"),
            db.from("studio_time_entries").select("*").eq("project_id", pid).order("work_date", { ascending: false }),
            db.from("activity_codes").select("*").order("phase_code").order("seq"),
        ])
        if (ph.error) setMsg("Run 20261022_felemaye_master_ecosystem.sql first — " + ph.error.message)
        setBank(b.data)
        setBurn(ph.data || [])
        setRows(t.data || [])
        setCodes(c.data || [])
        setF((x) => ({ ...x, phase_id: x.phase_id || (ph.data || []).find((p: any) => p.status === "active")?.phase_id || "" }))
    }, [db, pid])
    React.useEffect(() => {
        load()
    }, [load])

    const phase = burn.find((b) => b.phase_id === f.phase_id)
    const phaseCode = phase?.phase_code || ""
    const phaseCodes = codes.filter((c) => !phaseCode || c.phase_code === phaseCode || c.phase_code === "AD")

    async function add() {
        const h = parseFloat(f.hours)
        if (!pid || !h || h <= 0) return setMsg("Enter hours.")
        const { data: u } = await db.auth.getUser()
        const { error } = await db.from("studio_time_entries").insert({
            project_id: pid,
            work_date: f.work_date,
            minutes: Math.round(h * 60),
            phase_id: f.phase_id || null,
            phase_code: phaseCode || null,
            activity_code: f.activity_code || null,
            task_notes: f.task_notes || null,
            description: f.task_notes || (codes.find((c) => c.code === f.activity_code)?.label ?? ""),
            category: "design",
            billable: false,
            entered_by: u?.user?.email || null,
        })
        if (error) return setMsg(error.message)
        setF({ ...f, hours: "", task_notes: "" })
        setMsg("Logged.")
        load()
    }
    async function setProgress(phase_id: string, v: number) {
        const { error } = await db.from("phases").update({ progress_pct: v }).eq("id", phase_id)
        if (error) setMsg(error.message)
        load()
    }
    async function del(id: string) {
        await db.from("studio_time_entries").delete().eq("id", id)
        load()
    }

    // Project → Week → Phase Code → Activity Code → Task Notes
    const tree = React.useMemo(() => {
        const W: Record<string, Record<string, Record<string, any[]>>> = {}
        for (const r of rows) {
            const w = weekOf(r.work_date)
            const pc = r.phase_code || "—"
            const ac = r.activity_code || r.category || "—"
            ;((W[w] ||= {})[pc] ||= {})[ac] ||= []
            W[w][pc][ac].push(r)
        }
        return Object.entries(W).sort((a, b) => (a[0] < b[0] ? 1 : -1))
    }, [rows])
    const sumM = (xs: any[]) => xs.reduce((s, r) => s + (r.minutes || 0), 0)
    const ehr = bank?.ehr != null ? +bank.ehr : null
    const target = +(bank?.target_ehr || 150)

    return (
        <section className="v4">
            <div className="r" style={{ justifyContent: "space-between" }}>
                <div>
                    <div className="mono">Financial engine</div>
                    <h2 className="v4-h">Time bank & effective hourly rate</h2>
                </div>
                {picker}
            </div>
            {msg && <p className="v4-note">{msg}</p>}
            {bank ? (
                <div className="v4-kpis">
                    <div className="v4-kpi">
                        <span className="mono">Time bank</span>
                        <b>
                            {(+bank.logged_hours).toFixed(1)} / {(+bank.time_bank_hours).toFixed(1)} h
                        </b>
                        <Meter value={bank.logged_hours} max={bank.time_bank_hours} tone={+bank.logged_hours > +bank.time_bank_hours ? "var(--oxblood)" : "var(--moss)"} label="Hours used" />
                        <small>{(+bank.hours_remaining).toFixed(1)} h remaining on a {money(+bank.fixed_fee)} fixed fee</small>
                    </div>
                    <div className="v4-kpi">
                        <span className="mono">EHR</span>
                        <b style={{ color: ehr == null ? undefined : ehr >= target ? "var(--moss-hi)" : "var(--oxblood-hi)" }}>{ehr == null ? "—" : money(ehr) + "/h"}</b>
                        <small>
                            (Fixed fee × phase progress) ÷ logged hours · target {money(target)}/h
                        </small>
                    </div>
                    <div className="v4-kpi">
                        <span className="mono">Earned value</span>
                        <b>{money(+bank.earned_value)}</b>
                        <small>Breakeven at target: {(+bank.fixed_fee / target).toFixed(1)} h</small>
                    </div>
                </div>
            ) : (
                <p className="v4-note">No budget for this project yet. Insert a row in project_budgets (fixed fee, hours, target EHR).</p>
            )}

            <div className="tw">
                <table>
                    <thead>
                        <tr>
                            <th>Phase</th>
                            <th>Fee</th>
                            <th>Progress</th>
                            <th>Hours</th>
                            <th>Burn</th>
                            <th>EHR</th>
                        </tr>
                    </thead>
                    <tbody>
                        {burn.map((b) => (
                            <tr key={b.phase_id} style={{ opacity: b.optional ? 0.6 : 1 }}>
                                <td>
                                    <span className="tag">{b.phase_code || b.seq}</span> {b.title}
                                    {b.burn_alert && <span className="v4-alert">Burn {pct(b.burn_pct)} · progress {pct(b.progress_pct)}</span>}
                                </td>
                                <td>{money(+b.fee_amount)}</td>
                                <td style={{ minWidth: 150 }}>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={5}
                                        defaultValue={+b.progress_pct}
                                        aria-label={"Progress for " + b.title}
                                        onMouseUp={(e: any) => setProgress(b.phase_id, +e.target.value)}
                                        onTouchEnd={(e: any) => setProgress(b.phase_id, +e.target.value)}
                                        onKeyUp={(e: any) => setProgress(b.phase_id, +e.target.value)}
                                        style={{ width: "100%", border: 0 }}
                                    />
                                    <small>{pct(b.progress_pct)}</small>
                                </td>
                                <td>
                                    {(+b.logged_hours).toFixed(1)} / {(+b.budget_hours).toFixed(1)}
                                </td>
                                <td style={{ minWidth: 110 }}>
                                    <Meter value={b.burn_pct || 0} tone={b.burn_alert ? "var(--oxblood)" : "var(--slate)"} label={"Burn " + b.title} />
                                    <small>{pct(b.burn_pct)}</small>
                                </td>
                                <td>{b.ehr == null ? "—" : money(+b.ehr)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="c v4-panel">
                <div className="mono">Timecard</div>
                <div className="r">
                    <input type="date" value={f.work_date} onChange={(e) => setF({ ...f, work_date: e.target.value })} aria-label="Date" />
                    <select value={f.phase_id} onChange={(e) => setF({ ...f, phase_id: e.target.value, activity_code: "" })} aria-label="Phase">
                        <option value="">Phase…</option>
                        {burn.map((b) => (
                            <option key={b.phase_id} value={b.phase_id}>
                                {(b.phase_code || b.seq) + " · " + b.title}
                            </option>
                        ))}
                    </select>
                    <select value={f.activity_code} onChange={(e) => setF({ ...f, activity_code: e.target.value })} aria-label="Activity code">
                        <option value="">Activity…</option>
                        {phaseCodes.map((c) => (
                            <option key={c.code} value={c.code}>
                                {c.code + " · " + c.label}
                            </option>
                        ))}
                    </select>
                    <input inputMode="decimal" placeholder="Hours" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} style={{ width: 90 }} aria-label="Hours" />
                    <input placeholder="Task notes" value={f.task_notes} onChange={(e) => setF({ ...f, task_notes: e.target.value })} style={{ flex: "2 1 240px" }} aria-label="Task notes" />
                    <button className="b" onClick={add}>
                        Log time
                    </button>
                </div>
            </div>

            {tree.map(([w, P], i) => (
                <details key={w} className="v4-acc" open={i === 0}>
                    <summary>
                        <span>Week of {new Date(w + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        <b>{hrs(Object.values(P).flatMap((A) => Object.values(A).flat()).reduce((s, r: any) => s + (r.minutes || 0), 0))} h</b>
                    </summary>
                    {Object.entries(P).map(([pc, A]) => (
                        <details key={pc} className="v4-acc v4-acc2" open>
                            <summary>
                                <span className="tag">{pc}</span>
                                <b>{hrs(sumM(Object.values(A).flat()))} h</b>
                            </summary>
                            {Object.entries(A).map(([ac, R]) => (
                                <div key={ac} className="v4-act">
                                    <div className="v4-acthead">
                                        <span className="mono">{ac}</span> {codes.find((c) => c.code === ac)?.label || ""}
                                        <b>{hrs(sumM(R))} h</b>
                                    </div>
                                    {R.map((r: any) => (
                                        <div key={r.id} className="v4-note-row">
                                            <span className="mono">{r.work_date}</span>
                                            <span>{r.task_notes || r.description || "—"}</span>
                                            <span>{hrs(r.minutes)} h</span>
                                            <button className="b g" onClick={() => del(r.id)} aria-label="Delete entry">
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </details>
                    ))}
                </details>
            ))}
        </section>
    )
}

/* ───────────── 2 · 50 / 25 / 25 WATERFALL ───────────── */
function Waterfall({ db }: any) {
    const [rows, setRows] = React.useState<any[]>([])
    const [cfg, setCfg] = React.useState({ tax: 25, opex: 25, owner: 50 })
    const [sim, setSim] = React.useState("2250")
    const [msg, setMsg] = React.useState("")
    const load = React.useCallback(async () => {
        const [w, c] = await Promise.all([
            db.from("v_inflow_waterfall").select("*"),
            db.from("studio_config").select("key,value").in("key", ["waterfall_tax_pct", "waterfall_opex_pct", "waterfall_owner_pct"]),
        ])
        if (w.error) setMsg(w.error.message)
        setRows((w.data || []).filter((r: any) => +r.inflow > 0))
        const m: any = Object.fromEntries((c.data || []).map((r: any) => [r.key, +r.value]))
        setCfg({ tax: m.waterfall_tax_pct ?? 25, opex: m.waterfall_opex_pct ?? 25, owner: m.waterfall_owner_pct ?? 50 })
    }, [db])
    React.useEffect(() => {
        load()
    }, [load])
    async function save() {
        if (cfg.tax + cfg.opex + cfg.owner !== 100) return setMsg("The three buckets must add to 100%.")
        const { error } = await db.from("studio_config").upsert([
            { key: "waterfall_tax_pct", value: String(cfg.tax) },
            { key: "waterfall_opex_pct", value: String(cfg.opex) },
            { key: "waterfall_owner_pct", value: String(cfg.owner) },
        ])
        setMsg(error ? error.message : "Split saved.")
        load()
    }
    const tot = rows.reduce(
        (s, r) => ({ in: s.in + +r.inflow, tax: s.tax + +r.tax_reserve, opex: s.opex + +r.opex_reserve, own: s.own + +r.owners_draw }),
        { in: 0, tax: 0, opex: 0, own: 0 }
    )
    const S = parseFloat(sim) || 0
    const buckets: [string, number, number, string][] = [
        ["Tax reserve", cfg.tax, tot.tax, "var(--oxblood)"],
        ["Studio OPEX & reserve", cfg.opex, tot.opex, "var(--slate)"],
        ["Owner's draw", cfg.owner, tot.own, "var(--moss)"],
    ]
    return (
        <section className="v4">
            <div className="mono">Cash waterfall</div>
            <h2 className="v4-h">Every inflow, split {cfg.owner}/{cfg.tax}/{cfg.opex}</h2>
            <p className="v4-note">This sits beside the 5-bucket engine in Finances (unchanged); it's the owner's quick read of each payment.</p>
            {msg && <p className="v4-note">{msg}</p>}
            <div className="v4-kpis">
                <div className="v4-kpi">
                    <span className="mono">Collected</span>
                    <b>{money(tot.in)}</b>
                    <small>{rows.length} paid invoice{rows.length === 1 ? "" : "s"}</small>
                </div>
                {buckets.map(([l, p, v, c]) => (
                    <div className="v4-kpi" key={l}>
                        <span className="mono">
                            {l} · {p}%
                        </span>
                        <b style={{ color: c.replace(")", "-hi)") }}>{money(v)}</b>
                        <Meter value={p} tone={c} label={l} />
                    </div>
                ))}
            </div>
            <div className="c v4-panel">
                <div className="mono">Simulate an inflow</div>
                <div className="r">
                    <input inputMode="decimal" value={sim} onChange={(e) => setSim(e.target.value)} aria-label="Inflow amount" style={{ width: 140 }} />
                    {buckets.map(([l, p, , c]) => (
                        <span key={l} className="v4-chip" style={{ borderColor: c }}>
                            {l}: <b>{money((S * p) / 100)}</b>
                        </span>
                    ))}
                </div>
                <div className="v4-cascade" aria-hidden>
                    {buckets.map(([l, p, , c]) => (
                        <i key={l} style={{ flex: p, background: c }} title={l} />
                    ))}
                </div>
            </div>
            <div className="c v4-panel">
                <div className="mono">Split</div>
                <div className="r">
                    {(["owner", "tax", "opex"] as const).map((k) => (
                        <label key={k} className="r" style={{ gap: 6 }}>
                            <span className="mono">{k === "owner" ? "Owner's draw" : k === "tax" ? "Tax" : "OPEX"}</span>
                            <input type="number" min={0} max={100} value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: +e.target.value })} style={{ width: 70 }} />
                        </label>
                    ))}
                    <button className="b" onClick={save}>
                        Save split
                    </button>
                </div>
            </div>
            <div className="tw">
                <table>
                    <thead>
                        <tr>
                            <th>Inflow</th>
                            <th>Tax</th>
                            <th>OPEX</th>
                            <th>Owner</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.invoice_id}>
                                <td>{money(+r.inflow)}</td>
                                <td>{money(+r.tax_reserve)}</td>
                                <td>{money(+r.opex_reserve)}</td>
                                <td>{money(+r.owners_draw)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    )
}

/* ───────────── 3 · ZONING / MUNI ENGINE + SHEET A-001 ───────────── */
type Cite = { code: string; title: string; note: string }
const BPC: Cite[] = [
    {
        code: "Cal. Bus. & Prof. Code §5537",
        title: "Exempt buildings",
        note: "Single-family wood-frame dwellings (≤ 2 stories + basement), small multi-family and appurtenant structures may be designed without an architect licence; the building official may still require structural portions by a licensed engineer or architect.",
    },
    {
        code: "Cal. Bus. & Prof. Code §5538",
        title: "Non-structural work",
        note: "Non-structural / non-seismic storefronts, interior alterations, fixtures, cabinetwork and furnishings may be prepared by unlicensed persons.",
    },
]
const JURIS: Record<string, { label: string; cites: Cite[] }> = {
    la_county: {
        label: "Unincorporated LA County · Regional Planning + Public Works (EPIC-LA)",
        cites: [{ code: "LA County Code Title 22", title: "Planning & Zoning", note: "Zone development standards: yards/setbacks, height, front-yard walls & fences. Confirm section against the current code." }],
    },
    ladbs: {
        label: "City of Los Angeles · City Planning + LADBS (ePlanLA)",
        cites: [{ code: "LAMC Ch. I (Zoning)", title: "Zoning code", note: "Zone, height district and yards per the ZIMAS parcel profile." }],
    },
    nyc_dob: {
        label: "New York City · DOB NOW",
        cites: [{ code: "NYC Zoning Resolution / NYC Building Code", title: "Zoning & building code", note: "Confirm zoning district, FAR and yard rules on ZoLa." }],
    },
}
const BHO: Cite = {
    code: "LAMC §12.21 C.10 (Baseline Hillside Ordinance)",
    title: "Hillside area",
    note: "Single-family zones in Hillside Areas: residential floor area, height envelope and grading limits. Verify the slope band analysis.",
}

/** Pull zoning facts out of free-form meeting notes. Everything parsed is a draft for the studio to verify. */
function parseZoning(txt: string) {
    const s = " " + txt.replace(/’|′/g, "'").replace(/”|″/g, '"') + " "
    const num = (re: RegExp) => {
        const m = s.match(re)
        return m ? parseFloat(m[m.length - 1].replace(/,/g, "")) : null
    }
    const zm =
        s.match(/\b((?:R[1-5]|RE\d{0,2}|RS|RD\d(?:\.\d)?|RA|A[12]|C[1-5]|CR|M[1-3])(?:-\d{1,2}[A-Z]?)?(?:-[A-Z]{2,5})?)\b/) ||
        s.match(/\b(R-[1-5](?:-[A-Z0-9]+)?)\b/i)
    const overlays = Array.from(new Set((s.match(/\b(BHO|HPOZ|CSD|SNAP|CPIO|HCR|RFA)\b/g) || []).map((x) => x.toUpperCase())))
    if (/baseline hillside/i.test(s) && !overlays.includes("BHO")) overlays.push("BHO")
    const hillside = /hillside|bho\b|slope (?:band|>|over)/i.test(s)
    const wallIn =
        num(/(?:wall|fence)[^.\n]{0,40}?(\d{2})\s*(?:in\b|inch|")/i) ??
        ((): number | null => {
            const ft = num(/(?:wall|fence)[^.\n]{0,40}?(\d(?:\.\d)?)\s*(?:ft|feet|')/i)
            return ft != null ? Math.round(ft * 12) : null
        })()
    return {
        zone_class: zm ? zm[1].toUpperCase() : null,
        overlays,
        lot_area_sf: num(/lot (?:area|size)[^\d]{0,12}([\d,]{3,7})\s*(?:sf|sq)/i),
        far_allowable: num(/\bFAR\b[^\d]{0,12}(\d(?:\.\d+)?)/i),
        setback_front_ft: num(/front[^.\n]{0,20}?(?:setback|yard)[^\d]{0,12}(\d{1,3})\s*(?:ft|feet|')/i),
        setback_side_ft: num(/side[^.\n]{0,20}?(?:setback|yard)[^\d]{0,12}(\d{1,3}(?:\.\d)?)\s*(?:ft|feet|')/i),
        setback_rear_ft: num(/rear[^.\n]{0,20}?(?:setback|yard)[^\d]{0,12}(\d{1,3})\s*(?:ft|feet|')/i),
        height_cap_ft: num(/height[^.\n]{0,20}?(?:limit|cap|max(?:imum)?)[^\d]{0,12}(\d{1,3})\s*(?:ft|feet|')/i),
        wall_height_cap_in: wallIn,
        transparency_pct: num(/(\d{2})\s*%\s*(?:transparen|open)/i),
        occupancy: (s.match(/\b(R-3|R-2|U|B|M|A-[1-5])\b(?=[^.\n]{0,20}occupan)|occupancy[^.\n]{0,12}\b(R-3|R-2|U|B|M)\b/i) || []).filter(Boolean)[1]?.toUpperCase() || null,
        hillside,
        retaining_wall_max_ft: num(/retaining wall[^.\n]{0,40}?(\d{1,2}(?:\.\d)?)\s*(?:ft|feet|')/i),
    }
}

function a001Html(project: any, z: any, prop: any) {
    const esc = (v: any) => String(v ?? "—").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[c])
    const row = (l: string, a: any, p: any, unit = "") => {
        const ok = a == null || p == null || p === "" ? "" : l.startsWith("Setback") ? +p >= +a : +p <= +a
        return `<tr><td>${l}</td><td>${esc(a)}${a != null ? unit : ""}</td><td>${esc(p)}${p ? unit : ""}</td><td class="${ok === "" ? "" : ok ? "ok" : "no"}">${ok === "" ? "" : ok ? "Complies" : "Check"}</td></tr>`
    }
    const cites = (z.citations || []).map((c: Cite) => `<li><b>${esc(c.code)}</b> — ${esc(c.title)}. ${esc(c.note)}</li>`).join("")
    return `<!doctype html><html><head><meta charset="utf-8"><title>A-001 Zoning & Code Analysis — ${esc(project?.title)}</title>
<style>@page{size:24in 18in;margin:.5in}body{font:12px/1.45 'Helvetica Neue',Arial,sans-serif;color:#111;margin:0}
.sheet{display:grid;grid-template-columns:1fr 3.2in;gap:.3in;min-height:16.5in;border:2px solid #111;padding:.3in}
h1{font:600 22px 'Helvetica Neue',Arial;letter-spacing:.08em;margin:0 0 4px}h2{font:600 12px 'Helvetica Neue';letter-spacing:.16em;text-transform:uppercase;border-bottom:1px solid #111;padding-bottom:4px;margin:22px 0 8px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #111;padding:6px 8px;text-align:left}th{background:#eee;font-size:10px;letter-spacing:.12em;text-transform:uppercase}
.ok{color:#2f5d2f;font-weight:600}.no{color:#8a1f1f;font-weight:600}.tb{border-left:2px solid #111;padding-left:.2in;display:flex;flex-direction:column;gap:14px}.tb .big{font:600 44px 'Helvetica Neue';letter-spacing:.04em}
.flag{border:2px solid #8a1f1f;color:#8a1f1f;padding:8px;font-weight:600}small{color:#555}</style></head><body><div class="sheet"><main>
<h1>ZONING & CODE ANALYSIS</h1><small>${esc(JURIS[z.jurisdiction]?.label || z.jurisdiction)}</small>
<h2>Project data</h2><table><tr><th>Address</th><td>${esc(project?.address)}</td><th>Zone</th><td>${esc(z.zone_class)}${(z.overlays || []).length ? " · " + esc(z.overlays.join(", ")) : ""}</td></tr>
<tr><th>Lot area</th><td>${esc(z.lot_area_sf)} sf</td><th>Occupancy / type</th><td>${esc(z.occupancy)} / ${esc(z.construction_type)}</td></tr></table>
<h2>Allowable vs proposed</h2><table><tr><th>Item</th><th>Allowable / required</th><th>Proposed</th><th>Status</th></tr>
${row("FAR", z.far_allowable, prop.far_proposed)}
${row("Floor area", z.far_allowable && z.lot_area_sf ? Math.round(z.far_allowable * z.lot_area_sf) : null, prop.floor_area_proposed, " sf")}
${row("Setback — front", z.setback_front_ft, prop.front, " ft")}
${row("Setback — side", z.setback_side_ft, prop.side, " ft")}
${row("Setback — rear", z.setback_rear_ft, prop.rear, " ft")}
${row("Building height", z.height_cap_ft, prop.height, " ft")}
${row("Front-yard wall (solid)", z.wall_height_cap_in, prop.wall_in, " in")}
<tr><td>Openness above solid portion</td><td>≥ ${esc(z.transparency_pct)}%</td><td>${esc(prop.transparency)}${prop.transparency ? "%" : ""}</td><td></td></tr></table>
${z.se_override ?? z.se_required ? '<p class="flag">STRUCTURAL ENGINEER REQUIRED — hillside site or retaining wall over 4 ft. Engineer of Record to stamp S-series sheets.</p>' : ""}
<h2>Code references</h2><ul>${cites}</ul><small>Draft analysis prepared by the designer for coordination; verify against the current adopted codes and the agency's plan check.</small>
</main><aside class="tb"><div><b>FELEMAYE LLC</b><br><small>Architectural design studio · Los Angeles</small></div>
<div><small>PROJECT</small><br><b>${esc(project?.title)}</b><br>${esc(project?.address)}</div><div><small>DATE</small><br>${new Date().toLocaleDateString("en-US")}</div>
<div><small>STATUS</small><br>${esc(z.status).toUpperCase()}</div><div style="margin-top:auto"><small>SHEET</small><div class="big">A-001</div></div></aside></div>
<script>setTimeout(()=>print(),400)</script></body></html>`
}

/* Zoning & permit intelligence (v2, 2026-10-22c). Upload meeting notes / agency letters / research
   (PDF, Word, Markdown, text — export Google Docs or Notion pages as PDF or Markdown), get a structured
   analysis: allowed · non-negotiable · negotiable · applications · questions for the planner · sources.
   Analysis runs in the zoning-analyze edge function (needs ANTHROPIC_API_KEY). */
const SHEET_DEFAULT: Record<string, [string, string]> = {
    la_county: ["G-001", "Project Data, Zoning & Code Analysis"],
    ladbs: ["G-001", "Project Data, Zoning & Code Analysis"],
    nyc_dob: ["Z-001", "Zoning Analysis (with ZD1 Zoning Diagram)"],
}
let PDFJS_C: Promise<any> | null = null
async function pdfText(file: File) {
    PDFJS_C ||= import(/* @vite-ignore */ "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs" as any).then((m: any) => {
        m.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs"
        return m
    })
    const lib = await PDFJS_C
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
        const c = await (await doc.getPage(i)).getTextContent()
        pages.push(c.items.map((t: any) => t.str + (t.hasEOL ? "\n" : " ")).join(""))
    }
    return pages.join("\n\n")
}
let MAMMOTH: Promise<any> | null = null
async function docxText(file: File) {
    MAMMOTH ||= new Promise((res, rej) => {
        if ((window as any).mammoth) return res((window as any).mammoth)
        const s = document.createElement("script")
        s.src = "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js"
        s.onload = () => res((window as any).mammoth)
        s.onerror = rej
        document.head.appendChild(s)
    })
    const m = await MAMMOTH
    return (await m.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value as string
}
async function fileText(f: File): Promise<string> {
    const n = f.name.toLowerCase()
    if (n.endsWith(".pdf") || f.type === "application/pdf") return pdfText(f)
    if (n.endsWith(".docx")) return docxText(f)
    if (/\.(html?|htm)$/.test(n)) { const d = new DOMParser().parseFromString(await f.text(), "text/html"); return d.body.innerText || d.body.textContent || "" }
    if (/\.(txt|md|markdown|csv|rtf|json)$/.test(n) || f.type.startsWith("text/")) return f.text()
    throw new Error("Unsupported file — export as PDF, DOCX, Markdown or text. Scanned images need OCR first.")
}

function zoningSheetHtml(project: any, z: any, prop: any, sheetNo: string, sheetTitle: string) {
    const esc = (v: any) => String(v ?? "—").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[c])
    const A = z.analysis || {}
    const list = (xs: any[]) => (xs || []).map((x) => `<li>${esc(x)}</li>`).join("")
    const row = (l: string, a: any, p: any, unit = "") => {
        const ok = a == null || p == null || p === "" ? "" : l.startsWith("Setback") ? +p >= +a : +p <= +a
        return `<tr><td>${l}</td><td>${a != null ? esc(a) + unit : "—"}</td><td>${p ? esc(p) + unit : "—"}</td><td class="${ok === "" ? "" : ok ? "ok" : "no"}">${ok === "" ? "" : ok ? "Complies" : "Check"}</td></tr>`
    }
    const srcs = (A.sources || []).map((s: any) => `<li>${esc(s.title)}${s.url ? ` — <span class="u">${esc(s.url)}</span>` : ""}</li>`).join("")
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sheetNo)} ${esc(sheetTitle)} — ${esc(project?.title)}</title>
<style>@page{size:24in 18in;margin:.5in}body{font:13px/1.5 'Helvetica Neue',Arial,sans-serif;color:#111;margin:0}
.sheet{display:grid;grid-template-columns:1fr 3.2in;gap:.3in;min-height:16.5in;border:2px solid #111;padding:.3in}
.cols{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.25in}
h1{font:600 24px 'Helvetica Neue',Arial;letter-spacing:.08em;margin:0 0 4px}h2{font:600 12px 'Helvetica Neue';letter-spacing:.16em;text-transform:uppercase;border-bottom:1px solid #111;padding-bottom:4px;margin:20px 0 8px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #111;padding:6px 8px;text-align:left;vertical-align:top}th{background:#eee;font-size:10px;letter-spacing:.12em;text-transform:uppercase}
ul{margin:0;padding-left:18px}li{margin:3px 0}.ok{color:#2f5d2f;font-weight:600}.no{color:#8a1f1f;font-weight:600}.u{font-size:10px;color:#555;word-break:break-all}
.tb{border-left:2px solid #111;padding-left:.2in;display:flex;flex-direction:column;gap:14px}.tb .big{font:600 44px 'Helvetica Neue';letter-spacing:.04em}
.box{border:1.5px solid #111;padding:10px 12px}.box.red{border-color:#8a1f1f}.box.red h2{color:#8a1f1f;border-color:#8a1f1f}small{color:#555}</style></head><body><div class="sheet"><main>
<h1>${esc(sheetTitle).toUpperCase()}</h1><small>${esc(z.jurisdiction)} · ${esc((z.overlays || []).join(" · "))}</small>
<h2>Project data</h2><table><tr><th>Address</th><td>${esc(project?.address)}</td><th>Zone</th><td>${esc(z.zone_class)}</td></tr>
<tr><th>Lot area</th><td>${z.lot_area_sf ? esc(z.lot_area_sf) + " sf" : "—"}</td><th>Occupancy / type</th><td>${esc(z.occupancy)} / ${esc(z.construction_type)}</td></tr></table>
${A.summary ? `<p style="font-size:14px;margin:12px 0 0">${esc(A.summary)}</p>` : ""}
<h2>Allowable vs proposed</h2><table><tr><th>Item</th><th>Allowable / required</th><th>Proposed</th><th>Status</th></tr>
${row("Setback — front", z.setback_front_ft, prop.front, " ft")}${row("Setback — side", z.setback_side_ft, prop.side, " ft")}${row("Setback — rear", z.setback_rear_ft, prop.rear, " ft")}
${row("Building height", z.height_cap_ft, prop.height, " ft")}${row("Front-yard fence / wall", z.wall_height_cap_in, prop.wall_in, " in")}
${row("FAR", z.far_allowable, prop.far_proposed)}</table>
<div class="cols" style="margin-top:14px">
<div class="box"><h2>Permitted by right</h2><ul>${list(A.allowed)}</ul></div>
<div class="box red"><h2>Non-negotiable</h2><ul>${list(A.non_negotiables)}</ul></div>
<div class="box"><h2>Discretionary paths</h2><ul>${list(A.negotiables)}</ul></div></div>
<h2>Approvals sequence</h2><ol style="margin:0;padding-left:20px">${list(A.applications)}</ol>
${(A.conflicts || []).length ? `<h2>To verify</h2><ul>${list(A.conflicts)}</ul>` : ""}
<h2>Sources</h2><ul>${srcs}</ul><small>Analysis prepared by the designer for coordination; verify against the adopted code and the agency's plan check.</small>
</main><aside class="tb"><div><b>FELEMAYE LLC</b><br><small>Architectural design studio · Los Angeles</small></div>
<div><small>PROJECT</small><br><b>${esc(project?.title)}</b><br>${esc(project?.address)}</div><div><small>DATE</small><br>${new Date().toLocaleDateString("en-US")}</div>
<div><small>STATUS</small><br>${esc(z.status).toUpperCase()}</div><div style="margin-top:auto"><small>SHEET</small><div class="big">${esc(sheetNo)}</div></div></aside></div>
<script>setTimeout(()=>print(),400)</script></body></html>`
}

function ZoningMuniEngine({ db, focus }: any) {
    const { pid, picker } = usePick(db, focus)
    const [project, setProject] = React.useState<any>(null)
    const [audits, setAudits] = React.useState<any[]>([])
    const [refs, setRefs] = React.useState<any[]>([])
    const [notes, setNotes] = React.useState("")
    const [files, setFiles] = React.useState<{ name: string; chars: number }[]>([])
    const [jur, setJur] = React.useState("la_county")
    const [draft, setDraft] = React.useState<any>(null)
    const [busy, setBusy] = React.useState("")
    const [open, setOpen] = React.useState<string | null>(null)
    const [prop, setProp] = React.useState<any>({})
    const [sheetNo, setSheetNo] = React.useState("")
    const [msg, setMsg] = React.useState("")
    const [drag, setDrag] = React.useState(false)
    const load = React.useCallback(async () => {
        if (!pid) return
        const [p, a] = await Promise.all([
            db.from("projects").select("id,title,address,jurisdiction_id").eq("id", pid).maybeSingle(),
            db.from("project_zoning_audits").select("*").eq("project_id", pid).order("created_at", { ascending: false }),
        ])
        if (a.error) setMsg(a.error.message)
        setProject(p.data); setAudits(a.data || [])
        setOpen((o) => o || (a.data || [])[0]?.id || null)
        const j = String(p.data?.jurisdiction_id || "")
        setJur(/ladbs|la_city/.test(j) ? "ladbs" : /nyc/.test(j) ? "nyc_dob" : "la_county")
    }, [db, pid])
    React.useEffect(() => { load() }, [load])
    React.useEffect(() => {
        db.from("jurisdiction_references").select("*").in("jurisdiction", [jur, "national"]).order("topic").then((r: any) => setRefs(r.data || []), () => {})
        setSheetNo(SHEET_DEFAULT[jur]?.[0] || "G-001")
    }, [db, jur])

    async function addFiles(list: FileList | File[] | null) {
        if (!list) return
        for (const f of Array.from(list)) {
            setBusy("Reading " + f.name + "…")
            try {
                const t = (await fileText(f)).replace(/\n{3,}/g, "\n\n").trim()
                setNotes((n) => (n ? n + "\n\n" : "") + `──── ${f.name} ────\n` + t)
                setFiles((fs) => [...fs, { name: f.name, chars: t.length }])
            } catch (e: any) { setMsg(f.name + ": " + (e?.message || "could not read")) }
        }
        setBusy("")
    }
    async function analyze() {
        setBusy("Analyzing — usually 20–40 seconds…"); setMsg("")
        const { data, error } = await db.functions.invoke("zoning-analyze", { body: { project_id: pid, jurisdiction: jur, text: notes, files: files.map((f) => f.name) } })
        setBusy("")
        if (error || data?.error) return setMsg((data?.error || error?.message || "Analysis failed") + (/not set|404|Failed to send/i.test(String(data?.error || error?.message)) ? " — deploy the zoning-analyze function and add ANTHROPIC_API_KEY." : ""))
        const A = data.analysis || {}
        const f = A.facts || {}
        setDraft({ jurisdiction: jur, status: "draft", analysis: A, zone_class: f.zone_class || null, overlays: f.overlays || [], setback_front_ft: f.setback_front_ft ?? null, setback_side_ft: f.setback_side_ft ?? null, setback_rear_ft: f.setback_rear_ft ?? null, height_cap_ft: f.height_cap_ft ?? null, wall_height_cap_in: f.wall_height_cap_in ?? null, transparency_pct: f.transparency_pct ?? null, lot_area_sf: f.lot_area_sf ?? null, far_allowable: f.far_allowable ?? null, occupancy: f.occupancy || null, sheet_number: A.sheet?.number || SHEET_DEFAULT[jur]?.[0] })
    }
    function quick() {
        const z: any = parseZoning(notes)
        setDraft({ jurisdiction: jur, status: "draft", analysis: {}, ...z, sheet_number: SHEET_DEFAULT[jur]?.[0] })
    }
    async function save() {
        if (!draft) return
        const { se_required, ...row } = draft
        const num = (v: any) => (v === "" || v == null || isNaN(+v) ? null : +v)
        const { error } = await db.from("project_zoning_audits").insert({
            ...row, project_id: pid, source_note: notes.slice(0, 200000), source_files: files.map((f) => f.name),
            setback_front_ft: num(row.setback_front_ft), setback_side_ft: num(row.setback_side_ft), setback_rear_ft: num(row.setback_rear_ft), height_cap_ft: num(row.height_cap_ft),
            wall_height_cap_in: num(row.wall_height_cap_in), transparency_pct: num(row.transparency_pct), lot_area_sf: num(row.lot_area_sf), far_allowable: num(row.far_allowable), retaining_wall_max_ft: num(row.retaining_wall_max_ft),
            parsed: {},
        })
        setMsg(error ? error.message : "Saved."); if (!error) { setDraft(null); setFiles([]); load() }
    }
    async function setStatus(a: any, status: string) { await db.from("project_zoning_audits").update({ status }).eq("id", a.id); load() }
    function sheet(a: any) {
        const w = window.open("", "_blank"); if (!w) return setMsg("Allow pop-ups to open the sheet.")
        const t = a.analysis?.sheet?.title || SHEET_DEFAULT[a.jurisdiction]?.[1] || "Zoning & Code Analysis"
        w.document.write(zoningSheetHtml(project, a, prop, a.sheet_number || sheetNo, t)); w.document.close()
    }
    const copy = (xs: string[]) => { try { navigator.clipboard.writeText(xs.map((x, i) => `${i + 1}. ${x}`).join("\n")); setMsg("Questions copied.") } catch {} }
    const Col = ({ t, xs, tone }: any) => (xs || []).length ? (
        <div className="c" style={{ borderTop: `3px solid ${tone}`, margin: 0 }}>
            <div className="mono" style={{ color: tone, opacity: 1 }}>{t}</div>
            <ul className="v4-cites" style={{ fontSize: 14 }}>{xs.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
        </div>
    ) : null
    const Analysis = ({ A }: any) => (
        <>
            {A.summary && <p style={{ fontSize: 15, lineHeight: 1.65, margin: "6px 0 12px" }}>{A.summary}</p>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
                <Col t="Permitted by right" xs={A.allowed} tone="var(--moss-hi)" />
                <Col t="Non-negotiable" xs={A.non_negotiables} tone="var(--oxblood-hi)" />
                <Col t="Negotiable / discretionary" xs={A.negotiables} tone="var(--ochre)" />
            </div>
            {(A.applications || []).length > 0 && <><div className="mono" style={{ marginTop: 14 }}>Approvals sequence</div><ol className="v4-cites" style={{ fontSize: 14 }}>{A.applications.map((x: string, i: number) => <li key={i}>{x}</li>)}</ol></>}
            {(A.conflicts || []).length > 0 && <><div className="mono" style={{ marginTop: 10, color: "var(--oxblood-hi)", opacity: 1 }}>Conflicts to verify</div><ul className="v4-cites" style={{ fontSize: 14 }}>{A.conflicts.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></>}
            {(A.questions || []).length > 0 && <><div className="r" style={{ marginTop: 10, justifyContent: "space-between" }}><span className="mono">Questions for the planner</span><button className="b g" onClick={() => copy(A.questions)}>Copy</button></div><ol className="v4-cites" style={{ fontSize: 14 }}>{A.questions.map((x: string, i: number) => <li key={i}>{x}</li>)}</ol></>}
            {(A.sheet_requirements || []).length > 0 && <><div className="mono" style={{ marginTop: 10 }}>Sheet requirements</div><ul className="v4-cites" style={{ fontSize: 14 }}>{A.sheet_requirements.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></>}
            {(A.sources || []).length > 0 && <><div className="mono" style={{ marginTop: 10 }}>Sources</div><ul className="v4-cites" style={{ fontSize: 13 }}>{A.sources.map((s: any, i: number) => <li key={i}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a> : s.title}{s.cited_for ? <small style={{ opacity: 0.6 }}> · {s.cited_for}</small> : null}</li>)}</ul></>}
        </>
    )
    return (
        <section className="v4">
            <div className="r" style={{ justifyContent: "space-between" }}>
                <div><div className="mono">Zoning & permit intelligence</div><h2 className="v4-h">What's allowed, what's fixed, what can be negotiated</h2></div>
                {picker}
            </div>
            {msg && <p className="v4-note">{msg}</p>}
            <div className="c v4-panel">
                <div className="r">
                    <select value={jur} onChange={(e) => setJur(e.target.value)} aria-label="Jurisdiction">
                        <option value="la_county">Unincorporated LA County (Regional Planning · DPW)</option>
                        <option value="ladbs">City of Los Angeles (City Planning · LADBS)</option>
                        <option value="nyc_dob">New York City (DOB · LPC)</option>
                    </select>
                    <label className="b g" style={{ cursor: "pointer" }}>Upload documents<input type="file" multiple hidden accept=".pdf,.docx,.txt,.md,.markdown,.html,.htm,.csv" onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = "" }} /></label>
                    <button className="b" onClick={analyze} disabled={!!busy || notes.trim().length < 40}>Analyze</button>
                    <button className="b g" onClick={quick} disabled={!notes.trim()}>Quick extract (no AI)</button>
                </div>
                <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
                    style={{ marginTop: 12, border: `1px dashed ${drag ? "var(--ochre)" : "color-mix(in srgb,var(--ink) 30%,transparent)"}`, padding: 14, background: drag ? "color-mix(in srgb,var(--ochre) 8%,transparent)" : "transparent" }}>
                    <div className="mono" style={{ marginBottom: 8 }}>Drop PDFs, Word docs or Markdown here · Google Docs: File › Download › PDF · Notion: ⋯ › Export › Markdown or PDF</div>
                    {files.length > 0 && <div className="r" style={{ marginBottom: 8 }}>{files.map((f) => <span key={f.name} className="v4-chip" style={{ borderColor: "var(--slate)" }}>{f.name} · {Math.round(f.chars / 1000)}k chars</span>)}<button className="b g" onClick={() => { setFiles([]); setNotes("") }}>Clear</button></div>}
                    <textarea rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="…or paste meeting notes here." style={{ width: "100%", fontSize: 15 }} />
                </div>
                {busy && <p className="v4-note">{busy}</p>}
            </div>

            {draft && (
                <div className="c v4-panel" style={{ borderColor: "var(--ochre)" }}>
                    <div className="r" style={{ justifyContent: "space-between" }}><span className="mono">New analysis · review, then save</span><div className="r"><button className="b g" onClick={() => setDraft(null)}>Discard</button><button className="b" onClick={save}>Save analysis</button></div></div>
                    <div className="v4-grid">
                        {[["zone_class", "Zone"], ["setback_front_ft", "Front yard ft"], ["setback_side_ft", "Side ft"], ["setback_rear_ft", "Rear ft"], ["height_cap_ft", "Height ft"], ["wall_height_cap_in", "Front fence/wall in"], ["transparency_pct", "Open %"], ["lot_area_sf", "Lot sf"], ["sheet_number", "Sheet no."]].map(([k, l]) => (
                            <label className="v4-field" key={k}><span className="mono">{l}</span><input value={draft[k] ?? ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} /></label>
                        ))}
                    </div>
                    <Analysis A={draft.analysis || {}} />
                </div>
            )}

            {audits.map((a) => {
                const A = a.analysis || {}
                const isOpen = open === a.id
                return (
                    <div key={a.id} className="c v4-panel">
                        <div className="r" style={{ justifyContent: "space-between" }}>
                            <button className="b g" onClick={() => setOpen(isOpen ? null : a.id)} style={{ textAlign: "left" }} aria-expanded={isOpen}>
                                {isOpen ? "▾" : "▸"} {a.zone_class || "Analysis"} {(a.overlays || []).length ? "· " + a.overlays.join(" · ") : ""} · {new Date(a.created_at).toLocaleDateString()}
                            </button>
                            <div className="r">
                                <span className="tag">{a.status}</span>
                                <button className="b g" onClick={() => sheet(a)}>Sheet {a.sheet_number || sheetNo}</button>
                                {a.status !== "issued" && <button className="b g" onClick={() => setStatus(a, a.status === "draft" ? "reviewed" : "issued")}>{a.status === "draft" ? "Mark reviewed" : "Issue to client"}</button>}
                            </div>
                        </div>
                        {isOpen && <div style={{ marginTop: 10 }}>
                            <Analysis A={A} />
                            {(a.source_files || []).length > 0 && <p className="v4-note">From: {a.source_files.join(", ")}</p>}
                            <div className="mono" style={{ marginTop: 12 }}>Proposed values for the sheet</div>
                            <div className="v4-grid">{[["front", "Front setback ft"], ["side", "Side ft"], ["rear", "Rear ft"], ["height", "Height ft"], ["wall_in", "Fence/wall in"], ["far_proposed", "FAR"]].map(([k, l]) => <label className="v4-field" key={k}><span className="mono">{l}</span><input value={prop[k] || ""} onChange={(e) => setProp({ ...prop, [k]: e.target.value })} /></label>)}</div>
                        </div>}
                    </div>
                )
            })}

            <details className="v4-acc">
                <summary><span>Reference library · {jur === "nyc_dob" ? "NYC" : jur === "ladbs" ? "City of LA" : "LA County"} · {refs.length}</span></summary>
                <p className="v4-note">Sheet naming: {SHEET_DEFAULT[jur]?.[0]} — {SHEET_DEFAULT[jur]?.[1]}. Items marked “to verify” are leads, not confirmed code.</p>
                {refs.map((r) => (
                    <div key={r.id} style={{ padding: "10px 0", borderTop: ".5px solid color-mix(in srgb,var(--ink) 15%,transparent)" }}>
                        <div className="r" style={{ gap: 8 }}><span className="tag">{r.topic}</span><b style={{ fontSize: 14 }}>{r.title}</b>{r.status !== "verified" && <span className="v4-chip" style={{ borderColor: "var(--ochre)" }}>to verify</span>}</div>
                        {r.body && <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: "6px 0 0", opacity: 0.85 }}>{r.body}</p>}
                        {r.url && <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{r.agency || "Source"} ↗</a>}
                    </div>
                ))}
            </details>
        </section>
    )
}

/* ───────────── 4 · SUB-CONSULTANT CRM & RFP MATRIX ───────────── */
const DISCIPLINES = ["structural", "civil", "geotech", "survey", "mep", "landscape"]
function ConsultantsCRM({ db, focus }: any) {
    const { pid, picker } = usePick(db, focus)
    const [cons, setCons] = React.useState<any[]>([])
    const [rfps, setRfps] = React.useState<any[]>([])
    const [props_, setProps] = React.useState<any[]>([])
    const [zoning, setZoning] = React.useState<any>(null)
    const [nc, setNc] = React.useState<any>({ discipline: "structural", firm: "", contact_name: "", email: "", phone: "", license_no: "" })
    const [np, setNp] = React.useState<any>({})
    const [msg, setMsg] = React.useState("")
    const load = React.useCallback(async () => {
        const [c, r, z] = await Promise.all([
            db.from("consultants").select("*").order("discipline").order("firm"),
            pid ? db.from("consultant_rfps").select("*").eq("project_id", pid).order("created_at", { ascending: false }) : { data: [] },
            pid ? db.from("project_zoning_audits").select("se_required,se_override,hillside,retaining_wall_max_ft").eq("project_id", pid).order("created_at", { ascending: false }).limit(1) : { data: [] },
        ])
        if ((c as any).error) setMsg((c as any).error.message)
        setCons(c.data || [])
        setRfps(r.data || [])
        setZoning((z.data || [])[0] || null)
        const ids = (r.data || []).map((x: any) => x.id)
        const p = ids.length ? await db.from("consultant_proposals").select("*").in("rfp_id", ids).order("fee") : { data: [] }
        setProps(p.data || [])
    }, [db, pid])
    React.useEffect(() => {
        load()
    }, [load])
    const seFlag = zoning && (zoning.se_override ?? zoning.se_required)
    async function addConsultant() {
        if (!nc.firm) return
        const { error } = await db.from("consultants").insert(nc)
        setMsg(error ? error.message : "Consultant added.")
        setNc({ ...nc, firm: "", contact_name: "", email: "", phone: "", license_no: "" })
        load()
    }
    async function newRfp(discipline = "structural", reason = "") {
        const { error } = await db.from("consultant_rfps").insert({
            project_id: pid,
            discipline,
            title: discipline === "structural" ? "Structural Engineer of Record — footing, masonry & seismic calcs, stamped S-sheets" : discipline + " consultant",
            trigger_reason: reason || null,
        })
        setMsg(error ? error.message : "RFP drafted.")
        load()
    }
    async function patchRfp(r: any, patch: any) {
        await db.from("consultant_rfps").update(patch).eq("id", r.id)
        load()
    }
    async function addProposal(r: any) {
        const x = np[r.id] || {}
        const c = cons.find((k) => k.id === x.consultant_id)
        if (!c && !x.firm_name) return setMsg("Pick a consultant or type a firm.")
        const { error } = await db.from("consultant_proposals").insert({
            rfp_id: r.id,
            consultant_id: c?.id || null,
            firm_name: c?.firm || x.firm_name,
            fee: x.fee ? +x.fee : null,
            fee_basis: x.fee_basis || "fixed",
            duration_weeks: x.duration_weeks ? +x.duration_weeks : null,
            inclusions: x.inclusions || null,
            exclusions: x.exclusions || null,
            insurance_note: x.insurance_note || null,
        })
        setMsg(error ? error.message : "Proposal added.")
        setNp({ ...np, [r.id]: {} })
        load()
    }
    async function patchProp(p: any, patch: any) {
        await db.from("consultant_proposals").update(patch).eq("id", p.id)
        load()
    }
    async function approve(p: any) {
        const { error } = await db.rpc("client_approve_proposal", { p_proposal: p.id })
        setMsg(error ? error.message : "Approved on the client's behalf — client contracts the consultant directly.")
        load()
    }
    const ROWS: [string, (p: any) => any][] = [
        ["Fee", (p) => (p.fee != null ? money(+p.fee) : "—") + (p.fee_basis ? " · " + p.fee_basis : "")],
        ["Duration", (p) => (p.duration_weeks ? p.duration_weeks + " wks" : "—")],
        ["Includes", (p) => p.inclusions || "—"],
        ["Excludes", (p) => p.exclusions || "—"],
        ["Insurance", (p) => p.insurance_note || "—"],
        ["Client sees", (p) => (p.client_visible ? "Yes" : "No")],
        ["Status", (p) => p.status],
    ]
    return (
        <section className="v4">
            <div className="r" style={{ justifyContent: "space-between" }}>
                <div>
                    <div className="mono">Sub-consultants</div>
                    <h2 className="v4-h">RFPs the client contracts directly</h2>
                </div>
                {picker}
            </div>
            <p className="v4-note">FELEMAYE stays lead designer and coordinates the work; the engineer is engaged and paid by the client, so engineering liability sits with the Engineer of Record.</p>
            <ConsultantDirectory db={db} cons={cons} reload={load} project={null} />
            {seFlag && (
                <div className="v4-alert v4-alert-block">
                    Structural Engineer Required — the latest zoning audit flags a hillside site or a retaining wall over 4 ft.
                    {!rfps.some((r) => r.discipline === "structural") && (
                        <button className="b" style={{ marginLeft: 12 }} onClick={() => newRfp("structural", zoning?.hillside ? "Hillside site" : "Retaining wall > 4 ft")}>
                            Draft structural RFP
                        </button>
                    )}
                </div>
            )}
            {msg && <p className="v4-note">{msg}</p>}
            <div className="r" style={{ margin: "8px 0 14px" }}>
                {DISCIPLINES.map((d) => (
                    <button key={d} className="b g" onClick={() => newRfp(d)}>
                        + {d} RFP
                    </button>
                ))}
            </div>
            {rfps.map((r) => {
                const P = props_.filter((p) => p.rfp_id === r.id)
                const x = np[r.id] || {}
                const set = (k: string, v: any) => setNp({ ...np, [r.id]: { ...x, [k]: v } })
                return (
                    <div key={r.id} className="c v4-panel">
                        <div className="r" style={{ justifyContent: "space-between" }}>
                            <div>
                                <span className="tag">{r.discipline}</span> <b>{r.title}</b> {r.trigger_reason && <small>· {r.trigger_reason}</small>}
                            </div>
                            <div className="r">
                            {r.status === "draft" && !P.length && <button className="b g" onClick={async () => { await db.from("consultant_rfps").delete().eq("id", r.id); load() }} aria-label="Remove empty RFP">✕</button>}
                            <select value={r.status} onChange={(e) => patchRfp(r, { status: e.target.value })} aria-label="RFP status">
                                {["draft", "sent", "comparing", "approved", "closed"].map((s) => (
                                    <option key={s}>{s}</option>
                                ))}
                            </select>
                            </div>
                        </div>
                        {P.length > 0 && (
                            <div className="tw">
                                <table className="v4-matrix">
                                    <thead>
                                        <tr>
                                            <th />
                                            {P.map((p) => (
                                                <th key={p.id} className={p.status === "approved" ? "won" : ""}>
                                                    {p.firm_name}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ROWS.map(([l, fn]) => (
                                            <tr key={l}>
                                                <th>{l}</th>
                                                {P.map((p) => (
                                                    <td key={p.id}>{fn(p)}</td>
                                                ))}
                                            </tr>
                                        ))}
                                        <tr>
                                            <th />
                                            {P.map((p) => (
                                                <td key={p.id}>
                                                    <div className="r">
                                                        <button className="b g" onClick={() => patchProp(p, { client_visible: !p.client_visible })}>
                                                            {p.client_visible ? "Hide from client" : "Show client"}
                                                        </button>
                                                        {p.status === "received" && (
                                                            <button className="b" onClick={() => approve(p)}>
                                                                Approve & direct contract
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="r" style={{ marginTop: 8 }}>
                            <select value={x.consultant_id || ""} onChange={(e) => set("consultant_id", e.target.value)} aria-label="Consultant">
                                <option value="">Consultant…</option>
                                {cons
                                    .filter((c) => c.discipline === r.discipline)
                                    .map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.firm}
                                        </option>
                                    ))}
                            </select>
                            {!x.consultant_id && <input placeholder="or firm name" value={x.firm_name || ""} onChange={(e) => set("firm_name", e.target.value)} />}
                            <input placeholder="Fee" inputMode="decimal" value={x.fee || ""} onChange={(e) => set("fee", e.target.value)} style={{ width: 100 }} />
                            <input placeholder="Weeks" inputMode="decimal" value={x.duration_weeks || ""} onChange={(e) => set("duration_weeks", e.target.value)} style={{ width: 80 }} />
                            <input placeholder="Includes" value={x.inclusions || ""} onChange={(e) => set("inclusions", e.target.value)} />
                            <input placeholder="Excludes" value={x.exclusions || ""} onChange={(e) => set("exclusions", e.target.value)} />
                            <button className="b g" onClick={() => addProposal(r)}>
                                + proposal
                            </button>
                        </div>
                    </div>
                )
            })}
            <details className="v4-acc">
                <summary>
                    <span>Add a consultant</span>
                </summary>
                <div className="r" style={{ margin: "10px 0" }}>
                    <select value={nc.discipline} onChange={(e) => setNc({ ...nc, discipline: e.target.value })} aria-label="Discipline">
                        {DISCIPLINES.map((d) => (
                            <option key={d}>{d}</option>
                        ))}
                    </select>
                    {(["firm", "contact_name", "email", "phone", "license_no"] as const).map((k) => (
                        <input key={k} placeholder={k.replace("_", " ")} value={nc[k]} onChange={(e) => setNc({ ...nc, [k]: e.target.value })} />
                    ))}
                    <button className="b" onClick={addConsultant}>
                        Add
                    </button>
                </div>
            </details>
        </section>
    )
}

/* ───────────── 5 · TRADE BOT QUEUE + STUDIO ADMIN DRIVE REFS ─────────────
   The button only QUEUES a job. The Playwright bot on the studio PC claims it with
   its own service key and reads EIN / CDTFA / NY certificate files from the local
   vault. It never solves CAPTCHAs: anything gated goes to needs_review for you. */
function TradeJobsPanel({ db }: any) {
    const [vendors, setVendors] = React.useState<any[]>([])
    const [jobs, setJobs] = React.useState<any[]>([])
    const [refs, setRefs] = React.useState<any[]>([])
    const [q, setQ] = React.useState("")
    const [vid, setVid] = React.useState("")
    const [kind, setKind] = React.useState("apply")
    const [nr, setNr] = React.useState<any>({ doc_kind: "cdtfa_permit", title: "", drive_url: "" })
    const [msg, setMsg] = React.useState("")
    const load = React.useCallback(async () => {
        const [v, j, r] = await Promise.all([
            db.from("vendors").select("id,name,tier").order("name"),
            db.from("trade_jobs").select("*").order("requested_at", { ascending: false }).limit(25),
            db.from("studio_drive_refs").select("*").order("doc_kind"),
        ])
        if (j.error) setMsg(j.error.message)
        setVendors(v.data || [])
        setJobs(j.data || [])
        setRefs(r.data || [])
    }, [db])
    React.useEffect(() => {
        load()
        const t = setInterval(load, 15000)
        return () => clearInterval(t)
    }, [load])
    async function queue() {
        if (!vid) return setMsg("Pick a vendor.")
        const { error } = await db.from("trade_jobs").insert({ vendor_id: vid, kind })
        setMsg(error ? (/duplicate|unique/i.test(error.message) ? "A job for this vendor is already open." : error.message) : "Queued — the studio PC bot picks it up on its next poll.")
        load()
    }
    async function cancel(j: any) {
        await db.from("trade_jobs").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", j.id)
        load()
    }
    async function addRef() {
        if (!nr.title || !nr.drive_url) return
        const id = (nr.drive_url.match(/[-\w]{25,}/) || [])[0] || null
        const { error } = await db.from("studio_drive_refs").insert({ ...nr, drive_file_id: id })
        setMsg(error ? error.message : "Reference saved (link only).")
        setNr({ ...nr, title: "", drive_url: "" })
        load()
    }
    const vName = (id: string) => vendors.find((v) => v.id === id)?.name || "—"
    const list = q ? vendors.filter((v) => v.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40) : vendors.slice(0, 40)
    const TONE: any = { queued: "var(--slate)", claimed: "var(--ochre)", running: "var(--ochre)", needs_review: "var(--oxblood)", done: "var(--moss)", failed: "var(--oxblood)", cancelled: "#666" }
    return (
        <section className="v4 c v4-panel" style={{ marginBottom: 16 }}>
            <div className="mono">Trade applications · studio PC bot</div>
            {msg && <p className="v4-note">{msg}</p>}
            <div className="r">
                <input placeholder="Find vendor" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find vendor" />
                <select value={vid} onChange={(e) => setVid(e.target.value)} aria-label="Vendor">
                    <option value="">Vendor…</option>
                    {list.map((v) => (
                        <option key={v.id} value={v.id}>
                            {v.name} {v.tier ? "· " + v.tier : ""}
                        </option>
                    ))}
                </select>
                <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Job type">
                    <option value="apply">Apply for trade account</option>
                    <option value="discover">Discover programme</option>
                    <option value="status_check">Check status</option>
                </select>
                <button className="b" onClick={queue}>
                    Run trade bot
                </button>
            </div>
            {jobs.length > 0 && (
                <div className="tw" style={{ marginTop: 10 }}>
                    <table>
                        <tbody>
                            {jobs.map((j) => (
                                <tr key={j.id}>
                                    <td>{vName(j.vendor_id)}</td>
                                    <td>{j.kind}</td>
                                    <td>
                                        <span className="v4-chip" style={{ borderColor: TONE[j.status] }}>
                                            {j.status.replace("_", " ")}
                                        </span>
                                    </td>
                                    <td>
                                        <small>{j.error || j.result?.note || ""}</small>
                                    </td>
                                    <td>
                                        <small>{new Date(j.requested_at).toLocaleString()}</small>
                                    </td>
                                    <td>{j.status === "queued" && <button className="b g" onClick={() => cancel(j)}>Cancel</button>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <details className="v4-acc" style={{ marginTop: 12 }}>
                <summary>
                    <span>Studio Admin · 03_STUDIO_OPERATIONS_&_SETUP · {refs.length} linked</span>
                </summary>
                <p className="v4-note">Links only. The documents (EIN letter, CDTFA permit, resale certificate, NY Certificate of Authority, W-9, COI) stay in Drive and in the bot's local vault.</p>
                <div className="r">
                    <select value={nr.doc_kind} onChange={(e) => setNr({ ...nr, doc_kind: e.target.value })} aria-label="Document type">
                        {["ein_letter", "cdtfa_permit", "resale_cert", "nys_cert_authority", "w9", "coi", "trade_app_template", "letterhead"].map((k) => (
                            <option key={k}>{k}</option>
                        ))}
                    </select>
                    <input placeholder="Title" value={nr.title} onChange={(e) => setNr({ ...nr, title: e.target.value })} />
                    <input placeholder="Drive link" value={nr.drive_url} onChange={(e) => setNr({ ...nr, drive_url: e.target.value })} />
                    <button className="b g" onClick={addRef}>
                        Link
                    </button>
                </div>
                <ul className="v4-cites">
                    {refs.map((r) => (
                        <li key={r.id}>
                            <span className="tag">{r.doc_kind}</span>{" "}
                            <a href={r.drive_url} target="_blank" rel="noreferrer">
                                {r.title} ↗
                            </a>
                        </li>
                    ))}
                </ul>
            </details>
        </section>
    )
}

/* ───────────── 6 · CLIENT EXPERIENCE PORTAL (client-safe) ─────────────
   Reads ONLY client-facing columns: phase progress, FF&E list/client prices,
   agreements, RFPs the client can see. No net cost, discounts, burn or reps. */
function ClientExperience({ db, focus, portalUrl }: any) {
    const { pid, picker, projects } = usePick(db, focus)
    const [d, setD] = React.useState<any>({ phases: [], ffe: [], env: [], rfps: [], props: [], slug: "" })
    const [live, setLive] = React.useState(false)
    React.useEffect(() => {
        if (!pid) return
        ;(async () => {
            const [p, ph, ffe, env, rf] = await Promise.all([
                db.from("projects").select("slug,client_slug,title").eq("id", pid).maybeSingle(),
                db.from("phases").select("id,seq,title,status,progress_pct,optional").eq("project_id", pid).order("seq"),
                db.from("procurement_ffe").select("id,room,item,vendor,qty,client_price,retail_msrp,client_status,image_url").eq("project_id", pid).eq("is_selected", true).order("room"),
                db.from("project_files").select("id,name,path,category,created_at").eq("project_id", pid).in("category", ["agreements", "contracts", "documents"]).order("created_at", { ascending: false }),
                db.from("consultant_rfps").select("id,title,discipline,status").eq("project_id", pid).neq("status", "draft"),
            ])
            const ids = (rf.data || []).map((r: any) => r.id)
            const pr = ids.length ? await db.from("consultant_proposals").select("id,rfp_id,firm_name,fee,fee_basis,duration_weeks,status").in("rfp_id", ids).eq("client_visible", true) : { data: [] }
            setD({ phases: ph.data || [], ffe: ffe.data || [], env: env.data || [], rfps: rf.data || [], props: pr.data || [], slug: p.data?.client_slug || p.data?.slug || "" })
        })()
    }, [db, pid])
    const core = d.phases.filter((p: any) => !p.optional)
    const cur = core.find((p: any) => p.status === "active")
    const done = core.filter((p: any) => p.status === "approved").length
    const overall = core.length ? Math.round((100 * (done + (cur ? 1 : 0))) / core.length) : 0
    // The portal honours ?c=<client-slug> for studio sessions (same Supabase session on felemaye.com).
    const suite = (portalUrl || "") + ((portalUrl || "").includes("?") ? "&" : "?") + "c=" + encodeURIComponent(d.slug)
    const ffeTotal = d.ffe.reduce((s: number, r: any) => s + (+r.client_price || +r.retail_msrp || 0) * (r.qty || 1), 0)
    return (
        <section className="v4">
            <div className="r" style={{ justifyContent: "space-between" }}>
                <div>
                    <div className="mono">Client experience portal · what {projects.find((p: any) => p.id === pid)?.title || "the client"} sees</div>
                    <h2 className="v4-h">Progress, selections, agreements</h2>
                </div>
                <div className="r">
                    {picker}
                    {d.slug && (
                        <>
                            <button className="b g" onClick={() => setLive(!live)}>
                                {live ? "Hide live portal" : "Show live portal"}
                            </button>
                            <a className="b" href={suite} target="_blank" rel="noreferrer">
                                Open as client ↗
                            </a>
                        </>
                    )}
                </div>
            </div>
            {live && d.slug && <iframe title="Client portal" src={suite} className="v4-frame" />}
            <div className="c v4-panel">
                <div className="r" style={{ justifyContent: "space-between" }}>
                    <span className="mono">Project progress</span>
                    <b>{overall}%</b>
                </div>
                <Meter value={overall} tone="var(--ochre)" label="Overall progress" />
                {cur && (
                    <p>
                        Phase {cur.seq} · {cur.title} — <b>{pct(cur.progress_pct)}</b> complete
                    </p>
                )}
                <ol className="v4-phases">
                    {d.phases.map((p: any) => (
                        <li key={p.id} data-s={p.status}>
                            <span>{p.title}</span>
                            <small>{p.status === "approved" ? "Approved" : p.status === "active" ? pct(p.progress_pct) : p.optional ? "Optional" : "Upcoming"}</small>
                        </li>
                    ))}
                </ol>
            </div>
            <div className="c v4-panel">
                <div className="r" style={{ justifyContent: "space-between" }}>
                    <span className="mono">FF&E selections · list prices</span>
                    <b>{money(ffeTotal)}</b>
                </div>
                <div className="tw">
                    <table>
                        <tbody>
                            {d.ffe.map((r: any) => (
                                <tr key={r.id}>
                                    <td>{r.room}</td>
                                    <td>
                                        <b>{r.item}</b>
                                        <br />
                                        <small>{r.vendor}</small>
                                    </td>
                                    <td>{r.qty}</td>
                                    <td>{money(+r.client_price || +r.retail_msrp || 0)}</td>
                                    <td>
                                        <span className="tag">{r.client_status || "proposed"}</span>
                                    </td>
                                </tr>
                            ))}
                            {!d.ffe.length && (
                                <tr>
                                    <td>No selections yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="c v4-panel">
                <span className="mono">Agreements & envelopes</span>
                <ul className="v4-cites">
                    {d.env.map((f: any) => (
                        <li key={f.id}>
                            {f.name} <small>· {new Date(f.created_at).toLocaleDateString()}</small>
                        </li>
                    ))}
                    {!d.env.length && <li>Nothing filed under agreements yet.</li>}
                </ul>
            </div>
            <div className="c v4-panel">
                <span className="mono">Consultant RFPs</span>
                {d.rfps.map((r: any) => (
                    <div key={r.id} style={{ marginTop: 8 }}>
                        <b>{r.title}</b> <span className="tag">{r.status}</span>
                        <ul className="v4-cites">
                            {d.props
                                .filter((p: any) => p.rfp_id === r.id)
                                .map((p: any) => (
                                    <li key={p.id}>
                                        {p.firm_name} — {p.fee != null ? money(+p.fee) : "—"} {p.duration_weeks ? "· " + p.duration_weeks + " wks" : ""} {p.status === "approved" && <b> · approved</b>}
                                    </li>
                                ))}
                        </ul>
                    </div>
                ))}
                {!d.rfps.length && <p className="v4-note">No RFPs shared yet.</p>}
            </div>
        </section>
    )
}

/** V4 design layer. Re-points the console's --paper/--ink/--accent at the Atelier palette and styles the V4 engines. */
function v4Css(t: { oxblood: string; ochre: string; slate: string; moss: string; bg: string }, dark: boolean) {
    return `@import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..700&display=swap');
.fys{--oxblood:${t.oxblood};--ochre:${t.ochre};--slate:${t.slate};--moss:${t.moss};--oxblood-hi:color-mix(in srgb,${t.oxblood} 55%,#fff);--moss-hi:color-mix(in srgb,${t.moss} 50%,#fff);--slate-hi:color-mix(in srgb,${t.slate} 50%,#fff)}
${
    dark
        ? `.fys.v4dark{--paper:${t.bg};--ink:#E8E1D4;--accent:${t.ochre};font-family:'Archivo','Helvetica Neue',Arial,sans-serif;font-stretch:88%}
.fys.v4dark .c,.fys.v4dark .card{background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012));border-color:rgba(232,225,212,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.05),inset 0 -1px 0 rgba(0,0,0,.5),0 1px 2px rgba(0,0,0,.4)}
.fys.v4dark h1,.fys.v4dark .v4-h{text-shadow:0 1px 0 rgba(0,0,0,.7),0 -1px 0 rgba(255,255,255,.06)}
.fys.v4dark .b{background:${t.ochre};color:#121212;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),inset 0 -1px 0 rgba(0,0,0,.25)}
.fys.v4dark .b.g{background:transparent;color:var(--ink);border-color:rgba(232,225,212,.35);box-shadow:none}
.fys.v4dark a{color:${t.ochre}}.fys.v4dark select option{background:#1b1b1b;color:#E8E1D4}
.fys.v4dark{min-height:100vh}.fys.v4dark h1{font-family:'Archivo','Helvetica Neue',Arial,sans-serif;font-stretch:78%;font-weight:500;letter-spacing:.02em}
.fys.v4dark .card[aria-pressed=true]{background:var(--ink);color:var(--paper);box-shadow:none}
.fys.v4dark a.b{color:#121212}`
        : ""
}
.fys .v4-h{font:500 clamp(22px,3vw,30px)/1.15 'Archivo','Helvetica Neue',Arial,sans-serif;font-stretch:82%;letter-spacing:.01em;margin:4px 0 14px}
.fys .v4-note{font-size:13px;opacity:.75;margin:6px 0 12px}
.fys .v4-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:8px 0 16px}
.fys .v4-kpi{padding:14px;border:.5px solid color-mix(in srgb,var(--ink) 18%,transparent);display:grid;gap:6px;background:color-mix(in srgb,var(--ink) 3%,transparent);box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
.fys .v4-kpi b{font:500 26px 'Archivo','Helvetica Neue',sans-serif;font-stretch:80%}.fys .v4-kpi small{opacity:.65;font-size:11.5px}
.fys .v4-meter{height:6px;background:color-mix(in srgb,var(--ink) 12%,transparent);overflow:hidden}.fys .v4-meter i{display:block;height:100%;transition:width .6s cubic-bezier(.2,.7,.2,1)}
.fys .v4-alert{display:inline-block;margin-left:8px;padding:2px 8px;background:var(--oxblood);color:#fff;font:600 10px/16px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase}
.fys .v4-alert-block{display:block;margin:8px 0;padding:10px 12px;font-size:11px}
.fys .v4-panel{margin-top:12px}.fys .v4-chip{display:inline-block;padding:3px 9px;border:1px solid;font-size:12px}
.fys .v4-cascade{display:flex;height:10px;margin-top:10px;gap:2px}.fys .v4-cascade i{display:block}
.fys .v4-acc{border:.5px solid color-mix(in srgb,var(--ink) 18%,transparent);margin:8px 0;padding:0 12px}.fys section.v4{margin-top:18px}.fys a.b{text-decoration:none;display:inline-block}.fys .v4 input[type=range]{accent-color:var(--ochre)}
.fys .v4-acc>summary{cursor:pointer;display:flex;align-items:center;gap:12px;padding:10px 0;list-style:none}.fys .v4-acc>summary>:first-child{margin-right:auto}
.fys .v4-acc>summary::-webkit-details-marker{display:none}.fys .v4-acc>summary:before{content:'›';margin-right:6px;transition:transform .2s;display:inline-block}.fys .v4-acc[open]>summary:before{transform:rotate(90deg)}
.fys .v4-acc2{border-style:dashed}.fys .v4-act{padding:6px 0 10px;border-top:.5px solid color-mix(in srgb,var(--ink) 10%,transparent)}
.fys .v4-acthead{display:flex;gap:8px;align-items:baseline}.fys .v4-acthead b{margin-left:auto}
.fys .v4-note-row{display:grid;grid-template-columns:96px 1fr 60px 40px;gap:8px;align-items:center;font-size:13px;padding:3px 0}
.fys .v4-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin:10px 0}.fys .v4-field{display:grid;gap:2px}
.fys .v4-cites{margin:8px 0;padding-left:18px;font-size:13px;line-height:1.5}
.fys .v4-matrix th{white-space:nowrap}.fys .v4-matrix th.won{color:var(--moss-hi)}
.fys .v4-frame{width:100%;height:78vh;border:.5px solid color-mix(in srgb,var(--ink) 25%,transparent);background:#000;margin:10px 0}
.fys .v4-phases{list-style:none;padding:0;margin:10px 0 0;display:grid;gap:4px}.fys .v4-phases li{display:flex;justify-content:space-between;padding:6px 0;border-bottom:.5px solid color-mix(in srgb,var(--ink) 12%,transparent)}
.fys .v4-phases li[data-s=active]{color:var(--ochre)}.fys .v4-phases li[data-s=locked]{opacity:.55}
.fys .v4-mode{display:inline-flex;border:.5px solid color-mix(in srgb,var(--ink) 40%,transparent)}.fys .v4-mode button{all:unset;cursor:pointer;padding:8px 14px;font:600 10px ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase}
.fys .v4-mode button[aria-pressed=true]{background:var(--ink);color:var(--paper)}.fys .v4-mode button:focus-visible{outline:2px solid var(--accent)}
@media(max-width:700px){.fys .v4-note-row{grid-template-columns:80px 1fr 48px 36px}}`
}

/* ════════════════════════════════════════════════════════════════════════════
   CADENCE STUDIO (2026-10-22b) — needs 20261022b_felemaye_cadence_experience.sql
   12-week planner (internal deadlines vs client touchpoints), live-review scheduling
   with the 3-part agenda, Friday update composer, presentation builder with A/B
   options, booking boundaries and the studio notification inbox.
   ════════════════════════════════════════════════════════════════════════════ */
const SOP_PARTS = [
    { key: "context", title: "Where we are", items: ["What the studio has completed since we last met", "How this milestone serves your goals for the courtyard"] },
    { key: "present", title: "The work", items: ["A short presentation of the design", "Any options side by side, with cost, code and design trade-offs"] },
    { key: "approve", title: "Decisions & next steps", items: ["Your decision and sign-off in the portal", "Confirm the date of our next review"] },
]
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const short = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
const lines = (t: string) => t.split(/\n/).map((x) => x.trim()).filter(Boolean)

function CadenceStudio({ db, focus }: any) {
    const { pid, picker } = usePick(db, focus)
    const [d, setD] = React.useState<any>({ cfg: null, weeks: [], dl: [], agendas: [], updates: [], pres: [], decisions: [], events: [], usage: null, booking: "" })
    const [view, setView] = React.useState<"plan" | "updates" | "presentations" | "inbox" | "settings">("plan")
    const [edit, setEdit] = React.useState<any>(null) // { kind: 'agenda'|'update'|'pres'|'schedule', row }
    const [msg, setMsg] = React.useState("")
    const load = React.useCallback(async () => {
        if (!pid) return
        const q = (t: string, f: (x: any) => any = (x) => x) => f(db.from(t).select("*").eq("project_id", pid)).then((r: any) => r.data || [])
        const [cfg, weeks, dl, agendas, updates, pres, decisions, events, usage, proj] = await Promise.all([
            db.from("project_cadence").select("*").eq("project_id", pid).maybeSingle().then((r: any) => { if (r.error) setMsg("Run 20261022b_felemaye_cadence_experience.sql first — " + r.error.message); return r.data }),
            q("project_weeks", (x) => x.order("week_no")),
            q("studio_deadlines", (x) => x.order("due_on")),
            q("meeting_agendas", (x) => x.order("created_at", { ascending: false })),
            q("async_updates", (x) => x.order("created_at", { ascending: false })),
            q("presentations", (x) => x.order("created_at", { ascending: false })),
            q("presentation_decisions", (x) => x.order("created_at", { ascending: false })),
            q("calendar_events", (x) => x.order("starts_at")),
            db.from("v_session_usage").select("*").eq("project_id", pid).maybeSingle().then((r: any) => r.data),
            db.from("projects").select("permit_progress").eq("id", pid).maybeSingle().then((r: any) => r.data),
        ])
        setD({ cfg, weeks, dl, agendas, updates, pres, decisions, events, usage, booking: proj?.permit_progress?.__booking_url || "" })
    }, [db, pid])
    React.useEffect(() => { load() }, [load])

    const today = new Date().toISOString().slice(0, 10)
    const kick = d.cfg?.kickoff_on
    const week = kick ? Math.max(0, Math.floor((Date.parse(today) - Date.parse(kick)) / (7 * 864e5)) + 1) : 0
    const overdue = d.dl.filter((x: any) => !x.done_at && x.due_on && x.due_on < today)
    const soon = d.dl.filter((x: any) => !x.done_at && x.due_on && x.due_on >= today && x.due_on <= addDays(today, 3))
    const evOf = (w: any) => d.events.find((e: any) => e.id === w.event_id)
    const agOf = (w: any) => d.agendas.find((a: any) => a.week_no === w.week_no)

    async function toggleDl(x: any) { await db.from("studio_deadlines").update({ done_at: x.done_at ? null : new Date().toISOString() }).eq("id", x.id); load() }
    async function addDl(w: any, title: string) { if (!title.trim()) return; await db.from("studio_deadlines").insert({ project_id: pid, week_no: w.week_no, title: title.trim(), due_on: addDays(kick, (w.week_no - 1) * 7 + 4) }); load() }
    async function patchWeek(w: any, patch: any) { await db.from("project_weeks").update(patch).eq("id", w.id); load() }

    async function schedule(w: any, when: string, mins: number, video: string, location: string, billable: boolean) {
        if (!when) return setMsg("Pick a date and time.")
        const start = new Date(when)
        const { data: ev, error } = await db.from("calendar_events").insert({
            project_id: pid, title: w ? (w.touchpoint_title || w.title) : "Advisory consultation", kind: w ? "milestone_review" : "advisory",
            starts_at: start.toISOString(), ends_at: new Date(start.getTime() + mins * 60e3).toISOString(), video_url: video || null, location: location || null,
            notes: w?.presentation ? "Presentation: " + w.presentation : null, billable,
        }).select().single()
        if (error) return setMsg(error.message)
        if (w) {
            await db.from("project_weeks").update({ event_id: ev.id }).eq("id", w.id)
            const ag = agOf(w)
            if (ag) await db.from("meeting_agendas").update({ event_id: ev.id }).eq("id", ag.id)
            else await db.from("meeting_agendas").insert({ project_id: pid, event_id: ev.id, week_no: w.week_no, title: w.title, parts: SOP_PARTS, decisions: w.approval_required ? [{ q: w.approval_required }] : [] })
        }
        setMsg("Scheduled — the client is notified and can add it to their calendar.")
        setEdit(null); load()
    }

    const usage = d.usage
    const Tab = (k: typeof view, l: string, n?: number) => <button className={"b" + (view === k ? "" : " g")} onClick={() => setView(k)}>{l}{n ? ` · ${n}` : ""}</button>
    return (
        <section className="v4">
            <div className="r" style={{ justifyContent: "space-between" }}>
                <div>
                    <div className="mono">Cadence · meetings · presentations</div>
                    <h2 className="v4-h">{kick ? `Week ${Math.min(Math.max(week, 0), d.cfg.weeks) || "—"} of ${d.cfg.weeks}` : "Set a kickoff date"}{kick && <small style={{ fontSize: 14, opacity: 0.6, marginLeft: 12 }}>kickoff {short(kick)}</small>}</h2>
                </div>
                {picker}
            </div>
            {msg && <p className="v4-note">{msg}</p>}
            {(overdue.length > 0 || soon.length > 0) && (
                <div className="c v4-panel" style={{ borderColor: overdue.length ? "var(--oxblood)" : "var(--ochre)" }}>
                    <div className="mono">Internal deadlines</div>
                    {overdue.map((x: any) => <div key={x.id} className="r" style={{ marginTop: 6 }}><span className="v4-alert" style={{ marginLeft: 0 }}>Overdue {short(x.due_on)}</span><span>{x.title}</span><button className="b g" onClick={() => toggleDl(x)}>Done</button></div>)}
                    {soon.map((x: any) => <div key={x.id} className="r" style={{ marginTop: 6 }}><span className="v4-chip" style={{ borderColor: "var(--ochre)" }}>Due {short(x.due_on)}</span><span>{x.title}</span><button className="b g" onClick={() => toggleDl(x)}>Done</button></div>)}
                </div>
            )}
            {usage && (
                <div className="v4-kpis">
                    <div className="v4-kpi"><span className="mono">Included sessions used</span><b>{usage.included_used} / {usage.included_sessions}</b><Meter value={usage.included_used} max={usage.included_sessions} tone="var(--moss)" label="Included sessions" /></div>
                    <div className="v4-kpi"><span className="mono">Billable advisory calls</span><b>{usage.advisory_sessions}</b><small>{usage.advisory_rate ? `${money(+usage.advisory_rate)}/h → final reconciliation` : "Set your advisory rate in Settings"}</small></div>
                    <div className="v4-kpi"><span className="mono">Friday notes posted</span><b>{d.updates.filter((u: any) => u.published_at).length}</b><small>{d.weeks.filter((w: any) => w.touchpoint === "async").length} off-weeks planned</small></div>
                </div>
            )}
            {d.cfg?.standing_weekday && (
                <div className="c v4-panel" style={{ borderColor: "var(--moss)" }}>
                    <div className="r" style={{ justifyContent: "space-between" }}>
                        <div><span className="mono">Client's standing review time</span><div style={{ fontSize: 16, marginTop: 4 }}>{["", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays"][d.cfg.standing_weekday]} at {d.cfg.standing_time} PT{d.cfg.standing_note ? <span style={{ opacity: 0.7 }}> · “{d.cfg.standing_note}”</span> : null}</div></div>
                        <button className="b" onClick={async () => {
                            const todo = d.weeks.filter((w: any) => w.touchpoint === "live" && !w.event_id)
                            for (const w of todo) {
                                const day = addDays(kick, (w.week_no - 1) * 7 + (d.cfg.standing_weekday - 1))
                                if (day < today) continue
                                await schedule(w, `${day}T${d.cfg.standing_time}`, 45, "", "", false)
                            }
                            setMsg(todo.length ? "Standing time applied to the unscheduled live reviews." : "Every live review already has a date.")
                        }}>Apply to unscheduled live reviews</button>
                    </div>
                </div>
            )}
            <div className="r" style={{ margin: "6px 0 12px" }}>
                {Tab("plan", "12-week plan")}{Tab("updates", "Friday notes")}{Tab("presentations", "Presentations", d.pres.length)}{Tab("inbox", "Inbox")}{Tab("settings", "Settings & booking")}
            </div>

            {view === "plan" && d.weeks.map((w: any) => {
                const ev = evOf(w), ag = agOf(w), dls = d.dl.filter((x: any) => x.week_no === w.week_no)
                return (
                    <div key={w.id} className="c v4-panel" style={{ borderLeft: `3px solid ${week === w.week_no ? "var(--ochre)" : w.touchpoint === "live" ? "var(--oxblood)" : "var(--slate)"}` }}>
                        <div className="r" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                                <span className="tag">W{w.week_no} · {kick ? short(addDays(kick, (w.week_no - 1) * 7)) : ""}</span> <span className="tag">P{w.phase_seq}</span>{" "}
                                <b>{w.title}</b>{week === w.week_no && <span className="v4-chip" style={{ marginLeft: 8, borderColor: "var(--ochre)" }}>this week</span>}
                                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }}>
                                    <div>
                                        <div className="mono">Internal · studio only</div>
                                        {dls.map((x: any) => (
                                            <label key={x.id} className="r" style={{ gap: 8, marginTop: 6, alignItems: "flex-start", flexWrap: "nowrap" }}>
                                                <input type="checkbox" checked={!!x.done_at} onChange={() => toggleDl(x)} style={{ minWidth: 16, marginTop: 3 }} />
                                                <span style={{ fontSize: 13, textDecoration: x.done_at ? "line-through" : "none", opacity: x.done_at ? 0.55 : 1 }}>{x.title} {x.due_on && <small style={{ opacity: 0.6 }}>· {short(x.due_on)}</small>}</span>
                                            </label>
                                        ))}
                                        <AddLine placeholder="+ internal deadline" onAdd={(t: string) => addDl(w, t)} />
                                    </div>
                                    <div>
                                        <div className="mono">Client touchpoint</div>
                                        <div style={{ fontSize: 13, marginTop: 6 }}>{w.touchpoint === "live" ? "● " : "○ "}{w.touchpoint_title}</div>
                                        {w.presentation && <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 4 }}>Presentation · {w.presentation}</div>}
                                        {w.approval_required && <div style={{ fontSize: 12.5, marginTop: 4, color: "var(--ochre)" }}>◆ {w.approval_required}</div>}
                                        {ev && <div style={{ fontSize: 12.5, marginTop: 6 }}>📅 {new Date(ev.starts_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>}
                                        {ag && <div style={{ fontSize: 12.5, marginTop: 4 }}>Agenda · <span className="tag">{ag.status}</span></div>}
                                    </div>
                                </div>
                            </div>
                            <div className="r" style={{ flex: "0 1 auto" }}>
                                <select value={w.status} onChange={(e) => patchWeek(w, { status: e.target.value })} aria-label="Week status">{["planned", "in_progress", "done", "moved"].map((s) => <option key={s}>{s}</option>)}</select>
                                {w.touchpoint === "live" && <button className="b g" onClick={() => setEdit({ kind: "schedule", row: w })}>{ev ? "Reschedule" : "Schedule"}</button>}
                                {w.touchpoint === "live" && <button className="b g" onClick={() => setEdit({ kind: "agenda", row: ag || { project_id: pid, week_no: w.week_no, title: w.title, parts: SOP_PARTS, decisions: w.approval_required ? [{ q: w.approval_required }] : [], status: "draft", event_id: w.event_id } })}>Agenda</button>}
                                {w.touchpoint === "async" && <button className="b g" onClick={() => setEdit({ kind: "update", row: d.updates.find((u: any) => u.week_no === w.week_no) || { project_id: pid, week_no: w.week_no, title: `Week ${w.week_no} · ${w.title}`, highlights: [] } })}>Friday note</button>}
                                {w.touchpoint === "live" && <button className="b g" onClick={() => setEdit({ kind: "pres", row: d.pres.find((x: any) => x.week_no === w.week_no) || { project_id: pid, week_no: w.week_no, phase_seq: w.phase_seq, title: w.presentation ? w.title : w.title, subtitle: w.touchpoint_title, slides: [], options: [], decision_prompt: w.approval_required || "" } })}>Presentation</button>}
                            </div>
                        </div>
                    </div>
                )
            })}

            {view === "updates" && (
                <>
                    <button className="b" onClick={() => setEdit({ kind: "update", row: { project_id: pid, week_no: week || 1, title: `Week ${week || 1} · Studio update`, highlights: [] } })}>+ New Friday note</button>
                    {d.updates.map((u: any) => (
                        <div key={u.id} className="c v4-panel">
                            <div className="r" style={{ justifyContent: "space-between" }}>
                                <div><span className="tag">W{u.week_no}</span> <b>{u.title}</b> <small style={{ opacity: 0.6 }}>{u.published_at ? "published " + new Date(u.published_at).toLocaleDateString() : "draft"}</small></div>
                                <button className="b g" onClick={() => setEdit({ kind: "update", row: u })}>Edit</button>
                            </div>
                        </div>
                    ))}
                </>
            )}

            {view === "presentations" && (
                <>
                    <button className="b" onClick={() => setEdit({ kind: "pres", row: { project_id: pid, title: "", slides: [], options: [], decision_prompt: "" } })}>+ New presentation</button>
                    {d.pres.map((pr: any) => {
                        const ds = d.decisions.filter((x: any) => x.presentation_id === pr.id)
                        return (
                            <div key={pr.id} className="c v4-panel">
                                <div className="r" style={{ justifyContent: "space-between" }}>
                                    <div><span className="tag">{pr.status}</span> <b>{pr.title}</b> <small style={{ opacity: 0.6 }}>{(pr.slides || []).length} slides · {(pr.options || []).length} options</small>
                                        {ds[0] && <span className="v4-chip" style={{ marginLeft: 8, borderColor: "var(--moss)" }}>Client chose {ds[0].option_key}{ds[0].comment ? ` — “${ds[0].comment}”` : ""}</span>}</div>
                                    <button className="b g" onClick={() => setEdit({ kind: "pres", row: pr })}>Edit</button>
                                </div>
                            </div>
                        )
                    })}
                </>
            )}

            {view === "inbox" && <StudioInbox db={db} />}

            {view === "settings" && <CadenceSettings db={db} pid={pid} cfg={d.cfg} booking={d.booking} reload={load} setMsg={setMsg} schedule={schedule} />}

            {edit?.kind === "schedule" && <ScheduleForm w={edit.row} onClose={() => setEdit(null)} onSave={schedule} />}
            {edit?.kind === "agenda" && <AgendaEditor db={db} row={edit.row} onClose={() => { setEdit(null); load() }} />}
            {edit?.kind === "update" && <UpdateEditor db={db} pid={pid} row={edit.row} onClose={() => { setEdit(null); load() }} />}
            {edit?.kind === "pres" && <PresentationEditor db={db} pid={pid} row={edit.row} onClose={() => { setEdit(null); load() }} />}
        </section>
    )
}

function AddLine({ placeholder, onAdd }: any) {
    const [t, setT] = React.useState("")
    return <input value={t} placeholder={placeholder} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { onAdd(t); setT("") } }} style={{ width: "100%", fontSize: 13, marginTop: 6 }} />
}

function Drawer({ title, onClose, children }: any) {
    React.useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k) }, [onClose])
    return (
        <div role="dialog" aria-modal="true" aria-label={title} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.55)", display: "flex", justifyContent: "flex-end" }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div style={{ width: "min(640px,100vw)", height: "100%", overflow: "auto", background: "var(--paper)", color: "var(--ink)", borderLeft: ".5px solid color-mix(in srgb,var(--ink) 25%,transparent)", padding: "22px 22px 60px" }}>
                <div className="r" style={{ justifyContent: "space-between" }}><div className="v4-h" style={{ margin: 0 }}>{title}</div><button className="b g" onClick={onClose}>Close ✕</button></div>
                {children}
            </div>
        </div>
    )
}

function ScheduleForm({ w, onClose, onSave }: any) {
    const [when, setWhen] = React.useState(""), [mins, setMins] = React.useState(45), [video, setVideo] = React.useState(""), [loc, setLoc] = React.useState(""), [bill, setBill] = React.useState(!w)
    return (
        <Drawer title={w ? `Schedule · ${w.touchpoint_title}` : "Schedule an advisory call"} onClose={onClose}>
            <div className="v4-grid" style={{ gridTemplateColumns: "1fr" }}>
                <label className="v4-field"><span className="mono">Date & time (your local time)</span><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
                <label className="v4-field"><span className="mono">Length</span><select value={mins} onChange={(e) => setMins(+e.target.value)}>{[30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
                <label className="v4-field"><span className="mono">Video link</span><input value={video} onChange={(e) => setVideo(e.target.value)} placeholder="Google Meet / Zoom" /></label>
                <label className="v4-field"><span className="mono">Location (if in person)</span><input value={loc} onChange={(e) => setLoc(e.target.value)} /></label>
                <label className="r" style={{ gap: 8 }}><input type="checkbox" checked={bill} onChange={(e) => setBill(e.target.checked)} /> Billable advisory session (outside included milestone reviews)</label>
            </div>
            <p className="v4-note">Creates the calendar event, links it to the week and drafts the 3-part agenda. The client gets a notification; send the calendar invite from Google Calendar as usual.</p>
            <button className="b" onClick={() => onSave(w, when, mins, video, loc, bill)}>Schedule</button>
        </Drawer>
    )
}

function AgendaEditor({ db, row, onClose }: any) {
    const [a, setA] = React.useState<any>({ ...row, parts: (row.parts?.length ? row.parts : SOP_PARTS).map((p: any) => ({ ...p, text: (p.items || []).join("\n") })), dtext: (row.decisions || []).map((x: any) => x.q).join("\n"), next: row.next_meeting_at ? row.next_meeting_at.slice(0, 16) : "" })
    const [msg, setMsg] = React.useState("")
    async function save(status?: string) {
        const body: any = {
            project_id: a.project_id, week_no: a.week_no, event_id: a.event_id || null, title: a.title,
            parts: a.parts.map((p: any) => ({ key: p.key, title: p.title, items: lines(p.text) })),
            decisions: lines(a.dtext).map((q) => ({ q, outcome: (row.decisions || []).find((x: any) => x.q === q)?.outcome || null })),
            summary: a.summary || null, next_meeting_at: a.next ? new Date(a.next).toISOString() : null,
        }
        if (status) { body.status = status; if (status === "shared") body.shared_at = new Date().toISOString() }
        const r = a.id ? await db.from("meeting_agendas").update(body).eq("id", a.id) : await db.from("meeting_agendas").insert(body)
        if (r.error) return setMsg(r.error.message)
        onClose()
    }
    return (
        <Drawer title="Agenda" onClose={onClose}>
            <label className="v4-field"><span className="mono">Title</span><input value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} /></label>
            {a.parts.map((p: any, i: number) => (
                <div key={i} className="c v4-panel">
                    <div className="r"><input value={p.title} onChange={(e) => { const ps = [...a.parts]; ps[i] = { ...p, title: e.target.value }; setA({ ...a, parts: ps }) }} style={{ flex: 1 }} aria-label="Part title" />
                        </div>
                    <textarea rows={3} value={p.text} onChange={(e) => { const ps = [...a.parts]; ps[i] = { ...p, text: e.target.value }; setA({ ...a, parts: ps }) }} style={{ width: "100%", marginTop: 8 }} aria-label="Talking points, one per line" />
                </div>
            ))}
            <label className="v4-field" style={{ marginTop: 12 }}><span className="mono">Decisions to make (one per line)</span><textarea rows={2} value={a.dtext} onChange={(e) => setA({ ...a, dtext: e.target.value })} /></label>
            <div className="r" style={{ marginTop: 14 }}>
                <button className="b g" onClick={() => save()}>Save draft</button>
                {(a.status || "draft") === "draft" && <button className="b" onClick={() => save("shared")}>Share with client</button>}
            </div>
            <div className="c v4-panel">
                <div className="mono">After the meeting</div>
                <textarea rows={5} placeholder="Recap: what we decided, what happens next" value={a.summary || ""} onChange={(e) => setA({ ...a, summary: e.target.value })} style={{ width: "100%", marginTop: 8 }} />
                <label className="v4-field" style={{ marginTop: 8 }}><span className="mono">Next milestone review</span><input type="datetime-local" value={a.next} onChange={(e) => setA({ ...a, next: e.target.value })} /></label>
                <button className="b" style={{ marginTop: 10 }} onClick={() => save("held")}>Post recap to client</button>
            </div>
            {msg && <p className="v4-note">{msg}</p>}
        </Drawer>
    )
}

/* ── Brand print layer: Friday Progress Note + Welcome Kit (Letter, cream paper, Cormorant + Inter) ──
   Workflow that adds no new tools: drop 2–4 images you already make that week (Revit / Enscape views,
   site photos, marked-up sheets), write three lines, Publish. The client sees it in the portal; "Print / PDF"
   gives the same note as a branded one-pager for email or the binder. */
const BRAND = { paper: "#F4EFE4", ink: "#2B2B28", accent: "#8C6F52", line: "#D9CFBD", soft: "#6E675C" }
const escH = (v: any) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[c])
const PRINT_HEAD = (title: string) => `<!doctype html><html><head><meta charset="utf-8"><title>${escH(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>@page{size:letter;margin:0}*{box-sizing:border-box}html,body{margin:0;background:${BRAND.paper};color:${BRAND.ink};-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:300 11.5pt/1.6 Inter,system-ui,sans-serif}.pg{width:8.5in;min-height:11in;padding:.7in .75in .6in;position:relative;page-break-after:always;display:flex;flex-direction:column}.pg:last-child{page-break-after:auto}
.mono{font:500 7.5pt/1.4 'IBM Plex Mono',monospace;letter-spacing:.22em;text-transform:uppercase;color:${BRAND.soft}}
.wm{font:500 13pt 'Cormorant Garamond',serif;letter-spacing:.42em;color:${BRAND.accent}}
h1{font:400 34pt/1.05 'Cormorant Garamond',serif;margin:.18in 0 .12in;letter-spacing:.005em}h2{font:400 20pt/1.15 'Cormorant Garamond',serif;margin:0 0 .1in}
h3{font:500 7.5pt 'IBM Plex Mono',monospace;letter-spacing:.22em;text-transform:uppercase;color:${BRAND.accent};margin:.28in 0 .08in}
.rule{height:1px;background:${BRAND.line};margin:.16in 0}.hd{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid ${BRAND.line};padding-bottom:.12in}
.ft{margin-top:auto;display:flex;justify-content:space-between;border-top:1px solid ${BRAND.line};padding-top:.1in}
.lead{font:400 15pt/1.5 'Cormorant Garamond',serif;margin:0}
.imgs{display:grid;gap:.12in;margin:.22in 0 .05in}.imgs figure{margin:0}.imgs img{width:100%;height:100%;object-fit:cover;display:block;background:#E7DFD1}
.imgs figcaption{font:400 8.5pt/1.4 Inter;color:${BRAND.soft};margin-top:.05in}
ul.dash{list-style:none;padding:0;margin:0}ul.dash li{padding:.06in 0 .06in .22in;position:relative;border-bottom:1px solid ${BRAND.line}}ul.dash li:before{content:'—';position:absolute;left:0;color:${BRAND.accent}}
table{width:100%;border-collapse:collapse;font-size:9.5pt}td,th{text-align:left;vertical-align:top;padding:.07in .08in;border-bottom:1px solid ${BRAND.line}}th{font:500 7pt 'IBM Plex Mono';letter-spacing:.18em;text-transform:uppercase;color:${BRAND.soft}}
.two{display:grid;grid-template-columns:1fr 1fr;gap:.35in}.cover{justify-content:center}.cover h1{font-size:54pt}.box{border:1px solid ${BRAND.line};padding:.16in .2in}
.sig{font:italic 400 16pt 'Cormorant Garamond',serif;margin-top:.2in}
@media screen{body{background:#cfc8bb}.pg{margin:.3in auto;box-shadow:0 10px 40px rgba(0,0,0,.18);background:${BRAND.paper}}}</style></head><body>`
const PRINT_TAIL = `<script>Promise.all([document.fonts?document.fonts.ready:0,...[...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r}))]).then(()=>setTimeout(()=>print(),350))</script></body></html>`
function openPrint(html: string, setMsg?: (s: string) => void) {
    const w = window.open("", "_blank")
    if (!w) return setMsg && setMsg("Allow pop-ups to open the print view.")
    w.document.write(html); w.document.close()
}
async function signAll(db: any, paths: string[]) {
    const out: Record<string, string> = {}
    await Promise.all(paths.map(async (p) => { const { data } = await db.storage.from("project-files").createSignedUrl(p, 3600); out[p] = data?.signedUrl || "" }))
    return out
}
function fridayNoteHtml(project: any, u: any, urls: Record<string, string>, nextReview?: string) {
    const imgs = (u.images || []).filter((x: any) => urls[x.path])
    const grid = imgs.length === 1 ? "grid-template-columns:1fr;height:4.1in" : imgs.length === 2 ? "grid-template-columns:1fr 1fr;height:3.1in" : "grid-template-columns:1.6fr 1fr;grid-template-rows:1fr 1fr;height:3.9in"
    const fig = (x: any, i: number) => `<figure style="${imgs.length >= 3 && i === 0 ? "grid-row:span 2" : ""};min-height:0;display:flex;flex-direction:column"><div style="flex:1;min-height:0"><img src="${urls[x.path]}" alt=""></div>${x.caption ? `<figcaption>${escH(x.caption)}</figcaption>` : ""}</figure>`
    const date = new Date(u.published_at || Date.now()).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    return PRINT_HEAD(`Friday Progress Note · ${u.title}`) + `<section class="pg">
<div class="hd"><span class="wm">FELEMAYE</span><span class="mono">Friday Progress Note${u.week_no ? ` · Week ${String(u.week_no).padStart(2, "0")}` : ""}</span></div>
<div class="mono" style="margin-top:.22in">${escH(project?.title)} · ${escH(project?.address)}</div>
<h1>${escH(u.title)}</h1><div class="mono">${escH(date)}</div>
${u.body ? `<div class="rule"></div><p class="lead">${escH(u.body).replace(/\n/g, "<br>")}</p>` : ""}
${imgs.length ? `<div class="imgs" style="${grid}">${imgs.slice(0, 3).map(fig).join("")}</div>` : ""}
<div class="two" style="margin-top:.1in">
 <div>${(u.highlights || []).length ? `<h3>This week in the studio</h3><ul class="dash">${u.highlights.map((h: string) => `<li>${escH(h)}</li>`).join("")}</ul>` : ""}</div>
 <div>${u.next_up ? `<h3>Next</h3><p style="margin:0">${escH(u.next_up)}</p>` : ""}${nextReview ? `<h3>Your next review</h3><p style="margin:0">${escH(nextReview)}</p>` : ""}${u.asks ? `<h3>From you</h3><p style="margin:0">${escH(u.asks)}</p>` : ""}</div>
</div>
<div class="ft"><span class="mono">Felema Yemaneberhan · FELEMAYE LLC</span><span class="mono">felemaye.com</span></div></section>` + PRINT_TAIL
}

function UpdateEditor({ db, pid, row, onClose }: any) {
    const [u, setU] = React.useState<any>({ ...row, images: row.images || [], htext: (row.highlights || []).join("\n") })
    const [file, setFile] = React.useState<File | null>(null)
    const [busy, setBusy] = React.useState(false)
    const [thumbs, setThumbs] = React.useState<Record<string, string>>({})
    const [msg, setMsg] = React.useState("")
    React.useEffect(() => { const ps = (u.images || []).map((x: any) => x.path).filter((p: string) => !thumbs[p]); if (ps.length) signAll(db, ps).then((m) => setThumbs((t) => ({ ...t, ...m }))) }, [u.images])
    async function addImages(list: FileList | null) {
        if (!list?.length) return
        setBusy(true)
        const add: any[] = []
        for (const f of Array.from(list).slice(0, 6)) {
            if (f.size > 20 * 1024 * 1024) { setMsg(f.name + " is over 20 MB"); continue }
            const path = `${pid}/studio/updates/${Date.now()}_${f.name.replace(/[^\w.\-]+/g, "_").slice(-80)}`
            const up = await db.storage.from("project-files").upload(path, f)
            if (up.error) setMsg(up.error.message); else add.push({ path, caption: "" })
        }
        setU((x: any) => ({ ...x, images: [...(x.images || []), ...add] })); setBusy(false)
    }
    const setImg = (i: number, patch: any) => setU({ ...u, images: u.images.map((x: any, k: number) => (k === i ? { ...x, ...patch } : x)) })
    function payload(publish: boolean, file_path: string | null) {
        const body: any = { project_id: pid, week_no: +u.week_no || null, title: u.title, body: u.body || null, highlights: lines(u.htext), video_url: u.video_url || null, next_up: u.next_up || null, file_path, images: u.images || [] }
        if (publish && !u.published_at) body.published_at = new Date().toISOString()
        return body
    }
    async function save(publish: boolean) {
        let file_path = u.file_path || null
        if (file) {
            const path = `${pid}/studio/updates/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_").slice(-80)}`
            const up = await db.storage.from("project-files").upload(path, file)
            if (up.error) return setMsg(up.error.message)
            file_path = path
        }
        let r = u.id ? await db.from("async_updates").update(payload(publish, file_path)).eq("id", u.id) : await db.from("async_updates").insert(payload(publish, file_path))
        if (r.error && /images/.test(r.error.message || "")) { const { images, ...b } = payload(publish, file_path); r = u.id ? await db.from("async_updates").update(b).eq("id", u.id) : await db.from("async_updates").insert(b) }
        if (r.error) return setMsg(r.error.message)
        onClose()
    }
    async function preview() {
        const [{ data: project }, { data: ev }] = await Promise.all([
            db.from("projects").select("title,address").eq("id", pid).maybeSingle(),
            db.from("calendar_events").select("title,starts_at").eq("project_id", pid).gte("starts_at", new Date().toISOString()).order("starts_at").limit(1),
        ])
        const urls = await signAll(db, (u.images || []).map((x: any) => x.path))
        const next = ev?.[0] ? `${ev[0].title} — ${new Date(ev[0].starts_at).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} PT` : ""
        openPrint(fridayNoteHtml(project, { ...u, highlights: lines(u.htext) }, urls, next), setMsg)
    }
    return (
        <Drawer title="Friday progress note" onClose={onClose}>
            <p className="v4-note">About ten minutes with what you already have: two to four images from the week (Revit or Enscape views, site photos, a marked-up sheet), a short note, three highlights. The client reads it in the portal; Print / PDF gives the same note as a branded one-pager. No video is promised.</p>
            <div className="v4-grid" style={{ gridTemplateColumns: "90px 1fr" }}>
                <label className="v4-field"><span className="mono">Week</span><input type="number" value={u.week_no || ""} onChange={(e) => setU({ ...u, week_no: e.target.value })} /></label>
                <label className="v4-field"><span className="mono">Title</span><input value={u.title} onChange={(e) => setU({ ...u, title: e.target.value })} placeholder="Site measured, County research under way" /></label>
            </div>
            <label className="v4-field"><span className="mono">Note</span><textarea rows={5} value={u.body || ""} onChange={(e) => setU({ ...u, body: e.target.value })} placeholder="Two or three sentences in your voice: what moved this week and why it matters for the courtyard." /></label>
            <div className="c v4-panel">
                <div className="r" style={{ justifyContent: "space-between" }}><span className="mono">Images · {(u.images || []).length}</span><label className="b g" style={{ cursor: "pointer" }}>{busy ? "Uploading…" : "+ Add images"}<input type="file" accept="image/*" multiple hidden onChange={(e) => { addImages(e.target.files); e.currentTarget.value = "" }} /></label></div>
                {(u.images || []).map((x: any, i: number) => (
                    <div key={x.path} className="r" style={{ marginTop: 8, flexWrap: "nowrap" }}>
                        <span style={{ width: 64, height: 48, flex: "none", background: "color-mix(in srgb,var(--ink) 10%,transparent)", overflow: "hidden" }}>{thumbs[x.path] && <img src={thumbs[x.path]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</span>
                        <input value={x.caption || ""} placeholder="Caption (e.g. Revit massing — Option B, street view)" onChange={(e) => setImg(i, { caption: e.target.value })} style={{ flex: 1 }} />
                        <button className="b g" onClick={() => setU({ ...u, images: u.images.filter((_: any, k: number) => k !== i) })} aria-label="Remove image">✕</button>
                    </div>
                ))}
            </div>
            <label className="v4-field" style={{ marginTop: 10 }}><span className="mono">Highlights (one per line)</span><textarea rows={3} value={u.htext} onChange={(e) => setU({ ...u, htext: e.target.value })} /></label>
            <label className="v4-field" style={{ marginTop: 10 }}><span className="mono">Next</span><input value={u.next_up || ""} onChange={(e) => setU({ ...u, next_up: e.target.value })} placeholder="Massing options A and B for our kickoff call" /></label>
            <details style={{ marginTop: 10 }}><summary className="mono" style={{ cursor: "pointer" }}>Optional: video link · PDF attachment</summary>
                <label className="v4-field" style={{ marginTop: 10 }}><span className="mono">Video link (only if you recorded one)</span><input value={u.video_url || ""} onChange={(e) => setU({ ...u, video_url: e.target.value })} /></label>
                <label className="v4-field" style={{ marginTop: 10 }}><span className="mono">Attach a PDF</span><input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
            </details>
            <div className="r" style={{ marginTop: 14 }}>
                <button className="b g" onClick={() => save(false)}>Save draft</button>
                <button className="b g" onClick={preview}>Print / PDF</button>
                <button className="b" onClick={() => save(true)}>{u.published_at ? "Save" : "Publish to client"}</button>
            </div>
            {msg && <p className="v4-note">{msg}</p>}
        </Drawer>
    )
}

/* ── Welcome Kit: generated from the project's own data, edited here, printed as a branded PDF ── */
const KIT_NEEDS = [
    "Any existing survey, plot plan, or prior permit drawings of the house",
    "Title report or grant deed (shows the legal description and any easements)",
    "Photos of the front yard, gate and facade you love — and anything you'd change",
    "Utility locations you know of (sprinkler lines, gas, low-voltage lighting)",
    "Your preferred standing review day and time (choose it in the portal)",
    "Your structural engineer choice once proposals are in — you'll contract them directly",
]
function welcomeKitHtml(k: any) {
    const p = k.project || {}, c = k.cfg || {}
    const DAYS = ["", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays"]
    const wkDate = (n: number) => { if (!c.kickoff_on) return ""; const d = new Date(c.kickoff_on + "T12:00:00"); d.setDate(d.getDate() + (n - 1) * 7); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) }
    const PH = ["", "Pre-Design & Site Feasibility", "Schematic Design", "Design Development", "Construction Documents & Permit"]
    const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    const head = (label: string) => `<div class="hd"><span class="wm">FELEMAYE</span><span class="mono">${escH(label)}</span></div>`
    const foot = (n: number) => `<div class="ft"><span class="mono">${escH(p.title)} · Welcome Kit</span><span class="mono">${n}</span></div>`
    return PRINT_HEAD(`Welcome Kit · ${p.title}`) + `
<section class="pg cover"><div class="wm" style="font-size:16pt">FELEMAYE</div>
<h1 style="margin-top:.5in">Welcome<br>to ${escH(p.title)}</h1>
<div class="mono" style="margin-top:.2in">${escH(p.address)}</div><div class="rule" style="width:1.4in;background:${BRAND.accent}"></div>
<div class="mono">Prepared for ${escH(k.clientName)} · ${escH(date)}</div>
<div class="ft" style="margin-top:auto"><span class="mono">Architectural design studio · Los Angeles</span><span class="mono">felemaye.com</span></div></section>

<section class="pg">${head("A note from the studio")}
<h2 style="margin-top:.3in">Dear ${escH(String(k.clientName).split(" ")[0])},</h2>
${String(k.letter || "").split(/\n\n+/).map((t: string) => `<p class="lead" style="font-size:13.5pt;margin:0 0 .16in">${escH(t)}</p>`).join("")}
<div class="sig">Felema Yemaneberhan</div><div class="mono">Principal · FELEMAYE LLC</div>
${foot(2)}</section>

<section class="pg">${head("How we'll work together")}
<h2 style="margin-top:.3in">Our rhythm</h2><p>${escH(String(c.cadence_note || "").replace(/ posted here /, " posted to your portal ").replace(/ update here /, " update to your portal "))}</p>
<div class="two">
 <div class="box"><h3 style="margin-top:0">Live reviews</h3><p style="margin:0">At each decision milestone, about every two to three weeks${c.standing_weekday ? `, held on ${DAYS[c.standing_weekday]} at ${escH(c.standing_time)} PT` : ""}. Each review follows the same shape: where we are, the work, and the decisions we make together.</p></div>
 <div class="box"><h3 style="margin-top:0">Friday progress notes</h3><p style="margin:0">On the weeks between reviews, a short note with images from the studio is posted to your portal every Friday — so you always know where things stand without setting time aside.</p></div>
 <div class="box"><h3 style="margin-top:0">Your portal</h3><p style="margin:0">Roadmap, presentations, decisions, files and invoices live in one place: <b>${escH(k.portalUrl)}</b>. Notifications appear under “Updates”.</p></div>
 <div class="box"><h3 style="margin-top:0">Time outside the reviews</h3><p style="margin:0">${escH(c.booking_note || "")}${c.advisory_rate ? ` The current advisory rate is $${Math.round(+c.advisory_rate)} per hour.` : ""}</p></div>
</div>
<h3>Reaching the studio</h3><p style="margin:0">${escH(k.contactNote)}</p>
${foot(3)}</section>

<section class="pg">${head("Your roadmap")}
<h2 style="margin-top:.3in">Twelve weeks, four phases</h2>
<table><tr><th>Week</th><th>Phase</th><th>In the studio</th><th>With you</th></tr>
${(k.weeks || []).map((w: any) => `<tr><td style="white-space:nowrap">${String(w.week_no).padStart(2, "0")} · ${wkDate(w.week_no)}</td><td>${escH(PH[w.phase_seq] || "")}</td><td>${escH(w.title)}</td><td>${escH(w.touchpoint_title || "")}${w.approval_required ? `<br><span style="color:${BRAND.accent}">◆ ${escH(w.approval_required)}</span>` : ""}</td></tr>`).join("")}
</table>
${foot(4)}</section>

<section class="pg">${head("What we need from you")}
<h2 style="margin-top:.3in">To start well</h2><ul class="dash">${(k.needs || []).map((n: string) => `<li>${escH(n)}</li>`).join("")}</ul>
<p style="margin-top:.16in">Drop anything into the shared folder or the Files tab in your portal${k.dropUrl ? ` (<b>${escH(k.dropUrl)}</b>)` : ""}. Photos from your phone are perfect.</p>
${(k.team || []).length ? `<h3>Your project team</h3><table><tr><th>Name</th><th>Role</th><th>Contact</th></tr>${k.team.map((t: any) => `<tr><td>${escH(t.full_name)}</td><td>${escH(t.role)}${t.company ? ` · ${escH(t.company)}` : ""}</td><td>${escH(t.email || "")}${t.phone ? ` · ${escH(t.phone)}` : ""}</td></tr>`).join("")}</table>` : ""}
${k.fees ? `<h3>Fees & milestones</h3><p style="margin:0">${escH(k.fees)}</p>` : ""}
${foot(5)}</section>` + PRINT_TAIL
}
function WelcomeKitEditor({ db, pid, cfg, onClose }: any) {
    const [k, setK] = React.useState<any>(null)
    React.useEffect(() => {
        (async () => {
            const [{ data: project }, { data: weeks }, { data: team }, { data: budget }] = await Promise.all([
                db.from("projects").select("title,address,client_id,drive_folder_url").eq("id", pid).maybeSingle(),
                db.from("project_weeks").select("*").eq("project_id", pid).order("week_no"),
                db.from("project_directory").select("full_name,role,company,email,phone").eq("project_id", pid).order("seq"),
                db.from("project_budgets").select("fixed_fee").eq("project_id", pid).maybeSingle(),
            ])
            const { data: client } = await db.from("clients").select("name,full_name").eq("client_id", project?.client_id).maybeSingle()
            const name = client?.full_name || client?.name || "there"
            setK({
                project, weeks: weeks || [], team: team || [], cfg, clientName: name,
                portalUrl: "felemaye.com/client-suite/portal", dropUrl: "",
                letter: `Thank you for trusting the studio with ${project?.title || "your home"}. While you've been away, the work has already begun: the site is measured, and we've met with LA County Regional Planning to understand exactly what the front yard can hold.\n\nThis kit sets out how we'll work together over the next twelve weeks — when we meet, what you'll receive each Friday, and the few things we need from you to move quickly. Everything lives in your private portal, so you never have to search an inbox for a drawing or a decision.\n\nI'm looking forward to our kickoff on your return.`,
                needs: KIT_NEEDS.join("\n"),
                contactNote: "Email felema@felemaye.com for anything project-related. For time outside the scheduled reviews, use the booking link in your portal.",
                fees: budget?.fixed_fee ? `Fixed design fee $${Number(budget.fixed_fee).toLocaleString()} — retainer, then milestone payments at Schematic Design and Design Development sign-off, as set out in your proposal. Structural engineering is contracted directly between you and the engineer.` : "",
            })
        })()
    }, [db, pid])
    if (!k) return <Drawer title="Welcome Kit" onClose={onClose}><p className="v4-note">Loading…</p></Drawer>
    const T = (key: string, label: string, rows = 3) => <label className="v4-field" style={{ marginTop: 10 }}><span className="mono">{label}</span><textarea rows={rows} value={k[key] || ""} onChange={(e) => setK({ ...k, [key]: e.target.value })} /></label>
    return (
        <Drawer title="Welcome Kit" onClose={onClose}>
            <p className="v4-note">Five pages, built from this project's roadmap, cadence and team: cover · letter · how we'll work · roadmap · what we need. Edit the words, then Print / PDF and add it to the client's Files (00 · Agreements).</p>
            <div className="v4-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <label className="v4-field"><span className="mono">Client name</span><input value={k.clientName} onChange={(e) => setK({ ...k, clientName: e.target.value })} /></label>
                <label className="v4-field"><span className="mono">Shared drop folder (optional)</span><input value={k.dropUrl} onChange={(e) => setK({ ...k, dropUrl: e.target.value })} placeholder="Client-only Drive folder link" /></label>
            </div>
            {T("letter", "Letter", 9)}{T("needs", "What we need (one per line)", 6)}{T("contactNote", "Reaching the studio", 3)}{T("fees", "Fees & milestones", 3)}
            <div className="r" style={{ marginTop: 14 }}><button className="b" onClick={() => openPrint(welcomeKitHtml({ ...k, needs: lines(k.needs) }))}>Print / PDF</button></div>
        </Drawer>
    )
}

function PresentationEditor({ db, pid, row, onClose }: any) {
    const [p, setP] = React.useState<any>({ ...row, options: (row.options || []).map((o: any) => ({ ...o, prosT: (o.pros || []).join("\n"), consT: (o.cons || []).join("\n") })) })
    const [busy, setBusy] = React.useState(false), [msg, setMsg] = React.useState("")
    async function upload(files: FileList | null) {
        if (!files?.length) return
        setBusy(true)
        const add: any[] = []
        for (const f of Array.from(files)) {
            if (f.size > 25 * 1024 * 1024) { setMsg(f.name + " is over 25 MB"); continue }
            const path = `${pid}/studio/presentations/${Date.now()}_${f.name.replace(/[^\w.\-]+/g, "_").slice(-80)}`
            const up = await db.storage.from("project-files").upload(path, f)
            if (up.error) setMsg(up.error.message); else add.push({ path, caption: "" })
        }
        setP((x: any) => ({ ...x, slides: [...(x.slides || []), ...add] })); setBusy(false)
    }
    const setSlide = (i: number, patch: any) => setP({ ...p, slides: p.slides.map((s: any, k: number) => (k === i ? { ...s, ...patch } : s)) })
    const move = (i: number, dir: number) => { const s = [...p.slides]; const j = i + dir; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; setP({ ...p, slides: s }) }
    const setOpt = (i: number, patch: any) => setP({ ...p, options: p.options.map((o: any, k: number) => (k === i ? { ...o, ...patch } : o)) })
    async function save(status?: string) {
        const body: any = {
            project_id: pid, phase_seq: p.phase_seq || null, week_no: p.week_no || null, title: p.title, subtitle: p.subtitle || null, deck_url: p.deck_url || null,
            slides: p.slides, decision_prompt: p.decision_prompt || null,
            options: p.options.map((o: any) => ({ key: o.key, title: o.title, summary: o.summary || "", pros: lines(o.prosT || ""), cons: lines(o.consT || ""), cost: o.cost || "", code: o.code || "" })),
        }
        if (!body.title) return setMsg("Add a title.")
        if (status) { body.status = status; if (status === "published") body.published_at = new Date().toISOString() }
        const r = p.id ? await db.from("presentations").update(body).eq("id", p.id) : await db.from("presentations").insert(body)
        if (r.error) return setMsg(r.error.message)
        onClose()
    }
    return (
        <Drawer title="Presentation" onClose={onClose}>
            <p className="v4-note">Curated slides only — renders, elevations, boards. Decisions go in the options below so the client sees A vs B side by side.</p>
            <label className="v4-field"><span className="mono">Title</span><input value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} placeholder="Pre-Design · Site context & enclosure options" /></label>
            <label className="v4-field" style={{ marginTop: 8 }}><span className="mono">Subtitle</span><input value={p.subtitle || ""} onChange={(e) => setP({ ...p, subtitle: e.target.value })} /></label>
            <label className="v4-field" style={{ marginTop: 8 }}><span className="mono">Full deck link (Framer / PDF, optional)</span><input value={p.deck_url || ""} onChange={(e) => setP({ ...p, deck_url: e.target.value })} /></label>
            <div className="c v4-panel">
                <div className="r" style={{ justifyContent: "space-between" }}><span className="mono">Slides · {(p.slides || []).length}</span><label className="b g" style={{ cursor: "pointer" }}>{busy ? "Uploading…" : "+ Add images"}<input type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} /></label></div>
                {(p.slides || []).map((s: any, i: number) => (
                    <div key={s.path || s.url || i} className="r" style={{ marginTop: 8, flexWrap: "nowrap" }}>
                        <span className="mono" style={{ width: 22 }}>{i + 1}</span>
                        <input value={s.caption || ""} placeholder="Caption" onChange={(e) => setSlide(i, { caption: e.target.value })} style={{ flex: 1 }} />
                        <button className="b g" onClick={() => move(i, -1)} aria-label="Move up">↑</button><button className="b g" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                        <button className="b g" onClick={() => setP({ ...p, slides: p.slides.filter((_: any, k: number) => k !== i) })} aria-label="Remove slide">✕</button>
                    </div>
                ))}
            </div>
            <div className="c v4-panel">
                <div className="r" style={{ justifyContent: "space-between" }}><span className="mono">Decision options</span><button className="b g" onClick={() => setP({ ...p, options: [...p.options, { key: String.fromCharCode(65 + p.options.length), title: "" }] })}>+ Option</button></div>
                <label className="v4-field" style={{ marginTop: 8 }}><span className="mono">Question for the client</span><input value={p.decision_prompt || ""} onChange={(e) => setP({ ...p, decision_prompt: e.target.value })} placeholder="Which enclosure approach should we develop?" /></label>
                {p.options.map((o: any, i: number) => (
                    <div key={i} style={{ marginTop: 12, paddingTop: 12, borderTop: ".5px solid color-mix(in srgb,var(--ink) 15%,transparent)" }}>
                        <div className="r"><span className="tag">Option {o.key}</span><input value={o.title} placeholder="Title" onChange={(e) => setOpt(i, { title: e.target.value })} style={{ flex: 1 }} /><button className="b g" onClick={() => setP({ ...p, options: p.options.filter((_: any, k: number) => k !== i) })}>✕</button></div>
                        <textarea rows={2} placeholder="Summary" value={o.summary || ""} onChange={(e) => setOpt(i, { summary: e.target.value })} style={{ width: "100%", marginTop: 6 }} />
                        <div className="v4-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                            <textarea rows={3} placeholder="Strengths (one per line)" value={o.prosT || ""} onChange={(e) => setOpt(i, { prosT: e.target.value })} />
                            <textarea rows={3} placeholder="Trade-offs (one per line)" value={o.consT || ""} onChange={(e) => setOpt(i, { consT: e.target.value })} />
                            <input placeholder="Cost note" value={o.cost || ""} onChange={(e) => setOpt(i, { cost: e.target.value })} />
                            <input placeholder="Code note" value={o.code || ""} onChange={(e) => setOpt(i, { code: e.target.value })} />
                        </div>
                    </div>
                ))}
            </div>
            <div className="r" style={{ marginTop: 14 }}>
                <button className="b g" onClick={() => save()}>Save draft</button>
                {p.status !== "published" ? <button className="b" onClick={() => save("published")}>Publish to client</button> : <button className="b g" onClick={() => save("draft")}>Unpublish</button>}
            </div>
            {msg && <p className="v4-note">{msg}</p>}
        </Drawer>
    )
}

function CadenceSettings({ db, pid, cfg, booking, reload, setMsg, schedule }: any) {
    const [c, setC] = React.useState<any>(cfg || { kickoff_on: new Date().toISOString().slice(0, 10), weeks: 12, included_sessions: 5 })
    const [b, setB] = React.useState(booking || "")
    const [adv, setAdv] = React.useState(false)
    const [kit, setKit] = React.useState(false)
    React.useEffect(() => { if (cfg) setC(cfg) }, [cfg])
    React.useEffect(() => { setB(booking || "") }, [booking])
    async function save() {
        const { updated_at, ...row } = c
        const r = await db.from("project_cadence").upsert({ ...row, project_id: pid, advisory_rate: c.advisory_rate === "" ? null : c.advisory_rate })
        const r2 = await saveProjectSetting(db, pid, "__booking_url", b.trim() || null)
        setMsg(r.error ? r.error.message : r2.error ? r2.error.message : "Saved.")
        reload()
    }
    const F = (k: string, l: string, type = "text") => <label className="v4-field" key={k}><span className="mono">{l}</span><input type={type} value={c[k] ?? ""} onChange={(e) => setC({ ...c, [k]: e.target.value })} /></label>
    return (
        <div className="c v4-panel">
            <div className="v4-grid">
                {F("kickoff_on", "Kickoff (Monday of week 1)", "date")}
                {F("weeks", "Weeks", "number")}
                {F("included_sessions", "Included live sessions", "number")}
                {F("advisory_rate", "Advisory rate $/h", "number")}
            </div>
            <label className="v4-field"><span className="mono">Dedicated client booking link (not your public discovery link)</span><input value={b} onChange={(e) => setB(e.target.value)} placeholder="Calendly / TidyCal event: Project Lorado — Phase Review / Advisory Touchpoint (45 min)" /></label>
            <label className="v4-field" style={{ marginTop: 10 }}><span className="mono">Cadence note shown to the client</span><textarea rows={4} value={c.cadence_note || ""} onChange={(e) => setC({ ...c, cadence_note: e.target.value })} /></label>
            <label className="v4-field" style={{ marginTop: 10 }}><span className="mono">Booking boundary note</span><textarea rows={3} value={c.booking_note || ""} onChange={(e) => setC({ ...c, booking_note: e.target.value })} /></label>
            <div className="r" style={{ marginTop: 14 }}><button className="b" onClick={save}>Save settings</button><button className="b g" onClick={() => setAdv(true)}>Log an advisory call</button><button className="b g" onClick={() => setKit(true)}>Welcome Kit</button></div>
            {kit && <WelcomeKitEditor db={db} pid={pid} cfg={c} onClose={() => setKit(false)} />}
            {adv && <ScheduleForm w={null} onClose={() => setAdv(false)} onSave={(w: any, ...rest: any[]) => { setAdv(false); (schedule as any)(null, ...rest) }} />}
        </div>
    )
}

function StudioInbox({ db }: any) {
    const [rows, setRows] = React.useState<any[]>([])
    const [projects, setProjects] = React.useState<any>({})
    const load = React.useCallback(async () => {
        const [n, p] = await Promise.all([
            db.from("portal_notifications").select("*").eq("audience", "studio").order("created_at", { ascending: false }).limit(60),
            db.from("projects").select("id,title"),
        ])
        setRows(n.data || []); setProjects(Object.fromEntries((p.data || []).map((x: any) => [x.id, x.title])))
    }, [db])
    React.useEffect(() => { load() }, [load])
    async function readAll() { const ids = Array.from(new Set(rows.filter((r) => !r.read_at).map((r) => r.project_id))); for (const id of ids) await db.rpc("mark_notifications_read", { p_project: id }); load() }
    return (
        <div className="c v4-panel">
            <div className="r" style={{ justifyContent: "space-between" }}><span className="mono">From clients · {rows.filter((r) => !r.read_at).length} new</span><button className="b g" onClick={readAll}>Mark all read</button></div>
            {rows.map((r) => (
                <div key={r.id} className="v4-note-row" style={{ gridTemplateColumns: "10px 150px minmax(0,1fr) 140px", opacity: r.read_at ? 0.6 : 1 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: r.read_at ? "transparent" : "var(--ochre)" }} />
                    <span className="mono">{new Date(r.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    <span><b>{r.title}</b>{r.body ? <span style={{ opacity: 0.7 }}> · {r.body}</span> : null}</span>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>{projects[r.project_id] || ""}</span>
                </div>
            ))}
            {!rows.length && <p className="v4-note">Nothing yet. Client choices, sign-offs, meeting requests and completed tasks land here.</p>}
        </div>
    )
}

/* ───────────── Consultant directory (2026-10-22c) ─────────────
   Shortlist with websites, service area, stated lead times and notes. "To vet" means researched
   online only — confirm licence (CA BPELSG lookup), availability and fee on the first call. */
const VET = ["to_vet", "contacted", "vetted", "warm", "declined"]
const VET_TONE: any = { to_vet: "var(--slate)", contacted: "var(--ochre)", vetted: "var(--moss)", warm: "var(--moss)", declined: "#666" }
function ConsultantDirectory({ db, cons, reload }: any) {
    const [disc, setDisc] = React.useState("all")
    const [editing, setEditing] = React.useState<string | null>(null)
    const list = cons.filter((c: any) => disc === "all" || c.discipline === disc)
    const discs = Array.from(new Set(cons.map((c: any) => c.discipline))) as string[]
    async function patch(c: any, p: any) { await db.from("consultants").update(p).eq("id", c.id); reload() }
    const intro = (c: any) => {
        const subj = `Introduction — FELEMAYE · 3745 Lorado Way, View Park (front-yard courtyard wall)`
        const body = `Hello${c.contact_name ? " " + c.contact_name.split(" ")[0] : ""},\n\nI'm Felema Yemaneberhan, principal of FELEMAYE LLC, an architectural design studio in Los Angeles. I'm leading the design of a front-yard courtyard enclosure at 3745 Lorado Way in View Park (unincorporated LA County, R-1): a masonry base with ornamental iron above, new pilasters and gate, roughly 1,500 sq ft of front yard.\n\nWe're in pre-design and expect to need ${c.discipline === "structural" ? "an Engineer of Record for footing, masonry and seismic calculations with stamped S-sheets for LA County Building & Safety" : c.discipline === "survey" ? "a boundary and topographic survey to fix the front property line and grades" : c.discipline === "civil" ? "grading and drainage input if the County requires it" : "engineering input on exterior lighting and power"}. The client contracts directly; FELEMAYE coordinates and remains lead designer.\n\nWould you have capacity in the next 4–6 weeks, and could you share your typical fee range and turnaround for a scope like this?\n\nThank you,\nFelema Yemaneberhan\nFELEMAYE LLC · felema@felemaye.com`
        return `mailto:${c.email || ""}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`
    }
    return (
        <div className="c v4-panel">
            <div className="r" style={{ justifyContent: "space-between" }}>
                <div><div className="mono">Consultant directory</div><div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Researched shortlist + your warm contacts. Verify each licence at bpelsg.ca.gov before engaging.</div></div>
                <div className="r">{["all", ...discs].map((d) => <button key={d} className={"b" + (disc === d ? "" : " g")} onClick={() => setDisc(d)}>{d}</button>)}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 12, marginTop: 12 }}>
                {list.map((c: any) => (
                    <div key={c.id} className="c" style={{ margin: 0, borderTop: `3px solid ${VET_TONE[c.vetting_status || "to_vet"]}` }}>
                        <div className="r" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ minWidth: 0 }}><span className="tag">{c.discipline}</span><div style={{ fontSize: 16, fontWeight: 600, marginTop: 6 }}>{c.firm}</div>{c.contact_name && <div style={{ fontSize: 13, opacity: 0.75 }}>{c.contact_name}</div>}</div>
                            <select value={c.vetting_status || "to_vet"} onChange={(e) => patch(c, { vetting_status: e.target.value })} aria-label="Vetting status" style={{ fontSize: 13 }}>{VET.map((v) => <option key={v} value={v}>{v.replace("_", " ")}</option>)}</select>
                        </div>
                        {c.service_area && <div style={{ fontSize: 13, marginTop: 6, opacity: 0.8 }}>📍 {c.service_area}</div>}
                        {c.lead_time_note && <div style={{ fontSize: 13, marginTop: 4 }}><span className="mono">Lead time · </span>{c.lead_time_note}</div>}
                        {c.notes && <p style={{ fontSize: 13, lineHeight: 1.55, margin: "8px 0", opacity: 0.85 }}>{c.notes}</p>}
                        <div className="r" style={{ gap: 12, fontSize: 13 }}>
                            {c.website && <a href={c.website} target="_blank" rel="noreferrer">Website ↗</a>}
                            {c.phone && <a href={"tel:" + c.phone.replace(/[^\d+]/g, "")}>{c.phone}</a>}
                            {c.source_url && c.source_url !== c.website && <a href={c.source_url} target="_blank" rel="noreferrer" style={{ opacity: 0.7 }}>Source ↗</a>}
                        </div>
                        <div className="r" style={{ marginTop: 10 }}>
                            <a className="b" href={intro(c)} style={{ textDecoration: "none" }} onClick={() => (c.vetting_status || "to_vet") === "to_vet" && patch(c, { vetting_status: "contacted" })}>Email intro</a>
                            <button className="b g" onClick={() => setEditing(editing === c.id ? null : c.id)}>{editing === c.id ? "Done" : "Edit"}</button>
                        </div>
                        {editing === c.id && (
                            <div className="v4-grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 10 }}>
                                {(["contact_name", "email", "phone", "license_no", "lead_time_note", "website"] as const).map((k) => (
                                    <label className="v4-field" key={k}><span className="mono">{k.replace("_", " ")}</span><input defaultValue={c[k] || ""} onBlur={(e) => e.target.value !== (c[k] || "") && patch(c, { [k]: e.target.value || null })} /></label>
                                ))}
                                <label className="v4-field" style={{ gridColumn: "1 / -1" }}><span className="mono">notes</span><textarea rows={3} defaultValue={c.notes || ""} onBlur={(e) => e.target.value !== (c.notes || "") && patch(c, { notes: e.target.value })} /></label>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {!list.length && <p className="v4-note">No consultants yet — run 20261022c SQL to load the researched shortlist.</p>}
        </div>
    )
}
