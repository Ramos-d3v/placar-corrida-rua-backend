import { Router } from 'express';
import { resultsQuerySchema, updateResultSchema } from '../schemas/results.js';
import { getResultByBibNumber, listResults, updateResultByBibNumber } from '../services/results.js';
import { ingestResults, resetIngestedResults } from '../services/ingestion.js';
import { realtimePublisher } from '../services/realtime-publisher.js';
import { realtimeState } from '../services/realtime-state.js';

export const resultsRouter = Router();

resultsRouter.post('/', async (request, response) => {
  const imported = await ingestResults(request.body);

  response.status(200).json(imported);
});

resultsRouter.post('/reset', async (_request, response) => {
  response.json(await resetIngestedResults());
});

resultsRouter.get('/', async (request, response) => {
  const filters = resultsQuerySchema.parse(request.query);
  response.json(await listResults(filters));
});

resultsRouter.get('/:bibNumber', async (request, response) => {
  const eventSlug = typeof request.query.event_slug === 'string' ? request.query.event_slug.trim() : null;
  const result = await getResultByBibNumber(request.params.bibNumber, eventSlug);
  if (!result) return response.status(404).json({ error: 'Resultado não encontrado' });
  return response.json(result);
});

resultsRouter.put('/:bibNumber', async (request, response) => {
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
});