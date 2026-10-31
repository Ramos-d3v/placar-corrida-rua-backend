import 'dotenv/config';

const ALWAYS_ALLOWED_ORIGINS = [
  'https://cronoracingrua.vercel.app',
  'https://placar-corrida-rua-frontend.vercel.app',
];

const port = Number.parseInt(process.env.PORT ?? '3001', 10);

export const env = {
  port,
  baseUrl: process.env.BASE_URL ?? `http://localhost:${port}`,
  databaseUrl: process.env.DATABASE_URL,
  directUrl: process.env.DATABASE_URL_UNPOOLED,
  ingestionApiKey: process.env.INGESTION_API_KEY ?? '',
  ingestionQueueMaxSize: Number.parseInt(process.env.INGESTION_QUEUE_MAX_SIZE ?? '10', 10),
  frontendOrigins: [
    ...(process.env.FRONTEND_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    ...ALWAYS_ALLOWED_ORIGINS,
  ].filter((origin, index, origins) => origins.indexOf(origin) === index),
};

export function assertRuntimeConfig() {
  const missing = [];

  if (!env.databaseUrl) missing.push('DATABASE_URL');
  if (process.env.NODE_ENV === 'production' && !env.ingestionApiKey) {
    missing.push('INGESTION_API_KEY');
  }
  if (!Number.isInteger(env.ingestionQueueMaxSize) || env.ingestionQueueMaxSize < 1) {
    missing.push('INGESTION_QUEUE_MAX_SIZE (must be a positive integer)');
  }
  if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
    missing.push('PORT (must be an integer from 1 to 65535)');
  }

  if (missing.length > 0) {
    throw new Error(`Missing or invalid environment configuration: ${missing.join(', ')}`);
  }
}
