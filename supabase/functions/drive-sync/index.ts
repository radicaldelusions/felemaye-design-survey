// FELEMAYE · drive-sync (Supabase Edge Function) — backend for integrations/FELEMAYE_DriveBridge.gs
// 1. Client Drive folders → portal: new files a client drops in their project Drive folder appear in the portal's
//    Files / references (stored as ext: links; Drive sharing is never changed).
// 2. Family survey → Drive: hands unsynced family_survey_responses to the script, which writes them into a Google Doc
//    in the project folder, then marks them synced with the doc link.
// Auth: header x-sync-secret = DRIVE_SYNC_SECRET (function secret). Deploy with --no-verify-jwt.
// Actions (POST JSON): {action:"projects"} · {action:"files", project_id, files:[{id,name,url,mimeType,folder,modified}]}
//                      {action:"family_pending"} · {action:"family_mark", ids:[...], doc_url}
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
    return json({ error: "unknown action" }, 400)
})
