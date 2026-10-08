import { createHash } from "node:crypto";
import { LEVELS, record } from "./config.js";
export const digest = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
type Item = Record<string, unknown>;
export type Payload = {
  model: string;
  input: Item[];
  reasoning: { effort: string; [key: string]: unknown };
  [key: string]: unknown;
};
export type CacheState = {
  version: 1;
  // Omitted for prepared drafts; sent requests cannot rewrite the same boundary.
  sent?: boolean;
  root: string;
  base: string;
  length: number;
  prefix: string;
  boundaries: { length: number; prefix: string }[];
  updates: { index: number; prefix: string; effort: string }[];
};
const WIRE_LEVELS = [...LEVELS, "none", "minimal"];
function validate(value: unknown, manual = false): asserts value is Payload {
  if (
    !record(value) ||
    typeof value.model !== "string" ||
    !Array.isArray(value.input) ||
    !value.input.every(record) ||
    !record(value.reasoning) ||
    !(manual ? WIRE_LEVELS : LEVELS).includes(value.reasoning.effort as never)
  )
    throw new Error("Unsupported Responses payload or effort");
  if (
    (value.reasoning.mode !== undefined &&
      value.reasoning.mode !== "standard") ||
    value.multi_agent !== undefined ||
    value.context_management !== undefined ||
    (value.truncation !== undefined && value.truncation !== "disabled") ||
    value.input.some((item) => item.type === "configuration_update")
  )
    throw new Error(
      "Incompatible Responses update ownership or automatic history management",
    );
}
function root(payload: Payload): string {
  const { effort: _, ...reasoning } = payload.reasoning;
  return digest([
    payload.model,
    payload.instructions,
    payload.tools,
    payload.text,
    payload.parallel_tool_calls,
    payload.tool_choice,
    payload.prompt_cache_key,
    reasoning,
  ]);
}
export function isCacheState(value: unknown): value is CacheState {
  return (
    record(value) &&
    value.version === 1 &&
    (value.sent === undefined || typeof value.sent === "boolean") &&
    typeof value.root === "string" &&
    typeof value.prefix === "string" &&
    typeof value.base === "string" &&
    WIRE_LEVELS.includes(value.base as never) &&
    Number.isSafeInteger(value.length) &&
    Number(value.length) >= 0 &&
    Array.isArray(value.boundaries) &&
    value.boundaries.every(
      (b) =>
        record(b) &&
        Number.isSafeInteger(b.length) &&
        Number(b.length) >= 0 &&
        typeof b.prefix === "string",
    ) &&
    Array.isArray(value.updates) &&
    value.updates.every(
      (u, i, a) =>
        record(u) &&
        Number.isSafeInteger(u.index) &&
        Number(u.index) >= 0 &&
        Number(u.index) <= Number(value.length) &&
        typeof u.prefix === "string" &&
        typeof u.effort === "string" &&
        WIRE_LEVELS.includes(u.effort as never) &&
        (i === 0 || Number((a[i - 1] as Item).index) < Number(u.index)),
    )
  );
}
export function adaptPayload(
  value: unknown,
  previous?: CacheState,
  manual = false,
): { payload: Payload; state: CacheState; rebased: boolean } {
  validate(value, manual);
  const input = value.input,
    identity = root(value),
    desired = value.reasoning.effort;
  const compatible =
    previous &&
    isCacheState(previous) &&
    previous.root === identity &&
    previous.length <= input.length &&
    previous.prefix === digest(input.slice(0, previous.length));
  const base = compatible ? previous.base : desired;
  const updates = compatible ? previous.updates.map((u) => ({ ...u })) : [];
  if (
    compatible &&
    previous.sent === true &&
    previous.length === input.length &&
    desired !== (updates.at(-1)?.effort ?? base)
  )
    throw new Error(
      "Cannot change effort on an already sent Responses input boundary",
    );
  if (desired !== (updates.at(-1)?.effort ?? base)) {
    if (updates.at(-1)?.index === input.length) updates.pop();
    if (desired !== (updates.at(-1)?.effort ?? base))
      updates.push({
        index: input.length,
        prefix: digest(input),
        effort: desired,
      });
  }
  const output: Item[] = [];
  let cursor = 0;
  for (const update of updates) {
    output.push(...input.slice(cursor, update.index), {
      type: "configuration_update",
      reasoning: { effort: update.effort },
    });
    cursor = update.index;
  }
  output.push(...input.slice(cursor));
  return {
    payload: {
      ...value,
      reasoning: { ...value.reasoning, effort: base },
      input: output,
    },
    state: {
      version: 1,
      root: identity,
      base,
      updates,
      length: input.length,
      prefix: digest(input),
      boundaries: [
        ...(compatible ? previous.boundaries : []),
        { length: input.length, prefix: digest(input) },
      ].slice(-64),
    },
    rebased: Boolean(previous && !compatible),
  };
}
export function replayWarm(value: unknown, state: CacheState): Payload {
  validate(value, true);
  if (
    !isCacheState(state) ||
    root(value) !== state.root ||
    !state.boundaries.some(
      (b) =>
        b.length === value.input.length && b.prefix === digest(value.input),
    )
  )
    throw new Error("Unmatched warming snapshot");
  const updates = state.updates.filter(
    (u) =>
      u.index <= value.input.length &&
      u.prefix === digest(value.input.slice(0, u.index)),
  );
  if (
    value.input.length === state.length &&
    digest(value.input) !== state.prefix
  )
    throw new Error("Unmatched warming snapshot");
  const desired = updates.at(-1)?.effort ?? state.base;
  return adaptPayload(
    { ...value, reasoning: { ...value.reasoning, effort: desired } },
    {
      ...state,
      updates,
      length: value.input.length,
      prefix: digest(value.input),
    },
    true,
  ).payload;
}
