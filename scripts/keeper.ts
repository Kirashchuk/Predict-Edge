/**
 * Keeper for on-chain CLOB limit orders.
 *
 * Scans configured CLOBs for crossed bid/ask pairs and calls matchOrders.
 * Uses the deployer PRIVATE_KEY from .env.local, so keep this testnet-only.
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { ethers } from "ethers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

for (const file of [".env.local", ".env"]) {
  const p = path.join(ROOT, file);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

const RPC_URL = process.env.ARC_RPC_URL || process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || "https://rpc.testnet.arc.network";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const INTERVAL_MS = Number(process.env.KEEPER_INTERVAL_MS || "10000");

const CLOB_ABI = [
  "function getOpenOrders(uint8 outcome,uint8 side) view returns (uint256[])",
  "function getOrders(uint256[] ids) view returns (tuple(uint256 id,address maker,uint8 side,uint8 outcome,uint256 price,uint256 amountInitial,uint256 amountRemaining,uint256 escrowRemaining,uint8 status,uint256 createdAt,uint256 filledAt)[])",
  "function matchOrders(uint256 buyOrderId,uint256 sellOrderId,uint256 amountToFill)",
];

type Order = {
  id: bigint;
  maker: string;
  side: bigint | number;
  outcome: bigint | number;
  price: bigint;
  amountInitial: bigint;
  amountRemaining: bigint;
  escrowRemaining: bigint;
  status: bigint | number;
  createdAt: bigint;
  filledAt: bigint;
};

const Outcome = { Yes: 0, No: 1 } as const;
const Side = { Buy: 0, Sell: 1 } as const;

function loadClobs(): string[] {
  const out = new Set<string>();
  const envClob = process.env.NEXT_PUBLIC_CLOB_ADDRESS;
  if (envClob && ethers.isAddress(envClob)) out.add(ethers.getAddress(envClob));

  const marketsPath = path.join(ROOT, "data", "markets.json");
  if (fs.existsSync(marketsPath)) {
    const markets = JSON.parse(fs.readFileSync(marketsPath, "utf-8")) as Array<{ clobAddress?: string }>;
    for (const market of markets) {
      if (market.clobAddress && ethers.isAddress(market.clobAddress)) out.add(ethers.getAddress(market.clobAddress));
    }
  }

  return [...out];
}

async function openOrders(clob: ethers.Contract, outcome: number, side: number): Promise<Order[]> {
  const ids: bigint[] = await clob.getOpenOrders(outcome, side);
  if (ids.length === 0) return [];
  return (await clob.getOrders(ids)) as Order[];
}

async function matchCrossedForOutcome(clob: ethers.Contract, clobAddress: string, outcome: number) {
  const [buysRaw, sellsRaw] = await Promise.all([
    openOrders(clob, outcome, Side.Buy),
    openOrders(clob, outcome, Side.Sell),
  ]);

  const buys = buysRaw
    .filter((order) => Number(order.status) === 0 && order.amountRemaining > 0n)
    .sort((a, b) => (a.price === b.price ? Number(a.createdAt - b.createdAt) : a.price > b.price ? -1 : 1));
  const sells = sellsRaw
    .filter((order) => Number(order.status) === 0 && order.amountRemaining > 0n)
    .sort((a, b) => (a.price === b.price ? Number(a.createdAt - b.createdAt) : a.price < b.price ? -1 : 1));

  if (buys.length === 0 || sells.length === 0) return;

  const bestBid = buys[0];
  const bestAsk = sells[0];
  if (bestBid.price < bestAsk.price) return;

  const outcomeLabel = outcome === Outcome.Yes ? "YES" : "NO";
  console.log(
    `[keeper] ${clobAddress} crossed ${outcomeLabel}: bid #${bestBid.id} ${ethers.formatUnits(bestBid.price, 18)} >= ask #${bestAsk.id} ${ethers.formatUnits(bestAsk.price, 18)}`,
  );

  const tx = await clob.matchOrders(bestBid.id, bestAsk.id, 0);
  console.log(`[keeper] submitted ${tx.hash}`);
  await tx.wait();
  console.log(`[keeper] matched ${tx.hash}`);
}

async function tick(wallet: ethers.Wallet) {
  const clobs = loadClobs();
  if (clobs.length === 0) {
    console.log("[keeper] no CLOB addresses configured");
    return;
  }

  for (const clobAddress of clobs) {
    const clob = new ethers.Contract(clobAddress, CLOB_ABI, wallet);
    await matchCrossedForOutcome(clob, clobAddress, Outcome.Yes);
    await matchCrossedForOutcome(clob, clobAddress, Outcome.No);
  }
}

async function main() {
  if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY is required in .env.local");
  const key = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(key, provider);

  console.log(`[keeper] wallet ${wallet.address}`);
  console.log(`[keeper] rpc ${RPC_URL}`);
  console.log(`[keeper] interval ${INTERVAL_MS}ms`);

  await tick(wallet);
  setInterval(() => {
    tick(wallet).catch((error) => {
      console.error("[keeper]", error instanceof Error ? error.message : error);
    });
  }, INTERVAL_MS);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
