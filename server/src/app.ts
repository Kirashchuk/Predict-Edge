import { OpenAPIHono } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { HTTPException } from 'hono/http-exception';
import { env } from './core/config';
import { logger } from './core/logger';
import { marketsRoutes } from './modules/markets/markets.routes';

export function createApp(): OpenAPIHono {
  const app = new OpenAPIHono();

  app.use('*', cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use('*', compress({ threshold: 1024 }));

  // Lightweight request logging.
  app.use('*', async (c, next) => {
    const start = Date.now();
    await next();
    logger.debug({ method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - start }, 'request');
  });

  app.onError((e, c) => {
    if (e instanceof HTTPException) return e.getResponse();
    logger.error({ err: e.message }, 'unhandled error');
    return c.json({ error: 'Internal server error' }, 500);
  });

  app.get('/health', (c) => c.json({ status: 'ok', chain: env.ARC_RPC_URL, ts: new Date().toISOString() }));

  // Mount versioned API (mirrors nado's /v1 prefix).
  app.route('/v1', marketsRoutes);

  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'Predict-Edge API', version: '0.1.0', description: 'Bun + Hono backend for the Predict-Edge prediction market.' },
  });
  app.get('/docs', apiReference({ spec: { url: '/openapi.json' } }));

  return app;
}
