import { env } from './core/config';
import { logger } from './core/logger';
import { createApp } from './app';

const app = createApp();

const server = Bun.serve({
  port: env.API_PORT,
  fetch: app.fetch,
  idleTimeout: 30,
});

logger.info({ port: server.port, env: env.NODE_ENV, rpc: env.ARC_RPC_URL }, 'predict-edge api listening');

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandledRejection');
});

const shutdown = (signal: string) => {
  logger.info({ signal }, 'shutting down');
  void server.stop(false);
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
