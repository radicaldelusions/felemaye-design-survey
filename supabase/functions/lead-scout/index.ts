// FELEMAYE · lead-scout (Supabase Edge Function)
// Weekly: pulls fresh public permit filings for LA (LADBS, data.lacity.org dataset pi9x-tg5x "Building Permits Issued from
// 2020 to Present") and NYC (DOB NOW: Build – Job Application Filings, data.cityofnewyork.us dataset w9ak-ipjd),
// scores them against studio_config.lead_scout_rules, and upserts the good ones into lead_signals (status 'new').
// For NYC it also tallies the most active DOB filing representatives (expediters) and adds them to network_contacts
// as 'to_verify' — a data-driven shortlist of who is actually filing.
// Public records only. It stores the address and the applicant / filing firm of record; it never looks up owners'
// personal contact details.
//
// Auth: studio JWT (is_studio) or header  x-scout-key: <LEAD_SCOUT_KEY>  (for the scheduled run).
// Secrets: LEAD_SCOUT_KEY (choose any long random string) · optional SOCRATA_APP_TOKEN (higher rate limits).
// Deploy:  supabase functions deploy lead-scout --no-verify-jwt   (the function checks auth itself)
// Run:     POST /functions/v1/lead-scout   body {"days": 7, "markets": ["LA","NY"]}
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-scout-key", "access-control-allow-methods": "POST, OPTIONS" }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } })
const DEFAULT_RULES = {
    LA: { zips: ["90008", "90043", "90016", "90018", "90056", "90062", "90047"], keywords: ["addition", "adu", "remodel", "courtyard", "patio", "facade", "restaurant", "tenant improvement", "retail"], min_valuation: 25000 },
    NY: { boroughs: ["BROOKLYN", "MANHATTAN", "QUEENS"], keywords: ["alteration", "restaurant", "retail", "storefront", "brownstone", "rear yard", "enlargement"], min_valuation: 50000 },
}
const iso = (d: Date) => d.toISOString().slice(0, 19)
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

function score(text: string, valuation: number, areaHit: boolean, rules: any) {
    let s = 30; const why: string[] = []
    if (areaHit) { s += 25; why.push("target area") }
    const hits = (rules.keywords || []).filter((k: string) => text.includes(k.toLowerCase()))
    s += Math.min(30, hits.length * 15); if (hits.length) why.push(hits.slice(0, 3).join(", "))
    const min = Number(rules.min_valuation || 0)
    if (valuation >= min) s += 5
    if (valuation >= min * 3) s += 5
    if (valuation >= 250000) s += 5
    if (valuation) why.push("$" + Math.round(valuation / 1000) + "k")
    return { s: Math.min(100, s), why: why.join(" · ") }
}

async function socrata(base: string, params: Record<string, string>) {
    const u = new URL(base)
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v))
    const h: Record<string, string> = { accept: "application/json" }
    const tok = Deno.env.get("SOCRATA_APP_TOKEN"); if (tok) h["X-App-Token"] = tok
    const r = await fetch(u, { headers: h })
    if (!r.ok) throw new Error(`${u.host} ${r.status}: ${(await r.text()).slice(0, 200)}`)
    return await r.json()
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
    const url = Deno.env.get("SUPABASE_URL")!
    const key = req.headers.get("x-scout-key")
    let ok = !!key && key === Deno.env.get("LEAD_SCOUT_KEY")
    if (!ok) {
        const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession: false } })
        const { data } = await asUser.rpc("is_studio"); ok = !!data
    }
    if (!ok) return json({ error: "Studio only." }, 403)
    const body = await req.json().catch(() => ({}))
    const days = Math.min(30, Math.max(1, Number(body.days) || 7))
    const markets: string[] = body.markets || ["LA", "NY"]
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })
    const { data: cfg } = await db.from("studio_config").select("value").eq("key", "lead_scout_rules").maybeSingle()
    let rules: any = DEFAULT_RULES
    try { if (cfg?.value) rules = { ...DEFAULT_RULES, ...JSON.parse(cfg.value) } } catch {}
    const since = new Date(Date.now() - days * 864e5)
    const out: any = { LA: { fetched: 0, kept: 0 }, NY: { fetched: 0, kept: 0, expediters: 0 }, errors: [] as string[] }
    const rows: any[] = []

    if (markets.includes("LA")) {
        try {
            const r = rules.LA
            const zips = (r.zips || []).map((z: string) => `'${z.replace(/\D/g, "")}'`).join(",")
            const data = await socrata("https://data.lacity.org/resource/pi9x-tg5x.json", {
                $where: `issue_date >= '${iso(since)}'` + (zips ? ` AND zip_code in(${zips})` : ""),
                $order: "issue_date DESC", $limit: "1000",
            })
            out.LA.fetched = data.length
            for (const d of data) {
                const val = Number(d.valuation || 0)
                const text = [d.permit_type, d.permit_sub_type, d.use_desc, d.work_desc].join(" ").toLowerCase()
                if (val && val < Number(r.min_valuation || 0)) continue
                if (/electrical|plumbing|hvac|mechanical|fire sprinkler|solar|reroof|re-roof|demolition only/.test(text) && !/addition|remodel|alter/.test(text)) continue
                const sc = score(text, val, true, r)
                if (sc.s < 55) continue
                rows.push({ source: "ladbs_permits", market: "LA", external_id: String(d.permit_nbr), address: d.primary_address ? `${titleCase(d.primary_address)}, Los Angeles ${d.zip_code || ""}`.trim() : null,
                    neighborhood: d.cpa || null, permit_type: [d.permit_type, d.permit_sub_type].filter(Boolean).join(" · "), work_type: d.use_desc || null,
                    description: d.work_desc || null, valuation: val || null, filed_on: (d.issue_date || d.submitted_date || "").slice(0, 10) || null,
                    score: sc.s, score_why: sc.why, url: "https://data.lacity.org/d/pi9x-tg5x", raw: d })
                out.LA.kept++
            }
        } catch (e) { out.errors.push("LA: " + (e as Error).message) }
    }

    if (markets.includes("NY")) {
        try {
            const r = rules.NY
            const data = await socrata("https://data.cityofnewyork.us/resource/w9ak-ipjd.json", {
                $where: `:updated_at >= '${iso(since)}'`, $order: ":updated_at DESC", $limit: "2000",
            })
            out.NY.fetched = data.length
            const reps: Record<string, number> = {}
            for (const d of data) {
                const boro = String(d.borough || "").toUpperCase()
                const rep = String(d.filing_representative_business_name || "").trim()
                if (rep) reps[rep] = (reps[rep] || 0) + 1
                if ((r.boroughs || []).length && !(r.boroughs as string[]).includes(boro)) continue
                const val = Number(d.initial_cost || 0)
                if (val && val < Number(r.min_valuation || 0)) continue
                const text = [d.job_type, d.job_description, d.building_type, d.work_on_floor, d.filing_status].filter(Boolean).join(" ").toLowerCase()
                const sc = score(text, val, true, r)
                if (sc.s < 55) continue
                rows.push({ source: "nyc_dob_now", market: "NY", external_id: String(d.job_filing_number), address: [d.house_no, d.street_name].filter(Boolean).join(" ") + (boro ? `, ${titleCase(boro)}` : ""),
                    neighborhood: d.commmunity_board ? `CB ${d.commmunity_board}` : null, permit_type: d.job_type || d.filing_status || null, work_type: d.building_type || null,
                    description: d.job_description || null, valuation: val || null, filed_on: (d.filing_date || d[":updated_at"] || "").slice(0, 10) || null,
                    applicant: [d.applicant_first_name, d.applicant_last_name, d.applicant_professional_title].filter(Boolean).join(" ") || null,
                    score: sc.s, score_why: sc.why + (rep ? ` · filed by ${rep}` : ""), url: "https://data.cityofnewyork.us/d/w9ak-ipjd", raw: d })
                out.NY.kept++
            }
            const top = Object.entries(reps).sort((a, b) => b[1] - a[1]).slice(0, 15)
            for (const [firm, n] of top) {
                const { error } = await db.from("network_contacts").upsert({
                    kind: "expediter", firm: titleCase(firm), name: null, market: "NY", area: "NYC",
                    source_url: "https://data.cityofnewyork.us/d/w9ak-ipjd",
                    why: `${n} DOB NOW filings as filing representative in the last ${days} days (public record, ${new Date().toISOString().slice(0, 10)}).`,
                    collaboration: "Shortlist for NYC filings — confirm residential/alteration experience.",
                }, { onConflict: "kind,firm,name", ignoreDuplicates: false })
                if (!error) out.NY.expediters++
            }
        } catch (e) { out.errors.push("NY: " + (e as Error).message) }
    }

    for (let i = 0; i < rows.length; i += 200) {
        const { error } = await db.from("lead_signals").upsert(rows.slice(i, i + 200), { onConflict: "source,external_id", ignoreDuplicates: true })
        if (error) out.errors.push("save: " + error.message)
    }
    const top = rows.sort((a, b) => b.score - a.score).slice(0, 5).map((r) => `${r.market} · ${r.score} · ${r.address} · ${r.score_why}`)
    if (rows.length) {
        await db.rpc("fy_notify", { p_project: null, p_audience: "studio", p_kind: "lead_signals", p_title: `${rows.length} new lead signal${rows.length > 1 ? "s" : ""}`, p_body: top.join("\n"), p_link: "dashboard", p_ref: null }).then(() => {}, () => {})
    }
    return json({ ok: true, days, ...out, top })
})
