// FELEMAYE · vendor-sheet-sync (Supabase Edge Function)
// Two-way bridge between the "FELEMAYE | Procurement System" Google Sheet (tab VENDOR LIBRARY)
// and public.vendors. Called only by the Apps Script bound to that sheet.
//
// Auth: header  x-fy-sync-secret  must equal the VENDOR_SYNC_SECRET function secret.
//       Deploy with --no-verify-jwt (the shared secret replaces the JWT check).
// Secrets: VENDOR_SYNC_SECRET (set in Supabase › Edge Functions › Secrets). SUPABASE_URL and
//          SUPABASE_SERVICE_ROLE_KEY are injected by Supabase — never put them in the sheet.
//
// POST {action:"push", rows:[{id?, name, website, catalogue_url, category_primary, tier, notes,
//        trusted, contact_name, email, phone, sheet_row, last_edited}]}
//   → upserts vendors (last-write-wins against vendors.updated_at), adds/updates the primary rep.
// POST {action:"pull"} → every vendor (+ primary rep) for the sheet to write back.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } })

Deno.serve(async (req) => {
    if (req.method !== "POST") return json({ error: "POST only" }, 405)
    const secret = Deno.env.get("VENDOR_SYNC_SECRET")
    if (!secret || req.headers.get("x-fy-sync-secret") !== secret) return json({ error: "unauthorized" }, 401)

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
        auth: { persistSession: false },
    })
    let body: any
    try {
        body = await req.json()
    } catch {
        return json({ error: "bad json" }, 400)
    }

    if (body.action === "push") {
        const rows: any[] = (Array.isArray(body.rows) ? body.rows : []).filter((r) => String(r.name || "").trim())
        if (rows.length > 2000) return json({ error: "too many rows" }, 413)
        const { data, error } = await db.rpc("vendors_upsert_from_sheet", { p_rows: rows })
        if (error) return json({ error: error.message }, 500)

        // Primary rep from the sheet's Contact Person / Email / Phone (studio-only table).
        let reps = 0
        for (const r of rows) {
            const email = String(r.email || "").trim().toLowerCase()
            if (!email && !r.contact_name) continue
            const { data: v } = await db.from("vendors").select("id").ilike("name", String(r.name).trim()).limit(1).maybeSingle()
            if (!v) continue
            const q = db.from("sales_reps").select("id").eq("vendor_id", v.id)
            const { data: ex } = email ? await q.ilike("email", email).maybeSingle() : await q.eq("is_primary", true).maybeSingle()
            const rep = { vendor_id: v.id, name: r.contact_name || null, email: email || null, phone: r.phone || null, source: "sheet", is_primary: true }
            const res = ex ? await db.from("sales_reps").update(rep).eq("id", ex.id) : await db.from("sales_reps").insert(rep)
            if (!res.error) reps++
        }
        return json({ ...(data as any), reps })
    }

    if (body.action === "pull") {
        const { data, error } = await db
            .from("vendors")
            .select("id,name,website,catalogue_url,category_primary,tier,notes,trusted,updated_at,sheet_row,sales_reps(name,email,phone,is_primary)")
            .order("name")
        if (error) return json({ error: error.message }, 500)
        await db.from("vendor_sheet_sync").insert({ direction: "db_to_sheet", finished_at: new Date().toISOString(), rows_out: data.length, status: "ok" })
        return json({
            rows: data.map((v: any) => {
                const rep = (v.sales_reps || []).find((r: any) => r.is_primary) || (v.sales_reps || [])[0] || {}
                return { ...v, sales_reps: undefined, contact_name: rep.name || "", email: rep.email || "", phone: rep.phone || "" }
            }),
        })
    }
    return json({ error: "unknown action" }, 400)
})
