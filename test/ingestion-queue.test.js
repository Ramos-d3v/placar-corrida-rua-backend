import test from 'node:test';
import assert from 'node:assert/strict';
import { IngestionQueue, IngestionQueueFullError } from '../src/services/ingestion-queue.js';

test('processes queued payloads in order and waits on stop', async () => {
  const processed = [];
  const queue = new IngestionQueue(async (payload) => {
    processed.push(payload);
  }, 2);

  assert.deepEqual(queue.enqueue({ id: 1 }), { position: 1 });
  assert.deepEqual(queue.enqueue({ id: 2 }), { position: 1 });
  await queue.stop();

  assert.deepEqual(processed, [{ id: 1 }, { id: 2 }]);
});

test('rejects new jobs after capacity is reached', async () => {
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const queue = new IngestionQueue(async () => blocked, 1);

  queue.enqueue({ id: 1 });
  assert.throws(() => queue.enqueue({ id: 2 }), IngestionQueueFullError);
  release();
  await queue.stop();
});
