import { Router } from 'express';
import { resultsQuerySchema, updateResultSchema } from '../schemas/results.js';
import { getResultByBibNumber, listResults, updateResultByBibNumber } from '../services/results.js';
import { ingestResults, resetIngestedResults } from '../services/ingestion.js';
import { realtimePublisher } from '../services/realtime-publisher.js';
import { realtimeState } from '../services/realtime-state.js';

export const resultsRouter = Router();

resultsRouter.post('/', async (request, response, next) => {
  try {
    const imported = await ingestResults(request.body);
    response.status(200).json(imported);
  } catch (err) {
    next(err);
  }
});

resultsRouter.post('/reset', async (_request, response, next) => {
  try {
    response.json(await resetIngestedResults());
  } catch (err) {
    next(err);
  }
});

resultsRouter.get('/', async (request, response, next) => {
  try {
    const filters = resultsQuerySchema.parse(request.query);
    console.log('[GET /api/results] filters:', JSON.stringify(filters));
    const data = await listResults(filters);
    console.log('[GET /api/results] event found:', data.event?.slug ?? 'none');
    response.json(data);
  } catch (err) {
    console.error('[GET /api/results] error:', err);
    next(err);
  }
});

resultsRouter.get('/:bibNumber', async (request, response, next) => {
  try {
    const eventSlug = typeof request.query.event_slug === 'string' ? request.query.event_slug.trim() : null;
    console.log('[GET /api/results/:bibNumber] bibNumber:', request.params.bibNumber, 'event_slug:', eventSlug);
    const result = await getResultByBibNumber(request.params.bibNumber, eventSlug);
    if (!result) return response.status(404).json({ error: 'Resultado não encontrado' });
    return response.json(result);
  } catch (err) {
    console.error('[GET /api/results/:bibNumber] error:', err);
    next(err);
  }
});

resultsRouter.put('/:bibNumber', async (request, response, next) => {
  try {
    const data = updateResultSchema.parse(request.body);
    const updated = await updateResultByBibNumber(request.params.bibNumber, data, data.event_slug);
    if (!updated) {
      return response.status(404).json({ error: 'Resultado não encontrado' });
    }

    realtimeState.updateAthlete(updated.event.slug, request.params.bibNumber, data);
    realtimePublisher.publishAthleteUpdate({
      event_slug: updated.event.slug,
      event: updated.event,
      result: updated.result,
    });

    return response.json(updated);
  } catch (err) {
    next(err);
  }
});
