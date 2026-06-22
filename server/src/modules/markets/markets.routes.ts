import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { readMarkets } from './markets.store';
import { createMarket } from './markets.service';

const MarketSchema = z.object({
  id: z.string(),
  address: z.string(),
  ammAddress: z.string(),
  clobAddress: z.string().optional(),
  title: z.string(),
  category: z.string(),
  createdAt: z.string(),
});

const listRoute = createRoute({
  method: 'get',
  path: '/markets',
  tags: ['markets'],
  summary: 'List user-created markets',
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(MarketSchema) } },
      description: 'Array of user-created markets',
    },
  },
});

const createMarketRoute = createRoute({
  method: 'post',
  path: '/markets',
  tags: ['markets'],
  summary: 'Deploy a new prediction market + AMM + CLOB on-chain',
  request: {
    body: {
      content: {
        'application/json': { schema: z.object({ title: z.string().min(1).max(200) }) },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ success: z.literal(true), market: MarketSchema }) } },
      description: 'Market created',
    },
    400: { description: 'Invalid title' },
    500: { description: 'Server not configured or deployment failed' },
  },
});

export const marketsRoutes = new OpenAPIHono();

marketsRoutes.openapi(listRoute, (c) => c.json(readMarkets(), 200));

marketsRoutes.openapi(createMarketRoute, async (c) => {
  const { title } = c.req.valid('json');
  const result = await createMarket(title);
  return result.match(
    (market) => c.json({ success: true as const, market }, 200),
    (error) =>
      c.json({ error: error.message }, error.kind === 'not_configured' ? 500 : 500),
  );
});
