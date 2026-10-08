# pi-auto-effort

Automatically adjust reasoning effort **without switching your answering model**.

Reasoning effort is the model's thinking-intensity setting, not the answer length or a guarantee of quality. This Pi extension chooses an effort for the next step using your current model (**root**) or a configured **Jev classifier**. It keeps the selected physical model and preserves provider-specific effort history so changes need not rewrite an existing prompt prefix.

**Experimental; targets Pi 1.0.4.** Local tests use real Pi sessions and isolated HTTP fixtures. Live provider acceptance, cache hits and savings are **not verified**. Warming is off by default. [Verification](docs/verification.md) · [Publication status](docs/publication.md)

## Before you start

- Root judgments are extra requests to your answering provider and consume quota. Jev judgments send selected task text to the configured classifier provider and require its authentication.
- Selected user/assistant text and recent tool names/error flags can be sent to the judge. System prompts, thinking blocks, images, tool arguments and tool-result contents are excluded. Known credential patterns are redacted, but arbitrary secrets in ordinary text are **not guaranteed to be removed**.
- This is not model routing, a virtual `auto` model, a cache-hit guarantee, or a hard spending limit. It does not change your global Pi defaults.

## Quick start

Requires **Pi 1.0.4** and **Node.js 22.19+**. Review the source before installing: Pi extensions run with your operating-system permissions.

```sh
pi install git:github.com/Marila-mo/pi-auto-effort
```

Inside Pi:

1. Run `/login` for your answering provider if needed.
2. Run `/reload` (or restart Pi).
3. Use `/model` to select a supported **physical** model from the table below.
4. Run `/auto-effort status`. In a fresh session with auto enabled, a supported, conflict-free model starts as `ready`; after a managed request it shows the effective effort.
5. Send your task normally. The selected model stays fixed; effort changes only between responses.

Do not load another auto-effort/provider-overriding extension for the same provider alongside this one. npm installation is not available yet.

### Recommended starting configuration

Create `~/.pi/agent/pi-auto-effort.json` (or `pi-auto-effort.json` under `PI_CODING_AGENT_DIR`), then `/reload`:

```json
{
  "enabled": true,
  "selector": { "kind": "root" },
  "timeoutMs": 10000,
  "confidence": 0.5,
  "minEffort": "medium",
  "warming": "off"
}
```

This example deliberately uses `medium`. **Without a config file, the actual minimum defaults to `low`**, with auto enabled, root selection, a 10-second deadline, confidence 0.5 and warming off. The minimum filters automatic choices; it is not a universal floor. A failed judge can retain a prior lower level, including off/minimal. If no supported automatic choice meets the minimum, generation fails rather than silently lowering it.

## Guides

- [Usage](docs/usage.md): commands, root/Jev choice, manual control, sessions, update and removal.
- [Configuration](docs/configuration.md): every field, defaults, valid ranges and complete examples.
- [Troubleshooting](docs/troubleshooting.md): missing commands/models, warnings, conflicts and safe recovery.
- [Verification](docs/verification.md): what the local checks prove—and what they do not.

For temporary controls, use `/auto-effort off`, `/auto-effort on` or `/auto-effort root`. They do not write the configuration file. **Off stops new judgments, not historical replay, payload validation or the independent warming policy.** See the [complete command reference](docs/usage.md#commands).

## Supported answering models

All rows require compatible model metadata, reasoning support and the specified native API/official endpoint—not merely a matching name.

| Provider | Exact model IDs | API / endpoint |
| --- | --- | --- |
| `openai-codex` | `gpt-6-astra`, `gpt-6-luna`, `gpt-6-sol`, `gpt-6.1-sol` | `openai-codex-responses`; `https://chatgpt.com/backend-api` |
| `openai` | `gpt-6-astra`, `gpt-6-luna`, `gpt-6-sol`, `gpt-6.1-sol` | `openai-responses`; `https://api.openai.com/v1` (optional trailing slash) |
| `anthropic` | `claude-opus-5`, `claude-opus-5-5`, `claude-sonnet-5-5` | `anthropic-messages`; `https://api.anthropic.com`; native `supportsMidConvoEffort` |

These 11 provider/model combinations have protocol-fixture coverage, **not live-service certification**. Proxies, other providers/models and virtual selections do not receive automatic adjustment. New IDs and future Pi versions need separate verification.

## Cache preservation and warming

OpenAI keeps the original request-level effort fixed and replays append-only effort updates at their original history boundaries. Managed updates require standard single-agent mode. Already submitted boundaries are immutable: identical-input retries must retain their effort, and changed effort requires appended history. Anthropic reuses Pi's native historical effort mechanism and required beta features. Ordinary cache thresholds, expiry and vendor routing still apply; changed prompts/tools/history or compaction may require a rebase and cache miss.

Leave warming **off** to start. `inherit` only permits Pi's own warming policy when a matching snapshot and Pi's scheduling/economic conditions allow it. It does not force warming. Maintenance consumes quota; **Codex does not enforce Pi's `maxTokens: 1` as a hard output/spending cap**, and the cancellation deadline is best-effort. Read [configuration](docs/configuration.md) before opting in.

## Compatibility limits

- Native auth and Pi's dynamic catalog/config composition are retained. Provider-replacing authentication such as Radius is outside the supported scope.
- Existing provider ownership is refused. Later additive registrations are conflicts; unloading preserves the merged registration rather than deleting another extension's settings.
- Incompatible final payload changes fail before generation dispatch. Arbitrary extension combinations are not guaranteed safe.
- The public stream overlay cannot always distinguish raw from simple calls. Explicit native `reasoningEffort`/`thinkingEnabled`/`effort` options use raw dispatch; other calls receive simple normalization. Bare low-level raw calls are not guaranteed identical native defaults.
- A judge's confidence is not a probability that the main task succeeds. Root judging can be slow or time out; failure retains the current effort.

## Development

```sh
npm ci --ignore-scripts
npm run verify
npm pack --dry-run
```

The verification suite includes the original 14 policy/deadline tests, reviewed regression checks, adaptive checkpoint checks and real-Pi loopback protocol/catalog E2E flows. Reports are retained locally in `artifacts/`. **GitHub CI is currently not enabled**; local success is not a hosted CI result. See [publication status](docs/publication.md).

## Related work and license

[pi-jev-router](https://github.com/mejiasd3v/pi-jev-router) already implements adaptive effort with cache-preserving updates. This package focuses on a fixed answering model, root/Jev choice, metadata-only tool context and native Pi warming; it does not claim to invent the underlying provider mechanisms.

[MIT](LICENSE). No credentials, personal sessions, host library copies or private local extensions are bundled.
