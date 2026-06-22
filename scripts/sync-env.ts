/**
 * Propagate deployed contract addresses from the repo-root .env.local
 * (written by the Hardhat deploy script, using DEPLOY_* names) into
 * app/.env.local with the VITE_ prefix the Vite frontend expects.
 *
 * Usage: bun run sync-env
 * SPDX-License-Identifier: Apache-2.0
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dirname ?? __dirname, '..');

function readEnv(p: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

const root = readEnv(path.join(ROOT, '.env.local'));

const pick = (name: string, fallback = ''): string =>
  root[`DEPLOY_${name}`] || fallback;

const map: Record<string, string> = {
  VITE_ARC_RPC_URL: root.DEPLOY_RPC_URL || 'https://rpc.testnet.arc.network',
  VITE_API_URL: 'http://localhost:8787',
  VITE_MARKET_ADDRESS: pick('MARKET_ADDRESS'),
  VITE_AMM_ADDRESS: pick('AMM_ADDRESS'),
  VITE_CLOB_ADDRESS: pick('CLOB_ADDRESS'),
  VITE_USDC_ADDRESS: pick('USDC_ADDRESS', '0x3600000000000000000000000000000000000000'),
  VITE_OO_V2_ADDRESS: pick('OO_V2_ADDRESS'),
  VITE_FINDER_ADDRESS: pick('FINDER_ADDRESS'),
  VITE_TIMER_ADDRESS: pick('TIMER_ADDRESS'),
};

const appEnvPath = path.join(ROOT, 'app', '.env.local');
const existing = readEnv(appEnvPath);
Object.assign(existing, map);
const content = Object.entries(existing).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
fs.writeFileSync(appEnvPath, content);

console.log('Synced addresses to app/.env.local:');
for (const [k, v] of Object.entries(map)) console.log(`  ${k}=${v || '(empty)'}`);
