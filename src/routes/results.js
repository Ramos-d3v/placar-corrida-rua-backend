import { Router } from 'express';
import { importResultsSchema, resultsQuerySchema } from '../schemas/results.js';
import { getResultByBibNumber, listResults, replaceEventResults, resetResults } from '../services/results.js';

export const resultsRouter = Router();

resultsRouter.post('/', async (request, response) => {
  const payload = importResultsSchema.parse(request.body);
  const imported = await replaceEventResults(payload);

  response.status(200).json({ ...imported, imported_count: payload.results.length });
});

resultsRouter.post('/reset', async (_request, response) => {
  response.json(await resetResults());
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