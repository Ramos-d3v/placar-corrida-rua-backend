import test from 'node:test';
import assert from 'node:assert/strict';
import { RealtimeStateStore, hashPayload } from '../src/services/realtime-state.js';

test('canonical hashing is stable regardless of object key order', () => {
  assert.equal(
    hashPayload({ event_slug: 'race', results: [{ bib_number: '1', status: 'C' }] }),
    hashPayload({ results: [{ status: 'C', bib_number: '1' }], event_slug: 'race' }),
  );
});

test('state store detects changes and replaces the cached snapshot', () => {
  const store = new RealtimeStateStore();
  const first = { event_slug: 'race', total_results: 1, results: [] };

  assert.equal(store.hasChanged('race', first), true);
  const state = store.set('race', first);
  assert.equal(store.hasChanged('race', first), false);
  assert.equal(store.get('race'), state);

  const second = { ...first, total_results: 2 };
  assert.equal(store.hasChanged('race', second), true);
  store.set('race', second);
  assert.equal(store.get('race').payload.total_results, 2);
});
