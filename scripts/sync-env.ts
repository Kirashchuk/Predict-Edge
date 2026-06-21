/**
 * Propagate deployed contract addresses from the repo-root .env.local
 * (written by the Hardhat deploy script, using NEXT_PUBLIC_* names) into
 * app/.env.local with the VITE_ prefix the Vite frontend expects.
 *
 * Usage: node --experimental-strip-types scripts/sync-env.ts
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

const map: Record<string, string> = {
  VITE_ARC_RPC_URL: root.NEXT_PUBLIC_ALCHEMY_RPC_URL || 'https://rpc.testnet.arc.network',
  VITE_API_URL: 'http://localhost:8787',
  VITE_MARKET_ADDRESS: root.NEXT_PUBLIC_MARKET_ADDRESS ?? '',
  VITE_AMM_ADDRESS: root.NEXT_PUBLIC_AMM_ADDRESS ?? '',
  VITE_ARCT_ADDRESS: root.NEXT_PUBLIC_ARCT_ADDRESS ?? '',
  VITE_OO_V2_ADDRESS: root.NEXT_PUBLIC_OO_V2_ADDRESS ?? '',
  VITE_FINDER_ADDRESS: root.NEXT_PUBLIC_FINDER_ADDRESS ?? '',
  VITE_TIMER_ADDRESS: root.NEXT_PUBLIC_TIMER_ADDRESS ?? '',
};

const appEnvPath = path.join(ROOT, 'app', '.env.local');
const existing = readEnv(appEnvPath);
Object.assign(existing, map);
const content = Object.entries(existing).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
fs.writeFileSync(appEnvPath, content);

console.log('Synced addresses to app/.env.local:');
for (const [k, v] of Object.entries(map)) console.log(`  ${k}=${v || '(empty)'}`);
