import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

function keysMatch(receivedKey, expectedKey) {
  const received = Buffer.from(receivedKey);
  const expected = Buffer.from(expectedKey);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function requireIngestionApiKey(request, response, next) {
  const receivedKey = request.get('X-Ingestion-API-Key');

  if (!env.ingestionApiKey || !receivedKey || !keysMatch(receivedKey, env.ingestionApiKey)) {
    return response.status(401).json({ error: 'Credenciais de ingestão inválidas' });
  }

  return next();
}
