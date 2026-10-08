# Usage

[README](../README.md) · [Configuration](configuration.md) · [Troubleshooting](troubleshooting.md)

This guide targets Pi 1.0.4. Installation/command loading and protocol fixtures were checked locally; actual vendor effort acceptance, cache hits and savings remain unverified.

## A normal session

1. [Install](../README.md#quick-start), authenticate the answering provider through `/login`, and `/reload` or restart Pi.
2. Select a supported physical model using `/model`. Do not choose a virtual `auto` model or combine competing provider/effort extensions.
3. Apply the [recommended configuration](../README.md#recommended-starting-configuration) if you want a `medium` automatic minimum; the built-in minimum is `low`.
4. Run `/auto-effort status`, then send your task normally.

Automatic selection can make an extra paid/quota-consuming judge request. Root sends selected text to your answering provider; Jev sends it to the explicitly configured classifier. Known credential redaction is not a complete secret filter. See [privacy and costs](#privacy-and-costs) before submitting sensitive text.

For example, you might start with “Fix the failing validation in this function,” then ask “Review the transaction boundary and failure recovery.” These are hypothetical tasks, not promises that particular efforts will be selected. Effort is chosen from the model's supported choices and your configured minimum; the extension does not replace the answering model with a larger or cheaper one.

Selection is keyed to a new user task or a detected phase transition—not every read or tool continuation. The current implementation distinguishes analysis, execution after successful edit/write tools, and recovery after recent failed tools. This is a heuristic based on tool metadata, not a complete understanding of task difficulty. Repeated contexts may reuse an earlier decision without another judge call. If only one allowed level remains, it is selected without a judge.

## Commands

Type these inside Pi, not in your shell. All changes affect the current extension instance only; none writes `pi-auto-effort.json`.

| Command | Effect |
| --- | --- |
| `/auto-effort` or `/auto-effort status` | Show on/off state, selector, effective status and warming policy. |
| `/auto-effort on` | Enable new automatic decisions. |
| `/auto-effort off` | Disable new automatic decisions; retain history replay and payload validation. |
| `/auto-effort root` | Select the current answering model as the isolated judge. Does not itself enable auto. |
| `/auto-effort jev typesafe/jev-latest` | Select this exact classifier provider/model. Does not authenticate it or itself enable auto. |
| `/auto-effort warming off` | Block this extension's managed-model warming path. |
| `/auto-effort warming inherit` | Permit Pi's existing policy, subject to matching snapshots and Pi's eligibility checks. |

The Jev command accepts another explicit `provider/model` pair if the classifier exists in Pi's catalog. No discovery or cross-provider fallback is performed. Invalid command syntax shows a usage warning. Commands can cancel pending setup; the new policy applies to subsequent requests, not the middle of a response.

**Before using `warming inherit`:** maintenance costs quota and is not guaranteed to save money. It does not change Pi's global `cacheWarming` setting or force a refresh. Codex has no hard output/spending cap from `maxTokens: 1`; cancellation is best-effort. Start with `warming off` and read [configuration](configuration.md).

## Root or Jev?

| | Root | Jev |
| --- | --- | --- |
| Judge | Current answering model, in a separate request | Explicit native classifier provider/model |
| Authentication | Existing answering-provider authentication | Classifier-provider authentication in addition to generation auth |
| Additional data recipient | Answering provider | Configured classifier provider |
| Trade-off | Simple setup, but can be slower/more expensive | Separate service and quota; performance/cost depend on that service |

To use root temporarily:

```text
/auto-effort root
/auto-effort on
/auto-effort status
```

For direct TypeSafe Jev, configure its API key through Pi's supported authentication method or set `TYPESAFE_API_KEY` in the environment that starts Pi. Do not put the key in `pi-auto-effort.json`. Then:

```text
/auto-effort jev typesafe/jev-latest
/auto-effort on
/auto-effort status
```

Classifier models do not appear in Pi's chat `/model` picker. This extension calls the classifier directly; you do not need to enable codemode. Selecting Jev is not proof of usable authentication or service entitlement. If it cannot judge, the extension retains current effort and warns rather than silently calling root or another provider. Make the selection persistent with the complete [configuration examples](configuration.md).

## Effective effort versus `/thinking`

Pi's `/thinking` selects the manually requested thinking level. Auto mode can choose a different effective level without changing that picker or your saved defaults. Consult `/auto-effort status` and the extension status line for the automatic state. The effective level is also recorded on assistant responses; it is the extension's applied/requested metadata, **not a vendor acknowledgment or cache-hit measurement**.

Before the first managed request, status can be `ready`; an unsupported model or ownership conflict has its own status. An illustrative extension status is:

```text
auto-effort: high · root · warm:off
```

This example is not an observed vendor response or a promise of the selected level. Off is shown while auto is disabled; use Pi's thinking picker to select a supported manual level.

For manual control:

```text
/auto-effort off
/auto-effort warming off
```

Then run `/thinking` and choose the desired level. Historical effort adaptation and final payload checks remain active while the extension is loaded. `off` is not a full uninstall and does not erase effort updates. Warming is an independent policy: turning auto off alone does not change `inherit` to `off`.

## Failure, cancellation and the minimum

- A failed, invalid, timed-out or low-confidence judge retains the existing effective level. That can include manual off/minimal or a level below your automatic minimum.
- `minEffort` restricts successful automatic choices; it is not a universal minimum for all requests or manual mode.
- If the model has no supported automatic choice at or above the minimum, generation stops with a setup/payload error. It does not silently lower the minimum.
- Cancellation does not apply a late judge result. Extra requests already sent may still consume quota.
- Unsafe final payload/model/beta changes fail before managed generation dispatch. Do not bypass those checks to suppress an error; use [troubleshooting](troubleshooting.md).

## Reload, resume and history

Commands are temporary. Editing the global JSON file and running `/reload` replaces the extension runtime and rereads persistent configuration. A later restart likewise uses the file, not previous command changes.

Effort decisions and replay state are stored in versioned custom session entries and reconstructed from the active branch. Existing state can therefore survive reload/resume or follow branch navigation. Disabling auto does not delete it. Compaction, edited history, changed prompt/tools/model/cache key, or a different branch may require a rebuilt prefix and a cache miss.

A fork is not a guarantee of an empty effort history: behavior follows the session history Pi includes in that fork. Use a new independent session for a fresh conversation, not deletion of stored sessions. Loopback fixtures exercise reload, compaction, tree navigation, persisted resume and new-file forks; arbitrary session modifications and live caches are not certified. Auxiliary judge/summary and warming requests do not save main-turn decisions or add maintenance turns to task history.

## Update or remove

Run package management in your shell. For the default personal Git installation:

```sh
pi update git:github.com/Marila-mo/pi-auto-effort
```

Then `/reload` or restart Pi. This updates the named package; bare `pi update` updates Pi itself. Host versions other than 1.0.4 need separate compatibility verification. Check `pi list` for the source/ref you actually installed; pinned Git refs do not move to a newer ref automatically.

To remove the same personal installation:

```sh
pi remove git:github.com/Marila-mo/pi-auto-effort
```

Then `/reload` or restart Pi. If you installed with `--local`, use `pi remove --local git:github.com/Marila-mo/pi-auto-effort` from that project instead. If you also loaded a local file/clone or explicit `-e` path, disable that source too. Package removal does not require deleting your credentials or sessions. You may remove the extension's JSON config if you no longer want it, but it is separate from package removal.

Unloading stops this extension's replay/validation behavior; do not expect an existing cache prefix to remain reusable afterward.

## Privacy and costs

The judge sees bounded current/previous user text, recent assistant text, and recent tool names/error flags. System prompts, thinking blocks, images, tool arguments and tool-result contents are excluded. Known credential patterns are redacted; other private data in ordinary text may still be sent.

Judge usage is stored separately from task conversation messages. Root/Jev judgments and optional warming are extra requests. Their actual price and quota effects depend on the provider; deadlines, confidence thresholds and estimated model prices are not hard spending limits. This extension does not log raw task/judge requests or answers in diagnostics, but Pi sessions and user-generated debug/export files can contain private material. Review and redact them before sharing.

Cache-preserving updates are designed to avoid unnecessarily rewriting prefixes. Expiration, vendor thresholds/routing, history changes and other settings still cause misses. Neither cache hits nor lower total costs are guaranteed. See [verification](verification.md) and [publication status](publication.md) for the current evidence boundary.
