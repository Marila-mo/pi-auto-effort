import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createAssistantMessageEventStream,
  getSupportedThinkingLevels,
  type AssistantMessage,
  type Api,
  type Model,
  type Provider,
  type ModelThinkingLevel,
} from "@earendil-works/pi-ai";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import {
  getAgentDir,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  adaptPayload,
  replayWarm,
  isCacheState,
  digest,
  type CacheState,
} from "./cache.js";
import {
  allowedLevels,
  capability,
  LEVELS,
  parseConfig,
  record,
  type Config,
  type Effort,
} from "./config.js";
import { snapshot, select } from "./selector.js";

const STATE = "pi-auto-effort/v1";
const APIS: Record<string, Api> = {
  "openai-codex": "openai-codex-responses",
  openai: "openai-responses",
  anthropic: "anthropic-messages",
};
type Stored = {
  version: 1;
  model: string;
  decisions: { key: string; effort: Effort }[];
  cache?: CacheState;
  lastLevel?: ModelThinkingLevel;
};
const ref = (m: Model<Api>) => `${m.provider}/${m.id}`;
const responseKey = (m: AssistantMessage) =>
  `${m.provider}/${m.model}/${m.timestamp}/${m.responseId ?? ""}`;
const wireEffort = (m: Model<Api>, level: ModelThinkingLevel) =>
  m.thinkingLevelMap?.[level] ??
  (m.api === "anthropic-messages" && level === "minimal"
    ? "low"
    : level === "off"
      ? "none"
      : level);
const zero = () => ({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
});

export default function autoEffort(pi: ExtensionAPI) {
  let current: ExtensionContext | undefined;
  let config: Config = parseConfig({});
  let scope = new AbortController();
  let stored: Stored | undefined;
  let status = "not started";
  const owners = new Map<string, { original: Provider; wrapper: Provider }>();
  const pending = new WeakMap<AssistantMessage, ModelThinkingLevel>();
  const responseLevels = new Map<string, ModelThinkingLevel>();
  const warmSnapshots = new Map<string, ModelThinkingLevel>();
  const failedSelections = new Map<string, number>();
  function cancel() {
    scope.abort();
    scope = new AbortController();
    warmSnapshots.clear();
    failedSelections.clear();
  }
  function owned(
    ctx: ExtensionContext,
    id: string,
    wrapper: Provider,
  ): boolean {
    const registered = ctx.modelRegistry.getRegisteredProviderConfig(id);
    return (
      !ctx.modelRegistry.getRegisteredNativeProvider(id) &&
      !!registered &&
      Object.keys(registered).every(
        (key) => key === "api" || key === "streamSimple",
      ) &&
      registered.api === APIS[id] &&
      registered.streamSimple === wrapper.streamSimple
    );
  }
  function visibleStatus(ctx: ExtensionContext): string {
    if (!ctx.model || !capability(ctx.model)) return "unsupported model";
    const owner = owners.get(ctx.model.provider);
    if (!owner || !owned(ctx, ctx.model.provider, owner.wrapper))
      return "provider conflict";
    return status;
  }
  function show(ctx: ExtensionContext) {
    ctx.ui.setStatus(
      "auto-effort",
      `auto-effort: ${config.enabled ? visibleStatus(ctx) : "off"} · ${config.selector.kind} · warm:${config.warming}`,
    );
  }
  function restore(ctx: ExtensionContext) {
    cancel();
    current = ctx;
    stored = undefined;
    for (const entry of ctx.sessionManager.getBranch()) {
      if (
        entry.type !== "custom" ||
        entry.customType !== STATE ||
        !record(entry.data)
      )
        continue;
      const data = entry.data;
      if (
        data.version === 1 &&
        typeof data.model === "string" &&
        Array.isArray(data.decisions) &&
        data.decisions.every(
          (d) =>
            record(d) &&
            typeof d.key === "string" &&
            typeof d.effort === "string" &&
            LEVELS.includes(d.effort as Effort),
        ) &&
        (data.cache === undefined || isCacheState(data.cache)) &&
        (data.lastLevel === undefined ||
          (typeof data.lastLevel === "string" &&
            ["off", "minimal", ...LEVELS].includes(data.lastLevel)))
      )
        stored = data as Stored;
    }
    status =
      ctx.model && stored?.model === ref(ctx.model)
        ? (stored.lastLevel ?? "ready")
        : "ready";
    show(ctx);
  }
  function save(next: Stored) {
    stored = next;
    pi.appendEntry(STATE, next);
  }
  pi.on("session_start", (_event, ctx) => {
    try {
      let raw: unknown = {};
      try {
        raw = JSON.parse(
          readFileSync(join(getAgentDir(), "pi-auto-effort.json"), "utf8"),
        );
      } catch (error) {
        if (!record(error) || error.code !== "ENOENT") throw error;
      }
      config = parseConfig(raw);
    } catch {
      config = { ...parseConfig({}), enabled: false };
      ctx.ui.notify(
        "Invalid pi-auto-effort.json; automatic selection disabled.",
        "warning",
      );
    }
    restore(ctx);
    for (const id of ["openai-codex", "openai", "anthropic"]) {
      if (
        ctx.modelRegistry.getRegisteredNativeProvider(id) ||
        ctx.modelRegistry.getRegisteredProviderConfig(id)
      ) {
        ctx.ui.notify(
          `auto-effort will not replace an existing extension provider: ${id}`,
          "warning",
        );
        continue;
      }
      // Delegate to the raw implementation, but register only a stream overlay.
      // Pi retains its dynamic catalog and composes current configuration once.
      const original = builtinProviders().find(
        (provider) => provider.id === id,
      );
      if (!original) continue;
      const wrapper: Provider = {
        ...original,
        streamSimple(model, context, options) {
          const active = current;
          const cap = capability(model);
          if (
            !active ||
            !cap ||
            options?.sessionId !== active.sessionManager.getSessionId() ||
            active.model?.provider !== model.provider ||
            active.model.id !== model.id ||
            !owned(active, id, wrapper) ||
            ["reasoningEffort", "thinkingEnabled", "effort"].some(
              (key) => key in (options ?? {}),
            )
          )
            return ["reasoningEffort", "thinkingEnabled", "effort"].some(
              (key) => key in (options ?? {}),
            )
              ? original.stream(model, context, options)
              : original.streamSimple(model, context, options);
          const output = createAssistantMessageEventStream();
          const lifecycle = scope.signal;
          const signal = options?.signal
            ? AbortSignal.any([options.signal, lifecycle])
            : lifecycle;
          const sessionId = active.sessionManager.getSessionId();
          const anchor = active.sessionManager.getLeafId();
          const owns = () =>
            current === active &&
            !signal.aborted &&
            active.sessionManager.getSessionId() === sessionId &&
            (anchor === null ||
              active.sessionManager
                .getBranch()
                .some((entry) => entry.id === anchor)) &&
            active.model?.provider === model.provider &&
            active.model.id === model.id &&
            owned(active, id, wrapper);
          const assertOwns = () => {
            signal.throwIfAborted();
            if (!owns())
              throw new Error("Auto-effort request ownership changed");
          };
          void (async () => {
            const requested: ModelThinkingLevel = options?.reasoning ?? "off";
            let effective: ModelThinkingLevel =
              stored?.model === ref(model)
                ? (stored.lastLevel ??
                  stored.decisions.at(-1)?.effort ??
                  requested)
                : requested;
            try {
              assertOwns();
              const warm = options?.maxTokens === 1;
              const snapshotKey = digest([ref(model), context.messages]);
              const existing =
                stored?.model === ref(model) ? stored : undefined;
              let decisions = existing?.decisions ?? [];
              if (warm) {
                const matched = warmSnapshots.get(snapshotKey);
                if (
                  config.warming !== "inherit" ||
                  !matched ||
                  (cap.kind === "openai" && !existing?.cache)
                )
                  throw new Error("Auto-effort warming unavailable");
                effective = matched;
              } else if (config.enabled) {
                const choices = allowedLevels(
                  getSupportedThinkingLevels(model),
                  config.minEffort,
                );
                if (!choices.length)
                  throw new Error(
                    "No supported effort meets configured minimum",
                  );
                const snap = snapshot(context.messages);
                const key = digest([
                  ref(model),
                  config.selector,
                  config.minEffort,
                  config.confidence,
                  snap.key,
                ]);
                const saved = decisions.findLast((d) => d.key === key);
                if (saved && choices.includes(saved.effort))
                  effective = saved.effort;
                else if (
                  failedSelections.get(key) === undefined ||
                  snap.progressStep - failedSelections.get(key)! >= 2
                ) {
                  let selected: Effort | undefined;
                  try {
                    selected =
                      choices.length === 1
                        ? choices[0]!
                        : await select(
                            active,
                            model,
                            snap.state,
                            choices,
                            config,
                            signal,
                          );
                  } catch {
                    assertOwns();
                    failedSelections.set(key, snap.progressStep);
                    if (failedSelections.size > 32)
                      failedSelections.delete(
                        failedSelections.keys().next().value!,
                      );
                    active.ui.notify(
                      "Effort selection failed or was uncertain; retaining current effort.",
                      "warning",
                    );
                  }
                  assertOwns();
                  if (selected !== undefined) {
                    effective = selected;
                    failedSelections.delete(key);
                    decisions = [...decisions, { key, effort: selected }].slice(
                      -32,
                    );
                  }
                }
              } else effective = requested;
              assertOwns();
              status = effective;
              show(active);
              const { reasoning: _requestedReasoning, ...nativeOptions } =
                options ?? {};
              const native = original.streamSimple(model, context, {
                ...nativeOptions,
                ...(effective === "off" ? {} : { reasoning: effective }),
                signal: warm
                  ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
                  : signal,
                onPayload: async (raw, physical) => {
                  const nativeHistory =
                    cap.kind === "anthropic" &&
                    record(raw) &&
                    Array.isArray(raw.messages)
                      ? digest(
                          raw.messages.filter(
                            (m) => record(m) && m.output_config !== undefined,
                          ),
                        )
                      : undefined;
                  const replaced = await options?.onPayload?.(raw, physical);
                  assertOwns();
                  let value = replaced === undefined ? raw : replaced;
                  if (!record(value) || value.model !== model.id)
                    throw new Error("Payload model changed by another hook");
                  if (cap.kind === "openai") {
                    if (warm) {
                      const replayed = replayWarm(value, existing!.cache!);
                      value = {
                        ...replayed,
                        input: [
                          ...replayed.input,
                          {
                            role: "user",
                            content: [
                              {
                                type: "input_text",
                                text: "Cache maintenance only. Do not resume tasks or call tools. Reply only OK.",
                              },
                            ],
                          },
                          {
                            type: "configuration_update",
                            reasoning: { effort: "medium" },
                          },
                        ],
                      };
                    } else {
                      if (
                        !record(value.reasoning) ||
                        value.reasoning.effort !== wireEffort(model, effective)
                      )
                        throw new Error(
                          "Payload effort changed by another hook",
                        );
                      const adapted = adaptPayload(
                        value,
                        existing?.cache
                          ? { ...existing.cache, sent: true }
                          : undefined,
                        // A failed judge can retain off/minimal; selector choices remain restricted.
                        !LEVELS.includes(effective as Effort),
                      );
                      value = adapted.payload;
                      assertOwns();
                      save({
                        version: 1,
                        model: ref(model),
                        decisions,
                        cache: { ...adapted.state, sent: true },
                        lastLevel: effective,
                      });
                      if (adapted.rebased)
                        active.ui.notify(
                          "Prompt/history settings changed: cache prefix rebased; a cache miss may occur.",
                          "info",
                        );
                    }
                  } else {
                    // The SDK's per-request params.betas overrides client header defaults.
                    const betas = Array.isArray(value.betas) ? value.betas : [];
                    if (
                      ![
                        "mid-conversation-output-config-2026-07-01",
                        "thinking-binding-controls-2026-08-01",
                      ].every((feature) => betas.includes(feature))
                    )
                      throw new Error(
                        "Required Anthropic beta headers missing",
                      );
                    if (
                      !record(value.output_config) ||
                      value.output_config.effort !== "high" ||
                      !record(value.thinking) ||
                      value.thinking.type !== "adaptive" ||
                      !record(value.thinking.block_binding) ||
                      value.thinking.block_binding.prefix_mismatch_behavior !==
                        "drop_block" ||
                      !Array.isArray(value.messages)
                    )
                      throw new Error(
                        "Incompatible native Anthropic effort payload",
                      );
                    const final = value.messages.findLast(
                      (m) => record(m) && record(m.output_config),
                    );
                    if (
                      !record(final) ||
                      !record(final.output_config) ||
                      final.output_config.effort !==
                        wireEffort(model, effective) ||
                      nativeHistory !==
                        digest(
                          value.messages.filter(
                            (m) => record(m) && m.output_config !== undefined,
                          ),
                        )
                    )
                      throw new Error(
                        "Anthropic effective effort changed by another hook",
                      );
                    if (!warm) {
                      assertOwns();
                      save({
                        version: 1,
                        model: ref(model),
                        decisions,
                        lastLevel: effective,
                      });
                    }
                  }
                  assertOwns();
                  if (!warm) {
                    warmSnapshots.set(snapshotKey, effective);
                    if (warmSnapshots.size > 16)
                      warmSnapshots.delete(warmSnapshots.keys().next().value!);
                  }
                  return value;
                },
              });
              for await (const event of native) {
                if ("partial" in event) {
                  if (cap.kind === "openai")
                    event.partial.providerThinkingLevel = effective;
                  pending.set(event.partial, effective);
                }
                if (event.type === "done" || event.type === "error") {
                  const message =
                    event.type === "done" ? event.message : event.error;
                  if (cap.kind === "openai")
                    message.providerThinkingLevel = effective;
                  pending.set(message, effective);
                  if (!warm) {
                    responseLevels.set(responseKey(message), effective);
                    if (responseLevels.size > 64)
                      responseLevels.delete(
                        responseLevels.keys().next().value!,
                      );
                  }
                }
                output.push(event);
              }
              output.end();
            } catch {
              const error: AssistantMessage = {
                role: "assistant",
                api: model.api,
                provider: model.provider,
                model: model.id,
                content: [],
                usage: zero(),
                timestamp: Date.now(),
                stopReason: signal.aborted ? "aborted" : "error",
                errorMessage: signal.aborted
                  ? "Auto-effort request cancelled"
                  : "Auto-effort setup or payload validation failed; generation was not dispatched",
                providerThinkingLevel: effective,
              };
              pending.set(error, effective);
              output.push({
                type: "error",
                reason: error.stopReason as "error" | "aborted",
                error,
              });
              output.end();
            }
          })();
          return output;
        },
      };
      owners.set(id, { original, wrapper });
      pi.registerProvider(id, {
        api: APIS[id]!,
        streamSimple: wrapper.streamSimple,
      });
    }
    show(ctx);
  });
  pi.on("message_end", (event) => {
    if (event.message.role !== "assistant") return;
    const effective =
      pending.get(event.message) ??
      responseLevels.get(responseKey(event.message));
    responseLevels.delete(responseKey(event.message));
    if (effective)
      return { message: { ...event.message, thinkingLevel: effective } };
    return;
  });
  pi.on("model_select", (_event, ctx) => restore(ctx));
  pi.on("session_tree", (_event, ctx) => restore(ctx));
  pi.on("session_compact", () => cancel());
  pi.on("session_shutdown", (_event, ctx) => {
    cancel();
    for (const [id, owner] of owners)
      if (owned(ctx, id, owner.wrapper)) pi.unregisterProvider(id);
    owners.clear();
    current = undefined;
  });
  pi.on("cache_warming_decision", (_event, ctx) => {
    if (
      ctx.model &&
      capability(ctx.model) &&
      owners.has(ctx.model.provider) &&
      owned(ctx, ctx.model.provider, owners.get(ctx.model.provider)!.wrapper) &&
      config.warming === "off"
    )
      return { action: "stop" };
    return;
  });
  pi.registerCommand("auto-effort", {
    description:
      "Auto effort: on, off, status, root, jev provider/model, warming off|inherit",
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/u);
      if (parts[0] === "on" || parts[0] === "off") {
        cancel();
        config = { ...config, enabled: parts[0] === "on" };
      } else if (parts[0] === "root") {
        cancel();
        config = { ...config, selector: { kind: "root" } };
      } else if (parts[0] === "jev" && parts[1]?.includes("/")) {
        const slash = parts[1].indexOf("/");
        cancel();
        config = {
          ...config,
          selector: {
            kind: "jev",
            provider: parts[1].slice(0, slash),
            model: parts[1].slice(slash + 1),
          },
        };
      } else if (
        parts[0] === "warming" &&
        ["off", "inherit"].includes(parts[1] ?? "")
      ) {
        cancel();
        config = { ...config, warming: parts[1] as Config["warming"] };
      } else if (args.trim() && args.trim() !== "status") {
        ctx.ui.notify(
          "Usage: /auto-effort on|off|status|root|jev provider/model|warming off|inherit",
          "warning",
        );
        return;
      }
      show(ctx);
      ctx.ui.notify(
        `Auto effort ${config.enabled ? "on" : "off"}; selector ${config.selector.kind}; effective ${visibleStatus(ctx)}; warming ${config.warming}. Changes are session-only. Extra selection/warming requests consume quota.`,
        "info",
      );
    },
  });
}
