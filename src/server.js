import { app } from './app.js';
import { assertRuntimeConfig, env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { attachRealtimeServer } from './realtime/socket.js';
import { ingestionQueue } from './services/ingestion-queue.js';

async function seedDefaultEvent() {
  try {
    const existing = await prisma.event.findUnique({ where: { slug: 'corrida' } });
    if (!existing) {
      await prisma.event.create({
        data: { slug: 'corrida', title: 'Corrida', totalResults: 0 },
      });
      console.log('[seed] Evento padrão "corrida" criado.');
    }
  } catch (err) {
    // Não bloqueia a inicialização se o seed falhar
    console.warn('[seed] Não foi possível criar evento padrão:', err.message);
  }
}

try {
  assertRuntimeConfig();

  await seedDefaultEvent();

  const server = app.listen(env.port, () => {
    console.log(`Results API listening on port ${env.port}`);
    console.log(`CORS allowed origins: ${env.frontendOrigins.join(', ')}`);
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
