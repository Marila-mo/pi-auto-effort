import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adaptPayload, replayWarm, isCacheState, type CacheState } from '../src/cache.js';
import { parseConfig, allowedLevels, capability } from '../src/config.js';
import { snapshot, parseJudge, parseClassification } from '../src/selector.js';

const payload = (input: Record<string, unknown>[], effort = 'medium', extra = {}) => ({ model: 'gpt-6.1-sol', instructions: 'stable', tools: [], prompt_cache_key: 'session', input, reasoning: { effort }, ...extra });
const user = (text: string) => ({ role: 'user', content: [{ type: 'input_text', text }] });

test('configuration is strict, conservative and bounded', () => {
  const c = parseConfig({});
  assert.equal(c.selector.kind, 'root'); assert.equal(c.warming, 'off');
  for (const invalid of [{ timeoutMs: 0 }, { timeoutMs: Infinity }, { unknown: true }, { warming: 'force' }, { selector: { kind: 'jev' } }, { minEffort: 'off' }, { confidence: 2 }, { enabled: 'yes' }]) assert.throws(() => parseConfig(invalid));
  assert.equal(parseConfig({ selector: { kind: 'jev', provider: 'typesafe', model: 'jev-latest' } }).selector.kind, 'jev');
});

test('only explicit official provider/model capabilities are eligible', () => {
  const base = { provider: 'openai-codex', id: 'gpt-6.1-sol', api: 'openai-codex-responses', baseUrl: 'https://chatgpt.com/backend-api', reasoning: true };
  assert.equal(capability(base)?.kind, 'openai');
  for (const patch of [{ id: 'auto' }, { id: 'gpt-5' }, { baseUrl: 'https://proxy.invalid' }, { reasoning: false }]) assert.equal(capability({ ...base, ...patch }), undefined);
  for (const id of ['claude-opus-5', 'claude-opus-5-5', 'claude-sonnet-5-5']) assert.equal(capability({ provider: 'anthropic', api: 'anthropic-messages', id, baseUrl: 'https://api.anthropic.com', reasoning: true, compat: { supportsMidConvoEffort: true } })?.kind, 'anthropic');
  assert.equal(capability({ provider: 'anthropic', api: 'anthropic-messages', id: 'claude-opus-5', baseUrl: 'https://api.anthropic.com', reasoning: true }), undefined);
  assert.deepEqual(allowedLevels(['off', 'minimal', 'low', 'medium', 'high'], 'medium'), ['medium', 'high']);
});

test('append-only effort changes preserve the complete earlier input', () => {
  let state: CacheState | undefined; let previous: Record<string, unknown>[] = [];
  let raw: Record<string, unknown>[] = [];
  for (const effort of ['medium', 'high', 'max', 'low', 'medium']) {
    raw = [...raw, user(effort)];
    const source = payload(raw, effort); const copy = structuredClone(source);
    const result = adaptPayload(source, state);
    assert.deepEqual(source, copy); assert.equal(result.payload.reasoning.effort, 'medium');
    assert.deepEqual(result.payload.input.slice(0, previous.length), previous);
    assert.equal(result.payload.prompt_cache_key, 'session');
    previous = result.payload.input; state = result.state;
    raw = [...raw, { role: 'assistant', content: 'OK' }];
  }
  assert.equal(previous.filter(item => item.type === 'configuration_update').length, 4);
});

test('retries reuse state, same boundaries do not accumulate adjacent updates', () => {
  const first = adaptPayload(payload([user('task')], 'medium'));
  const second = adaptPayload(payload([user('task'), user('next')], 'high'), first.state);
  assert.deepEqual(adaptPayload(payload([user('task'), user('next')], 'high'), second.state).payload, second.payload);
  const replaced = adaptPayload(payload([user('task'), user('next')], 'max'), second.state);
  assert.equal(replaced.payload.input.filter(item => item.type === 'configuration_update').length, 1);
});

test('sent retries preserve the request and reject effort changes at the same boundary', () => {
  const raw = [user('task')];
  const first = adaptPayload(payload(raw, 'medium'));
  const initialSent = { ...first.state, sent: true };
  assert.deepEqual(adaptPayload(payload(raw, 'medium'), initialSent).payload, first.payload);
  assert.throws(() => adaptPayload(payload(raw, 'high'), initialSent), /already sent/);
  const nextRaw = [...raw, { role: 'assistant', content: 'OK' }, user('next')];
  const next = adaptPayload(payload(nextRaw, 'high'), initialSent);
  assert.equal(next.state.sent, undefined);
  assert.deepEqual(next.payload.input.slice(0, first.payload.input.length), first.payload.input);
  const sent = { ...next.state, sent: true };
  const copy = structuredClone(sent);
  const retry = adaptPayload(payload(nextRaw, 'high'), sent);
  assert.equal(JSON.stringify(retry.payload), JSON.stringify(next.payload));
  assert.throws(() => adaptPayload(payload(nextRaw, 'max'), sent), /already sent/);
  assert.throws(() => adaptPayload(payload(nextRaw, 'medium'), sent), /already sent/);
  assert.deepEqual(sent, copy);
  const appended = adaptPayload(payload([...nextRaw, user('follow-up')], 'max'), sent);
  assert.deepEqual(appended.payload.input.slice(0, next.payload.input.length), next.payload.input);
  assert.equal(appended.state.sent, undefined);
});

test('cache state accepts legacy drafts and only boolean sent markers and string efforts', () => {
  const first = adaptPayload(payload([user('task')], 'medium'));
  const next = adaptPayload(payload([user('task'), user('next')], 'high'), first.state);
  assert.equal(isCacheState(next.state), true);
  for (const sent of [false, true]) assert.equal(isCacheState({ ...next.state, sent }), true);
  for (const sent of ['true', 1, null, []]) assert.equal(isCacheState({ ...next.state, sent }), false);
  assert.equal(isCacheState({ ...next.state, updates: [{ ...next.state.updates[0], effort: ['high'] }] }), false);
});

test('prefix/root changes explicitly rebase instead of replaying invalid history', () => {
  const old = adaptPayload(payload([user('a'), user('b')], 'high'));
  for (const next of [payload([user('changed')], 'max'), payload([user('a'), user('b')], 'max', { instructions: 'new' }), payload([user('a')], 'max'), payload([user('a'), user('b')], 'max', { tools: [{ name: 'new' }] }), payload([user('a'), user('b')], 'max', { prompt_cache_key: 'new' })]) {
    const result = adaptPayload(next, old.state); assert.equal(result.rebased, true); assert.equal(result.payload.reasoning.effort, 'max');
  }
});

test('unsafe ownership/truncation/compaction and malformed payloads fail closed', () => {
  for (const p of [payload([{ type: 'configuration_update' }]), payload([user('x')], 'medium', { truncation: 'auto' }), payload([user('x')], 'medium', { context_management: [] }), { model: 'x', input: null }, payload([user('x')], 'none')]) assert.throws(() => adaptPayload(p));
});

test('Responses accepts standard reasoning mode and rejects unsupported or malformed modes', () => {
  const raw = [user('task')];
  const first = adaptPayload(payload(raw, 'medium', { reasoning: { effort: 'medium', mode: 'standard' } }));
  const next = adaptPayload(payload([...raw, user('next')], 'high', { reasoning: { effort: 'high', mode: 'standard' } }), { ...first.state, sent: true });
  assert.equal(next.payload.reasoning.mode, 'standard');
  assert.equal(next.payload.reasoning.effort, 'medium');
  assert.equal(next.payload.input.at(-1)?.type, 'configuration_update');
  for (const mode of ['pro', [], {}, null, false, 1]) assert.throws(() => adaptPayload(payload(raw, 'medium', { reasoning: { effort: 'medium', mode } })));
  for (const multi_agent of [{}, [], null, false, true, 'standard']) assert.throws(() => adaptPayload(payload(raw, 'medium', { multi_agent })));
});

test('warming replays only a matching historical prefix without changing state', () => {
  const first = adaptPayload(payload([user('a')], 'medium'));
  const second = adaptPayload(payload([user('a'), { role: 'assistant', content: 'OK' }, user('b')], 'high'), first.state);
  const copy = structuredClone(second.state);
  assert.deepEqual(replayWarm(payload([user('a')]), second.state).input, first.payload.input);
  assert.deepEqual(replayWarm(payload([user('a'), { role: 'assistant', content: 'OK' }, user('b')], 'high'), second.state).input, second.payload.input);
  assert.deepEqual(replayWarm(payload([user('a')]), { ...second.state, sent: true }).input, first.payload.input);
  assert.deepEqual(replayWarm(payload([user('a'), { role: 'assistant', content: 'OK' }, user('b')], 'high'), { ...second.state, sent: true }).input, second.payload.input);
  assert.deepEqual(second.state, copy);
  assert.throws(() => replayWarm(payload([user('different')]), second.state));
});

test('selector state excludes private channels and is bounded/redacted', () => {
  const s = snapshot([
    { role: 'system', content: 'PRIVATE_SYSTEM' },
    { role: 'user', content: 'sk-0123456789012345 Bearer very-secret ' + 'あ'.repeat(20000), timestamp: 1 },
    { role: 'assistant', content: [{ type: 'thinking', thinking: 'PRIVATE_THINKING' }, { type: 'toolCall', name: 'bash', arguments: { secret: 'PRIVATE_ARGUMENT' } }, { type: 'text', text: 'status' }] },
    { role: 'toolResult', toolName: 'bash', isError: true, content: [{ type: 'text', text: 'PRIVATE_TOOL' }] },
  ]);
  const json = JSON.stringify(s.state);
  for (const privateText of ['PRIVATE_SYSTEM', 'PRIVATE_THINKING', 'PRIVATE_ARGUMENT', 'PRIVATE_TOOL', 'sk-0123456789012345', 'very-secret']) assert.ok(!json.includes(privateText));
  assert.ok(json.length < 14000); assert.equal(s.phase, 'recovery');
});

test('task/phase keys remain sticky through reads, change on new tasks and writes', () => {
  const start = [{ role: 'user', content: 'task', timestamp: 1 }];
  const a = snapshot(start);
  const read = snapshot([...start, { role: 'toolResult', toolName: 'read', isError: false, content: [] }]);
  assert.equal(a.key, read.key);
  assert.notEqual(a.key, snapshot([...start, { role: 'toolResult', toolName: 'edit', isError: false, content: [] }]).key);
  assert.notEqual(a.key, snapshot([...start, { role: 'user', content: 'task', timestamp: 2 }]).key);
});

test('judge parsing accepts only strict allowed choices and calibrated confidence', () => {
  assert.equal(parseJudge('{"effort":"high","confidence":0.9}', ['medium', 'high'], 0.5), 'high');
  for (const input of ['```json\n{"effort":"high","confidence":1}\n```', '{"effort":"max","confidence":1}', '{"effort":"high","confidence":0.2}', '{"effort":"high","confidence":2}', '{"effort":"high","confidence":1,"extra":true}', 'not json']) assert.throws(() => parseJudge(input, ['medium', 'high'], 0.5));
});

test('classifier validation rejects invalid probability envelopes and non-winning choices', () => {
  const valid = { stopReason: 'stop', answers: { effort: { type: 'choice', choice: 'high', confidence: 0.9, probabilities: { medium: 0.1, high: 0.9 } } } };
  assert.equal(parseClassification(valid, ['medium', 'high'], 0.5), 'high');
  for (const invalid of [{ ...valid, stopReason: 'error' }, { answers: {} }, { ...valid, answers: { effort: { ...valid.answers.effort, confidence: 0.2 } } }, { ...valid, answers: { effort: { ...valid.answers.effort, probabilities: { medium: 0.9, high: 0.1 } } } }, { ...valid, answers: { effort: { ...valid.answers.effort, probabilities: { medium: NaN, high: 1 } } } }]) assert.throws(() => parseClassification(invalid, ['medium', 'high'], 0.5));
});
