import { app } from './app.js';
import { assertRuntimeConfig, env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { attachRealtimeServer } from './realtime/socket.js';
import { ingestionQueue } from './services/ingestion-queue.js';

try {
  assertRuntimeConfig();
  const server = app.listen(env.port, () => {
    console.log(`Results API listening on port ${env.port}`);
  });
  const realtimeServer = attachRealtimeServer(server);

  async function shutdown() {
    await ingestionQueue.stop();
    await realtimeServer.close();
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