# Configuration

[Overview](../README.md) · [Usage and commands](usage.md) · [Troubleshooting](troubleshooting.md)

pi-auto-effort keeps your selected answering model and chooses its effort. The root selector uses that same model for a separate judgment; Jev uses the explicitly configured classifier provider. Judgments can send conversation text and consume additional quota. Real vendor effort acceptance, cache hits and savings remain **unverified**; see [verification](verification.md).

## File location and persistence

Create or edit this **global extension-specific** file:

```text
~/.pi/agent/pi-auto-effort.json
```

If `PI_CODING_AGENT_DIR` is set, use `pi-auto-effort.json` inside that directory instead. This is not a key inside Pi's `settings.json`, and project `.pi/pi-auto-effort.json` is not read. Keeping the judge configuration global prevents a repository from silently choosing a different recipient for your task text.

Use valid JSON, with no comments or trailing commas. Preserve any existing settings you want to keep. Run `/reload` inside interactive Pi after editing the file, or restart Pi. The file is read when the extension's session starts; it is not watched continuously.

Commands such as `/auto-effort root` and `/auto-effort off` change the current extension instance only. They do not write this file. Reloading rereads the persistent configuration and can replace those temporary choices. Session effort/replay history is separate: rereading configuration does not erase it.

If the file is absent or contains `{}`, the defaults below apply. Fields may be omitted. The file itself must be an object, not `null`. For its six defaulted fields, the parser treats `null` values as omitted; prefer omission or explicit values to keep configuration clear. Invalid JSON, unknown keys or invalid values produce `Invalid pi-auto-effort.json; automatic selection disabled.` The extension then uses its other defaults with automatic selection disabled and warming off; it is **not unloaded**.

## Settings reference

| Field | Type / accepted values | Default | Meaning |
| --- | --- | --- | --- |
| `enabled` | Boolean | `true` | Allow new automatic decisions. `false` does not remove history replay or payload validation, and does not independently change warming policy. |
| `selector` | One of the objects below | `{ "kind": "root" }` | Choose who judges effort, not who generates your answer. |
| `timeoutMs` | Integer, **100–30,000** inclusive | `10000` | Selector deadline in milliseconds. The selector uses no retries. It is not a hard provider output, billing or quota cap. |
| `confidence` | Number, **0.5–1** inclusive | `0.5` | Minimum accepted judgment confidence. A higher threshold can cause more judgments to be rejected; it is not a task-success probability. |
| `minEffort` | `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"` | `"low"` | Filter automatic choices by this minimum and the model's supported levels. See the exceptions below. |
| `warming` | `"off"` or `"inherit"` | `"off"` | Block warming for managed models, or permit Pi's own policy when a matching safe snapshot exists. |

No other top-level keys are supported. `cacheWarming`, API keys and model lists do not belong in this file.

### Selector objects

For root, `kind` must be the **only** key:

```json
{ "kind": "root" }
```

The current answering provider's normal Pi authentication is reused. No separate classifier key is required, but a judgment is still an extra model request. Root judging requests medium reasoning through Pi's native model mapping; `minEffort` filters answer-effort choices, not the judge's own reasoning setting.

For Jev, provide all three keys, with nonempty strings for the exact catalog provider/model IDs:

```json
{ "kind": "jev", "provider": "typesafe", "model": "jev-latest" }
```

Unknown selector keys are rejected. IDs are not automatically discovered, trimmed or replaced with a fallback. Other explicit provider/model combinations can be used when the model exists in Pi's **classifier** catalog and its provider is authenticated. The `kind: "jev"` path invokes Pi's classifier API; it does not switch the answering model.

## Recommended root configuration

This is a starting recommendation, **not the defaults**: it raises the automatic minimum from `low` to `medium` and leaves warming off.

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

Authenticate the answering provider through Pi's normal `/login`, select a [supported physical model](../README.md#supported-answering-models), reload, then inspect `/auto-effort status`. When more than one eligible effort needs a fresh judgment, the root provider receives a bounded selection snapshot and charges/uses quota under its normal terms.

## Jev configuration and authentication

Jev sends the selection snapshot to the chosen classifier provider, which may differ from the answering provider. Only use a recipient you are willing to send that text to; classifier calls can be billed separately.

```json
{
  "enabled": true,
  "selector": {
    "kind": "jev",
    "provider": "typesafe",
    "model": "jev-latest"
  },
  "timeoutMs": 10000,
  "confidence": 0.5,
  "minEffort": "medium",
  "warming": "off"
}
```

For direct TypeSafe, Pi recognizes `TYPESAFE_API_KEY`. Supply it securely to the process that starts Pi, or use Pi's supported authentication flow for that provider. Do **not** put credentials in `pi-auto-effort.json`, source control or diagnostic reports. The answering provider still needs its own normal authentication.

Classifier models do not appear in the chat `/model` picker. You do not need to select Jev as the answering model or enable codemode for this extension. Catalog presence and usable classifier authentication are separate prerequisites. If classifier discovery, authentication or judgment fails, the extension retains the current effort; it does not silently try root or another provider.

## What the minimum does—and does not do

Automatic choices are the intersection of the model's supported levels and this ordered list at or above `minEffort`:

```text
low → medium → high → xhigh → max
```

- `off` and `minimal` are not automatic selector choices or valid `minEffort` values.
- A minimum does not invent unsupported levels. If no supported choice meets it, generation stops with the generic setup/payload error described in [troubleshooting](troubleshooting.md), rather than silently lowering the minimum.
- With exactly one eligible choice, the extension uses it without a classifier/root judgment. Saved decisions can also avoid a new judgment.
- On an invalid, uncertain or timed-out judgment, the **current effort is retained**. That may be below the minimum, including manual `off` or `minimal`. The minimum is not a hard invariant for every request.
- When automatic selection is off, the manually requested Pi level controls subsequent managed generation, with historical updates still replayed. It is not constrained by `minEffort`.

Allowed effort labels are model-relative and can map to different provider wire values. Status/response metadata is the extension's record, not independent provider confirmation.

## Warming is a separate opt-in

Keep `warming: "off"` unless you have assessed the additional quota/cost exposure. This setting applies to models managed by this extension, not every model or extension in Pi.

`warming: "inherit"` only permits Pi's existing global `cacheWarming` policy (`off`, `streaming` or `idle`). That Pi setting belongs in Pi's global `settings.json`, **not** this extension's file. The extension does not change it, force a refresh or add its own scheduler. Pi's cache lifetime/economic conditions and a matching request snapshot must still be satisfied; `inherit` does not guarantee a request will run.

Warm requests do not invoke the selector or add maintenance messages to task history, but they are additional provider requests. **Codex does not enforce Pi's `maxTokens: 1` as a hard output/spending cap.** A cancellation deadline is best-effort and does not guarantee zero charges. Automatic selection off does not mean warming off: use `/auto-effort warming off` for a temporary restriction and save `"warming": "off"` for persistence.

Preserving a prefix cannot recover an expired cache, guarantee a cache hit or prove that warming saves money. Do not infer live savings from the synthetic counters/prices used in local tests.

## Data sent to the judge

Selection uses bounded current/previous user text, the latest assistant text, and recent tool names/error flags. It excludes system prompts, thinking, images, tool arguments and tool-result contents. Known credential patterns are redacted, but arbitrary secrets and personal data in ordinary text are **not guaranteed to be removed**.

Root receives this snapshot at your answering provider; Jev receives it at the configured classifier provider. Keep sensitive task text out of recipients you do not trust. See [usage](usage.md) for controls and [troubleshooting](troubleshooting.md) for failure/recovery steps.
