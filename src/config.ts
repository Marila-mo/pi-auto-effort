export const LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof LEVELS)[number];
export type Config = {
  enabled: boolean;
  selector: { kind: "root" } | { kind: "jev"; provider: string; model: string };
  timeoutMs: number;
  confidence: number;
  minEffort: Effort;
  warming: "off" | "inherit";
};
export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function parseConfig(value: unknown): Config {
  if (
    !record(value) ||
    Object.keys(value).some(
      (key) =>
        ![
          "enabled",
          "selector",
          "timeoutMs",
          "confidence",
          "minEffort",
          "warming",
        ].includes(key),
    )
  )
    throw new Error("Invalid auto-effort configuration");
  const enabled = value.enabled ?? true,
    timeoutMs = value.timeoutMs ?? 10000,
    confidence = value.confidence ?? 0.5,
    minEffort = value.minEffort ?? "low",
    warming = value.warming ?? "off";
  if (
    typeof enabled !== "boolean" ||
    typeof timeoutMs !== "number" ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 100 ||
    timeoutMs > 30000 ||
    typeof confidence !== "number" ||
    !Number.isFinite(confidence) ||
    confidence < 0.5 ||
    confidence > 1 ||
    !LEVELS.includes(minEffort as Effort) ||
    typeof warming !== "string" ||
    !["off", "inherit"].includes(warming)
  )
    throw new Error("Invalid auto-effort configuration");
  const selector = value.selector ?? { kind: "root" };
  if (!record(selector)) throw new Error("Invalid selector");
  if (selector.kind === "root" && Object.keys(selector).length === 1)
    return {
      enabled,
      timeoutMs,
      confidence,
      minEffort: minEffort as Effort,
      warming: warming as Config["warming"],
      selector: { kind: "root" },
    };
  if (
    selector.kind !== "jev" ||
    Object.keys(selector).some(
      (key) => !["kind", "provider", "model"].includes(key),
    ) ||
    typeof selector.provider !== "string" ||
    !selector.provider.trim() ||
    typeof selector.model !== "string" ||
    !selector.model.trim()
  )
    throw new Error("Invalid selector");
  return {
    enabled,
    timeoutMs,
    confidence,
    minEffort: minEffort as Effort,
    warming: warming as Config["warming"],
    selector: {
      kind: "jev",
      provider: selector.provider,
      model: selector.model,
    },
  };
}
export function allowedLevels(
  supported: readonly string[],
  minimum: Effort,
): Effort[] {
  return LEVELS.filter(
    (level, index) =>
      index >= LEVELS.indexOf(minimum) && supported.includes(level),
  );
}
export function capability(model: {
  id: string;
  provider: string;
  api: string;
  baseUrl: string;
  reasoning: boolean;
  compat?: unknown;
}): { kind: "openai" | "anthropic" } | undefined {
  if (!model.reasoning) return;
  let url: URL;
  try {
    url = new URL(model.baseUrl);
  } catch {
    return;
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    return;
  if (
    ["gpt-6-astra", "gpt-6-luna", "gpt-6-sol", "gpt-6.1-sol"].includes(
      model.id,
    ) &&
    ((model.provider === "openai-codex" &&
      model.api === "openai-codex-responses" &&
      url.origin === "https://chatgpt.com" &&
      url.pathname === "/backend-api") ||
      (model.provider === "openai" &&
        model.api === "openai-responses" &&
        url.origin === "https://api.openai.com" &&
        ["/v1", "/v1/"].includes(url.pathname)))
  )
    return { kind: "openai" };
  if (
    model.provider === "anthropic" &&
    model.api === "anthropic-messages" &&
    ["claude-opus-5", "claude-opus-5-5", "claude-sonnet-5-5"].includes(
      model.id,
    ) &&
    url.origin === "https://api.anthropic.com" &&
    ["/", ""].includes(url.pathname) &&
    record(model.compat) &&
    model.compat.supportsMidConvoEffort === true
  )
    return { kind: "anthropic" };
  return;
}
