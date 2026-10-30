import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { attachRealtimeServer } from '../src/realtime/socket.js';
import { realtimePublisher } from '../src/services/realtime-publisher.js';
import { realtimeState } from '../src/services/realtime-state.js';

function listen(server) {
  return new Promise((resolve) => server.listen(0, () => resolve(server.address().port)));
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

test('sends cached snapshot on subscription and isolates rooms', async () => {
  realtimeState.clear();
  realtimeState.set('race-a', { event_slug: 'race-a', results: [{ bib_number: '1' }] });

  const httpServer = http.createServer((_request, response) => response.end());
  const realtimeServer = attachRealtimeServer(httpServer);
  const port = await listen(httpServer);
  const clientA = connect(`http://localhost:${port}`, { transports: ['websocket'] });
  const clientB = connect(`http://localhost:${port}`, { transports: ['websocket'] });

  try {
    await Promise.all([
      new Promise((resolve) => clientA.once('connect', resolve)),
      new Promise((resolve) => clientB.once('connect', resolve)),
    ]);

    const snapshot = new Promise((resolve) => clientA.once('results.snapshot', resolve));
    const subscription = new Promise((resolve) => clientA.emit('subscribe', { event_slug: 'race-a' }, resolve));
    const [snapshotPayload, subscriptionPayload] = await Promise.all([snapshot, subscription]);

    assert.equal(snapshotPayload.state.event_slug, 'race-a');
    assert.equal(subscriptionPayload.state.event_slug, 'race-a');

    const receivedByB = new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 100);
      clientB.once('results.updated', () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
    clientB.emit('subscribe', { event_slug: 'race-b' });
    realtimePublisher.publishUpdate({ event_slug: 'race-a', version: 'next', payload: {} });

    assert.equal(await receivedByB, false);
  } finally {
    clientA.disconnect();
    clientB.disconnect();
    await realtimeServer.close();
    await close(httpServer);
    realtimeState.clear();
  }
});
