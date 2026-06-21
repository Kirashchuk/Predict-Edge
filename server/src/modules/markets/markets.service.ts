import * as fs from 'node:fs';
import { ethers } from 'ethers';
import { ResultAsync, err, errAsync, ok, type Result } from 'neverthrow';
import { env } from '../../core/config';
import { logger } from '../../core/logger';
import { artifactPath } from '../../core/paths';
import { prependMarket, type StoredMarket } from './markets.store';

// --- Market parameters (mirror scripts/deploy.ts CONFIG / legacy API) -----
const PROPOSER_REWARD = ethers.parseEther('10'); // 10 ARCT
const MARKET_LIVENESS = 60n; // 1 minute (testnet)
const PROPOSER_BOND = ethers.parseEther('100'); // 100 ARCT
const AMM_FEE_BPS = 200n; // 2%
const SEED_LIQUIDITY = ethers.parseEther('1000'); // 1000 ARCT

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
  'function allocateTo(address ownerAddress, uint256 value)',
];
const MARKET_INIT_ABI = ['function initializeMarket()'];
const AMM_INIT_ABI = ['function initialize(uint256 _initialLiquidity)'];

function deployerConfig(): Result<
  { privateKey: string; arct: string; finder: string; timer: string },
  CreateMarketError
> {
  const { PRIVATE_KEY, ARCT_ADDRESS, FINDER_ADDRESS, TIMER_ADDRESS } = env;
  if (!PRIVATE_KEY) {
    return err({ kind: 'not_configured', message: 'Server not configured: missing PRIVATE_KEY' });
  }
  if (!ARCT_ADDRESS || !FINDER_ADDRESS || !TIMER_ADDRESS) {
    return err({
      kind: 'not_configured',
      message: 'Server not configured: missing contract addresses. Run the deploy script first.',
    });
  }
  return ok({ privateKey: PRIVATE_KEY, arct: ARCT_ADDRESS, finder: FINDER_ADDRESS, timer: TIMER_ADDRESS });
}

async function deployMarketAndAmm(
  title: string,
  cfg: { privateKey: string; arct: string; finder: string; timer: string },
): Promise<StoredMarket> {
  const provider = new ethers.JsonRpcProvider(env.ARC_RPC_URL);
  const key = cfg.privateKey.startsWith('0x') ? cfg.privateKey : `0x${cfg.privateKey}`;
  const wallet = new ethers.Wallet(key, provider);

  const pairName = title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
  const ancillaryData = ethers.toUtf8Bytes(title);

  const marketArtifact = loadArtifact('EventBasedPredictionMarket.sol/EventBasedPredictionMarket.json');
  const ammArtifact = loadArtifact('PredictionMarketAMM.sol/PredictionMarketAMM.json');

  const arct = new ethers.Contract(cfg.arct, ERC20_ABI, wallet);

  // Ensure the deployer holds enough ARCT (reward + seed) before deploying.
  const totalNeeded = PROPOSER_REWARD + SEED_LIQUIDITY;
  const balance: bigint = await arct.balanceOf!(wallet.address);
  if (balance < totalNeeded) {
    const mintAmount = totalNeeded - balance + ethers.parseEther('100');
    logger.info({ mintAmount: mintAmount.toString() }, 'minting ARCT for deployer');
    await (await arct.allocateTo!(wallet.address, mintAmount)).wait();
  }

  // --- Deploy market ------------------------------------------------------
  const marketFactory = new ethers.ContractFactory(marketArtifact.abi, marketArtifact.bytecode, wallet);
  const market = await marketFactory.deploy(
    pairName,
    cfg.arct,
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
  await (await arct.approve!(marketAddress, PROPOSER_REWARD)).wait();
  const marketInit = new ethers.Contract(marketAddress, MARKET_INIT_ABI, wallet);
  await (await marketInit.initializeMarket!()).wait();

  // --- Deploy + seed AMM --------------------------------------------------
  const ammFactory = new ethers.ContractFactory(ammArtifact.abi, ammArtifact.bytecode, wallet);
  const amm = await ammFactory.deploy(marketAddress, AMM_FEE_BPS);
  await amm.waitForDeployment();
  const ammAddress = await amm.getAddress();
  logger.info({ ammAddress }, 'amm deployed');

  await (await arct.approve!(ammAddress, SEED_LIQUIDITY)).wait();
  const ammInit = new ethers.Contract(ammAddress, AMM_INIT_ABI, wallet);
  await (await ammInit.initialize!(SEED_LIQUIDITY)).wait();

  const market_: StoredMarket = {
    id: `user-${Date.now()}`,
    address: marketAddress,
    ammAddress,
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
