https://aleksanderfigiel.pl

## App support

- [Support form](https://aleksanderfigiel.pl/ios-breathing-support): app questions and feedback saved in Supabase. [Setup and data access](docs/support.md).

## Privacy policy

- [HRV Breathing & Meditation](https://aleksanderfigiel.pl/ios-breathing-privacy-policy): [policy maintenance](docs/breathing-privacy.md).

## Tutoriale

- [ChatGPT, własny plugin](https://aleksanderfigiel.pl/chatgpt-wlasny-plugin/): Hello World i widżet GitHub Actions przez własny serwer MCP.

- [Naprawa workflow z AI](https://aleksanderfigiel.pl/naprawa-workflow-z-ai/): dwie ścieżki zgłoszenia błędu GitHub Actions w ChatGPT oraz naprawa bezpośrednio w GitHub przez Fix with Copilot.

## UDID

- [UDID page and Safari return handling](docs/udid.md).


## Ad Hoc builds

- [App catalog](https://aleksanderfigiel.pl/builds/): icons, latest version/build and per-app installation history.
- `tools/builds_catalog.py` rebuilds the catalog from published metadata. Both central signing and Trichoscopy publication call it against the latest website revision.
- `builds/catalog.json` refreshes the app cards; static HTML also works without JavaScript.

## HRV ASMR

- [Web breathing companion](https://aleksanderfigiel.pl/hrv-asmr/): native breathing animation and six ASMR sounds, ported to JavaScript. [Architecture, controls and checks](docs/hrv-asmr.md).

## Local development

Static HTML, CSS and JavaScript. Clone and serve without a build step:

```bash
git clone https://github.com/feegloo/feegloo.github.io.git
cd feegloo.github.io
python3 -m http.server 8000
```

Open `http://localhost:8000/`. GitHub Pages publishes pushes to `main` through `.github/workflows/pages.yml`.

