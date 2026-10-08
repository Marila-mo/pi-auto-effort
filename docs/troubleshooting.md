# Troubleshooting

[Overview](../README.md) · [Usage](usage.md) · [Configuration](configuration.md)

Start with `/auto-effort status` inside Pi. It reports automatic selection, selector kind, the effective/status value and warming policy. `ready` means the extension is ready for a managed request, not that credentials, a live judgment or cache hits have been verified. The status line shows `off` when automatic selection is disabled; the command's notification can still show the underlying effective/status value. Effort labels and response metadata are not provider acknowledgment.

## The command is unavailable

In your shell, run:

```sh
pi list
```

Confirm the package source is present and its extension has not been filtered out. Inspect Pi's startup extension errors, then run `/reload` in interactive Pi or restart. Use only one installation source and check any personal/project resource filters. A project-local installation also needs the appropriate project trust decision.

The published source installs with:

```sh
pi install git:github.com/Marila-mo/pi-auto-effort
```

Pi 1.0.4 and Node.js 22.19+ are the documented target. Do not assume another host version is compatible. npm is not currently a published installation source; see [publication status](publication.md).

`/reload` is an interactive built-in command. Automation must use the relevant SDK/RPC lifecycle interface; sending built-in `/reload` as an RPC `prompt` can enter the ordinary model-prompt path. `/auto-effort` itself is a registered extension command.

## `unsupported model` or a missing model

These are different problems:

- A model missing from Pi's `/model` picker can indicate unavailable provider authentication/catalog data.
- `unsupported model` means the selected model fails this extension's capability checks; it does not prove an authentication problem. Automatic adjustment is bypassed.

Choose a supported **physical** answering model. GPT IDs are exactly `gpt-6-astra`, `gpt-6-luna`, `gpt-6-sol`, `gpt-6.1-sol`, using `openai-codex` / `openai-codex-responses` at `https://chatgpt.com/backend-api`, or `openai` / `openai-responses` at `https://api.openai.com/v1` (a trailing slash is accepted there). Claude IDs are exactly `claude-opus-5`, `claude-opus-5-5`, `claude-sonnet-5-5`, using native `anthropic` / `anthropic-messages` at `https://api.anthropic.com`, with reasoning and `supportsMidConvoEffort` capability metadata.

Proxies, virtual `auto` selections, other IDs/APIs and merely compatible endpoints are not supported. Do not rename models or enable compatibility flags to defeat the checks. Built-in/remote catalog updates are preserved, but a newly listed model does not automatically become eligible.

## `Invalid pi-auto-effort.json; automatic selection disabled.`

Check the file location, JSON syntax, field names and allowed values in the [configuration reference](configuration.md). The file belongs in the global agent directory, not project `.pi` or as a nested `settings.json` key. Root selector accepts only `kind`; Jev needs its exact provider/model fields. Unknown keys are rejected.

Correct the file, then `/reload` or restart. The warning disables automatic selection and restores other defaults, including warming off; it does not unload historical replay/validation. `/auto-effort on` changes the current instance but does not repair or save the file, so it is not a persistent fix.

## `Effort selection failed or was uncertain; retaining current effort.`

Possible causes include an unavailable classifier, missing authentication, a timeout, malformed judgment output or confidence below your threshold. These internal causes are deliberately summarized by the displayed warning; it does not expose a specific credential/provider error.

For root, verify the selected answering provider's normal Pi authentication. For Jev, check the exact classifier catalog ID and that provider's authentication separately. Direct TypeSafe recognizes `TYPESAFE_API_KEY`; it must reach the process starting Pi. Classifiers are not chat models in `/model`, and this extension does not require codemode. It never silently switches to another judge provider.

Retention can legitimately keep `off`, `minimal` or a level below `minEffort`. Saved decisions can be reused within the same task/phase, so repeating a prompt or toggling `on` does not guarantee an immediate fresh judgment. Fix the prerequisite, reload persistent changes and inspect the next relevant task/phase; avoid unbounded retries, which can consume additional quota.

## `Auto-effort setup or payload validation failed; generation was not dispatched`

This generic error covers setup/ownership/payload failures, including **no supported effort meeting the configured minimum**. The internal string `No supported effort meets configured minimum` is not a separate user-facing diagnostic.

Check, in order:

1. Does the selected model support at least one automatic level at or above `minEffort`? If not, choose a compatible minimum/model or disable automatic selection; it does not silently clamp the minimum downward.
2. Is another extension registering the same provider or changing model/effort/history fields?
3. Have custom endpoint, compatibility or Anthropic beta settings changed the required native payload?

Preserve the error evidence. Do not bypass final validation, remove required beta features or inject your own `configuration_update` items. `/auto-effort off` stops new judgments but leaves the wrapper's historical replay and validation active, so it may not resolve a payload conflict. To remove the extension entirely, use the uninstall steps below. Live provider acceptance remains unverified even after local checks pass.

`Auto-effort request cancelled` instead indicates cancellation/supersession. Stop or wait for the current operation before changing session/model/configuration; do not interpret cancellation as a successful judgment.

## `provider conflict` or an existing-provider warning

Startup can emit `auto-effort will not replace an existing extension provider: <provider>`. Another extension already owns that provider registration, so this extension refuses takeover. A later additive registration can also produce `provider conflict` even if its stream callback is unchanged.

Use only one effort/provider-overriding extension for the affected provider, and reload or restart after disabling the unwanted resource. Do not delete unrelated provider settings or credentials. On shutdown, a later merged registration is left intact rather than deleting another extension's headers/auth/model settings. Restarting with the intended extension set is preferable to trying to mutate that merged state manually.

The public overlay also lacks a raw/simple discriminator. Explicit native `reasoningEffort` / `thinkingEnabled` / `effort` options use raw dispatch; calls without those flags receive simple normalization. Low-level raw calls without a discriminator are not guaranteed identical native defaults. If another extension depends on that behavior, test it independently or avoid the combination.

## Cache misses or rebasing

`Prompt/history settings changed: cache prefix rebased; a cache miss may occur.` means a request prefix could not be reused unchanged. Model/prompt/tools/format/history changes, compaction or edited history can require a rebase. Preserve normal session history; deleting it is not a cache fix.

Effort-history preservation does not override cache expiration, minimum cached-token thresholds or vendor routing. Synthetic fixture counters are not live cache-hit evidence, and the extension does not promise savings. See [verification](verification.md).

## Warming does not run—or requests continue after auto off

`warm:off` blocks warming only for this extension's managed models. `warm:inherit` merely permits Pi's global policy: a lifetime/economic threshold and a safe matching snapshot are still required. It does not force warming. Other models/extensions may follow different policies.

Automatic selection and warming are separate. Temporarily stop both with:

```text
/auto-effort off
/auto-effort warming off
```

For persistence, set `enabled` to `false` and `warming` to `"off"` in the extension file, then reload. This does not disable unrelated Pi/provider requests. Warming is an extra quota/cost exposure; **Codex does not enforce `maxTokens: 1` as a hard spending/output cap**, and cancellation deadlines are not billing limits. Leave warming off if exposure is unacceptable or unverified.

## Remove the extension safely

For the normal personal Git installation, run in your shell:

```sh
pi remove git:github.com/Marila-mo/pi-auto-effort
```

If installed with `--local`, remove it with `--local` in that same project. For another installation source/ref, use the source reported by `pi list`. Then `/reload` in interactive Pi or restart, and verify the command/resource is gone; a second installation can keep it loaded.

Removal does not need deletion of authentication, session files or the extension JSON file. Keep those private and retain recoverable history. Unloading removes this extension's future processing, not old session metadata; a fresh session may avoid old history dependencies, but is not a guaranteed cache recovery and can incur a cache miss.

## Prepare a sanitized report

Include Pi/Node versions, package revision/source, exact provider/model, root or Jev mode, minimum/current effort, warming policy, relevant settings **without credentials**, repeatable steps, exact observed notification/error and whether the reproduction used an isolated fixture or a live service.

Do not publish API keys, OAuth tokens, authorization headers, personal prompts, provider responses containing private data, raw session exports or unreviewed debug logs. Pi debug/session files can contain conversation and tool data. Known-pattern selector redaction is not universal secret removal. Prefer a minimal synthetic task and redact sensitive paths/data; screenshots are optional and must be reviewed before sharing.
