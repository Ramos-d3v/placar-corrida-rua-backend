import 'dotenv/config';

export const env = {
  port: Number.parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL,
  directUrl: process.env.DATABASE_URL_UNPOOLED,
  frontendOrigins: (process.env.FRONTEND_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export function assertRuntimeConfig() {
  const missing = [];

  if (!env.databaseUrl) missing.push('DATABASE_URL');
  if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
    missing.push('PORT (must be an integer from 1 to 65535)');
  }

  if (missing.length > 0) {
    throw new Error(`Missing or invalid environment configuration: ${missing.join(', ')}`);
  }
}