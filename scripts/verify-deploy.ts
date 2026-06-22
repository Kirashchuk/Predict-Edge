/**
 * Пост-деплойна перевірка стану контрактів на Arc Testnet.
 * Читає on-chain стан (резерви AMM, ціни, статус ринку, баланси) і друкує звіт.
 *
 * Usage: bun run verify-deploy
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";
import * as path from "path";
import { createPublicClient, http, formatEther, formatUnits, isAddress, type Address } from "viem";
import { Wallet } from "ethers";

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
const pick = (name: string, fallback = ""): string =>
  env[`DEPLOY_${name}`] || fallback;
const RPC = env.DEPLOY_RPC_URL || "https://rpc.testnet.arc.network";
const client = createPublicClient({ transport: http(RPC) });

const AMM = pick("AMM_ADDRESS") as Address;
const MARKET = pick("MARKET_ADDRESS") as Address;
const CLOB = pick("CLOB_ADDRESS") as Address | undefined;
const USDC = pick("USDC_ADDRESS", "0x3600000000000000000000000000000000000000") as Address;

const deployerAddress = (() => {
  if (!env.PRIVATE_KEY) return USDC;
  const key = env.PRIVATE_KEY.startsWith("0x") ? env.PRIVATE_KEY : `0x${env.PRIVATE_KEY}`;
  return new Wallet(key).address as Address;
})();

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

const clobAbi = [
  { name: "market", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "getOpenOrders", type: "function", stateMutability: "view", inputs: [{ type: "uint8" }, { type: "uint8" }], outputs: [{ type: "uint256[]" }] },
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

  const [usdcSymbol, deployerUsdc, ammUsdc, gasBal] = await Promise.all([
    client.readContract({ address: USDC, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [deployerAddress] }),
    client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [AMM] }),
    client.getBalance({ address: deployerAddress }),
  ]);

  console.log(`Market (${pairName}):`);
  console.log(`  priceRequested:          ${priceRequested}  ${priceRequested ? "✅" : "❌"}`);
  console.log(`  receivedSettlementPrice: ${settled} (очікувано false до резолюції)`);
  console.log("");
  // Collateral (USDC) amounts use 6 decimals; price ratios use 18.
  const usdc6 = (v: bigint) => formatUnits(v, 6);
  console.log("AMM:");
  console.log(`  initialized:  ${ammInit}  ${ammInit ? "✅" : "❌"}`);
  console.log(`  reserves:     YES=${usdc6(reserves[0])}  NO=${usdc6(reserves[1])} USDC`);
  console.log(`  yesPrice:     ${formatEther(yesPrice)} (≈0.5 очікувано)`);
  console.log(`  noPrice:      ${formatEther(noPrice)} (≈0.5 очікувано)`);
  console.log(`  feeBps:       ${fee} (200 = 2%)`);
  console.log("");
  if (CLOB && isAddress(CLOB)) {
    const [clobMarket, yesBids, yesAsks, noBids, noAsks] = await Promise.all([
      client.readContract({ address: CLOB, abi: clobAbi, functionName: "market" }),
      client.readContract({ address: CLOB, abi: clobAbi, functionName: "getOpenOrders", args: [0, 0] }),
      client.readContract({ address: CLOB, abi: clobAbi, functionName: "getOpenOrders", args: [0, 1] }),
      client.readContract({ address: CLOB, abi: clobAbi, functionName: "getOpenOrders", args: [1, 0] }),
      client.readContract({ address: CLOB, abi: clobAbi, functionName: "getOpenOrders", args: [1, 1] }),
    ]);
    const attached = clobMarket.toLowerCase() === MARKET.toLowerCase();
    console.log("CLOB:");
    console.log(`  address:      ${CLOB}`);
    console.log(`  market:       ${clobMarket}  ${attached ? "✅" : "❌"}`);
    console.log(`  YES bids/asks:${yesBids.length}/${yesAsks.length}`);
    console.log(`  NO bids/asks: ${noBids.length}/${noAsks.length}`);
    console.log("");
  } else {
    console.log("CLOB:");
    console.log("  DEPLOY_CLOB_ADDRESS is not configured.");
    console.log("");
  }
  console.log("Balances:");
  console.log(`  deployer ${usdcSymbol}: ${usdc6(deployerUsdc)} USDC (ERC-20, 6 dec)`);
  console.log(`  AMM ${usdcSymbol}:      ${usdc6(ammUsdc)} USDC`);
  console.log(`  deployer gas (native): ${formatEther(gasBal)} USDC`);
}

main().catch((e) => { console.error(e); process.exit(1); });
