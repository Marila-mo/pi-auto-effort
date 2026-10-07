# Publication status

Checked on 2026-10-07.

- Source published to https://github.com/Marila-mo/pi-auto-effort at `6f6c35b1ba787e6d80c7b2ea36bded6981c72e85`. Source contents match local verified revision `917706e`, excluding the CI workflow.
- Public GitHub installation, package-origin RPC command discovery, `/auto-effort status`, and uninstall passed with a disposable HOME/cwd/agent directory and no credentials. Repeatable runner and evidence are retained locally under `artifacts/github-install-smoke.py` and `artifacts/github-install-1791411232.json`. Only the public git clone used network access; Pi model traffic was offline.
- CI workflow creation was rejected with `403 insufficient scopes`. The existing GitHub integration can write source files but not workflows. CI is NOT ENABLED; tests passed locally, not in GitHub Actions.
- npm publication is BLOCKED: `npm whoami` returns `ENEEDAUTH`. The package is not currently listed in npm. No interactive login or account changes were performed.
- Offline, no-refresh auth readiness remains: Codex ready; OpenAI API, Anthropic and TypeSafe not ready. Real-provider verification is NOT RUN. Readiness does not establish model entitlement or acceptable quota/cost exposure; Codex output cannot be strictly capped by this host's token/deadline settings. Warming stays OFF.
- No new issues were created. No release/tag was created; no unpublished npm version or enabled CI is implied.

Required external prerequisites: GitHub workflow-write authorization; npm publisher authentication/permissions; relevant provider authentication and explicitly acceptable bounded request/input and quota/cost exposure for live tests. Instructions to finish the task do not supply missing credentials or spending limits. Arbitrary extensions/future host versions and no-discriminant raw dispatch remain outside the verified compatibility scope.

Install the published source now:

```sh
pi install git:github.com/Marila-mo/pi-auto-effort
```
