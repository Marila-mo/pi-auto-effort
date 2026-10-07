# pi-auto-effort implementation and verification plan

Status: implementation authorized; npm publication is not part of this run. Existing personal extensions/settings must remain unchanged. Development/review agents must not use low effort. Product-supported effort values are a separate concern.

## Goal and scope

Keep the user's physical answering model selected while automatically choosing its reasoning effort with either a native Jev classifier or an isolated call to that answering model. Preserve provider-specific prompt prefixes when effort changes. Make native Pi warming available without private CacheWarmer imports or custom timers. Publish reviewed source to Marila-mo/pi-auto-effort, not via the differently authenticated local GitHub CLI.

Target host: Pi 1.0.4 initially. OpenAI Responses/Codex GPT-6 family on official endpoints; Anthropic Opus 5/5.5 and Sonnet 5.5 on its native endpoint with supportsMidConvoEffort. No blanket proxy compatibility claims, model switching, Liquid d1 dependency, subagent framework, credential files or user session history in the repository.

## Architecture decision

Use a physical-model provider boundary rather than a virtual selection. During session_start verify ownership and capture a raw delegate through public builtinProviders. Register only the public named api/streamSimple configuration, retaining Pi's original dynamic remote-catalog base and current auth/config composition. Never capture composed closures. Ownership requires the exact minimal effective configuration: additive registrations are conflicts and must survive shutdown. Explicit native raw thinking options bypass automatic processing and use the raw delegate; other requests use simple normalization, including omitted/off reasoning. Public dispatch has no raw/simple discriminator, so bare low-level raw default equivalence is not guaranteed. Conversion/transport remain native.

The synchronous wrapper returns an AssistantMessageEventStream and bridges asynchronous setup/native events with exactly one terminal event. Main requests are identified by session ID plus selected physical model, auxiliary selectors/summaries use different IDs, and native Pi 1.0.4 warm requests use maxTokens=1. Unsupported models pass through without classification or transformation. Failed/cancelled setup must not dispatch generation. No reliance on throwing in before_provider_request (Pi logs and swallows those exceptions).

Main selector snapshots contain bounded user/assistant plain text and tool names/error flags, never tool arguments/results, system sections, images or thinking. Known credential patterns are redacted, not a universal sensitive-data filter. Context is classified at a new user task or phase boundary; unchanged phases and retries reuse decisions. Keep current effort on selector error/invalid/uncertain results; abort/supersession never applies late changes. Root judge uses separate session ID, no tools, fixed medium-or-higher judge reasoning, bounded output where enforced and a deadline. Jev uses Pi's classify API with explicit provider/model. No fallback to a different provider unless selected by the user.

The generated message records the actual effort as providerThinkingLevel; message_end must preserve the effective thinkingLevel rather than the agent loop's old requested level. UI reports selected/effective effort separately instead of mutating global defaults. State follows the active branch via versioned custom entries and restores on start/tree; auxiliary/warm calls never save selection or replay state.

Codex/OpenAI: validate the final payload after all original onPayload hooks; own configuration_update exclusively, pin initial reasoning.effort, store update index and original-prefix hash, replay at original positions. Include root-settings identity to detect prompt/tool/model/cache-key changes. Rebase explicitly with a cache-miss notice when history/root changes. Reject auto truncation/compaction and incompatible injected update items before sending. Do not claim cache longevity or hits are guaranteed.

Anthropic: reuse native supportsMidConvoEffort, providerThinkingLevel, history insertion and automatic beta headers; do not write a second update history. Validate the final request's fixed top-level effort, effective update, thinking mode and essential beta headers before dispatch. Respect native thinking-signature handling. Custom endpoint/header incompatibility disables auto before a change or fails closed at dispatch; never quietly downgrade to top-level switching.

Warming: local option off by default; inherit permits Pi's own configured streaming/idle/off mode and economics. Do not alter global settings, force warming or create extra timers. Wrapper replays the matching saved prefix without classification or state changes; Codex appends a separate small maintenance suffix, never task tools. Use a bounded cancellation deadline. maxTokens is NOT claimed as a hard Codex output/cost bound. Usage remains in native cache_warm entries. Unsafe/unverifiable warming remains unavailable, with clear status.

Session lifecycle: abort pending selector setup on model switch, tree navigation, compaction, shutdown and configuration changes. Track generation epoch, session ID, selected model and branch ownership. Never publish a late verdict. Disabling auto leaves historical replay active. Reject/diagnose simultaneous ownership with the old local effort-presets extension; isolated QA never loads it.

## Work sequence

1. Capability/type/API review and independent plan review.
2. Package scaffold, enumerated failure cases and necessary isolated tests BEFORE first targeted production edit.
3. First Codex + root-judge end-to-end slice; native Jev; native Anthropic; optional native warming.
4. Types/build and observable isolated real-Pi runtime flows; public packaging/docs; independent stable-diff review; fixes and final QA.
5. Verified GitHub upload via the authenticated Marila-mo integration. Check remote baseline before publishing. npm readiness only, no npm publish.

## Failure modes to prepare before production code

- Strict configuration defaults, unknown/invalid fields, timeout/choice/minimum ranges, unavailable selector/auth, unsupported/off/minimal model levels, virtual/custom/proxy endpoints, unsupported or stale native capability metadata.
- Root/classifier choices: valid allowed level, malformed JSON, code fences/extra prose/keys, tools instead of text, incomplete/error/aborted response, low confidence, NaN/negative/non-normalized probabilities, choice not maximal, unsupported choices, deadline, external abort, late backend that ignores abort, bounded output and usage, no recursion or task transcript pollution, no cross-provider fallback.
- Privacy: system/thinking/image/tool argument/result exclusion, bounded Unicode-safe text, credential redaction, no raw task/judge logging, no secret-bearing provider errors in diagnostics.
- Sticky policy: new user, same phase with reads, successful edit, latest failed tool batch, recovery completion, repeated same input, retry, direct/summary/warm requests, manual effort on disable, model change, reload/resume/tree/fork, cancelled/superseded judgement and state corruption/version mismatch.
- OpenAI replay: first request, each supported effort change including decreases, unchanged effort, same-boundary update, stable prefix and cache key, original input immutability, root/tool/prompt/format/cache-key changes, compaction/shorter/edited history, malformed payload, old warm snapshots, foreign configuration_update, server auto truncation/compaction, original payload hooks and thrown hook errors.
- Anthropic: all advertised model IDs, native effective-effort metadata, fixed top-level effort, history replay, custom headers missing required beta, incompatible thinking mode, signature preservation, conflicting output_config hooks, unsupported models pass-through.
- Streaming/lifecycle: start ordering, exactly one terminal event, error before start, text/tool updates, cancellation, correct effective level and usage in persisted response, session branch ownership, duplicate extension/provider replacement detection.
- Warming: off/default/inherit, no forced native settings, threshold/TTL scheduling, selector bypass, complete prior prefix, old matching snapshot replay, no saved maintenance messages/choices, native usage, deadline/abort, new request/tree/model/shutdown, tool output never executed.
- Packaging: portable imports/no private paths, no bundled host deps, source-only tarball allowlist, fresh local/git install, uninstall, README default accuracy, license and no secret/session artifacts, CI reproducibility.

This is a comprehensive relevant checklist, not proof that every possible failure is enumerated. Necessary isolated tests are authored now; later newly discovered behaviors are checked through E2E/probes or unchanged tests, not newly added targeted unit cases after production edits.

## Verification and evidence

Use genuine Pi SDK/CLI sessions with disposable data and an isolated HTTP protocol fixture server. These exercise the real extension, model runtime, provider request conversion, agent tools, persistence and warm scheduler. Fixture protocol flows are end-to-end within that isolated system, not evidence of real vendor cache hits. Label fixture usage counters explicitly synthetic.

Live vendor checks are a separate opt-in runner using already-authorized auth and a bounded number of non-sensitive requests; no new spend/auth escalation. Preserve revision, host/node versions, data/setup/cleanup, exact commands, expected/observed results, selectors, effective efforts, cache reads and logs for EACH E2E attempt, including failures. NOT RUN when credentials/budget/support are unavailable; never label unverified live models as fully verified. Cache reads, effective effort, and immutable-prefix replay are separate acceptance checks.

Independent review sees an exact stable diff and actual initial QA output; do not edit its scope while reviewed. Root integrates evidence-backed findings, reruns QA and verifies the final published tree matches reviewed local source.
