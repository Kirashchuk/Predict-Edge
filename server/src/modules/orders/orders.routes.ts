import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { listOrders, createOrder, updateOrder } from './orders.store';

const OrderSchema = z.object({
  id: z.string(),
  market: z.string(),
  owner: z.string(),
  side: z.enum(['buy', 'sell']),
  outcome: z.enum(['yes', 'no']),
  limitPrice: z.number(),
  size: z.number(),
  status: z.enum(['open', 'filled', 'cancelled']),
  createdAt: z.string(),
  filledAt: z.string().optional(),
  txHash: z.string().optional(),
});

const listRoute = createRoute({
  method: 'get',
  path: '/orders',
  tags: ['orders'],
  summary: 'List open limit orders (optionally filtered by market/owner)',
  request: {
    query: z.object({ market: z.string().optional(), owner: z.string().optional() }),
  },
  responses: {
    200: { content: { 'application/json': { schema: z.array(OrderSchema) } }, description: 'Open orders' },
  },
});

const createOrderRoute = createRoute({
  method: 'post',
  path: '/orders',
  tags: ['orders'],
  summary: 'Place an off-chain limit order (executes against the AMM when crossed)',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            market: z.string(),
            owner: z.string(),
            side: z.enum(['buy', 'sell']),
            outcome: z.enum(['yes', 'no']),
            limitPrice: z.number().min(0).max(1),
            size: z.number().positive(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: OrderSchema } }, description: 'Created order' },
  },
});

const patchRoute = createRoute({
  method: 'patch',
  path: '/orders/{id}',
  tags: ['orders'],
  summary: 'Cancel or mark-filled a limit order',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            owner: z.string(),
            status: z.enum(['filled', 'cancelled']),
            txHash: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: OrderSchema } }, description: 'Updated order' },
    404: { description: 'Not found' },
  },
});

export const ordersRoutes = new OpenAPIHono();

ordersRoutes.openapi(listRoute, (c) => {
  const { market, owner } = c.req.valid('query');
  return c.json(listOrders(market, owner), 200);
});

ordersRoutes.openapi(createOrderRoute, (c) => {
  const body = c.req.valid('json');
  return c.json(createOrder(body), 200);
});

ordersRoutes.openapi(patchRoute, (c) => {
  const { id } = c.req.valid('param');
  const { owner, status, txHash } = c.req.valid('json');
  const updated = updateOrder(id, owner, { status, ...(txHash ? { txHash, filledAt: new Date().toISOString() } : {}) });
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated, 200);
});
