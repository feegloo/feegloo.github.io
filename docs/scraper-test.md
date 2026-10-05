# Temporary scraper test

Paths: `scraper.html`, `scraper.css`, `scraper.js`, `scraper-format.js`.

Open `/scraper.html`, provide the dedicated test token and a public HTTP(S) URL.
Choose Node.js (default) or Python in the switch. Send calls Supabase `scrape-page`, which calls the authenticated Playwright container.
The page shows the target HTTP status, final URL, response headers, render readiness,
duration, actual engine, attempts, direct/proxy route and DOM HTML. HTTP errors from the target still display their HTML. Gateway
errors display a separate message.

Returned HTML is highlighted using text nodes only. It is never executed or embedded
as a live page. Formatting is optional; raw DOM HTML is retained for exact inspection.
Large snapshots skip formatting/highlighting. Copy/download uses the selected view.
The token is never committed; URL fragments are consumed and cleared and it stays in
sessionStorage until that browser tab/session closes.

Backend and deployment setup: `feegloo/vibe-ios-app/docs/browser-scraper.md`.
Remove these test-only files when the temporary UI is no longer needed.
