/**
 * Additional regression criteria from review of acf629080e0f359e3c0659fcbd3978ac21930fa3.
 * Run after placing this file in the repository's tests/ directory:
 *   npx tsx --test tests/review-regressions.test.ts
 * These checks intentionally FAIL on the reviewed revision. They do not
 * perform network requests, call a model, or establish vendor acceptance.
 * The final retry check assumes previous state represents an already sent
 * request: a production fix may instead retain an explicit sent/unsent state.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { snapshot, parseJudge, parseClassification } from '../src/selector.js';
import { adaptPayload } from '../src/cache.js';

const user = { role: 'user', content: 'Fix the authentication bug, then validate and review the result.', timestamp: 1 };
const assistant = (text: string) => ({ role: 'assistant', content: [{type: 'text', text}] });
const tool = (name: string, failed: boolean) => ({role: 'toolResult', toolName: name, isError: failed, content: []});
const wireUser = (text: string) => ({role: 'user', content: [{type: 'input_text', text}]});
const payload = (input: Record<string, unknown>[], effort: string, extra: Record<string, unknown> = {}) => ({
  model: 'gpt-6-astra', instructions: 'stable', tools: [], input, reasoning: {effort}, ...extra,
});

test('R1: materially changed next-step reasoning is reconsidered at bounded tool progress', () => {
  const routine = snapshot([user, assistant('The fix is established; read the relevant file.'), tool('read', false)]);
  const difficult = snapshot([user, assistant('The trace contradicts the plan. We must redesign token rotation and concurrency handling.'), tool('read', false)]);
  assert.notDeepEqual(routine.state, difficult.state);
  // Arbitrary prose is judge input, not a cache invalidation heuristic. A
  // bounded tool-round checkpoint provides freshness without judging every read.
  assert.equal(routine.key, difficult.key);
  const latest = 'The trace contradicts the plan. We must redesign token rotation and concurrency handling.';
  const fourRounds = snapshot([user,
    assistant('Read the relevant file.'), tool('read', false),
    assistant('Check the caller.'), tool('read', false),
    assistant('Compare the implementation.'), tool('read', false),
    assistant(latest), tool('read', false),
  ]);
  assert.equal(fourRounds.phase, 'analysis');
  assert.equal(fourRounds.state.update, latest);
  assert.notEqual(routine.key, fourRounds.key);
});

test('R2: a new recovery episode with repeated failures must not reuse the first recovery decision', () => {
  const once = [user, assistant('Try the existing fix.'), tool('bash', true)];
  const repeated = [...once, assistant('Retry failed; investigate deeper invariants.'), tool('bash', true)];
  const a = snapshot(once), b = snapshot(repeated);
  assert.equal(a.phase, 'recovery'); assert.equal(b.phase, 'recovery');
  assert.notDeepEqual(a.state, b.state);
  assert.notEqual(a.key, b.key, 'Failure count and recovery re-entry are absent from the key.');
});

test('R3: root judge must reject an array instead of a string effort', () => {
  assert.throws(() => parseJudge('{"effort":["high"],"confidence":0.9}', ['low','high'], 0.5));
});

test('R4: classifier must reject an array instead of a string choice', () => {
  assert.throws(() => parseClassification({stopReason:'stop',answers:{effort:{
    type:'choice',choice:['high'],confidence:0.9,probabilities:{low:0.1,high:0.9},
  }}}, ['low','high'], 0.5));
});

test('R5: configuration updates must reject a non-standard reasoning mode', () => {
  assert.throws(() => {
    const first = adaptPayload(payload([wireUser('start')], 'low', {reasoning:{effort:'low',mode:'pro'}}));
    adaptPayload(payload([wireUser('start'),wireUser('next')], 'high', {reasoning:{effort:'high',mode:'pro'}}),first.state);
  });
});

test('R6: configuration updates must reject backend multi-agent mode', () => {
  assert.throws(() => {
    const first = adaptPayload(payload([wireUser('start')], 'low', {multi_agent:{}}));
    adaptPayload(payload([wireUser('start'),wireUser('next')], 'high', {multi_agent:{}}),first.state);
  });
});

test('R7: changing effort on a sent, identical-input retry must not rewrite the previous update', () => {
  const first = adaptPayload(payload([wireUser('start')], 'low'));
  const input = [wireUser('start'),wireUser('next')];
  const sent = adaptPayload(payload(input, 'high'), first.state);
  const state = { ...sent.state, sent: true };
  const retry = adaptPayload(payload(input, 'high'), state);
  assert.deepEqual(retry.payload, sent.payload);
  assert.equal(JSON.stringify(retry.payload), JSON.stringify(sent.payload));
  assert.throws(() => adaptPayload(payload(input, 'max'), state), /already sent/);
});
