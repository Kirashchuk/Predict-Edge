/**
 * Deploy only the CLOB for an already deployed base market.
 *
 * Use this when `.env.local` already has DEPLOY_MARKET_ADDRESS from an
 * older deploy that predates OnChainLimitOrderBook.
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

function readEnv(envPath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) out[match[1].trim()] = match[2].trim();
  }
  return out;
}

function writeEnvFile(envPath: string, vars: Record<string, string>) {
  const env = { ...readEnv(envPath), ...vars };
  const oldPublicPrefix = `${"NEXT"}_${"PUBLIC"}_`;
  for (const key of Object.keys(env)) {
    if (key.startsWith(oldPublicPrefix)) delete env[key];
  }
  const output = Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n") + "\n";
  fs.writeFileSync(envPath, output);
}

/** Add clobAddress to a user-created market entry in data/markets.json. */
function patchMarketsJson(marketAddress: string, clobAddress: string): boolean {
  const file = path.resolve(__dirname, "../data/markets.json");
  if (!fs.existsSync(file)) return false;
  const markets = JSON.parse(fs.readFileSync(file, "utf-8")) as Array<Record<string, string>>;
  let patched = false;
  for (const m of markets) {
    if (m.address?.toLowerCase() === marketAddress.toLowerCase()) {
      m.clobAddress = clobAddress;
      patched = true;
    }
  }
  if (patched) fs.writeFileSync(file, JSON.stringify(markets, null, 2) + "\n");
  return patched;
}

async function main() {
  const envPath = path.resolve(__dirname, "../.env.local");
  const env = readEnv(envPath);
  // Optional override: deploy a CLOB for a specific (e.g. user-created) market.
  const target = process.env.CLOB_MARKET?.trim();
  const baseMarket = env.DEPLOY_MARKET_ADDRESS;
  const marketAddress = target && target.length > 0 ? target : baseMarket;
  const isBase = !target || target.toLowerCase() === baseMarket?.toLowerCase();

  if (!marketAddress || !ethers.isAddress(marketAddress)) {
    throw new Error("Target market address is missing or invalid (set CLOB_MARKET or DEPLOY_MARKET_ADDRESS).");
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer account found. Set PRIVATE_KEY in .env.local.");

  console.log("Deploying CLOB for market:", marketAddress, isBase ? "(base)" : "(custom)");
  console.log("Deployer:", deployer.address);

  const clobFactory = await ethers.getContractFactory("OnChainLimitOrderBook", deployer);
  const clob = await clobFactory.deploy(marketAddress);
  await clob.waitForDeployment();
  const clobAddress = await clob.getAddress();
  console.log("OnChainLimitOrderBook:", clobAddress);

  if (isBase) {
    writeEnvFile(envPath, { DEPLOY_CLOB_ADDRESS: clobAddress });
    console.log(`Updated ${envPath} (DEPLOY_CLOB_ADDRESS). Next: bun run sync-env`);
  } else {
    const patched = patchMarketsJson(marketAddress, clobAddress);
    console.log(
      patched
        ? "Updated data/markets.json with clobAddress for this market."
        : "Note: market not found in data/markets.json — record clobAddress manually.",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
