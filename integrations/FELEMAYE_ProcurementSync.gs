/**
 * FELEMAYE | Procurement System ⇄ Supabase vendors — Google Apps Script
 * Extensions › Apps Script in the "FELEMAYE | Procurement System" sheet, paste this file, then:
 *   1. Project Settings › Script properties:
 *        SYNC_URL    = https://afejhlfwymwagstyfnse.supabase.co/functions/v1/vendor-sheet-sync
 *        SYNC_SECRET = (same value as the VENDOR_SYNC_SECRET function secret)
 *      No Supabase keys go in the sheet.
 *   2. Run setup() once and approve the permissions. It adds "FY ID" and "Last Edited"
 *      columns (K, L) to VENDOR LIBRARY, an on-edit stamp, and a sync every 15 minutes.
 *   Menu: FELEMAYE › Sync vendors now.
 *
 * Rules: rows push to the vault; the vault pulls back. A row edited in the sheet after the
 * vault's last change wins; otherwise the vault wins. Conflicts are logged in vendor_sheet_sync.
 * Existing columns A–J are never reordered or cleared.
 */
var TAB = 'VENDOR LIBRARY';
var COLS = ['Vendor Name', 'Contact Person', 'Email ', 'Phone', 'Website', 'Catalogue', 'Category', 'Notes', 'Tier', 'Trusted? (Yes/No)', 'FY ID', 'Last Edited'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('FELEMAYE').addItem('Sync vendors now', 'syncVendors').addToUi();
}

function setup() {
  var sh = sheet_();
  var head = sh.getRange(1, 1, 1, 12).getValues()[0];
  if (head[10] !== 'FY ID') sh.getRange(1, 11).setValue('FY ID');
  if (head[11] !== 'Last Edited') sh.getRange(1, 12).setValue('Last Edited');
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['stampEdit', 'syncVendors'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('stampEdit').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  ScriptApp.newTrigger('syncVendors').timeBased().everyMinutes(15).create();
}

function stampEdit(e) {
  var sh = e.range.getSheet();
  if (sh.getName() !== TAB || e.range.getRow() < 2 || e.range.getColumn() > 10) return;
  sh.getRange(e.range.getRow(), 12, e.range.getNumRows(), 1).setValue(new Date().toISOString());
}

function syncVendors() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    var sh = sheet_();
    var last = sh.getLastRow();
    var data = last > 1 ? sh.getRange(2, 1, last - 1, 12).getValues() : [];
    var rows = data.map(function (r, i) {
      return {
        name: String(r[0]).trim(), contact_name: r[1], email: r[2], phone: r[3], website: r[4], catalogue_url: r[5],
        category_primary: r[6], notes: r[7], tier: r[8], trusted: /^y/i.test(String(r[9])) ? 'true' : (String(r[9]) ? 'false' : ''),
        id: r[10] || '', last_edited: r[11] ? new Date(r[11]).toISOString() : '', sheet_row: i + 2
      };
    }).filter(function (r) { return r.name; });

    var pushed = call_({ action: 'push', rows: rows });
    var pulled = call_({ action: 'pull' }).rows || [];

    // Write back: update rows matched by FY ID or name, append vault-only vendors.
    var index = {};
    data.forEach(function (r, i) { index[(r[10] || '').toString()] = i; index['n:' + String(r[0]).trim().toLowerCase()] = i; });
    var out = data.slice();
    pulled.forEach(function (v) {
      var i = index[v.id] !== undefined ? index[v.id] : index['n:' + String(v.name).trim().toLowerCase()];
      var row = [v.name, v.contact_name, v.email, v.phone, v.website || '', v.catalogue_url || '', v.category_primary || '',
                 v.notes || '', v.tier || '', v.trusted ? 'Yes' : 'No', v.id, i !== undefined ? out[i][11] : ''];
      if (i !== undefined) {
        // keep any sheet value the vault has blank
        for (var c = 0; c < 10; c++) if (row[c] === '' || row[c] == null) row[c] = out[i][c];
        out[i] = row;
      } else out.push(row);
    });
    if (out.length) sh.getRange(2, 1, out.length, 12).setValues(out);
    console.log('pushed ' + JSON.stringify(pushed) + ' · pulled ' + pulled.length);
  } finally {
    lock.releaseLock();
  }
}

function sheet_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB);
  if (!sh) throw new Error('Tab "' + TAB + '" not found');
  return sh;
}

function call_(payload) {
  var p = PropertiesService.getScriptProperties();
  var res = UrlFetchApp.fetch(p.getProperty('SYNC_URL'), {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-fy-sync-secret': p.getProperty('SYNC_SECRET') },
    payload: JSON.stringify(payload)
  });
  if (res.getResponseCode() >= 300) throw new Error('Sync ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText());
}
