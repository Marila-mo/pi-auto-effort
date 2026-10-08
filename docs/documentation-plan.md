Historical plan for the initial documentation-only change. Its CI-disabled and workflow-exclusion statements describe that earlier run; current CI status is maintained in [publication](publication.md) and [verification](verification.md).

# User documentation implementation plan

Status: implemented; independent plan review (xhigh, OKAY) and stable documentation review (medium, correct) found no unresolved blockers. Final clean-tree checks and public documentation upload follow the reviewed content. Scope: documentation only, on the existing Pi 1.0.4 extension; no production-code, dependency, credential, user-setting or workflow changes. Communication is Japanese; public documents remain English to match the repository. Existing live-verification limits remain in force.

## Goal

A first-time reader can identify what the package does, install it from the actually published Git source, choose a supported physical answering model, inspect status, set a persistent root/Jev policy, and stop/remove it without confusing automatic effort with model routing, manual thinking, caching guarantees or warming.

## Allowed paths

- `README.md`: concise entry point and navigation, feature/non-feature overview, safe quick start, exact model IDs, experimental/live-evidence warning, costs/privacy summary, defaults versus recommended settings, development/publication accuracy.
- `docs/usage.md`: normal interactive workflow, complete extension command table, root versus Jev, hypothetical task examples (no promised output level), effective versus manually requested effort, phase boundaries/failure behavior, branch/reload/history behavior, update/remove.
- `docs/configuration.md`: the actual global JSON path, all six fields and selector variants with types/defaults/ranges, allowed supported choices, floor exceptions on failure/manual mode, complete copyable JSON examples, reload/persistence, classifier authentication prerequisites, warming opt-in conditions and cost limitations.
- `docs/troubleshooting.md`: exact emitted diagnostics/status values with safe recovery, unavailable commands/model/classifier/auth, invalid config, no allowed levels (generation fails rather than pretending fallback), provider ownership and payload conflicts, warming/cache misconceptions, sanitized bug-report guidance and uninstall. Do not advise deleting sessions/auth or bypassing final validations.
- `docs/verification.md`: remove enabled-CI claims, include the existing catalog check and publication evidence references; preserve distinction between fixture and real-service acceptance.
- `docs/publication.md` and `docs/current-environment.md`: navigation/clarifications only when needed, preserve dated historical evidence. Do not alter auth/publication status without checking it.
- `docs/documentation-plan.md`: this bounded plan and completion evidence.
- Directly relevant reproducible documentation-check/RPC/install helpers and reports in ignored `artifacts/` only, if needed. No new or modified unit tests.

## Evidence and assumptions

Read `src/config.ts`, `src/index.ts`, `src/selector.ts`, package scripts and existing verification/publication records, plus installed Pi 1.0.4 package/model/auth/settings/CLI documentation. The code is the source of truth for extension behavior. Public examples from pi-jev-router and two extension collections inform information layout only, not API or compatibility claims.

- Omitted config defaults include minEffort=low; recommended getting-started example sets medium and warming=off. Do not conflate developer no-low policy with product capabilities.
- Root judgment uses the selected answering model but is an extra isolated request; Jev explicitly uses the configured classifier and its separate auth. No Liquid d1 requirement or automatic provider fallback.
- Auto off stops new judgments, not historical replay, validation, or warming policy. Commands do not write the JSON file; reload rereads it.
- A floor filters automatic choices only. Unsupported minimum with no choices stops generation. Selector failure may retain existing off/minimal/below-floor effort; not a hard universal floor.
- Cache-preserving effort changes do not prove cache hits or savings. Warming remains off in examples; inherit does not force Pi warming or create a hard Codex spending cap.
- Only the exact allowlisted physical provider/model/API/official-endpoint combinations qualify. Classifiers need not appear in Pi's chat model picker.
- GitHub source is published. npm is not published and CI is not enabled; do not add working npm/CI badges or claim hosted verification.

## Sequence and verification

1. Review this authored plan independently at xhigh, not low. Reconcile evidence-backed blockers before writing user-facing documents; record advice/decisions here. No routine user approval pause.
2. Rewrite README as an entry point and add the three guides. Keep detailed settings/commands in one canonical location and use relative links; preserve material warnings close to cost-generating actions. Amend existing verification's CI wording.
3. Validate local relative links and heading anchors, JSON syntax of every configuration example, exact field/default/command/model consistency against the already-read source, and archive inclusion/exclusion. These are static/documentation checks, not E2E or proof of live behavior.
4. Use a disposable HOME/cwd/agent directory, no credentials, Pi model traffic offline, synthetic configuration with minEffort=medium and warming off. Exercise actual Pi CLI installation/list, package-origin command discovery, root/Jev/on/off/status/warming-off commands, reload of documented JSON and uninstall through RPC; no normal user prompt/provider requests. Preserve commands, revisions, setup/cleanup and observed results for failed as well as passing runs. This proves command/config loading, not interactive picker rendering, selector outcomes or live cache effectiveness.
5. Run unchanged `npm run verify`, `git diff --check`, and tarball dry-run/inspection. No unit-test additions after production changes and no production changes for this documentation task.
6. Independently review the stable documentation diff against its pinned baseline and source/evidence, using medium or higher. Make justified corrections, recheck changed scope, and record unverified interactive/live flows honestly.
7. Commit scoped docs. Recheck authenticated GitHub owner/remote contents; upload only changed documentation, excluding workflow files. Prior user publishing authorization covers this repository update. Verify exact local-versus-remote file contents. If remote moved with overlapping edits or permission is lost, leave only the affected upload blocked; no force push, alternate account, npm publication or permission changes.

## Independent plan review decisions

The xhigh review found no blockers. Adopt its two clarifications: installation/removal are CLI operations; RPC verification must check handled commands and notification text, and must not send built-in `/reload` as an RPC prompt (it could become a model prompt). Use an isolated, test-only extension command invoking `ctx.reload()` if reload needs RPC exercise. Distinguish source-internal causes from the generic setup/payload error actually shown to users; classifier/auth failures appear as the selection-failure warning. Interactive/live outcomes remain NOT RUN.

## Acceptance criteria

- README provides a short safe path from understanding to installation/status and links the guides.
- All config fields/defaults/ranges, selector prerequisites and commands match source; recommended JSON is distinguished from defaults.
- New readers see additional costs/data recipients, unsafe warming exposure, experimental support and fixture/live distinction before any example that can cause extra calls.
- Troubleshooting offers recovery without hiding failures or compromising secrets/session history.
- Internal links/JSON/package content and feasible offline CLI/RPC flows pass; unavailable interactive/live checks are NOT RUN.
- Stable independent review has no unresolved evidence-backed blockers. GitHub docs match the scoped local result, or the precise publication blocker is recorded.

## Implementation evidence

- Reworked README and added usage, configuration and troubleshooting guides; fixed existing verification's enabled-CI claim and documented catalog coverage.
- Static JSON/local-link/anchor checks passed (42 checks); the dry-run archive includes the guides and excludes private artifacts/dependencies.
- Genuine offline Pi CLI/RPC checks passed: install/list, package-origin discovery, command handling and actual root/Jev/on/off/warming-off notifications, persistent configuration restored by a test-only `ctx.reload()` command, and uninstall. An initial batch-request reload race failed and was preserved; serializing requests/responses corrected the test driver without changing production code.
- Existing 14 unit tests, 11 protocol-fixture configurations and catalog E2E passed. Interactive picker/rendering and real service judgments/cache effects remain NOT RUN; no screenshots or live-savings claims.
- Source/dependencies/tests, user settings/auth/session data and workflows were not changed. Documentation writers used medium effort; plan review used xhigh and final review medium.
- Reproduction helpers and all passing/failing reports are retained locally under ignored `artifacts/` (`docs-check.py`, `docs-rpc-smoke.py`, `docs-verify.log`). Public documents describe evidence categories, not publicly hosted artifact availability.

## Recovery

All baseline docs are committed. Keep unrelated user changes untouched; revert only this task's documentation if necessary using a new corrective commit. Publication changes are a non-destructive documentation commit, never history replacement. Existing production behavior, global settings, auth and sessions remain unchanged.
