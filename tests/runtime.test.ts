import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withDeadline } from '../src/runtime.js';

test('deadline finishes even if the backend ignores cancellation', async () => {
  const started = Date.now();
  await assert.rejects(withDeadline(() => new Promise(() => {}), 20), /deadline/i);
  assert.ok(Date.now() - started < 1000);
});

test('caller cancellation aborts backend and never accepts a late decision', async () => {
  const controller = new AbortController(); let backendSignal: AbortSignal | undefined;
  const pending = withDeadline(signal => { backendSignal = signal; return new Promise(resolve => setTimeout(() => resolve('late'), 80)); }, 500, controller.signal);
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(pending); assert.equal(backendSignal?.aborted, true);
});

test('successful and rejected backends preserve their result without lingering deadlines', async () => {
  assert.equal(await withDeadline(async () => 'ok', 50), 'ok');
  await assert.rejects(withDeadline(async () => { throw new Error('backend'); }, 50), /backend/);
  const controller = new AbortController(); controller.abort(); let called = false;
  await assert.rejects(withDeadline(async () => { called = true; return 1; }, 50, controller.signal));
  assert.equal(called, false);
});
