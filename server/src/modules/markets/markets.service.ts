import * as fs from 'node:fs';
import { ethers } from 'ethers';
import { ResultAsync, err, errAsync, ok, type Result } from 'neverthrow';
import { env } from '../../core/config';
import { logger } from '../../core/logger';
import { artifactPath } from '../../core/paths';
import { prependMarket, type StoredMarket } from './markets.store';

// Collateral = Arc Testnet native USDC ERC-20 (system address, 6 decimals).
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
const usdc = (n: string) => ethers.parseUnits(n, 6);

// --- Market parameters (mirror scripts/deploy.ts CONFIG; small USDC amounts) -
const PROPOSER_REWARD = usdc('0.1'); // 0.1 USDC
const MARKET_LIVENESS = 60n; // 1 minute (testnet)
const PROPOSER_BOND = usdc('1'); // 1 USDC
const AMM_FEE_BPS = 200n; // 2%
const SEED_LIQUIDITY = usdc('1'); // 1 USDC

export type CreateMarketError =
  | { kind: 'not_configured'; message: string }
  | { kind: 'deploy_failed'; message: string };

interface Artifact {
  abi: ethers.InterfaceAbi;
  bytecode: string;
}

function loadArtifact(contractPath: string): Artifact {
  const json = JSON.parse(fs.readFileSync(artifactPath(contractPath), 'utf-8'));
  return { abi: json.abi, bytecode: json.bytecode };
}

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
];
const MARKET_INIT_ABI = ['function initializeMarket()'];
const AMM_INIT_ABI = ['function initialize(uint256 _initialLiquidity)'];

function deployerConfig(): Result<
  { privateKey: string; finder: string; timer: string },
  CreateMarketError
> {
  const { PRIVATE_KEY, FINDER_ADDRESS, TIMER_ADDRESS } = env;
  if (!PRIVATE_KEY) {
    return err({ kind: 'not_configured', message: 'Server not configured: missing PRIVATE_KEY' });
  }
  if (!FINDER_ADDRESS || !TIMER_ADDRESS) {
    return err({
      kind: 'not_configured',
      message: 'Server not configured: missing contract addresses. Run the deploy script first.',
    });
  }
  return ok({ privateKey: PRIVATE_KEY, finder: FINDER_ADDRESS, timer: TIMER_ADDRESS });
}

async function deployMarketAndAmm(
  title: string,
  cfg: { privateKey: string; finder: string; timer: string },
): Promise<StoredMarket> {
  const provider = new ethers.JsonRpcProvider(env.ARC_RPC_URL);
  const key = cfg.privateKey.startsWith('0x') ? cfg.privateKey : `0x${cfg.privateKey}`;
  const wallet = new ethers.Wallet(key, provider);

  const pairName = title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
  const ancillaryData = ethers.toUtf8Bytes(title);

  const marketArtifact = loadArtifact('EventBasedPredictionMarket.sol/EventBasedPredictionMarket.json');
  const ammArtifact = loadArtifact('PredictionMarketAMM.sol/PredictionMarketAMM.json');
  const clobArtifact = loadArtifact('OnChainLimitOrderBook.sol/OnChainLimitOrderBook.json');

  const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);

  // USDC cannot be minted — the deployer must already hold enough (reward + seed).
  const totalNeeded = PROPOSER_REWARD + SEED_LIQUIDITY;
  const balance: bigint = await usdcContract.balanceOf!(wallet.address);
  if (balance < totalNeeded) {
    throw new Error(
      `Insufficient USDC: have ${ethers.formatUnits(balance, 6)}, need ${ethers.formatUnits(totalNeeded, 6)} (+ gas). Top up from https://faucet.circle.com/`,
    );
  }

  // --- Deploy market ------------------------------------------------------
  const marketFactory = new ethers.ContractFactory(marketArtifact.abi, marketArtifact.bytecode, wallet);
  const market = await marketFactory.deploy(
    pairName,
    USDC_ADDRESS,
    ancillaryData,
    cfg.finder,
    cfg.timer,
    PROPOSER_REWARD,
    MARKET_LIVENESS,
    PROPOSER_BOND,
  );
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  logger.info({ marketAddress }, 'market deployed');

  // --- Initialize market (approve reward + requestPrice) ------------------
  await (await usdcContract.approve!(marketAddress, PROPOSER_REWARD)).wait();
  const marketInit = new ethers.Contract(marketAddress, MARKET_INIT_ABI, wallet);
  await (await marketInit.initializeMarket!()).wait();

  // --- Deploy + seed AMM --------------------------------------------------
  const ammFactory = new ethers.ContractFactory(ammArtifact.abi, ammArtifact.bytecode, wallet);
  const amm = await ammFactory.deploy(marketAddress, AMM_FEE_BPS);
  await amm.waitForDeployment();
  const ammAddress = await amm.getAddress();
  logger.info({ ammAddress }, 'amm deployed');

  await (await usdcContract.approve!(ammAddress, SEED_LIQUIDITY)).wait();
  const ammInit = new ethers.Contract(ammAddress, AMM_INIT_ABI, wallet);
  await (await ammInit.initialize!(SEED_LIQUIDITY)).wait();

  // --- Deploy CLOB --------------------------------------------------------
  const clobFactory = new ethers.ContractFactory(clobArtifact.abi, clobArtifact.bytecode, wallet);
  const clob = await clobFactory.deploy(marketAddress);
  await clob.waitForDeployment();
  const clobAddress = await clob.getAddress();
  logger.info({ clobAddress }, 'clob deployed');

  const market_: StoredMarket = {
    id: `user-${Date.now()}`,
    address: marketAddress,
    ammAddress,
    clobAddress,
    title,
    category: 'Crypto',
    createdAt: new Date().toISOString(),
  };
  prependMarket(market_);
  return market_;
}

export function createMarket(
  title: string,
): ResultAsync<StoredMarket, CreateMarketError> {
  const cfg = deployerConfig();
  if (cfg.isErr()) return errAsync(cfg.error);

  return ResultAsync.fromPromise(
    deployMarketAndAmm(title.trim(), cfg.value),
    (e): CreateMarketError => {
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error({ err: message }, 'market creation failed');
      return { kind: 'deploy_failed', message: `Market creation failed: ${message}` };
    },
  );
}
