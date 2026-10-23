// FELEMAYE · lead-scout (Supabase Edge Function) · v2 2026-10-23
// Pulls fresh public permit filings and keeps the ones worth a look, each labelled with
//   sector        residential_sf · residential_mf · commercial · hospitality · mixed_use · institutional · other
//   project_type  new_construction · addition · alteration · adu · tenant_improvement · fence_wall · pool_spa ·
//                 rebuild · entitlement · demolition · repair
//   fit           lead (you can design and sign the set) · partner (you design, an architect / engineer of record signs) ·
//                 consult (interiors, FF&E or BIM role on someone else's project) · skip
// Sources (public records only — addresses and the filing party of record, never owners' personal contact details):
//   LA County unincorporated · EPIC-LA case history (LA County Public Works, ArcGIS feature service, refreshed weekdays)
//   City of LA             · LADBS permits issued (data.lacity.org pi9x-tg5x)
//   New York City          · DOB NOW Build job filings (data.cityofnewyork.us w9ak-ipjd) + most active filing reps
// Fit uses studio_config.license_profile ({"CA":"pending"|"licensed","NY":"licensed"}). While the CA licence is pending,
// "lead" follows the B&P Code §5537 / §5538 exemptions: wood-frame single-family up to two storeys and basement, up to
// four units / two storeys, nonstructural interiors and storefronts. Anything structural beyond that needs a signer.
//
// Auth: studio JWT (is_studio), or header x-scout-key matching studio_private.lead_scout_key (the weekend schedule).
// No function secrets needed. Optional secret SOCRATA_APP_TOKEN for higher Socrata rate limits.
// Deploy:  supabase functions deploy lead-scout --no-verify-jwt   (the function checks auth itself)
// Run:     POST /functions/v1/lead-scout   {"days": 7, "markets": ["LA","NY"]}
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-scout-key, x-client-info", "access-control-allow-methods": "POST, OPTIONS" }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } })
const EPIC = "https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/EPIC-LA_Case_History_view/FeatureServer/0/query"
const DEFAULT_RULES: any = {
    COUNTY: {
        home_areas: ["View Park/Windsor Hills", "Ladera Heights"],
        areas: ["View Park/Windsor Hills", "Ladera Heights", "Altadena", "Marina del Rey", "Del Aire", "Wiseburn", "West LA", "Santa Monica Mountains", "La Crescenta-Montrose", "East Pasadena", "Kinneloa Mesa", "Athens-Westmont"],
        keywords: ["addition", "courtyard", "patio", "wall", "fence", "remodel", "adu", "kitchen", "facade", "restaurant", "tenant improvement", "rebuild", "pergola", "garden"],
    },
    LA: { zips: ["90008", "90043", "90016", "90018", "90056", "90062", "90047", "90302", "90305"], keywords: ["addition", "adu", "remodel", "courtyard", "patio", "facade", "restaurant", "tenant improvement", "retail"], min_valuation: 25000 },
    NY: { boroughs: ["BROOKLYN", "MANHATTAN", "QUEENS"], keywords: ["alteration", "restaurant", "retail", "storefront", "brownstone", "rear yard", "enlargement"], min_valuation: 50000 },
}
const iso = (d: Date) => d.toISOString().slice(0, 19)
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
const TRADE_ONLY = /electrical|plumbing|mechanical|hvac|sewer|solar|fire sprinkler|fire alarm|reroof|re-roof|water heater|ev charg|panel upgrade|express utility|encroachment|excavation|address request|recycling|c&d|corner record|record of survey|yard sale|vending|film/i

// ── classification ─────────────────────────────────────────────────────────────
function classify(text: string, units: number | null, valuation: number, market: string, lic: any) {
    const t = text.toLowerCase()
    const um = t.match(/(\d+)\s*(?:new\s*)?(?:dwelling\s*)?units?\b/)
    if (um && units == null) units = Number(um[1])
    const sector =
        /hotel|motel|hospitality/.test(t) ? "hospitality"
        : /mixed use|mixed-use/.test(t) ? "mixed_use"
        : /educational|institutional|assembly|church|school|hospital/.test(t) ? "institutional"
        : /multifamily|multi-family|apartment|condo|r-2\b|\b[3-9] units|townhome/.test(t) ? "residential_mf"
        : /commercial|office|retail|restaurant|store|tenant|warehouse|industrial|\bbusiness\b|\bb occupancy/.test(t) ? "commercial"
        : (units ?? 0) >= 3 ? "residential_mf"
        : /residential|dwelling|single family|1 or 2 family|sfd|sfr|duplex|\badu\b|accessory dwelling|garage|house|home|residence|fire rebuild|eaton fire|palisades fire|retaining wall|block wall|fence/.test(t) ? "residential_sf"
        : "other"
    const project_type =
        /disaster|rebuild/.test(t) ? "rebuild"
        : /\badu\b|accessory dwelling|jadu|junior adu/.test(t) ? "adu"
        : /retaining wall|fence|garden wall|block wall|gate/.test(t) ? "fence_wall"
        : /pool|spa\b/.test(t) ? "pool_spa"
        : /tenant improvement|\bti\b|interior alteration|build-?out/.test(t) ? "tenant_improvement"
        : /\bcup\b|site plan review|zoning conformance|yard modification|variance|plot plan|entitlement|coastal development|\bcdp\b|oak tree permit|housing permit/.test(t) ? "entitlement"
        : /demolition|demo only/.test(t) ? "demolition"
        : /addition|enlarge|new room|second story|2nd story/.test(t) ? "addition"
        : /\bnew\b|new construction|new building|new sfd|new dwelling|ground up/.test(t) ? "new_construction"
        : /alter|remodel|renovat|kitchen|bath|facade|storefront|convert|conversion/.test(t) ? "alteration"
        : "repair"
    const structural = /structural|foundation|steel|moment frame|shear|retaining|second story|2nd story|three stor|3 stor|basement|podium|concrete|masonry|cmu/.test(t)
    const caState = market === "NY" ? (lic?.NY || "licensed") : (lic?.CA || "pending")
    let fit = "lead", why = ""
    if (project_type === "demolition" || project_type === "repair" && !/kitchen|bath|facade|interior/.test(t)) { fit = "skip"; why = "Repair or demolition only — no design scope." }
    else if (caState === "licensed") {
        fit = sector === "institutional" || (valuation >= 5_000_000) ? "partner" : "lead"
        why = fit === "lead" ? `Licensed in ${market === "NY" ? "NY" : "CA"}: you can sign this set; bring a structural engineer where the work is structural.` : "Large or institutional: team with a firm that carries the delivery and insurance."
    } else if (sector === "residential_sf") {
        if (structural || project_type === "fence_wall") { fit = "lead"; why = "Wood-frame 1–2 family is exempt work under B&P §5537 — you lead the design and set; the structural or retaining-wall sheets need an engineer's stamp." }
        else { fit = "lead"; why = "Wood-frame 1–2 family up to two storeys and basement: exempt under B&P §5537, you can design and sign." }
    } else if (sector === "residential_mf") {
        if ((units ?? 0) > 4 || structural) { fit = "partner"; why = "Over four units or structural: under B&P §5537 this needs a licensed architect or engineer of record while your CA licence is pending." }
        else { fit = "lead"; why = "Up to four units, two storeys, wood frame: exempt under B&P §5537." }
    } else if (["commercial", "hospitality", "mixed_use"].includes(sector)) {
        if (project_type === "tenant_improvement" || (project_type === "alteration" && !structural)) { fit = "lead"; why = "Nonstructural interiors, storefronts and fixtures are exempt under B&P §5538 — you can design and sign the interior set." }
        else if (valuation >= 2_000_000 || project_type === "new_construction") { fit = "consult"; why = "New or large commercial: pitch interiors, FF&E or BIM/VDC to the architect of record." }
        else { fit = "partner"; why = "Structural commercial work: design lead with an architect of record signing until your CA licence is issued." }
    } else if (sector === "institutional") { fit = "consult"; why = "Institutional / assembly: architect of record required; offer interiors, FF&E or BIM." }
    else { fit = project_type === "entitlement" ? "lead" : "partner"; why = project_type === "entitlement" ? "Planning application: zoning feasibility and drawings for the hearing are within your scope." : "Use not stated — check the record before reaching out." }
    return { sector, project_type, fit, fit_why: why }
}

function score(text: string, valuation: number, areaW: number, rules: any, kind: { project_type: string; fit: string }) {
    let s = 30 + areaW; const why: string[] = []
    if (areaW >= 25) why.push("home area"); else if (areaW > 0) why.push("target area")
    const hits = (rules.keywords || []).filter((k: string) => text.includes(k.toLowerCase()))
    s += Math.min(30, hits.length * 12); if (hits.length) why.push(hits.slice(0, 3).join(", "))
    s += ({ fence_wall: 18, addition: 15, adu: 12, rebuild: 12, alteration: 10, tenant_improvement: 10, new_construction: 10, entitlement: 10, pool_spa: 4 } as any)[kind.project_type] || 0
    if (kind.fit === "skip") s -= 40
    if (kind.fit === "consult") s -= 5
    const min = Number(rules.min_valuation || 0)
    if (valuation && valuation >= min) s += 5
    if (valuation >= 150000) s += 5
    if (valuation >= 500000) s += 5
    if (valuation) why.push("$" + Math.round(valuation / 1000) + "k")
    return { s: Math.max(0, Math.min(100, s)), why: why.join(" · ") }
}

async function getJson(u: URL, headers: Record<string, string> = {}) {
    const r = await fetch(u, { headers: { accept: "application/json", ...headers } })
    if (!r.ok) throw new Error(`${u.host} ${r.status}: ${(await r.text()).slice(0, 200)}`)
    return await r.json()
}
async function socrata(base: string, params: Record<string, string>) {
    const u = new URL(base)
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v))
    const tok = Deno.env.get("SOCRATA_APP_TOKEN")
    return await getJson(u, tok ? { "X-App-Token": tok } : {})
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
    const url = Deno.env.get("SUPABASE_URL")!
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })
    const key = req.headers.get("x-scout-key")
    let ok = false
    if (key) {
        const { data } = await db.from("studio_private").select("value").eq("key", "lead_scout_key").maybeSingle()
        ok = (!!data?.value && key === data.value) || key === Deno.env.get("LEAD_SCOUT_KEY")
    }
    if (!ok) {
        const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession: false } })
        const { data } = await asUser.rpc("is_studio"); ok = !!data
    }
    if (!ok) return json({ error: "Studio only." }, 403)
    const body = await req.json().catch(() => ({}))
    const days = Math.min(30, Math.max(1, Number(body.days) || 7))
    const markets: string[] = body.markets || ["LA", "NY"]
    const [{ data: cfg }, { data: licRow }] = await Promise.all([
        db.from("studio_config").select("value").eq("key", "lead_scout_rules").maybeSingle(),
        db.from("studio_config").select("value").eq("key", "license_profile").maybeSingle(),
    ])
    let rules: any = DEFAULT_RULES
    try { if (cfg?.value) { const r = JSON.parse(cfg.value); rules = { ...DEFAULT_RULES, ...r, COUNTY: { ...DEFAULT_RULES.COUNTY, ...(r.COUNTY || {}) } } } } catch {}
    let lic: any = { CA: "pending", NY: "licensed" }
    try { if (licRow?.value) lic = { ...lic, ...JSON.parse(licRow.value) } } catch {}
    const since = new Date(Date.now() - days * 864e5)
    const out: any = { COUNTY: { fetched: 0, kept: 0 }, LA: { fetched: 0, kept: 0 }, NY: { fetched: 0, kept: 0, expediters: 0 }, errors: [] as string[] }
    const rows: any[] = []
    const push = (r: any, bucket: string) => { rows.push(r); out[bucket].kept++ }

    // ── LA County unincorporated · EPIC-LA ─────────────────────────────────────
    if (markets.includes("LA")) {
        try {
            const R = rules.COUNTY
            const areas = (R.areas || []).map((a: string) => `'Unincorporated - ${a.replace(/'/g, "''")}'`).join(",")
            const where = `APPLY_DATE >= DATE '${since.toISOString().slice(0, 10)}' AND COUNTYWIDE_STAT_AREA IN (${areas}) AND (CASENAME LIKE '%Building%' OR CASENAME LIKE '%Disaster%' OR CASENAME LIKE 'Permits & Reviews%' OR CASENAME LIKE '%Pool%')`
            const u = new URL(EPIC)
            Object.entries({ where, outFields: "CASENUMBER,MODULENAME,CASENAME,WORKCLASS_NAME,DESCRIPTION,MAIN_ADDRESS,APPLY_DATE,ISSUANCE_DATE,STATUS,PERMIT_VALUATION,COUNTYWIDE_STAT_AREA,NEW_DWELLING_UNITS,ACCESSORY_DWELLING_UNIT,USE_CURR,USE_PROPOSED1,STRUCT_TYPE_DISP", orderByFields: "APPLY_DATE DESC", resultRecordCount: "2000", returnGeometry: "false", f: "json" }).forEach(([k, v]) => u.searchParams.set(k, v))
            const data = await getJson(u)
            if (data.error) throw new Error(data.error.message || JSON.stringify(data.error).slice(0, 200))
            const feats = (data.features || []).map((f: any) => f.attributes)
            out.COUNTY.fetched = feats.length
            for (const d of feats) {
                const text = [d.CASENAME, d.WORKCLASS_NAME, d.DESCRIPTION, d.USE_CURR, d.USE_PROPOSED1, d.STRUCT_TYPE_DISP, d.ACCESSORY_DWELLING_UNIT ? "adu" : ""].filter(Boolean).join(" ")
                if (TRADE_ONLY.test(String(d.CASENAME || "")) || (/repair\/replacement/i.test(d.WORKCLASS_NAME || "") && !/addition|remodel|kitchen|bath|wall|fence|facade/i.test(d.DESCRIPTION || ""))) continue
                if (/^(void|denied|withdrawn|expired)/i.test(String(d.STATUS || ""))) continue
                const area = String(d.COUNTYWIDE_STAT_AREA || "").replace(/^Unincorporated - /, "")
                const areaW = (R.home_areas || []).includes(area) ? 25 : 10
                const val = Number(d.PERMIT_VALUATION || 0)
                const kind = classify(text, d.NEW_DWELLING_UNITS ?? null, val, "LA", lic)
                if (kind.fit === "skip") continue
                const sc = score(text.toLowerCase(), val, areaW, R, kind)
                if (sc.s < 50) continue
                push({ source: "epicla", market: "LA", jurisdiction: "LA County (unincorporated)", external_id: String(d.CASENUMBER), address: String(d.MAIN_ADDRESS || "").trim() || null,
                    neighborhood: area || null, permit_type: [d.CASENAME, d.WORKCLASS_NAME].filter(Boolean).join(" · ").replace(/^Unincorporated /, ""), work_type: d.STATUS || null,
                    description: d.DESCRIPTION || null, valuation: val || null, filed_on: d.APPLY_DATE ? new Date(d.APPLY_DATE).toISOString().slice(0, 10) : null,
                    ...kind, applicant_role: "unknown", stage: /Permits & Reviews/i.test(d.CASENAME || "") ? "planning" : /issued|finaled|approved/i.test(d.STATUS || "") ? "issued" : "plan_check",
                    score: sc.s, score_why: sc.why, url: `https://epicla.lacounty.gov/energov_prod/SelfService#/search?m=1&fm=1&ps=10&pn=1&em=true&st=${encodeURIComponent(d.CASENUMBER)}`, raw: d }, "COUNTY")
            }
        } catch (e) { out.errors.push("LA County: " + (e as Error).message) }
    }

    // ── City of LA · LADBS ─────────────────────────────────────────────────────
    if (markets.includes("LA")) {
        try {
            const r = rules.LA
            const zips = (r.zips || []).map((z: string) => `'${z.replace(/\D/g, "")}'`).join(",")
            const data = await socrata("https://data.lacity.org/resource/pi9x-tg5x.json", {
                $where: `issue_date >= '${iso(since)}'` + (zips ? ` AND zip_code in(${zips})` : ""), $order: "issue_date DESC", $limit: "1000",
            })
            out.LA.fetched = data.length
            for (const d of data) {
                const val = Number(d.valuation || 0)
                const text = [d.permit_type, d.permit_sub_type, d.use_desc, d.work_desc].join(" ")
                if (val && val < Number(r.min_valuation || 0)) continue
                if (TRADE_ONLY.test(text) && !/addition|remodel|alter/i.test(text)) continue
                const kind = classify(text, null, val, "LA", lic)
                if (kind.fit === "skip") continue
                const sc = score(text.toLowerCase(), val, 25, r, kind)
                if (sc.s < 55) continue
                push({ source: "ladbs_permits", market: "LA", jurisdiction: "City of Los Angeles", external_id: String(d.permit_nbr), address: d.primary_address ? `${titleCase(d.primary_address)}, Los Angeles ${d.zip_code || ""}`.trim() : null,
                    neighborhood: d.cpa || null, permit_type: [d.permit_type, d.permit_sub_type].filter(Boolean).join(" · "), work_type: d.use_desc || null,
                    description: d.work_desc || null, valuation: val || null, filed_on: (d.issue_date || d.submitted_date || "").slice(0, 10) || null,
                    ...kind, applicant_role: "unknown", stage: "issued", score: sc.s, score_why: sc.why, url: "https://data.lacity.org/d/pi9x-tg5x", raw: d }, "LA")
            }
        } catch (e) { out.errors.push("City of LA: " + (e as Error).message) }
    }

    // ── New York City · DOB NOW ────────────────────────────────────────────────
    if (markets.includes("NY")) {
        try {
            const r = rules.NY
            const data = await socrata("https://data.cityofnewyork.us/resource/w9ak-ipjd.json", { $where: `:updated_at >= '${iso(since)}'`, $order: ":updated_at DESC", $limit: "2000" })
            out.NY.fetched = data.length
            const reps: Record<string, number> = {}
            for (const d of data) {
                const boro = String(d.borough || "").toUpperCase()
                const rep = String(d.filing_representative_business_name || "").trim()
                if (rep) reps[rep] = (reps[rep] || 0) + 1
                if ((r.boroughs || []).length && !(r.boroughs as string[]).includes(boro)) continue
                const val = Number(d.initial_cost || 0)
                if (val && val < Number(r.min_valuation || 0)) continue
                const text = [d.job_type, d.job_description, d.building_type, d.work_on_floor, d.filing_status, d.existing_occupancy_classification, d.proposed_occupancy_classification].filter(Boolean).join(" ")
                const kind: any = classify(text, Number(d.proposed_dwelling_units || 0) || null, val, "NY", lic)
                if (kind.fit === "skip") continue
                const title = String(d.applicant_professional_title || "")
                const role = title === "PE" ? "engineer" : title === "RA" || title === "R" ? "architect" : "unknown"
                if (role !== "unknown") { kind.fit = "consult"; kind.fit_why = `Already filed by a licensed ${role}${d.applicant_business_name ? " at " + d.applicant_business_name : ""}. The opening is the firm, not the owner: interiors, FF&E, BIM production or overflow drafting.` }
                const sc = score(text.toLowerCase(), val, 10, r, kind)
                if (sc.s < 55) continue
                push({ source: "nyc_dob_now", market: "NY", jurisdiction: "New York City", external_id: String(d.job_filing_number), address: [d.house_no, d.street_name].filter(Boolean).join(" ") + (boro ? `, ${titleCase(boro)}` : ""),
                    neighborhood: d.commmunity_board ? `CB ${d.commmunity_board}` : null, permit_type: d.job_type || d.filing_status || null, work_type: d.building_type || null,
                    description: d.job_description || null, valuation: val || null, filed_on: (d.filing_date || d[":updated_at"] || "").slice(0, 10) || null,
                    applicant: [d.applicant_first_name, d.applicant_last_name].filter(Boolean).join(" ") || null,
                    ...kind, applicant_role: role, applicant_firm: d.applicant_business_name || null, stage: /approved|permit/i.test(d.filing_status || "") ? "issued" : "plan_check", score: sc.s, score_why: sc.why + (rep ? ` · filed by ${rep}` : ""), url: "https://a810-dobnow.nyc.gov/publish/Index.html#!/", raw: d }, "NY")
            }
            // NYC returns hundreds of professional filings a week; keep the 80 best so the list stays usable
            const ny = rows.filter((r) => r.market === "NY").sort((a, b) => b.score - a.score)
            const drop = new Set(ny.slice(80)); for (let i = rows.length - 1; i >= 0; i--) if (drop.has(rows[i])) rows.splice(i, 1)
            out.NY.kept = Math.min(out.NY.kept, 80)
            const top = Object.entries(reps).sort((a, b) => b[1] - a[1]).slice(0, 15)
            for (const [firm, n] of top) {
                const { error } = await db.from("network_contacts").upsert({
                    kind: "expediter", firm: titleCase(firm), name: null, market: "NY", area: "NYC", source_url: "https://data.cityofnewyork.us/d/w9ak-ipjd",
                    why: `${n} DOB NOW filings as filing representative in the last ${days} days (public record, ${new Date().toISOString().slice(0, 10)}).`,
                    collaboration: "Shortlist for NYC filings — confirm residential/alteration experience.",
                }, { onConflict: "kind,firm,name", ignoreDuplicates: false })
                if (!error) out.NY.expediters++
            }
        } catch (e) { out.errors.push("NY: " + (e as Error).message) }
    }

    let saved = 0
    for (let i = 0; i < rows.length; i += 200) {
        let chunk = rows.slice(i, i + 200)
        let { data, error } = await db.from("lead_signals").upsert(chunk, { onConflict: "source,external_id", ignoreDuplicates: true }).select("id")
        if (error && /column/i.test(error.message)) {
            // 20261023d not run yet: save without the new columns (type and fit stay in score_why)
            chunk = chunk.map(({ sector, project_type, fit, fit_why, jurisdiction, applicant_role, applicant_firm, stage, ...r }: any) => ({ ...r, score_why: [r.score_why, fit?.toUpperCase(), sector, project_type].filter(Boolean).join(" · ") }))
            ;({ data, error } = await db.from("lead_signals").upsert(chunk, { onConflict: "source,external_id", ignoreDuplicates: true }).select("id"))
        }
        if (error) out.errors.push("save: " + error.message); else saved += (data || []).length
    }
    const top = rows.sort((a, b) => b.score - a.score).slice(0, 6).map((r) => `${r.score} · ${r.fit.toUpperCase()} · ${r.sector.replace("_", " ")} ${r.project_type.replace("_", " ")} · ${r.address}`)
    await db.from("lead_scout_runs").insert({ trigger: body.trigger || (key ? "schedule" : "manual"), days, result: { ...out, saved, top } }).then(() => {}, () => {})
    if (saved) {
        await db.rpc("fy_notify", { p_project: null, p_audience: "studio", p_kind: "lead_signals", p_title: `${saved} new lead signal${saved > 1 ? "s" : ""}${body.trigger === "weekend" ? " for Monday" : ""}`, p_body: top.join("\n"), p_link: "dashboard", p_ref: null }).then(() => {}, () => {})
    }
    return json({ ok: true, days, saved, ...out, top })
})
