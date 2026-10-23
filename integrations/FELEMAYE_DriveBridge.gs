/**
 * FELEMAYE | Drive ⇄ Portal bridge — Google Apps Script (standalone script at script.google.com, signed in as
 * felema@felemaye.com — the account that can see the client project folders).
 *
 * What it does every 15 minutes:
 *   1. New files a client adds to their project Drive folder (in sub-folders whose name matches CLIENT_FOLDER_PATTERN,
 *      e.g. "From Banchi", "References", "Client uploads") appear in their portal Files as Drive links, and you get
 *      the usual "client sent a file" email. Drive sharing is never changed.
 *   2. Family survey responses are written into a Google Doc "Family Survey Responses — <project>" in the project
 *      folder (one section per person), and the portal records the doc link.
 *
 * Setup:
 *   1. Supabase › Edge Functions: deploy drive-sync (--no-verify-jwt) and add the secret DRIVE_SYNC_SECRET.
 *   2. Here: Project Settings › Script properties:
 *        SYNC_URL    = https://afejhlfwymwagstyfnse.supabase.co/functions/v1/drive-sync
 *        SYNC_SECRET = (same value as DRIVE_SYNC_SECRET)
 *        CLIENT_FOLDER_PATTERN = client|reference|inspiration|upload|from     (optional)
 *      No Supabase keys go in Google.
 *   3. (2026-10-23d) Reference images: every run also caches a resized copy of Drive images that are linked in the
 *      portal (Storage, project-files/<project>/studio/previews/ — the same place the portal already looks), so the console's Client References and the client's phone
 *      can show the picture itself instead of a link. Uses Drive thumbnails; nothing is shared or moved.
 *   4. (2026-10-23d) Revenue ledger: rows in the Google Sheet "FELEMAYE Revenue Ledger" (ID in script property
 *      LEDGER_SHEET_ID) become invoices in the console — tick Paid and it counts on the dashboard. Columns:
 *      Invoice no. | Date | Project | Vertical | Description | Amount | Status | Synced (filled by the script)
 *      No bank connection: you type or paste what came in.
 *   Run setup() once and approve. The first run only records "now" — it doesn't re-import files already in the
 *      portal. Run backfill() once if you want everything currently in those folders imported (duplicates are skipped).
 */
var PROPS = PropertiesService.getScriptProperties();

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'run') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('run').timeBased().everyMinutes(15).create();
  if (!PROPS.getProperty('LAST_SYNC')) PROPS.setProperty('LAST_SYNC', new Date().toISOString());
  Logger.log('Installed. Next run in 15 minutes.');
}
function backfill() { PROPS.setProperty('LAST_SYNC', '2000-01-01T00:00:00Z'); run(); }

function run() {
  var started = new Date();
  try { syncClientFolders_(new Date(PROPS.getProperty('LAST_SYNC') || started.toISOString())); PROPS.setProperty('LAST_SYNC', started.toISOString()); }
  catch (e) { Logger.log('Folder sync: ' + e); }
  try { syncFamilySurvey_(); } catch (e) { Logger.log('Family survey: ' + e); }
  try { cacheThumbnails_(); } catch (e) { Logger.log('Thumbnails: ' + e); }
  try { syncLedger_(); } catch (e) { Logger.log('Ledger: ' + e); }
}

/** Resized copies of Drive reference images for the portal (Drive sharing unchanged). */
function cacheThumbnails_() {
  var files = call_({ action: 'need_thumbs' }).files || [];
  var token = ScriptApp.getOAuthToken();
  files.forEach(function (f) {
    try {
      var meta = JSON.parse(UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + f.drive_id + '?fields=mimeType,thumbnailLink&supportsAllDrives=true',
        { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }).getContentText() || '{}');
      if (!meta.mimeType) return; // no access from this account
      if (meta.mimeType.indexOf('image/') !== 0) { call_({ action: 'thumb', id: f.id, mime: 'not_image' }); return; }
      if (!meta.thumbnailLink) return; // Drive hasn't made one yet; next run
      var big = meta.thumbnailLink.replace(/=s\d+$/, '=s1600');
      var img = UrlFetchApp.fetch(big, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
      if (img.getResponseCode() !== 200) return;
      call_({ action: 'thumb', id: f.id, mime: meta.mimeType, data_b64: Utilities.base64Encode(img.getBlob().getBytes()) });
    } catch (e) { Logger.log('thumb ' + f.name + ': ' + e); }
  });
  if (files.length) Logger.log('Thumbnails: ' + files.length + ' checked');
}
function cacheThumbnailsNow() { cacheThumbnails_(); }

/** Revenue ledger sheet → invoices. */
function syncLedger_() {
  var id = PROPS.getProperty('LEDGER_SHEET_ID'); if (!id) return;
  var sh = SpreadsheetApp.openById(id).getSheets()[0];
  var values = sh.getDataRange().getValues(); if (values.length < 2) return;
  var head = values[0].map(function (h) { return String(h).toLowerCase(); });
  var col = function (re) { for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i; return -1; };
  var c = { ref: col(/invoice|ref/), date: col(/date/), project: col(/project|client/), vertical: col(/vertical/), description: col(/desc/), amount: col(/amount/), status: col(/status|paid/), synced: col(/synced/) };
  var rows = [], idx = [];
  for (var r = 1; r < values.length; r++) {
    var v = values[r]; if (!v[c.ref] && !v[c.amount]) continue;
    rows.push({ ref: String(v[c.ref]), date: v[c.date] ? new Date(v[c.date]).toISOString() : null, project: c.project >= 0 ? v[c.project] : '',
                vertical: c.vertical >= 0 ? v[c.vertical] : 'SD', description: c.description >= 0 ? v[c.description] : '', amount: v[c.amount], status: c.status >= 0 ? v[c.status] : '' });
    idx.push(r);
  }
  if (!rows.length) return;
  var res = call_({ action: 'ledger', rows: rows });
  if (c.synced >= 0) { var stamp = new Date(); idx.forEach(function (r) { sh.getRange(r + 1, c.synced + 1).setValue(stamp); }); }
  Logger.log('Ledger: +' + res.added + ' new, ' + res.updated + ' updated' + ((res.problems || []).length ? ' · ' + res.problems.join('; ') : ''));
}
function syncLedgerNow() { syncLedger_(); }

function call_(payload) {
  var res = UrlFetchApp.fetch(PROPS.getProperty('SYNC_URL'), {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-sync-secret': PROPS.getProperty('SYNC_SECRET') }, payload: JSON.stringify(payload)
  });
  var body = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() >= 300) throw new Error(body.error || res.getResponseCode());
  return body;
}
function folderId_(url) { var m = /folders\/([\w-]+)/.exec(url || '') || /id=([\w-]+)/.exec(url || ''); return m ? m[1] : null; }

function syncClientFolders_(since) {
  var pattern = new RegExp(PROPS.getProperty('CLIENT_FOLDER_PATTERN') || 'client|reference|inspiration|upload|from', 'i');
  var projects = call_({ action: 'projects' }).projects || [];
  projects.forEach(function (p) {
    var id = folderId_(p.drive_folder_url); if (!id) return;
    var root; try { root = DriveApp.getFolderById(id); } catch (e) { Logger.log('No access: ' + p.title); return; }
    var files = [];
    var walk = function (folder, depth, matched) {
      var name = folder.getName(), ok = matched || pattern.test(name);
      if (ok) {
        var it = folder.getFiles();
        while (it.hasNext()) {
          var f = it.next();
          if (f.getDateCreated() > since || f.getLastUpdated() > since)
            files.push({ id: f.getId(), name: f.getName(), url: f.getUrl(), mimeType: f.getMimeType(), folder: name, size: f.getSize() });
        }
      }
      if (depth < 3) { var sub = folder.getFolders(); while (sub.hasNext()) walk(sub.next(), depth + 1, ok); }
    };
    walk(root, 0, false);
    if (files.length) { var r = call_({ action: 'files', project_id: p.id, files: files }); Logger.log(p.title + ': +' + r.added + ' (' + r.skipped + ' already in portal)'); }
  });
}

function syncFamilySurvey_() {
  var pending = call_({ action: 'family_pending' }).responses || [];
  if (!pending.length) return;
  var byProject = {};
  pending.forEach(function (r) { (byProject[r.project_id] = byProject[r.project_id] || []).push(r); });
  Object.keys(byProject).forEach(function (pid) {
    var list = byProject[pid], proj = list[0].projects || {};
    var folder = null; try { folder = DriveApp.getFolderById(folderId_(proj.drive_folder_url)); } catch (e) {}
    var title = 'Family Survey Responses — ' + (proj.title || 'Project');
    var doc = null;
    if (folder) { var it = folder.getFilesByName(title); if (it.hasNext()) doc = DocumentApp.openById(it.next().getId()); }
    if (!doc) {
      doc = DocumentApp.create(title);
      if (folder) DriveApp.getFileById(doc.getId()).moveTo(folder);
      doc.getBody().appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.TITLE);
      doc.getBody().appendParagraph('Responses from family and frequent guests, filed automatically from the portal survey.').setItalic(true);
    }
    var body = doc.getBody();
    list.forEach(function (r) {
      body.appendParagraph((r.nickname || 'Family member') + (r.age_band ? ' · ' + r.age_band : '')).setHeading(DocumentApp.ParagraphHeading.HEADING2);
      body.appendParagraph(new Date(r.created_at).toLocaleString()).setItalic(true);
      var lines = [
        ['How the courtyard should feel', (r.room_feel || []).join(', ')],
        ['Lighting', r.lighting], ['Seating', (r.seating || []).join(', ')], ['Palette', r.palette],
        ['Mood picks', (r.mood_picks || []).join(', ')], ['One wish', r.wish]
      ];
      if (r.extra) Object.keys(r.extra).forEach(function (k) { var v = r.extra[k]; lines.push([k.replace(/_/g, ' '), Array.isArray(v) ? v.join(', ') : (typeof v === 'object' ? JSON.stringify(v) : v)]); });
      lines.forEach(function (l) { if (l[1]) { var p = body.appendParagraph(''); p.appendText(l[0] + ': ').setBold(true); p.appendText(String(l[1])).setBold(false); } });
    });
    doc.saveAndClose();
    call_({ action: 'family_mark', ids: list.map(function (r) { return r.id; }), doc_url: doc.getUrl() });
    Logger.log(title + ': +' + list.length);
  });
}
