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

Each attempt saves `artifacts/e2e-<timestamp>.json`, including failed attempts. Reports contain revision, working-tree dirty status, Node/Pi versions, exact command, setup/cleanup, expected outcomes and observed scenario results. Early development reports predate the dirty-status field; use only the final clean-revision run as release evidence. Reports are retained locally in ignored `artifacts/`. GitHub Actions CI is not currently enabled: publishing its workflow was blocked by workflow-write permissions. Do not interpret local passing reports as hosted CI results. See [publication status](publication.md).

Fixture cache counters, prices and cache lifetimes are deliberately synthetic. Shortened lifetimes and fixture economics exercise Pi's real scheduler without waiting minutes or charging a vendor. Effective effort and immutable-prefix checks are separate from real cache-read accounting.

## Observed local coverage

The final source tree passes 14 pre-authored unit tests and 11 Pi/native-HTTP fixture configurations: four GPT IDs under both Responses providers and three Claude IDs. Flows cover manual minimal/off, failed/deadlined judges retaining off, cancellation, replacement-safe metadata, reload, configuration refresh/removal, native compaction, tree navigation, persisted runtime resume, new-file forks, unsafe model/beta/update rejection, native Jev and standard warming. Split-turn compactions can make two native summary requests; neither invokes the selector.

A disposable offline Pi CLI/RPC run also installed the packed archive without `node_modules`, discovered the package-origin command, handled `/auto-effort status`, and removed its local configuration. It used no user-global settings or credentials. Reproduction steps and archive fingerprints are retained in the local `artifacts/packed-install-*` reports.

Public GitHub installation was also checked with disposable HOME/cwd/agent directories, no credentials and offline Pi model traffic. Source cloning alone used the public network. See [publication status](publication.md) for the dated revision and local runner/report references.

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
