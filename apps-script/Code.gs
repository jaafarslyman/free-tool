/**
 * Certificate Workload Check — submission receiver.
 *
 * Bound to the "COI Workload Check — Submissions" sheet. Receives the JSON the tool posts
 * after someone finishes and appends one row per submission.
 *
 * Setup is in the README (Extensions -> Apps Script, paste this, deploy as a web app).
 */

var SHEET_NAME = 'Sheet1';

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var book = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = book.getSheetByName(SHEET_NAME) || book.getSheets()[0];

    var a = data.answers || {};
    var r = data.results || {};

    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.name || '',
      data.email || '',
      data.agency || '',
      label(a.requestsPerWeek),
      label(a.minutesEach),
      label(a.redos),
      label(a.handledBy),
      label(a.managementSystem),
      number(r.weeklyHours),
      number(r.monthlyHours),
      number(r.hourlyRate),
      number(r.monthlyCost),
      data.sessionId || '',
      data.startedAt || ''
    ]);

    return json({ ok: true, row: sheet.getLastRow() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json({ ok: true, service: 'certificate-workload-check' });
}

function label(field) {
  return field && field.label ? field.label : '';
}

function number(value) {
  return typeof value === 'number' ? value : '';
}

function json(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
