# Publication status

Checked on 2026-10-08.

- Reviewed adaptive-effort fixes were published and merged through [PR #1](https://github.com/Marila-mo/pi-auto-effort/pull/1). Merge `311bc2903d5af9288f68f265d46682461d69f566` has the same source tree as verified fix `5c91be44d08cbb5a90cac041e6eef3dc49cfe1ec`.
- The [Verify workflow](../.github/workflows/verify.yml) now defines PR, main-push and manual runs for Node 22.19.0 and 22.x on Ubuntu 24.04. It executes the locked install and full `npm run verify`, retains logs and E2E/catalog evidence for 14 days, and uses no live vendor credentials. The previous 403 workflow-write limitation was observed during the earlier connector-based publication; the current authorized Git authentication has workflow scope. Use [Actions run results](https://github.com/Marila-mo/pi-auto-effort/actions) as hosted evidence, not a local passing report.
- Public Git installation and package-origin RPC discovery previously passed with disposable directories and no credentials. Source cloning used public network access; Pi model traffic was offline. That historical installation evidence remains distinct from hosted CI and live-provider measurements.
- No npm release, tag or publisher-login change is part of this follow-up. Earlier npm publication was blocked by missing publisher authentication; do not infer a published npm package from GitHub CI success.
- Live comparison is separate from CI. The chosen pilot uses existing Pi ChatGPT/Codex authentication, one fixed physical model, warming off, synthetic tasks and finite request/time limits. Real cache reads, judgment quality and total measured consumption must be recorded before any savings claim. Catalog dollar estimates are not an invoice or subscription quota conversion.

Install from the public Git source:

```sh
pi install git:github.com/Marila-mo/pi-auto-effort
```