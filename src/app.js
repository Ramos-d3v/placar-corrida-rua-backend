import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { openApiDocument } from './docs/openapi.js';
import { resultsRouter } from './routes/results.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.frontendOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origem não permitida pela política CORS'));
  },
}));
app.use(express.json({ limit: '10mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));

app.use('/swagger', swaggerUi.serve, swaggerUi.setup(openApiDocument, {
  customSiteTitle: 'API de Resultados - Swagger',
}));
app.get('/health', (_request, response) => response.json({ status: 'ok' }));
app.use('/api/results', resultsRouter);

app.use((_request, response) => response.status(404).json({ error: 'Rota não encontrada' }));

app.use((error, _request, response, next) => {
  if (response.headersSent) return next(error);

  if (error?.name === 'ZodError') {
    return response.status(422).json({ error: 'Payload ou parâmetros inválidos', details: error.issues });
  }

  if (error?.type === 'entity.too.large') {
    return response.status(413).json({ error: 'Payload excede o limite de 10 MB' });
  }

  if (error?.message === 'Origem não permitida pela política CORS') {
    return response.status(403).json({ error: error.message });
  }

  console.error('API request failed', error);
  return response.status(500).json({ error: 'Erro interno do servidor' });
});