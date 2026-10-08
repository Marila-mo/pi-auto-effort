# Current-environment follow-up

Historical pre-pilot environment report. Its NOT RUN and exposure-authorization statements describe the baseline below. Current hosted CI and the bounded live comparison are recorded in [publication](publication.md) and [verification](verification.md#live-codex-pilot-2026-10-08).

Baseline: 6332044; Pi 1.0.4, Node 22.22.2. No issues, releases, npm publication, user settings or installed host changes are part of this run.

## Catalog correction

A synthetic loopback catalog test first reproduced remote-only models disappearing and remote price/capability metadata reverting when loading the extension. The fix uses the public named stream-only provider overlay rather than replacing the native provider. The test compares all model types/APIs with an unmodified Pi control, including refresh/removal, config key/header removal, raw same-API dispatch and non-destructive handling of a later additive registration. `npm run test:catalog` records source revision, a harness snapshot, scoped dirty patch, synthetic setup, expected/observed results and cleanup, including failures. Synthetic catalog dates/prices are not vendor facts.

## Credential-blind readiness

Offline `pi auth check --json --no-refresh --no-approve` reported Codex ready; OpenAI API, Anthropic and TypeSafe not ready. No credentials were printed or refreshed. Readiness does not prove model entitlement, available quota or spending authorization.

## Live verification: NOT RUN

Codex requests have no enforced small output/spending cap in this host. A deadline or request-count limit is not a hard exposure limit. No acceptable quota/spend exposure was established, so no additional live requests or warming were sent. Other protocols lack configured authentication. Real cache reads, vendor-confirmed effective effort, real Claude signature acceptance and economic savings remain unverified. Keep warming OFF. Future live execution must explicitly establish permitted endpoints/models, finite request/input budgets and acceptable quota/cost exposure, disable retries, use synthetic tasks and isolated minEffort=medium configuration. Do not treat the extension's own effort metadata or declared-price estimates as provider acknowledgment/billed cost.

The accessible local work is not blocked by these missing live prerequisites. Limits are documented, not reported as fixed or converted into issues. Existing fixture tests and independent review remain separate from real-vendor acceptance.
