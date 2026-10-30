import { Router } from 'express';
import { resultsQuerySchema } from '../schemas/results.js';
import { getResultByBibNumber, listResults } from '../services/results.js';
import { ingestResults, resetIngestedResults } from '../services/ingestion.js';

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
  const result = await getResultByBibNumber(request.params.bibNumber);
  if (!result) return response.status(404).json({ error: 'Resultado não encontrado' });
  return response.json(result);
});