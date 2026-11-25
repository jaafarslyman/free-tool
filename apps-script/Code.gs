/**
 * Certificate Workload Check — submission receiver.
 *
 * Receives the JSON the tool posts after someone finishes: the answers, the results, and the
 * two-page PDF (base64). Appends one row to the submissions sheet and emails the PDF to the
 * address the visitor gave.
 *
 * Runs either way:
 *  - inside the sheet (Extensions -> Apps Script): leave SHEET_ID empty;
 *  - standalone (script.google.com -> New project): set SHEET_ID to the sheet's id.
 */

var SHEET_ID = '';  // only needed for a standalone script, e.g. '1I5UP_qAr7uwUKUn...'
var SHEET_NAME = 'Sheet1';
var OWNER_NAME = 'Jaafar Slyman';
var OWNER_EMAIL = 'jaafarslyman85@gmail.com';

function openBook() {
  return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!data.email) return json({ ok: false, error: 'missing email' });

    var book = openBook();
    var sheet = book.getSheetByName(SHEET_NAME) || book.getSheets()[0];

    var a = data.answers || {};
    var r = data.results || {};

    var emailed = sendReport(data);

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
      data.startedAt || '',
      emailed ? 'yes' : 'no'
    ]);

    return json({ ok: emailed, emailed: emailed, row: sheet.getLastRow() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Emails the attached report. Returns false if there is no PDF or the send failed. */
function sendReport(data) {
  if (!data.pdf) return false;

  try {
    var fileName = String(data.pdfName || 'certificate-workload-report.pdf')
      .replace(/[^A-Za-z0-9._ -]+/g, '') || 'certificate-workload-report.pdf';
    var blob = Utilities.newBlob(Utilities.base64Decode(data.pdf), 'application/pdf', fileName);

    var r = data.results || {};
    var hours = r.monthlyHours ? Math.round(r.monthlyHours) : null;
    var cost = r.monthlyCost ? '$' + Number(r.monthlyCost).toLocaleString('en-US') : null;

    var headline = hours
      ? 'About ' + hours + ' hours a month' + (cost ? ', roughly ' + cost : '') + '.'
      : '';

    var body = [
      'Hi ' + (data.name || 'there') + ',',
      '',
      'Here is the two-page report for ' + (data.agency || 'your agency') + '. ' + headline,
      '',
      'It is an estimate built from the five answers you gave, using the hourly rate you set' +
        (r.hourlyRate ? ' ($' + r.hourlyRate + ')' : '') + '. It is not a quote.',
      '',
      'If you would like to see what AI pulls out of your real requests, send me 10 past ones ' +
        'with names removed and I will send back what it finds. No charge.',
      '',
      OWNER_NAME,
      OWNER_EMAIL
    ].join('\n');

    MailApp.sendEmail({
      to: data.email,
      replyTo: OWNER_EMAIL,
      name: OWNER_NAME,
      subject: 'Your certificate workload report for ' + (data.agency || 'your agency'),
      body: body,
      attachments: [blob]
    });

    return true;
  } catch (err) {
    return false;
  }
}

function doGet() {
  var book = openBook();
  var sheet = book.getSheetByName(SHEET_NAME) || book.getSheets()[0];
  return json({
    ok: true,
    service: 'certificate-workload-check',
    sheet: book.getName(),
    rows: sheet.getLastRow()
  });
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
