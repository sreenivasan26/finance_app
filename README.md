# Finance Capture

A small offline phone app (PWA) for capturing expenses, income and transfers on an iPhone. Entries are saved on the phone, exported as a JSON file, and picked up by a separate desktop website. Live at https://sreenivasan26.github.io/finance_app/.

**Privacy: no data is hosted.** This repository and the GitHub Pages site contain only the app code. Your entries live in your phone's own storage (IndexedDB) and never leave it unless you export a file yourself. There are no accounts, no login, no analytics and no network calls from the app. The default category, account and spend-name lists are generic placeholders you can edit on the phone.

## Features

- Add expense, income and transfer entries (amount, category, spend name, date, mode, accounts, comment); edit and swipe-to-delete.
- Searchable spend-name picker per category, most used first, with "Add new".
- Summary for the current calendar month (INR, Indian digit grouping), optionally combined with a website summary file.
- Export to `finance-capture-YYYYMMDD-HHMMSS.json` through the iOS share sheet, with warnings when entries are unexported or the last export is over 7 days old.
- Works offline after the first load.

## Add to the iPhone Home Screen

1. Open https://sreenivasan26.github.io/finance_app/ in Safari.
2. Tap Share, scroll, tap Add to Home Screen, tap Add.
3. Always open it from the Home Screen icon. Safari tabs can have their storage cleared by iOS; the installed app is far safer.

## Export to the OneDrive inbox

Open the Export tab and tap Export. In the share sheet choose OneDrive (or Save to Files, then OneDrive) and save the file into the data folder's `inbox` folder. The website imports it on its next refresh. "Clear exported" removes only exported entries dated before the current month; this month's entries always stay, so the Summary never changes.

## Load the website summary

The website writes `outbox/finance-summary.json` (format `nt-finance-summary`, version 1) in the same OneDrive data folder. On the Summary tab tap **Load website summary** and pick that file from Files or OneDrive. The Summary then shows the website's figures plus phone entries not already included in it (matched by id).

- A banner shows "Website + phone" with "Website data as of ...", or "Phone only" when no usable summary is loaded.
- A summary for another month is ignored, and the banner says so. One older than 3 days shows a warning.
- With a summary loaded you also get the Self budget pace card and read-only Account balances and Card dues cards.
- Everything is manual; the app never reads or writes OneDrive by itself.

## Develop

```
npm install
npm test -- --run        # vitest, pure logic
npm run dev              # http://localhost:5174 (service worker only in built app)
npm run build            # writes dist/ (relative paths, works at any root or folder)
VITE_BASE=/finance_app/ npm run build   # build for the GitHub Pages sub-path
```

`VITE_BASE` defaults to `./`, so a plain build works at a domain root or in any sub-folder (for a local check: `python -m http.server 8010 --directory dist`). `VITE_OUT` changes the output folder (default `dist`).

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` runs on every push to `main`: `npm ci`, the tests, a build with `VITE_BASE=/finance_app/`, then publishes `dist` to GitHub Pages. In the repository settings set Pages > Source to "GitHub Actions" once.

## Notes

- Mode is fixed to UPI, CC or Other. Categories, accounts and spend names are editable under Add > Lists.
- Safari and Home-Screen behaviour (share sheet, storage eviction, safe areas) can only be verified on a real iPhone.
