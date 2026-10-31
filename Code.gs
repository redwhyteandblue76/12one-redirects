// Copy into the Google Sheet's Extensions > Apps Script.
// Redeploy a new version after changing code.
function doGet(e) {
  var callback = String((e && e.parameter && e.parameter.callback) || '');
  if (!/^[$A-Z_a-z][$\w]*$/.test(callback)) {
    return ContentService.createTextOutput('Invalid JSONP callback').setMimeType(ContentService.MimeType.TEXT);
  }
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Redirects');
  if (!sheet) throw new Error('Missing Redirects tab');
  var rows = sheet.getDataRange().getValues();
  var redirects = Object.create(null);
  for (var i = 1; i < rows.length; i++) {
    var slug = String(rows[i][0] || '').trim().toLowerCase();
    var dest = String(rows[i][1] || '').trim();
    var active = rows[i][2] === true || String(rows[i][2]).toLowerCase() === 'true';
    if (!active || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(slug) || !/^https?:\/\//i.test(dest)) continue;
    if (!Object.prototype.hasOwnProperty.call(redirects, slug)) redirects[slug] = dest;
  }
  return ContentService.createTextOutput(callback + '(' + JSON.stringify({ redirects: redirects }) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}