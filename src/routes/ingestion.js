import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { requireIngestionApiKey } from '../middlewares/ingestion-auth.js';
import { importResultsSchema } from '../schemas/results.js';
import { IngestionQueueFullError, ingestionQueue } from '../services/ingestion-queue.js';

export const ingestionRouter = Router();

ingestionRouter.post('/results', requireIngestionApiKey, async (request, response) => {
  const payload = importResultsSchema.parse(request.body);

  try {
    const queued = ingestionQueue.enqueue(payload);
    return response.status(202).json({
      accepted: true,
      changed: null,
      event_slug: payload.event_slug,
      request_id: randomUUID(),
      queue_position: queued.position,
    });
  } catch (error) {
    if (error instanceof IngestionQueueFullError) {
      return response.status(503).json({ error: error.message });
    }
    throw error;
  }
});