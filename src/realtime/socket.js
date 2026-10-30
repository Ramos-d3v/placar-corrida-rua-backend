import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { realtimePublisher } from '../services/realtime-publisher.js';
import { realtimeState } from '../services/realtime-state.js';

function roomFor(eventSlug) {
  return `results:${eventSlug}`;
}

function normalizeEventSlug(value) {
  if (typeof value !== 'string') return null;
  const eventSlug = value.trim();
  return eventSlug.length > 0 ? eventSlug : null;
}

export function attachRealtimeServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.frontendOrigins || "http://localhost:3001",
    },
  });

  io.on('connection', (socket) => {
    socket.on('subscribe', (input, acknowledge) => {
      const eventSlug = normalizeEventSlug(input?.event_slug);
      if (!eventSlug) {
        const error = { error: 'event_slug é obrigatório' };
        if (typeof acknowledge === 'function') acknowledge(error);
        return;
      }

      const room = roomFor(eventSlug);
      socket.join(room);
      const state = realtimeState.get(eventSlug);
      const response = state
        ? { subscribed: true, room, state }
        : { subscribed: true, room, pending: true, event_slug: eventSlug };

      if (typeof acknowledge === 'function') acknowledge(response);
      socket.emit(state ? 'results.snapshot' : 'results.pending', response);
    });
  });

  const onUpdate = (state) => {
    io.to(roomFor(state.event_slug)).emit('results.updated', state);
  };
  const onAthleteUpdated = (update) => {
    io.to(roomFor(update.event_slug)).emit('athlete.updated', update);
  };
  const onReset = () => io.emit('results.reset');

  realtimePublisher.on('updated', onUpdate);
  realtimePublisher.on('athlete.updated', onAthleteUpdated);
  realtimePublisher.on('reset', onReset);

  return {
    io,
    close() {
      realtimePublisher.off('updated', onUpdate);
      realtimePublisher.off('athlete.updated', onAthleteUpdated);
      realtimePublisher.off('reset', onReset);
      return io.close();
    },
  };
}
