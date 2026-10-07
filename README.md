# pi-auto-effort

Automatically adapt reasoning effort **without switching your answering model**. Uses either Pi's native Jev classifier or an isolated call to your current model, preserves provider-specific effort history, and optionally cooperates with Pi's native cache warming.

**Status: experimental, targeting Pi 1.0.4.** Automated tests exercise real Pi sessions and native provider conversion against an isolated HTTP protocol fixture. This is not evidence of live vendor cache hits. See [verification](docs/verification.md) and [limitations](#limitations).

## Install

Requires Node.js 22.19+ and Pi 1.0.4. Authenticate your answering provider through Pi's normal `/login`.

```sh
pi install git:github.com/Marila-mo/pi-auto-effort
```

Restart or `/reload`, then choose a supported **physical** model using `/model`. No `auto` virtual model is introduced. Do not load another auto-effort/provider-overriding extension for the same provider at the same time.

The package is not published to npm yet. Removing it: `pi remove git:github.com/Marila-mo/pi-auto-effort` followed by `/reload`.

## Defaults

- Automatic selection enabled; current answering model is the judge.
- Model remains selected; only its effective effort changes.
- Selection occurs for a new user task or phase transition, not every read/tool continuation.
- Allowed choices come from model capabilities; `low` is the default minimum.
- A 10-second selector deadline, no selector retries, confidence threshold 0.5.
- Failed/invalid/uncertain selection retains current effort. Cancellation never applies a late result.
- Extension-controlled warming is **off**; global Pi settings are not modified.
- No extra API key is required with the root selector, but each selection makes an additional model request and consumes quota.

The effective level is shown in the status line and persisted on assistant responses. It is distinct from the manually selected `/thinking` level; auto mode does not overwrite your global defaults.

## Commands

| Command                                | Effect                                               |
| -------------------------------------- | ---------------------------------------------------- |
| `/auto-effort status`                  | Show selector, effective effort and warming policy   |
| `/auto-effort on` / `off`              | Enable/disable new automatic decisions               |
| `/auto-effort root`                    | Use the current answering model as an isolated judge |
| `/auto-effort jev typesafe/jev-latest` | Use this exact native classifier                     |
| `/auto-effort warming inherit`         | Permit Pi's configured warming policy                |
| `/auto-effort warming off`             | Block warming for managed models                     |

Commands change the current extension instance only. Turning auto off does **not** delete effort-update history: later requests still need to replay it to preserve existing prefixes. Manual supported effort changes remain cache-adapted.

## Persistent configuration

Create `~/.pi/agent/pi-auto-effort.json` (or under `PI_CODING_AGENT_DIR`) and `/reload`:

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

For Jev, replace `selector` with:

```json
{ "kind": "jev", "provider": "typesafe", "model": "jev-latest" }
```

Authenticate that provider using Pi. Other Jev provider/model combinations can be explicitly selected if present in Pi's classifier catalog. There is no silent discovery or cross-provider fallback. Configuration is global-only to prevent a repository from redirecting your task text to an arbitrary judge.

Accepted minimum levels: `low`, `medium`, `high`, `xhigh`, `max`. Only supported choices at or above the configured minimum are offered. Timeout: 100–30,000 ms; confidence: 0.5–1. Invalid or unknown configuration fields disable automatic selection with a warning instead of silently choosing defaults.

## Provider support

| Environment                                              | Implementation                                                                    | Evidence                                                                     |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| GPT-6 family, `openai-codex`, official ChatGPT backend   | Fixed request-level effort + append-only `configuration_update` replay            | Astra, Luna, Sol and 6.1 Sol protocol fixtures verified; live checks not run |
| GPT-6 family, `openai`, official Responses API           | Same Responses update policy                                                      | Astra, Luna, Sol and 6.1 Sol protocol fixtures verified; live checks not run |
| Opus 5 / 5.5 and Sonnet 5.5, native `anthropic` endpoint | Pi's `supportsMidConvoEffort`, native historical effort messages and beta headers | All three protocol fixtures verified; live checks not run                    |
| Proxies, other providers/models and virtual selections   | No automatic effort adjustment                                                    | Intentionally unsupported                                                    |

GPT-6 eligibility is limited to the four model IDs listed above; new family members require explicit validation before being added. The provider/model metadata must actually permit the selected effort. Protocol compatibility is not inferred from a model name alone. Custom Anthropic beta headers must preserve both required native features. Incompatible payload changes fail before generation dispatch rather than silently changing top-level effort and losing cache reuse.

### Cache preservation is not cache immortality

OpenAI requests keep their initial effort fixed and replay subsequent changes at their original input boundaries. Anthropic uses Pi's existing per-message effort mechanism, not a second custom replay writer. Model, prompt, tools, format or history changes can change the prefix; compaction and edited history may require a rebase and cache miss.

Expiration, minimum cached-token thresholds, vendor routing and provider behavior still apply. The package cannot guarantee a hit or recover an already expired cache.

### Warming

With `warming: "inherit"`, Pi still owns scheduling, its global `off`/`streaming`/`idle` mode, cache lifetimes and economic thresholds. This extension does not force warming, add timers or import Pi's private `CacheWarmer` class.

Only a matching request snapshot may be warmed; warming never calls the selector or adds maintenance messages to task history. Codex maintenance uses a separate short suffix after the original cached prefix. A 10-second cancellation deadline is best-effort; **Codex does not enforce Pi's `maxTokens: 1` as a hard output or spending cap**. Warming consumes quota and may be unavailable when a safe matching snapshot cannot be established.

## Privacy and costs

Selector input contains bounded current/previous user text, the latest assistant text, and recent tool names/error flags. It excludes system prompts, thinking blocks, images, tool arguments and tool-result contents. Known credential patterns are redacted; arbitrary secrets or personal data in ordinary text are **not guaranteed to be removed**.

Your selected judge receives that text. Root mode sends it to the answering provider; Jev mode sends it to the explicitly configured classifier provider. Judgements and warming are extra requests. Selector usage is recorded separately without inserting judge conversations into task history. Raw requests, answers and task text are not written to diagnostic logs by this package.

## Limitations

- Pi 1.0.4's provider and warming contracts are the initial target. Future host versions require verification.
- Stream-only provider overlays retain Pi's bundled/remote catalogs and normal refresh/config/auth composition. Catalog loading, additions, removal, price/capability updates and unloading are checked against unmodified Pi using a synthetic catalog server. Native authentication is supported; provider-replacing authentication such as Radius is outside the supported scope.
- A later additive provider registration is treated as a conflict. Automatic processing stops; unloading leaves the merged registration intact rather than removing another extension's headers/auth/model settings.
- The public stream overlay does not expose a raw/simple discriminator. Requests with explicit native `reasoningEffort`/`thinkingEnabled`/`effort` options use raw dispatch; requests without those flags use simple normalization, including off. Low-level raw calls with no discriminator are not guaranteed identical native defaults.
- Other extensions can replace the same provider or modify request payloads. This package refuses existing provider ownership and validates its final invariants; it cannot make arbitrary combinations safe.
- Root judging may be slower/more expensive than Jev and may time out on harder tasks.
- Effort changes occur between responses, never during a running response.
- A classifier's confidence is not a probability that the main task will succeed.
- Live vendor behavior and cache hits remain unverified until separately measured.

## Development

```sh
npm ci --ignore-scripts
npm run verify
npm pack --dry-run
```

Necessary unit cases were authored before the corresponding production code. The HTTP fixture uses synthetic credentials and blocks external traffic. Reports are retained in `artifacts/`; CI uploads them even on failure.

## Related work

[mejiasd3v/pi-jev-router](https://github.com/mejiasd3v/pi-jev-router) already implements adaptive Astra effort with cache-preserving updates. Pi's native Anthropic adapter and OpenAI's mid-conversation configuration mechanism are reused, not presented as new protocols. This package focuses on a fixed answering model, root/Jev selector choice, metadata-only tool context and native Pi warming integration.

MIT licensed. No credentials, personal session data, host library copies or private local extensions are bundled.
