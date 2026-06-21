/**
 * Пост-деплойна перевірка стану контрактів на Arc Testnet.
 * Читає on-chain стан (резерви AMM, ціни, статус ринку, баланси) і друкує звіт.
 *
 * Запуск: node --no-warnings --experimental-strip-types scripts/verify-deploy.ts
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";
import * as path from "path";
import { createPublicClient, http, formatEther, type Address } from "viem";

function readEnv(): Record<string, string> {
  const p = path.resolve(process.cwd(), ".env.local");
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

const env = readEnv();
const RPC = env.NEXT_PUBLIC_ALCHEMY_RPC_URL || "https://rpc.testnet.arc.network";
const client = createPublicClient({ transport: http(RPC) });

const AMM = env.NEXT_PUBLIC_AMM_ADDRESS as Address;
const MARKET = env.NEXT_PUBLIC_MARKET_ADDRESS as Address;
const ARCT = env.NEXT_PUBLIC_ARCT_ADDRESS as Address;

const ammAbi = [
  { name: "getReserves", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }, { type: "uint256" }] },
  { name: "getYesPrice", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "getNoPrice", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "feeBps", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "initialized", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
] as const;

const marketAbi = [
  { name: "priceRequested", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "receivedSettlementPrice", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "pairName", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

const erc20Abi = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

async function main() {
  console.log("\n=== Пост-деплойна перевірка (Arc Testnet) ===\n");

  const [reserves, yesPrice, noPrice, fee, ammInit] = await Promise.all([
    client.readContract({ address: AMM, abi: ammAbi, functionName: "getReserves" }),
    client.readContract({ address: AMM, abi: ammAbi, functionName: "getYesPrice" }),
    client.readContract({ address: AMM, abi: ammAbi, functionName: "getNoPrice" }),
    client.readContract({ address: AMM, abi: ammAbi, functionName: "feeBps" }),
    client.readContract({ address: AMM, abi: ammAbi, functionName: "initialized" }),
  ]);

  const [priceRequested, settled, pairName] = await Promise.all([
    client.readContract({ address: MARKET, abi: marketAbi, functionName: "priceRequested" }),
    client.readContract({ address: MARKET, abi: marketAbi, functionName: "receivedSettlementPrice" }),
    client.readContract({ address: MARKET, abi: marketAbi, functionName: "pairName" }),
  ]);

  const [arctSymbol, deployerArct, ammArct, gasBal] = await Promise.all([
    client.readContract({ address: ARCT, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address: ARCT, abi: erc20Abi, functionName: "balanceOf", args: [env.PRIVATE_KEY ? ("0x72CA27CC843373671DaA8F4876C36aa84ee74A3E" as Address) : (ARCT) ] }),
    client.readContract({ address: ARCT, abi: erc20Abi, functionName: "balanceOf", args: [AMM] }),
    client.getBalance({ address: "0x72CA27CC843373671DaA8F4876C36aa84ee74A3E" as Address }),
  ]);

  console.log(`Market (${pairName}):`);
  console.log(`  priceRequested:          ${priceRequested}  ${priceRequested ? "✅" : "❌"}`);
  console.log(`  receivedSettlementPrice: ${settled} (очікувано false до резолюції)`);
  console.log("");
  console.log("AMM:");
  console.log(`  initialized:  ${ammInit}  ${ammInit ? "✅" : "❌"}`);
  console.log(`  reserves:     YES=${formatEther(reserves[0])}  NO=${formatEther(reserves[1])}`);
  console.log(`  yesPrice:     ${formatEther(yesPrice)} (≈0.5 очікувано)`);
  console.log(`  noPrice:      ${formatEther(noPrice)} (≈0.5 очікувано)`);
  console.log(`  feeBps:       ${fee} (200 = 2%)`);
  console.log("");
  console.log("Balances:");
  console.log(`  deployer ${arctSymbol}: ${formatEther(deployerArct)} (≈98990 = 100000-10-1000)`);
  console.log(`  AMM ${arctSymbol}:      ${formatEther(ammArct)} (0 — пішло в market.create як колатераль)`);
  console.log(`  deployer gas:  ${formatEther(gasBal)} USDC (залишок)`);
  console.log("\nЗатрачено газу на деплой: ~" + (20.024 - Number(formatEther(gasBal))).toFixed(4) + " USDC\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
