import { app } from './app.js';
import { assertRuntimeConfig, env } from './config/env.js';
import { prisma } from './db/prisma.js';

try {
  assertRuntimeConfig();
  const server = app.listen(env.port, () => {
    console.log(`Results API listening on port ${env.port}`);
  });

  async function shutdown() {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}