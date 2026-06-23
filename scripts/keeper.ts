/**
 * Keeper for on-chain CLOB limit orders.
 *
 * Scans configured CLOBs for crossed bid/ask pairs and calls matchOrders.
 * It also fills CLOB orders against AMM depth when the AMM price crosses the
 * maker's limit. This keeps the unified order book executable instead of
 * showing AMM depth as a visual-only reference.
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

const RPC_URL =
  process.env.ARC_RPC_URL ||
  process.env.DEPLOY_RPC_URL ||
  "https://rpc.testnet.arc.network";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const INTERVAL_MS = Number(process.env.KEEPER_INTERVAL_MS || "10000");
const RUN_ONCE = ["1", "true", "yes"].includes(
  (process.env.KEEPER_ONCE || "").toLowerCase(),
);
const MIN_EDGE_BPS = BigInt(process.env.KEEPER_MIN_EDGE_BPS || "0");
const MAX_AMM_USDC_PER_FILL = process.env.KEEPER_MAX_AMM_USDC_PER_FILL
  ? ethers.parseUnits(process.env.KEEPER_MAX_AMM_USDC_PER_FILL, 6)
  : undefined;

const PRICE_SCALE = ethers.parseEther("1");
const BPS_DENOMINATOR = 10000n;

const CLOB_ABI = [
  "function collateralToken() view returns (address)",
  "function getOpenOrders(uint8 outcome,uint8 side) view returns (uint256[])",
  "function getOrders(uint256[] ids) view returns (tuple(uint256 id,address maker,uint8 side,uint8 outcome,uint256 price,uint256 amountInitial,uint256 amountRemaining,uint256 escrowRemaining,uint8 status,uint256 createdAt,uint256 filledAt)[])",
  "function longToken() view returns (address)",
  "function shortToken() view returns (address)",
  "function fillOrder(uint256 orderId,uint256 amountToFill)",
  "function matchOrders(uint256 buyOrderId,uint256 sellOrderId,uint256 amountToFill)",
];

const AMM_ABI = [
  "function buyYes(uint256 usdcAmount) returns (uint256)",
  "function buyNo(uint256 usdcAmount) returns (uint256)",
  "function sellYes(uint256 yesAmount) returns (uint256)",
  "function sellNo(uint256 noAmount) returns (uint256)",
  "function calcBuyYes(uint256 usdcAmount) view returns (uint256)",
  "function calcBuyNo(uint256 usdcAmount) view returns (uint256)",
  "function calcSellYes(uint256 yesAmount) view returns (uint256)",
  "function calcSellNo(uint256 noAmount) view returns (uint256)",
];

const ERC20_ABI = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
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

type MarketConfig = {
  clobAddress: string;
  ammAddress?: string;
};

type MarketContracts = {
  amm: ethers.Contract;
  clob: ethers.Contract;
  clobAddress: string;
  ammAddress: string;
  collateral: ethers.Contract;
  yes: ethers.Contract;
  no: ethers.Contract;
};

function loadMarkets(): MarketConfig[] {
  const byClob = new Map<string, MarketConfig>();
  const envClob = process.env.DEPLOY_CLOB_ADDRESS;
  const envAmm = process.env.DEPLOY_AMM_ADDRESS;
  if (envClob && ethers.isAddress(envClob)) {
    byClob.set(ethers.getAddress(envClob), {
      clobAddress: ethers.getAddress(envClob),
      ammAddress:
        envAmm && ethers.isAddress(envAmm)
          ? ethers.getAddress(envAmm)
          : undefined,
    });
  }

  const marketsPath = path.join(ROOT, "data", "markets.json");
  if (fs.existsSync(marketsPath)) {
    const markets = JSON.parse(fs.readFileSync(marketsPath, "utf-8")) as Array<{
      ammAddress?: string;
      clobAddress?: string;
    }>;
    for (const market of markets) {
      if (!market.clobAddress || !ethers.isAddress(market.clobAddress))
        continue;
      const clobAddress = ethers.getAddress(market.clobAddress);
      byClob.set(clobAddress, {
        clobAddress,
        ammAddress:
          market.ammAddress && ethers.isAddress(market.ammAddress)
            ? ethers.getAddress(market.ammAddress)
            : byClob.get(clobAddress)?.ammAddress,
      });
    }
  }

  return [...byClob.values()];
}

async function openOrders(
  clob: ethers.Contract,
  outcome: number,
  side: number,
): Promise<Order[]> {
  const ids = [...((await clob.getOpenOrders(outcome, side)) as bigint[])];
  if (ids.length === 0) return [];
  return (await clob.getOrders(ids)) as Order[];
}

function quoteUp(amount: bigint, price: bigint): bigint {
  return (amount * price + PRICE_SCALE - 1n) / PRICE_SCALE;
}

function quoteDown(collateral: bigint, price: bigint): bigint {
  return (collateral * PRICE_SCALE) / price;
}

function minBigint(...values: bigint[]): bigint {
  return values.reduce((min, value) => (value < min ? value : min));
}

function outcomeLabel(outcome: number) {
  return outcome === Outcome.Yes ? "YES" : "NO";
}

function formatRaw(value: bigint) {
  return ethers.formatUnits(value, 6);
}

function formatPrice(value: bigint) {
  return `${(Number(ethers.formatUnits(value, 18)) * 100).toFixed(1)}%`;
}

function meetsEdge(received: bigint, spent: bigint) {
  return received * BPS_DENOMINATOR >= spent * (BPS_DENOMINATOR + MIN_EDGE_BPS);
}

async function ensureAllowance(
  token: ethers.Contract,
  owner: string,
  spender: string,
  amount: bigint,
) {
  const allowance = (await token.allowance(owner, spender)) as bigint;
  if (allowance >= amount) return;

  const tx = await token.approve(spender, ethers.MaxUint256);
  console.log(`[keeper] approving ${spender}: ${tx.hash}`);
  await tx.wait();
}

async function calcBuy(
  amm: ethers.Contract,
  outcome: number,
  usdcIn: bigint,
): Promise<bigint> {
  return outcome === Outcome.Yes
    ? ((await amm.calcBuyYes(usdcIn)) as bigint)
    : ((await amm.calcBuyNo(usdcIn)) as bigint);
}

async function calcSell(
  amm: ethers.Contract,
  outcome: number,
  amountIn: bigint,
): Promise<bigint> {
  return outcome === Outcome.Yes
    ? ((await amm.calcSellYes(amountIn)) as bigint)
    : ((await amm.calcSellNo(amountIn)) as bigint);
}

async function buyFromAmm(
  contracts: MarketContracts,
  outcome: number,
  usdcIn: bigint,
  walletAddress: string,
): Promise<bigint> {
  const token = outcome === Outcome.Yes ? contracts.yes : contracts.no;
  const before = (await token.balanceOf(walletAddress)) as bigint;

  await ensureAllowance(
    contracts.collateral,
    walletAddress,
    contracts.ammAddress,
    usdcIn,
  );
  const tx =
    outcome === Outcome.Yes
      ? await contracts.amm.buyYes(usdcIn)
      : await contracts.amm.buyNo(usdcIn);
  console.log(
    `[keeper] AMM buy ${outcomeLabel(outcome)} ${formatRaw(usdcIn)} USDC: ${tx.hash}`,
  );
  await tx.wait();

  const after = (await token.balanceOf(walletAddress)) as bigint;
  return after - before;
}

async function sellToAmm(
  contracts: MarketContracts,
  outcome: number,
  amountIn: bigint,
  walletAddress: string,
): Promise<bigint> {
  const before = (await contracts.collateral.balanceOf(
    walletAddress,
  )) as bigint;
  const token = outcome === Outcome.Yes ? contracts.yes : contracts.no;

  await ensureAllowance(token, walletAddress, contracts.ammAddress, amountIn);
  const tx =
    outcome === Outcome.Yes
      ? await contracts.amm.sellYes(amountIn)
      : await contracts.amm.sellNo(amountIn);
  console.log(
    `[keeper] AMM sell ${outcomeLabel(outcome)} ${formatRaw(amountIn)} tokens: ${tx.hash}`,
  );
  await tx.wait();

  const after = (await contracts.collateral.balanceOf(walletAddress)) as bigint;
  return after - before;
}

async function findMinBuyInput(
  amm: ethers.Contract,
  outcome: number,
  targetAmountOut: bigint,
  highInput: bigint,
): Promise<bigint> {
  let low = 1n;
  let high = highInput;
  while (low < high) {
    const mid = (low + high) / 2n;
    const out = await calcBuy(amm, outcome, mid);
    if (out >= targetAmountOut) high = mid;
    else low = mid + 1n;
  }
  return low;
}

async function findMaxProfitableSellAmount(
  amm: ethers.Contract,
  outcome: number,
  limitPrice: bigint,
  highAmount: bigint,
): Promise<bigint> {
  let low = 0n;
  let high = highAmount;
  while (low < high) {
    const mid = (low + high + 1n) / 2n;
    const quote = quoteUp(mid, limitPrice);
    const out = await calcSell(amm, outcome, mid);
    if (meetsEdge(out, quote)) low = mid;
    else high = mid - 1n;
  }
  return low;
}

async function fillBuyOrderAgainstAmm(
  contracts: MarketContracts,
  order: Order,
  walletAddress: string,
): Promise<boolean> {
  const balance = (await contracts.collateral.balanceOf(
    walletAddress,
  )) as bigint;
  const maxOrderQuote = quoteUp(order.amountRemaining, order.price);
  const budget = minBigint(
    order.escrowRemaining,
    maxOrderQuote,
    balance,
    MAX_AMM_USDC_PER_FILL ?? maxOrderQuote,
  );
  if (budget === 0n) return false;

  let expectedOut = await calcBuy(contracts.amm, Number(order.outcome), budget);
  if (expectedOut === 0n) return false;

  let usdcIn = budget;
  let fillAmount =
    expectedOut < order.amountRemaining ? expectedOut : order.amountRemaining;
  if (expectedOut >= order.amountRemaining) {
    usdcIn = await findMinBuyInput(
      contracts.amm,
      Number(order.outcome),
      order.amountRemaining,
      budget,
    );
    expectedOut = await calcBuy(contracts.amm, Number(order.outcome), usdcIn);
    fillAmount = order.amountRemaining;
  }

  const makerQuote = quoteUp(fillAmount, order.price);
  if (fillAmount === 0n || !meetsEdge(makerQuote, usdcIn)) return false;

  console.log(
    `[keeper] CLOB->AMM buy fill #${order.id} ${outcomeLabel(Number(order.outcome))}: limit ${formatPrice(order.price)}, spend ${formatRaw(usdcIn)} USDC, fill ${formatRaw(fillAmount)}`,
  );
  const received = await buyFromAmm(
    contracts,
    Number(order.outcome),
    usdcIn,
    walletAddress,
  );
  const actualFill = received < fillAmount ? received : fillAmount;
  const actualQuote = quoteUp(actualFill, order.price);
  if (actualFill === 0n || !meetsEdge(actualQuote, usdcIn)) {
    console.log(
      `[keeper] AMM output no longer crosses order #${order.id}; keeping acquired inventory`,
    );
    return false;
  }

  const token =
    Number(order.outcome) === Outcome.Yes ? contracts.yes : contracts.no;
  await ensureAllowance(
    token,
    walletAddress,
    contracts.clobAddress,
    actualFill,
  );
  const tx = await contracts.clob.fillOrder(order.id, actualFill);
  console.log(`[keeper] filled CLOB buy #${order.id} from AMM: ${tx.hash}`);
  await tx.wait();
  return true;
}

async function fillSellOrderAgainstAmm(
  contracts: MarketContracts,
  order: Order,
  walletAddress: string,
): Promise<boolean> {
  const balance = (await contracts.collateral.balanceOf(
    walletAddress,
  )) as bigint;
  let fillAmount = order.amountRemaining;
  const maxByWallet = quoteDown(balance, order.price);
  fillAmount = minBigint(fillAmount, maxByWallet);
  if (MAX_AMM_USDC_PER_FILL !== undefined) {
    fillAmount = minBigint(
      fillAmount,
      quoteDown(MAX_AMM_USDC_PER_FILL, order.price),
    );
  }
  while (fillAmount > 0n && quoteUp(fillAmount, order.price) > balance) {
    fillAmount -= 1n;
  }
  if (fillAmount === 0n) return false;

  const expectedOut = await calcSell(
    contracts.amm,
    Number(order.outcome),
    fillAmount,
  );
  const quote = quoteUp(fillAmount, order.price);
  if (!meetsEdge(expectedOut, quote)) {
    fillAmount = await findMaxProfitableSellAmount(
      contracts.amm,
      Number(order.outcome),
      order.price,
      fillAmount,
    );
  }
  if (fillAmount === 0n) return false;

  const makerQuote = quoteUp(fillAmount, order.price);
  console.log(
    `[keeper] CLOB->AMM sell fill #${order.id} ${outcomeLabel(Number(order.outcome))}: limit ${formatPrice(order.price)}, pay ${formatRaw(makerQuote)} USDC, sell ${formatRaw(fillAmount)}`,
  );

  await ensureAllowance(
    contracts.collateral,
    walletAddress,
    contracts.clobAddress,
    makerQuote,
  );
  const token =
    Number(order.outcome) === Outcome.Yes ? contracts.yes : contracts.no;
  const before = (await token.balanceOf(walletAddress)) as bigint;
  const fillTx = await contracts.clob.fillOrder(order.id, fillAmount);
  console.log(`[keeper] filled CLOB sell #${order.id}: ${fillTx.hash}`);
  await fillTx.wait();

  const after = (await token.balanceOf(walletAddress)) as bigint;
  const receivedTokens = after - before;
  if (receivedTokens === 0n) return true;

  const currentOut = await calcSell(
    contracts.amm,
    Number(order.outcome),
    receivedTokens,
  );
  if (!meetsEdge(currentOut, makerQuote)) {
    console.log(
      `[keeper] AMM bid no longer crosses order #${order.id}; keeping acquired inventory`,
    );
    return true;
  }

  const usdcOut = await sellToAmm(
    contracts,
    Number(order.outcome),
    receivedTokens,
    walletAddress,
  );
  console.log(
    `[keeper] AMM hedge for #${order.id} returned ${formatRaw(usdcOut)} USDC`,
  );
  return true;
}

async function matchCrossedForOutcome(
  clob: ethers.Contract,
  clobAddress: string,
  outcome: number,
) {
  const [buysRaw, sellsRaw] = await Promise.all([
    openOrders(clob, outcome, Side.Buy),
    openOrders(clob, outcome, Side.Sell),
  ]);

  const buys = buysRaw
    .filter((order) => Number(order.status) === 0 && order.amountRemaining > 0n)
    .sort((a, b) =>
      a.price === b.price
        ? Number(a.createdAt - b.createdAt)
        : a.price > b.price
          ? -1
          : 1,
    );
  const sells = sellsRaw
    .filter((order) => Number(order.status) === 0 && order.amountRemaining > 0n)
    .sort((a, b) =>
      a.price === b.price
        ? Number(a.createdAt - b.createdAt)
        : a.price < b.price
          ? -1
          : 1,
    );

  if (buys.length === 0 || sells.length === 0) return;

  const bestBid = buys[0];
  const bestAsk = sells[0];
  if (bestBid.price < bestAsk.price) return;

  console.log(
    `[keeper] ${clobAddress} crossed ${outcomeLabel(outcome)}: bid #${bestBid.id} ${ethers.formatUnits(bestBid.price, 18)} >= ask #${bestAsk.id} ${ethers.formatUnits(bestAsk.price, 18)}`,
  );

  const tx = await clob.matchOrders(bestBid.id, bestAsk.id, 0);
  console.log(`[keeper] submitted ${tx.hash}`);
  await tx.wait();
  console.log(`[keeper] matched ${tx.hash}`);
}

async function fillAmmCrossesForOutcome(
  contracts: MarketContracts,
  outcome: number,
  walletAddress: string,
) {
  const [buysRaw, sellsRaw] = await Promise.all([
    openOrders(contracts.clob, outcome, Side.Buy),
    openOrders(contracts.clob, outcome, Side.Sell),
  ]);

  const buys = buysRaw
    .filter((order) => Number(order.status) === 0 && order.amountRemaining > 0n)
    .sort((a, b) =>
      a.price === b.price
        ? Number(a.createdAt - b.createdAt)
        : a.price > b.price
          ? -1
          : 1,
    );
  const sells = sellsRaw
    .filter((order) => Number(order.status) === 0 && order.amountRemaining > 0n)
    .sort((a, b) =>
      a.price === b.price
        ? Number(a.createdAt - b.createdAt)
        : a.price < b.price
          ? -1
          : 1,
    );

  for (const order of buys) {
    await fillBuyOrderAgainstAmm(contracts, order, walletAddress);
  }
  for (const order of sells) {
    await fillSellOrderAgainstAmm(contracts, order, walletAddress);
  }
}

async function marketContracts(
  config: MarketConfig,
  wallet: ethers.Wallet,
): Promise<MarketContracts | null> {
  if (!config.ammAddress) return null;

  const clob = new ethers.Contract(config.clobAddress, CLOB_ABI, wallet);
  const [collateralAddress, yesAddress, noAddress] = await Promise.all([
    clob.collateralToken() as Promise<string>,
    clob.longToken() as Promise<string>,
    clob.shortToken() as Promise<string>,
  ]);

  return {
    amm: new ethers.Contract(config.ammAddress, AMM_ABI, wallet),
    clob,
    clobAddress: config.clobAddress,
    ammAddress: config.ammAddress,
    collateral: new ethers.Contract(collateralAddress, ERC20_ABI, wallet),
    yes: new ethers.Contract(yesAddress, ERC20_ABI, wallet),
    no: new ethers.Contract(noAddress, ERC20_ABI, wallet),
  };
}

async function tick(wallet: ethers.Wallet) {
  const markets = loadMarkets();
  if (markets.length === 0) {
    console.log("[keeper] no CLOB addresses configured");
    return;
  }

  for (const config of markets) {
    const clob = new ethers.Contract(config.clobAddress, CLOB_ABI, wallet);
    await matchCrossedForOutcome(clob, config.clobAddress, Outcome.Yes);
    await matchCrossedForOutcome(clob, config.clobAddress, Outcome.No);

    const contracts = await marketContracts(config, wallet);
    if (!contracts) {
      console.log(
        `[keeper] ${config.clobAddress} has no AMM configured; skipping AMM crosses`,
      );
      continue;
    }
    await fillAmmCrossesForOutcome(contracts, Outcome.Yes, wallet.address);
    await fillAmmCrossesForOutcome(contracts, Outcome.No, wallet.address);
  }
}

async function main() {
  if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY is required in .env.local");
  const key = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(key, provider);

  console.log(`[keeper] wallet ${wallet.address}`);
  console.log(`[keeper] rpc ${RPC_URL}`);
  console.log(
    RUN_ONCE ? "[keeper] mode one-shot" : `[keeper] interval ${INTERVAL_MS}ms`,
  );

  await tick(wallet);
  if (RUN_ONCE) return;

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
