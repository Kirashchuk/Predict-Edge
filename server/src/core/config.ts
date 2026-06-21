import * as path from 'node:path';
import * as fs from 'node:fs';
import dotenv from 'dotenv';
import { z } from 'zod';
import { REPO_ROOT } from './paths';

// Reuse the repo-root env files written by the Hardhat deploy script so the
// backend shares one source of truth (deployer key + deployed addresses).
for (const file of ['.env.local', '.env']) {
  const p = path.join(REPO_ROOT, file);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}
// Also load the server's own .env (local overrides).
dotenv.config({ override: false });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(8787),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  ARC_RPC_URL: z
    .string()
    .default(process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || 'https://rpc.testnet.arc.network'),
  PRIVATE_KEY: z.string().optional(),
  ARCT_ADDRESS: z.string().optional(),
  FINDER_ADDRESS: z.string().optional(),
  TIMER_ADDRESS: z.string().optional(),
});

export const env = schema.parse({
  NODE_ENV: process.env.NODE_ENV,
  API_PORT: process.env.API_PORT,
  CORS_ORIGINS: process.env.CORS_ORIGINS,
  ARC_RPC_URL: process.env.ARC_RPC_URL,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  ARCT_ADDRESS: process.env.NEXT_PUBLIC_ARCT_ADDRESS,
  FINDER_ADDRESS: process.env.NEXT_PUBLIC_FINDER_ADDRESS,
  TIMER_ADDRESS: process.env.NEXT_PUBLIC_TIMER_ADDRESS,
});

export type Env = typeof env;
