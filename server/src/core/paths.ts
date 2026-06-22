import * as path from 'node:path';

// server/src/core/paths.ts -> repo root is three levels up.
export const REPO_ROOT = path.resolve(import.meta.dir, '../../..');

export const DATA_DIR = path.join(REPO_ROOT, 'data');
export const MARKETS_FILE = path.join(DATA_DIR, 'markets.json');
export const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
export const ARTIFACTS_DIR = path.join(REPO_ROOT, 'artifacts', 'contracts');

export function artifactPath(contractPath: string): string {
  return path.join(ARTIFACTS_DIR, contractPath);
}
