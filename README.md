# Certificate Workload Check

A single-page interactive tool that estimates what certificate of insurance requests cost an
agency each month. Built as a lead magnet.

**Live:** https://certificate-workload-check-pavbp6.freebuff.site

## Run it

No build step. Open `index.html`, or serve the folder:

```
python3 -m http.server 3000
```

## Files

- `index.html` — the screens: welcome, five questions, results, email gate, confirmation
- `styles.css` — monochrome design, mobile-first
- `app.js` — step state, answer midpoints, the calculation, the PDF, and data capture
- `apps-script/Code.gs` — the receiver: writes the sheet row and emails the report

## How the estimate works

Each answer range maps to a midpoint. Weekly handling hours are requests × minutes ÷ 60, plus
redo time (a share of that base: 10% rarely, 25% sometimes, 50% often). Monthly hours are weekly
hours × 4.33. Monthly cost is monthly hours × the hourly rate, which starts at $30 and is
adjustable on the results screen. Results are always labelled as estimates.

## What happens on submit

Nothing is displayed: the visitor gets a confirmation screen that says the report is on its way.

In the background `app.js` renders a two-page A4 PDF from the answers and results (a small PDF
writer built into the file — no library, no server), then posts one JSON body to the Apps Script
receiver: answers, results, timestamps, session id, and the PDF as base64.

The receiver appends one row to the "COI Workload Check — Submissions" sheet and emails the PDF
to the address the visitor gave, from the owner's own Gmail, with the owner as reply-to. If a step
fails it returns `ok: false`, and the page then offers the same PDF as a download so nobody is
left without their report.

| Column | |
| --- | --- |
| A | Submitted at (ISO) |
| B–D | First name, email, agency |
| E–I | Requests per week, minutes each, redos, handled by, management system (the labels chosen) |
| J–M | Weekly hours, monthly hours, hourly rate, monthly cost |
| N–O | Session ID, start time |
| P | Report emailed (`yes` / `no`) |

Progress is also written to `localStorage` on every answer (`coi-check.v1.progress`, plus a
`coi-check.v1.events` log), and the finished payload is kept in `coi-check.v1.submissions`.

### Turning saving and email on (once)

The page cannot sign in to Google, so it needs one published receiver. This is the only setup
step, and it switches on both the sheet and the email.

1. Open the sheet, then **Extensions → Apps Script**.
2. Delete the stub and paste the contents of `apps-script/Code.gs`.
3. **Deploy → New deployment → Web app.** Execute as *Me*, Who has access *Anyone*.
4. Authorise it the first time Google asks.
5. Copy the `/exec` URL into `SHEET_ENDPOINT` at the top of `app.js`.
6. `./build.sh` and publish again.

Until step 5 is done `SHEET_ENDPOINT` is empty, so nothing can be stored or emailed and the
confirmation screen falls back to a download link.

## The report

Two A4 pages, black on white, readable in greyscale. Page one: the headline number, the five
answers as a small table, and how it was calculated (including the hourly-rate assumption and the
word "estimate"). Page two: where the time usually goes, what 10 hours back would mean for their
numbers, and a box with the next step and the owner's name and email.

## Deploying

```
./build.sh
```

This copies the three public files into `dist/`, which is what `deploy.json` uploads. The live site
is a published Freebuff Sites project: publishing from this workspace is what makes changes go
live, so a commit to this repo alone does not update the URL above.
