// FELEMAYE · drive-sync (Supabase Edge Function) — backend for integrations/FELEMAYE_DriveBridge.gs
// 1. Client Drive folders → portal: new files a client drops in their project Drive folder appear in the portal's
//    Files / references (stored as ext: links; Drive sharing is never changed).
// 2. Family survey → Drive: hands unsynced family_survey_responses to the script, which writes them into a Google Doc
//    in the project folder, then marks them synced with the doc link.
// Auth: header x-sync-secret = DRIVE_SYNC_SECRET (function secret). Deploy with --no-verify-jwt.
// Actions (POST JSON): {action:"projects"} · {action:"files", project_id, files:[{id,name,url,mimeType,folder,modified}]}
//                      {action:"family_pending"} · {action:"family_mark", ids:[...], doc_url}
// 3. (2026-10-23d) Reference images: {action:"need_thumbs"} lists Drive-linked files without a cached image;
//    {action:"thumb", id, mime, data_b64} stores a resized copy in Storage (project-files/<project>/studio/previews/<drive id>.jpg — where the portal looks)
//    so the console and the portal can show it on any device. {action:"thumb", id, mime:"not_image"} marks non-images.
// 4. (2026-10-23d) Revenue ledger: {action:"ledger", rows:[{ref, date, project, vertical, description, amount, status}]}
//    upserts invoices from the "FELEMAYE Revenue Ledger" Google Sheet (source "sheet"); a row whose invoice no.
//    matches an existing invoice updates that invoice instead of adding a second one.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } })

Deno.serve(async (req) => {
    if (req.method !== "POST") return json({ error: "POST only" }, 405)
    const secret = Deno.env.get("DRIVE_SYNC_SECRET")
    if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "unauthorized" }, 401)
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })
    const b = await req.json().catch(() => ({}))

    if (b.action === "projects") {
        const { data, error } = await db.from("projects").select("id,title,drive_folder_url,client_id").not("drive_folder_url", "is", null)
        if (error) return json({ error: error.message }, 500)
        return json({ projects: data })
    }

    if (b.action === "files") {
        if (!b.project_id || !Array.isArray(b.files)) return json({ error: "project_id and files required" }, 400)
        const { data: proj } = await db.from("projects").select("id,client_id").eq("id", b.project_id).maybeSingle()
        if (!proj) return json({ error: "unknown project" }, 404)
        const { data: client } = await db.from("clients").select("email").eq("client_id", proj.client_id).maybeSingle()
        const paths = b.files.map((f: any) => `ext:https://drive.google.com/file/d/${f.id}/view`)
        const { data: have } = await db.from("project_files").select("path").eq("project_id", b.project_id).in("path", paths)
        const known = new Set((have || []).map((r: any) => r.path))
        const rows = b.files
            .map((f: any) => ({ f, path: `ext:https://drive.google.com/file/d/${f.id}/view` }))
            .filter((x: any) => !known.has(x.path))
            .map(({ f, path }: any) => ({
                project_id: b.project_id, path, name: String(f.name || "Drive file").slice(0, 200), direction: "client",
                category: /photo|site/i.test(f.folder || "") ? "site_photo" : "reference",
                uploaded_by: client?.email || "drive", size_bytes: f.size || null,
            }))
        if (rows.length) {
            const { error } = await db.from("project_files").insert(rows)
            if (error) return json({ error: error.message }, 500)
        }
        return json({ added: rows.length, skipped: b.files.length - rows.length })
    }

    if (b.action === "family_pending") {
        const { data, error } = await db.from("family_survey_responses").select("*, projects(id,title,drive_folder_url)").is("drive_synced_at", null).order("created_at").limit(100)
        if (error) return json({ error: error.message }, 500)
        return json({ responses: data })
    }

    if (b.action === "family_mark") {
        if (!Array.isArray(b.ids) || !b.ids.length) return json({ error: "ids required" }, 400)
        const { error } = await db.from("family_survey_responses").update({ drive_synced_at: new Date().toISOString(), drive_file_url: b.doc_url || null }).in("id", b.ids)
        if (error) return json({ error: error.message }, 500)
        return json({ marked: b.ids.length })
    }

    if (b.action === "need_thumbs") {
        const { data, error } = await db.from("project_files").select("id,project_id,name,drive_id,category,mime_type")
            .not("drive_id", "is", null).is("thumb_path", null).or("mime_type.is.null,mime_type.like.image/%").limit(40)
        if (error) return json({ error: error.message }, 500)
        return json({ files: (data || []).filter((f: any) => f.mime_type !== "not_image") })
    }

    if (b.action === "thumb") {
        if (!b.id) return json({ error: "id required" }, 400)
        const { data: f } = await db.from("project_files").select("id,project_id,drive_id").eq("id", b.id).maybeSingle()
        if (!f) return json({ error: "unknown file" }, 404)
        if (b.mime === "not_image" || !b.data_b64) {
            await db.from("project_files").update({ mime_type: b.mime || "not_image" }).eq("id", f.id)
            return json({ ok: true, skipped: true })
        }
        const bytes = Uint8Array.from(atob(String(b.data_b64)), (c) => c.charCodeAt(0))
        if (bytes.length > 8_000_000) return json({ error: "image too large after resize" }, 413)
        const path = `${f.project_id}/studio/previews/${f.drive_id}.jpg` // same place the portal looks for Drive previews
        const up = await db.storage.from("project-files").upload(path, bytes, { contentType: "image/jpeg", upsert: true })
        if (up.error) return json({ error: up.error.message }, 500)
        await db.from("project_files").update({ thumb_path: path, mime_type: b.mime || "image/jpeg" }).eq("id", f.id)
        return json({ ok: true, path })
    }

    if (b.action === "ledger") {
        if (!Array.isArray(b.rows)) return json({ error: "rows required" }, 400)
        const { data: projects } = await db.from("projects").select("id,title,slug")
        const find = (p: string) => {
            const q = String(p || "").toLowerCase().trim(); if (!q) return null
            return (projects || []).find((x: any) => [x.title, x.slug].some((v: any) => String(v || "").toLowerCase() === q))
                || (projects || []).find((x: any) => String(x.title || "").toLowerCase().includes(q) || q.includes(String(x.title || "").toLowerCase()))
        }
        let added = 0, updated = 0; const problems: string[] = []
        for (const r of b.rows) {
            const amount = Number(String(r.amount ?? "").replace(/[$,\s]/g, ""))
            if (!r.ref || !amount) { if (r.ref || r.amount) problems.push(`row ${r.ref || "?"}: needs a reference and an amount`); continue }
            const st = /paid|received|yes|true|✓/i.test(String(r.status)) ? "paid" : /void|cancel/i.test(String(r.status)) ? "void" : "sent"
            const when = r.date ? new Date(r.date).toISOString() : new Date().toISOString()
            const p = find(r.project)
            const { data: byNum } = await db.from("invoices").select("id,source").eq("number", String(r.ref)).maybeSingle()
            if (byNum) {
                const { error } = await db.from("invoices").update({ status: st, paid_at: st === "paid" ? when : null, amount_paid: st === "paid" ? amount : null }).eq("id", byNum.id)
                if (error) problems.push(`${r.ref}: ${error.message}`); else updated++
                continue
            }
            const row = { external_ref: "sheet:" + r.ref, number: String(r.ref), project_id: p?.id || null, description: r.description || null, amount,
                status: st, issued_at: when, paid_at: st === "paid" ? when : null, vertical: String(r.vertical || "SD").toUpperCase().slice(0, 2), source: "sheet" }
            const { data: had } = await db.from("invoices").select("id").eq("external_ref", row.external_ref).maybeSingle()
            const res = had ? await db.from("invoices").update(row).eq("id", had.id) : await db.from("invoices").insert(row)
            if (res.error) problems.push(`${r.ref}: ${res.error.message}`); else had ? updated++ : added++
        }
        return json({ added, updated, problems })
    }

    return json({ error: "unknown action" }, 400)
})
