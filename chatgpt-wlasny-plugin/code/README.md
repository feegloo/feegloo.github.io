# Hello World → GitHub Actions MCP

Tutorial: https://aleksanderfigiel.pl/chatgpt-wlasny-plugin/

Requires Node.js >=22. Run `npm ci`, then `npm run hello`. Public HTTPS `/mcp` connects to ChatGPT; `/health` checks the HTTP process. Use a tunnel such as `ngrok http 8787`. No authentication is implemented: only public demo data.

## Workflow card
Copy `demo.yml` to `.github/workflows/demo.yml` of your own public GitHub repository. Commit it and save the full SHA. Copy `.env.example` to `.env`, set `GITHUB_REPOSITORY=owner/repo`. Stop Hello World, run `npm run build` and `npm start`. Refresh tools in ChatGPT. Call `show_workflow_status` with the full 40-character SHA and `workflow: demo.yml`.

The card checks current status before revealing itself, rather than rendering historical running results. Initial show calls can use a 10-second cache; widget refresh calls bypass it, including the read before revealing the card. Running cards poll every 60 seconds and stop on terminal states. Errors show unavailable. GitHub anonymous API limits apply across all cards sharing the server IP. This demo reads one workflow, does not dispatch it, and does not implement TestFlight delivery tracking. Private repos require server-side GitHub credentials and user authentication, which are outside this public example.

## Validation
`npm test` checks MCP tool discovery/calls, stateless HTTP, structured status results, exact SHA filtering, cache, state mapping and API errors. `npm run build` creates self-contained `dist/widget.html`. Keep `.env`, `node_modules` and `dist` out of git.
