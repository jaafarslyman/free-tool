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
- `app.js` — step state, answer midpoints, the calculation, and data capture

## How the estimate works

Each answer range maps to a midpoint. Weekly handling hours are requests × minutes ÷ 60, plus
redo time (a share of that base: 10% rarely, 25% sometimes, 50% often). Monthly hours are weekly
hours × 4.33. Monthly cost is monthly hours × the hourly rate, which starts at $30 and is
adjustable on the results screen. Results are always labelled as estimates.

## Data

Every answer writes progress to `localStorage` (`coi-check.v1.progress`, plus a
`coi-check.v1.events` log), so partial runs are captured. Completed submissions are appended to
`coi-check.v1.submissions` with name, email, agency, all answers, computed results and timestamps.

On submit the payload is posted to a Google Apps Script web app, which appends one row to the
"COI Workload Check — Submissions" sheet:

| Column | |
| --- | --- |
| A | Submitted at (ISO) |
| B–D | First name, email, agency |
| E–I | Requests per week, minutes each, redos, handled by, management system (the labels chosen) |
| J–M | Weekly hours, monthly hours, hourly rate, monthly cost |
| N–O | Session ID, start time |

The report only opens once that write succeeds. If `SHEET_ENDPOINT` is empty the tool still runs
end to end, but nothing leaves the browser.

### Turning saving on (once)

1. Open the sheet, then **Extensions → Apps Script**.
2. Delete the stub and paste the contents of `apps-script/Code.gs`.
3. **Deploy → New deployment → Web app.** Execute as *Me*, Who has access *Anyone*.
4. Copy the `/exec` URL into `SHEET_ENDPOINT` at the top of `app.js`.
5. `./build.sh` and publish again.

## The report

After the email gate the tool builds a two-page A4 report from the stored submission and offers
**Print or save as PDF**: page one has the headline number, the answers as a table and the
calculation; page two has where the time usually goes, what ten hours back would mean, and the
next-step box. Everything is black on white and prints readably in greyscale.

## Deploying

```
./build.sh
```

This copies the three public files into `dist/`, which is what `deploy.json` uploads. The live site
is a published Freebuff Sites project: publishing from this workspace is what makes changes go
live, so a commit to this repo alone does not update the URL above.
