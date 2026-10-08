# Verification

## Evidence categories

1. `npm test`: isolated policy/deadline tests. Not E2E.
2. `npm run test:e2e`: real Pi SDK sessions, native model runtime/auth/request conversion, extension callbacks, command dispatch and persistence, with a loopback HTTP protocol fixture. No real vendor credentials, external calls or vendor cache evidence.
3. `npm run test:catalog`: a real Pi runtime comparison against an unmodified control with synthetic loopback catalogs, including refresh/removal, model metadata, configuration removal, raw/simple dispatch and non-destructive provider conflicts. Not live vendor evidence.
4. Live vendor verification: **NOT RUN** in the initial local implementation checks. A passing fixture must not be interpreted as Anthropic/OpenAI acceptance or real cache-hit proof.

## Reproduce the isolated run

Prerequisites: Node.js >=22.19, dependencies from the lockfile, Pi 1.0.4. From the repository:

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run test:e2e
npm run test:catalog
```

The E2E runner creates a disposable agent directory and synthetic auth, starts a loopback HTTP server, sends native protocol traffic to that server, and rejects all other destinations. At completion it closes the server and deletes the disposable directory. It restores the original process environment and fetch function.

Each attempt saves `artifacts/e2e-<timestamp>.json`, including failed attempts. Reports contain revision, working-tree dirty status, Node/Pi versions, exact command, setup/cleanup, expected outcomes and observed scenario results. Early development reports predate the dirty-status field; use only the final clean-revision run as release evidence. Reports are retained locally in ignored `artifacts/`. The [Verify workflow](../.github/workflows/verify.yml) executes `npm ci --ignore-scripts` and `npm run verify` on Ubuntu 24.04 with Node 22.19.0 and 22.x for pull requests, pushes to main and manual dispatch. Each matrix job uploads JSON reports, catalog reproduction snapshots/patches and `artifacts/verify.log` even after failures, retaining them for 14 days. The log records actual Node/npm versions, tested revision, prerequisites and expected outcomes. Actions are pinned to immutable commits, checkout credentials are not persisted, and workflow permissions are limited to contents read. No live vendor credentials or model calls are used. Hosted [Actions results](https://github.com/Marila-mo/pi-auto-effort/actions) are distinct from local verification; see [publication status](publication.md).

Fixture cache counters, prices and cache lifetimes are deliberately synthetic. Shortened lifetimes and fixture economics exercise Pi's real scheduler without waiting minutes or charging a vendor. Effective effort and immutable-prefix checks are separate from real cache-read accounting.

## Observed local coverage

The baseline source tree passed 14 pre-authored unit tests and 11 Pi/native-HTTP fixture configurations: four GPT IDs under both Responses providers and three Claude IDs. Flows cover manual minimal/off, failed/deadlined judges retaining off, cancellation, replacement-safe metadata, reload, configuration refresh/removal, native compaction, tree navigation, persisted runtime resume, new-file forks, unsafe model/beta/update rejection, native Jev and standard warming. Split-turn compactions can make two native summary requests; neither invokes the selector.

A disposable offline Pi CLI/RPC run also installed the packed archive without `node_modules`, discovered the package-origin command, handled `/auto-effort status`, and removed its local configuration. It used no user-global settings or credentials. Reproduction steps and archive fingerprints are retained in the local `artifacts/packed-install-*` reports.

Public GitHub installation was also checked with disposable HOME/cwd/agent directories, no credentials and offline Pi model traffic. Source cloning alone used the public network. See [publication status](publication.md) for the dated revision and local runner/report references.

## Independent review follow-up (2026-10-08)

The supplied evidence pinned `acf629080e0f359e3c0659fcbd3978ac21930fa3`, which matched the fetched main HEAD. Under supported Node 22.22.3, all original 14 tests passed and the seven additional review assertions failed before changes. Original reproduction output is retained separately from final verification output.

R1/R2 exposed a documented phase-only policy tradeoff that did not meet the dynamically adaptive requirement. R1 now checks bounded reassessment after four completed tool batches, rather than requiring another paid judgment for every different public progress sentence. R2 retains the second-failure checkpoint. The new key policy invalidates old phase-only decision identities without changing the version-1 session/cache format.

R3/R4 were confirmed type-validation defects. R5/R6 were missing local compatibility guards; the [official reasoning guide](https://developers.openai.com/api/docs/guides/reasoning) specifies standard single-agent mode for configuration updates. Their fixture checks establish rejection before transport, not vendor acceptance. R7 assumed that a prepared state had already been sent. It now marks that state explicitly and checks immutable same-effort replay plus explicit rejection of an identical-input effort change. Draft replacement remains covered by the original test.

Separately, the extension integration cached failed-selection fallback as a successful decision. This is fixed with successful-only persistence and a separate bounded transient cooldown. Real Pi tool-loop coverage checks both selector recovery and stored decision entries, with actual filesystem read operations, native request conversion and synthetic protocol responses. It also checks within-phase escalation/simplification, repeated tool errors/recovery episodes, exact native transport retry payloads and unsupported OpenAI modes.

The expanded suite contains 30 isolated tests, retaining the original 14, plus the existing 11 protocol configurations and five catalog scenarios. For OpenAI API, OpenAI OAuth and Claude, the actual-read adaptive loop uses nine main requests and three judgments over eight completed batches, selecting medium for four responses, high for four, then medium. This is six fewer judgments than an every-response policy for that fixture, not measured monetary savings. Recovery and failed-selector loops report their counters independently; native OpenAI retry uses identical bodies across synthetic 503, 429 and success.

These runs measure request counts and structural cache-prefix preservation in deterministic fixtures. They do not prove optimum reasoning quality, live vendor cache reuse or monetary savings. The periodic policy intentionally allows up to four tool batches of lag; tool-result contents remain excluded from the judge under the existing privacy contract. Live paid tests require separate user approval.
## Release verification gates

- Type checks and all unchanged unit tests pass.
- Isolated Pi runtime checks cover each advertised protocol implementation.
- Root/Jev selector success/failure/cancellation, persistence/reload/branching, unsafe hook rejection and warming are checked separately.
- Package tarball includes only its intended allowlist; no credentials, private paths, user transcripts or duplicated host libraries.
- Reviewed source tree is stable; independent reviewer sees the pinned diff and actual checks.
- Live model/provider combinations without evidence remain marked unverified, not fully supported.

## Live vendor checks (separate)

Use non-sensitive disposable tasks and already-authorized credentials. Bound the number of requests; do not claim a Codex token limit is a spending limit. Keep a sufficiently long stable prefix for the vendor's documented caching minimum, and compare requests within the cache lifetime. Record:

- commit, host/runtime versions, exact provider/model/endpoint and relevant headers;
- setup and repeatable commands/interaction steps;
- requested and effective effort, selector request count and actual usage;
- real cache-read tokens before/after switching, with cache writes and output separated;
- real Claude encrypted-thinking signatures and final beta-header acceptance (fixture thinking blocks do not prove vendor signature acceptance);
- disable, resume, compaction, cancellation and warming observations;
- expected/observed status, errors and redacted logs.

Do not publish authorization headers, API keys, OAuth tokens, raw personal prompts or provider responses containing private data. Missing credentials, spend authorization or available models means NOT RUN, not PASS.
