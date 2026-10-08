# Publication status

Checked on 2026-10-08.

- Reviewed adaptive-effort fixes were published and merged through [PR #1](https://github.com/Marila-mo/pi-auto-effort/pull/1). Merge `311bc2903d5af9288f68f265d46682461d69f566` has the same source tree as verified fix `5c91be44d08cbb5a90cac041e6eef3dc49cfe1ec`.
- The [Verify workflow](../.github/workflows/verify.yml) was merged through [PR #2](https://github.com/Marila-mo/pi-auto-effort/pull/2). Its [PR run](https://github.com/Marila-mo/pi-auto-effort/actions/runs/37770669916) and [merged-main run](https://github.com/Marila-mo/pi-auto-effort/actions/runs/37770961092) passed on Node 22.19.0 and 22.23.3, each with 30 tests, 24 E2E results and five catalog scenarios. It executes the locked install and full `npm run verify`, retains logs and runner evidence for 14 days, and uses no live vendor credentials. Both matrix checks from GitHub Actions are required on main, with up-to-date checks and administrator enforcement. The earlier 403 workflow-write limitation is resolved. Use [Actions run results](https://github.com/Marila-mo/pi-auto-effort/actions) for the status of later revisions.
- Public Git installation and package-origin RPC discovery previously passed with disposable directories and no credentials. Source cloning used public network access; Pi model traffic was offline. That historical installation evidence remains distinct from hosted CI and live-provider measurements.
- No npm release, tag or publisher-login change is part of this follow-up. Earlier npm publication was blocked by missing publisher authentication; do not infer a published npm package from GitHub CI success.
- A [three-task live pilot](verification.md#live-codex-pilot-2026-10-08) used existing Pi ChatGPT/Codex authentication and `gpt-6.1-sol`, with warming off. Both conditions passed all three tasks. Including judgments, automatic mode used about 1% fewer tokens but took about 17% longer; real cache reads were observed in both conditions. No effort update was sent during these short tasks. Live effort-change acceptance, broad quality equivalence and monetary savings remain unverified. Catalog dollar estimates are not an invoice or subscription quota conversion.

Install from the public Git source:

```sh
pi install git:github.com/Marila-mo/pi-auto-effort
```
