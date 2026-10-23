// FELEMAYE · zoning-analyze (Supabase Edge Function)
// Called by the Studio Console › Zoning tab with the text of uploaded meeting notes / PDFs / Word / Markdown
// (extracted in the browser). Returns a structured analysis; the console shows it and saves it as a draft audit.
//
// Request:  POST { project_id, jurisdiction: "la_county"|"ladbs"|"nyc_dob", text, files?: string[] }
// Response: { analysis: { summary, allowed[], non_negotiables[], negotiables[], applications[], conflicts[],
//                         questions[], sheet_requirements[], sheet{number,title,note}, facts{…}, sources[{title,url,cited_for}] } }
//
// Studio only (the caller's JWT must pass is_studio()). Secrets (Supabase › Edge Functions › Secrets):
//   ANTHROPIC_API_KEY (required) · ANTHROPIC_MODEL (optional, default claude-sonnet-5-5)
// Deploy with JWT verification ON (the default):  supabase functions deploy zoning-analyze
//
// Second mode (2026-10-23): POST { mode: "references", project_id, images: [{name, url}], notes? }
//   Reads the client's reference images (signed Storage URLs) and returns an internal design read for Schematic
//   Design: directions, materials with specs, palette, elements, keep-out list, tensions with the zoning limits,
//   SD moves and questions. Same auth and secrets as the zoning mode.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } })

const JURIS: Record<string, string> = {
    la_county: "Unincorporated Los Angeles County. Zoning: Title 22 on Municode, read together with any Planning Area Standards District and Community Standards District for the parcel. Discretionary relief through Regional Planning (e.g., Yard Modification, Chapter 22.196). Permits through Public Works Building & Safety (EPIC-LA). No mandated zoning sheet number — NCS G-series convention (G-001 Project Data, Zoning & Code Analysis).",
    ladbs: "City of Los Angeles. Zoning: LAMC Chapter I with ZIMAS overlays (HPOZ, specific plans, BHO). City Planning for discretionary approvals; LADBS permits via ePlanLA (vector PDF, bookmarks per sheet, stamp space upper right). No mandated zoning sheet number — G-series convention.",
    nyc_dob: "New York City. Zoning Resolution (ZoLa), NYC Building Code, DOB NOW. ZD1 zoning diagram where zoning review is required; zoning sheets conventionally Z-001+. LPC for landmarks/historic districts; BSA for variances.",
}

const SHAPE = `{
 "summary": "2–3 plain sentences: what can be built, the binding constraint, the decision that unlocks the design",
 "allowed": ["permitted by right — end each with its basis in parentheses, e.g. (§22.110.070.B.1) or (planner, S2)"],
 "non_negotiables": ["absolute restrictions, with basis"],
 "negotiables": ["what could be pursued: the named procedure, the evidence a planner would want (measured neighbors, dated photos, narrative), typical timing"],
 "applications": ["ordered approvals / agencies / applications"],
 "conflicts": ["contradictions between sources or assumptions to verify — most important first"],
 "questions": ["precise questions for the next planner meeting"],
 "sheet_requirements": ["jurisdiction sheet / title-block / submittal requirements that matter for this scope"],
 "sheet": {"number": "e.g. G-001 or Z-001", "title": "sheet title", "note": "why"},
 "facts": {"zone_class": null, "overlays": [], "setback_front_ft": null, "setback_side_ft": null, "setback_rear_ft": null, "height_cap_ft": null, "wall_height_cap_in": null, "transparency_pct": null, "lot_area_sf": null, "far_allowable": null, "occupancy": null},
 "sources": [{"title": "document or code", "url": "only if it appears in the material", "cited_for": "what it supports"}]
}`

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
    if (req.method !== "POST") return json({ error: "POST only" }, 405)
    const url = Deno.env.get("SUPABASE_URL")!
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession: false } })
    const { data: ok } = await asUser.rpc("is_studio")
    if (!ok) return json({ error: "Studio only." }, 403)
    const key = Deno.env.get("ANTHROPIC_API_KEY")
    if (!key) return json({ error: "ANTHROPIC_API_KEY not set" }, 500)

    const body = await req.json().catch(() => ({}))
    if (body.mode === "references") return referencesRead(body, key, url)
    const { project_id, jurisdiction = "la_county", text = "", files = [] } = body
    if (!project_id || String(text).trim().length < 40) return json({ error: "Upload or paste the meeting notes first." }, 400)

    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })
    const [{ data: project }, { data: refs }, { data: cfg }] = await Promise.all([
        db.from("projects").select("title,address").eq("id", project_id).maybeSingle(),
        db.from("jurisdiction_references").select("agency,title,body,url,status").in("jurisdiction", [jurisdiction, "national"]),
        db.from("studio_config").select("value").eq("key", "ai_max_input_chars").maybeSingle(),
    ])
    const cap = Math.max(20000, Number(cfg?.value) || 180000)
    const material = String(text).slice(0, cap)
    const library = (refs || []).map((r: any) => `- [${r.status}] ${r.agency || ""}: ${r.title} — ${r.body || ""}${r.url ? ` (${r.url})` : ""}`).join("\n")

    const system = `You are a senior permit-expediting architect writing a zoning & code feasibility analysis for a design studio. The goal is to know, before design work, what is allowed, what is fixed, and what can be negotiated, so the permit is approved.
Jurisdiction: ${JURIS[jurisdiction] || jurisdiction}
Studio reference library (verified items are reliable; "to_verify" items are leads):
${library || "(none)"}
Rules:
- Ground every statement in the uploaded material or the reference library and say which in the parenthetical basis.
- You may add well-known code facts from your own knowledge only if you append "(verify)". Never invent section numbers — write "section to confirm".
- Treat a planner's verbal answer and an ordinance that disagree as a conflict, listed first in "conflicts".
- Name the discretionary procedure for each negotiable item and the evidence a planner would want.
- Leave out architect-licensing and generic boilerplate. Professional, concise, no marketing tone.
Return ONLY one JSON object in this shape:
${SHAPE}`

    const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
            model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5",
            max_tokens: 6000,
            system,
            messages: [{ role: "user", content: `Project: ${project?.title || ""} — ${project?.address || ""}\nUploaded material (${(files as string[]).join(", ") || "pasted notes"}):\n\n${material}` }],
        }),
    })
    if (!r.ok) return json({ error: "Analysis service error", detail: (await r.text()).slice(0, 400) }, 502)
    const out = await r.json()
    const raw = (out.content || []).map((c: any) => c.text || "").join("")
    try {
        const analysis = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1))
        return json({ analysis, model: out.model, usage: out.usage })
    } catch {
        return json({ error: "Could not read the analysis — try again.", raw: raw.slice(0, 1500) }, 502)
    }
})

const READ_SHAPE = `{
 "summary": "4–6 plain sentences: what the images have in common, where they split, how that sits with the existing house",
 "directions": [{"name": "short name", "what": "materials, forms, planting in one or two sentences", "refs": ["image names"]}],
 "materials": [{"item": "e.g. Walls and seat backs", "spec": "buildable specification", "why": "which images / what it solves"}],
 "palette": [{"name": "colour name", "hex": "#RRGGBB"}],
 "elements": ["design elements to test in SD"],
 "keep_out": ["things the client signalled against, or that would dilute the scheme"],
 "tensions": ["conflicts with the zoning limits, the existing house, budget, maintenance"],
 "sd_moves": ["concrete schematic options to draw"],
 "questions": ["questions for the client before SD"]
}`

async function referencesRead(b: any, key: string, url: string) {
    const imgs = (Array.isArray(b.images) ? b.images : []).filter((i: any) => /^https:\/\//.test(i?.url || "")).slice(0, 20)
    if (!b.project_id || !imgs.length) return json({ error: "No viewable images. Upload reference images to the portal (Files) — Drive-only links can't be read here." }, 400)
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })
    const [{ data: project }, { data: audit }] = await Promise.all([
        db.from("projects").select("title,address").eq("id", b.project_id).maybeSingle(),
        db.from("project_zoning_audits").select("analysis").eq("project_id", b.project_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ])
    const limits = audit?.analysis ? JSON.stringify({ non_negotiables: audit.analysis.non_negotiables, facts: audit.analysis.facts }).slice(0, 4000) : "(no zoning analysis saved yet)"
    const system = `You are a senior residential architect preparing an internal design read before Schematic Design. Look closely at the client's reference images and describe what is actually in them: forms, materials, finishes, planting, colour, light, furniture. Be specific (name materials and finishes a contractor could price). Note when images disagree with each other. Do not flatter, do not use marketing language, avoid lists of three for rhythm's sake, and do not invent things you cannot see. Zoning limits for this site: ${limits}
Return ONLY one JSON object in this shape:
${READ_SHAPE}`
    const content: any[] = [{ type: "text", text: `Project: ${project?.title || ""} — ${project?.address || ""}\nStudio notes: ${b.notes || "(none)"}\nImages follow, each preceded by its file name.` }]
    for (const i of imgs) { content.push({ type: "text", text: `Image: ${i.name}` }); content.push({ type: "image", source: { type: "url", url: i.url } }) }
    const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5", max_tokens: 5000, system, messages: [{ role: "user", content }] }),
    })
    if (!r.ok) return json({ error: "Analysis service error", detail: (await r.text()).slice(0, 400) }, 502)
    const out = await r.json()
    const raw = (out.content || []).map((c: any) => c.text || "").join("")
    try {
        const read = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1))
        read.images_seen = imgs.length
        return json({ read, model: out.model })
    } catch {
        return json({ error: "Could not read the result — try again.", raw: raw.slice(0, 1500) }, 502)
    }
}
