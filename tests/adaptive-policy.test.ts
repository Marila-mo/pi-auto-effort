import assert from "node:assert/strict";
import { test } from "node:test";
import { snapshot } from "../src/selector.js";

const user = {
  role: "user",
  content: "Investigate and fix the issue.",
  timestamp: 1,
};
const assistant = (update: string, ids: string[] = []) => ({
  role: "assistant",
  content: [
    { type: "text", text: update },
    ...ids.map((id) => ({ type: "toolCall", id, name: "read", arguments: {} })),
  ],
});
const result = (name = "read", failed = false, id?: string) => ({
  role: "toolResult",
  toolName: name,
  isError: failed,
  ...(id === undefined ? {} : { toolCallId: id }),
  content: [],
});
const round = (index: number, failed = false, name = "read") => [
  assistant(`Update ${index}`),
  result(name, failed),
];

test("same-phase successful tool work refreshes at four rounds, without prose-only calls", () => {
  const messages: unknown[] = [user];
  const initial = snapshot(messages);
  for (let i = 1; i <= 3; i++) {
    messages.push(...round(i));
    assert.equal(snapshot(messages).key, initial.key);
  }
  const prose = snapshot([
    ...messages,
    assistant("A difficult unresolved design remains."),
  ]);
  assert.equal(prose.key, initial.key);
  assert.equal(prose.progressStep, 3);
  messages.push(...round(4));
  assert.notEqual(snapshot(messages).key, initial.key);
  assert.equal(snapshot(messages).state.phaseRounds, 4);
  const checkpoint = snapshot(messages).key;
  for (let i = 5; i <= 7; i++) messages.push(...round(i));
  assert.equal(snapshot(messages).key, checkpoint);
  messages.push(...round(8));
  assert.notEqual(snapshot(messages).key, checkpoint);
});

test("parallel tool results count as one completed round and partial batches do not advance", () => {
  const messages = [
    user,
    assistant("Read two files.", ["a", "b"]),
    result("read", false, "a"),
  ];
  assert.equal(snapshot(messages).progressStep, 0);
  const complete = snapshot([...messages, result("read", false, "b")]);
  assert.equal(complete.progressStep, 1);
  assert.equal(complete.state.phaseRounds, 1);
  assert.equal(complete.key, snapshot([user]).key);
});

test("recovery reevaluates at doubling failures and periodic progress checkpoints", () => {
  const messages: unknown[] = [user];
  const keys: string[] = [];
  for (let i = 1; i <= 12; i++) {
    messages.push(...round(i, true));
    const snap = snapshot(messages);
    keys.push(snap.key);
    assert.equal(snap.phase, "recovery");
    assert.equal(snap.state.failedRounds, i);
  }
  for (const n of [2, 4, 8, 12]) assert.notEqual(keys[n - 1], keys[n - 2]);
  for (const n of [3, 5, 6, 7, 9, 10, 11])
    assert.equal(keys[n - 1], keys[n - 2]);
});

test("phase exits and reentry cannot resurrect earlier analysis or recovery decisions", () => {
  const initial = snapshot([user]);
  const failed = [user, ...round(1, true)];
  const recovery = snapshot(failed);
  const recovered = [...failed, ...round(2)];
  const analysis = snapshot(recovered);
  assert.equal(analysis.phase, "analysis");
  assert.notEqual(analysis.key, initial.key);
  const reentered = snapshot([...recovered, ...round(3, true)]);
  assert.equal(reentered.phase, "recovery");
  assert.notEqual(reentered.key, recovery.key);
  assert.equal(reentered.state.phaseRounds, 1);
  assert.equal(reentered.state.failedRounds, 1);
});

test("execution remains latched after a successful write, including recovery exit", () => {
  const edited = [user, ...round(1, false, "write")];
  assert.equal(snapshot(edited).phase, "execution");
  const read = [...edited, ...round(2)];
  assert.equal(snapshot(read).key, snapshot(edited).key);
  const recovered = [...read, ...round(3, true), ...round(4)];
  assert.equal(snapshot(recovered).phase, "execution");
  assert.notEqual(snapshot(recovered).key, snapshot(edited).key);
  assert.equal(
    snapshot([user, ...round(1, true, "write"), ...round(2)]).phase,
    "analysis",
  );
});

test("fresh user tasks reset progress, episode counters, and execution state", () => {
  const prior = [user, ...round(1, false, "edit"), ...round(2, true)];
  const fresh = snapshot([...prior, { ...user, timestamp: 2 }]);
  assert.equal(fresh.phase, "analysis");
  assert.equal(fresh.progressStep, 0);
  assert.equal(fresh.state.failedRounds, 0);
  assert.notEqual(fresh.key, snapshot([user]).key);
});
