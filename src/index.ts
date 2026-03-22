import app from './app';
import { config } from './config';
import { initRabbitMQ, shutdownRabbitMQ } from './integrations/rabbitmq';
import { initRedis, shutdownRedis } from './integrations/redis';

async function main(): Promise<void> {
  // Initialize integrations first so failures are visible early.
  try {
    await initRedis();
    console.log('[Redis] Connected');
  } catch (err) {
    console.warn('[Redis] Not connected:', err instanceof Error ? err.message : err);
  }

  try {
    await initRabbitMQ();
    console.log('[RabbitMQ] Connected');
  } catch (err) {
    console.warn('[RabbitMQ] Not connected:', err instanceof Error ? err.message : err);
  }

  const server = app.listen(config.port, () => {
    console.log(`User service running on port ${config.port} (${config.nodeEnv})`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    server.close(async () => {
      await shutdownRedis();
      await shutdownRabbitMQ();
      process.exit(0);
    });
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
