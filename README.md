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

`deliverReport()` in `app.js` is the single place to wire up later: post the payload, generate the
PDF and send the email. It resolves on its own for now.

## Deploying

```
./build.sh
```

This copies the three public files into `dist/`, which is what `deploy.json` uploads. The live site
is a published Freebuff Sites project: publishing from this workspace is what makes changes go
live, so a commit to this repo alone does not update the URL above.
