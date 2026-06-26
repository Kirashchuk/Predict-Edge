/**
 * Send a small Arc Testnet USDC payment through the predeployed Memo contract.
 *
 * Usage:
 *   bun run memo:payment
 *   bun run memo:payment -- --amount 0.05 --ref predict-edge-test-001 --note "order=..."
 *   bun run memo:payment -- --recipient 0xRecipient --amount 0.01
 *
 * If no recipient is configured, the script creates a local test recipient and
 * stores its key in .env.memo-test.local, which is ignored by git.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";

const ARC_TESTNET_CHAIN_ID = 5042002n;
const DEFAULT_RPC_URL = "https://rpc.testnet.arc.network";
const EXPLORER_URL = "https://testnet.arcscan.app";
const MEMO_ADDRESS = "0x5294E9927c3306DcBaDb03fe70b92e01cCede505";
const DEFAULT_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const DEFAULT_AMOUNT = "0.05";

const MEMO_ABI = [
  "function memo(address target, bytes data, bytes32 memoId, bytes memoData)",
  "event BeforeMemo(uint256 indexed memoIndex)",
  "event Memo(address indexed sender, address indexed target, bytes32 callDataHash, bytes32 indexed memoId, bytes memo, uint256 memoIndex)",
];

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

type EnvMap = Record<string, string>;

function readEnv(envPath: string): EnvMap {
  const out: EnvMap = {};
  if (!fs.existsSync(envPath)) return out;

  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) out[match[1].trim()] = match[2].trim();
  }
  return out;
}

function writeEnv(envPath: string, vars: EnvMap) {
  const existing = readEnv(envPath);
  Object.assign(existing, vars);
  const content =
    Object.entries(existing)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n";
  fs.writeFileSync(envPath, content);
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function normalizePrivateKey(key: string): `0x${string}` {
  const normalized = key.trim().startsWith("0x") ? key.trim() : `0x${key.trim()}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("PRIVATE_KEY must be 64 hex chars, with or without 0x prefix.");
  }
  return normalized as `0x${string}`;
}

function mask(value: string): string {
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function loadOrCreateRecipient(root: string, env: EnvMap) {
  const recipientFromArgs = argValue("--recipient");
  const recipientFromEnv = env.MEMO_RECIPIENT_ADDRESS;
  if (recipientFromArgs || recipientFromEnv) {
    return {
      address: ethers.getAddress(recipientFromArgs || recipientFromEnv),
      source: recipientFromArgs ? "cli" : ".env.local",
      privateKey: undefined,
    };
  }

  const testEnvPath = path.join(root, ".env.memo-test.local");
  const testEnv = readEnv(testEnvPath);
  if (testEnv.MEMO_TEST_RECIPIENT_ADDRESS) {
    return {
      address: ethers.getAddress(testEnv.MEMO_TEST_RECIPIENT_ADDRESS),
      source: ".env.memo-test.local",
      privateKey: testEnv.MEMO_TEST_RECIPIENT_PRIVATE_KEY,
    };
  }

  const wallet = ethers.Wallet.createRandom();
  writeEnv(testEnvPath, {
    MEMO_TEST_RECIPIENT_ADDRESS: wallet.address,
    MEMO_TEST_RECIPIENT_PRIVATE_KEY: wallet.privateKey,
    MEMO_TEST_RECIPIENT_CREATED_AT: new Date().toISOString(),
  });

  return {
    address: wallet.address,
    source: "generated .env.memo-test.local",
    privateKey: wallet.privateKey,
  };
}

function formatUsdc(value: bigint, decimals: number) {
  return ethers.formatUnits(value, decimals);
}

async function main() {
  const root = process.cwd();
  const env = readEnv(path.join(root, ".env.local"));

  if (!env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY is required in root .env.local.");
  }

  const rpcUrl = env.DEPLOY_RPC_URL || env.ARC_RPC_URL || DEFAULT_RPC_URL;
  const provider = new ethers.JsonRpcProvider(rpcUrl, {
    chainId: Number(ARC_TESTNET_CHAIN_ID),
    name: "arc-testnet",
  });
  const wallet = new ethers.Wallet(normalizePrivateKey(env.PRIVATE_KEY), provider);
  const network = await provider.getNetwork();
  if (network.chainId !== ARC_TESTNET_CHAIN_ID) {
    throw new Error(`Wrong chain: expected ${ARC_TESTNET_CHAIN_ID}, got ${network.chainId}.`);
  }

  const recipient = loadOrCreateRecipient(root, env);
  const usdcAddress = ethers.getAddress(env.DEPLOY_USDC_ADDRESS || DEFAULT_USDC_ADDRESS);
  const amountText = argValue("--amount") || env.MEMO_PAYMENT_AMOUNT || DEFAULT_AMOUNT;
  const ref =
    argValue("--ref") ||
    env.MEMO_PAYMENT_REF ||
    `predict-edge-memo-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const note =
    argValue("--note") ||
    env.MEMO_PAYMENT_NOTE ||
    `app=predict-edge;type=test-payment;ref=${ref}`;

  const memoCode = await provider.getCode(MEMO_ADDRESS);
  if (memoCode === "0x") {
    throw new Error(`Memo contract is not deployed at ${MEMO_ADDRESS}.`);
  }

  const memoInterface = new ethers.Interface(MEMO_ABI);
  const erc20Interface = new ethers.Interface(ERC20_ABI);
  const usdc = new ethers.Contract(usdcAddress, ERC20_ABI, wallet);

  const [symbol, decimalsRaw, senderBalanceBefore, recipientBalanceBefore, senderGasBefore] =
    await Promise.all([
      usdc.symbol() as Promise<string>,
      usdc.decimals() as Promise<bigint>,
      usdc.balanceOf(wallet.address) as Promise<bigint>,
      usdc.balanceOf(recipient.address) as Promise<bigint>,
      provider.getBalance(wallet.address),
    ]);

  const decimals = Number(decimalsRaw);
  const amount = ethers.parseUnits(amountText, decimals);
  if (senderBalanceBefore < amount) {
    throw new Error(
      `Insufficient ${symbol}: have ${formatUsdc(senderBalanceBefore, decimals)}, need ${amountText}.`,
    );
  }

  const transferData = erc20Interface.encodeFunctionData("transfer", [recipient.address, amount]);
  const callDataHash = ethers.keccak256(transferData);
  const memoId = ethers.id(ref);
  const memoBytes = ethers.toUtf8Bytes(note);
  const memoBytesHex = ethers.hexlify(memoBytes);
  const data = memoInterface.encodeFunctionData("memo", [
    usdcAddress,
    transferData,
    memoId,
    memoBytes,
  ]);

  const txRequest = {
    to: MEMO_ADDRESS,
    data,
    chainId: Number(ARC_TESTNET_CHAIN_ID),
  };
  const estimatedGas = await wallet.estimateGas(txRequest);

  console.log("\n=== Arc Memo USDC payment ===\n");
  console.log(`Network:     Arc Testnet (${network.chainId})`);
  console.log(`Sender:      ${wallet.address}`);
  console.log(`Recipient:   ${recipient.address} (${recipient.source})`);
  if (recipient.privateKey) {
    console.log(`Recipient key saved locally, masked: ${mask(recipient.privateKey)}`);
  }
  console.log(`Amount:      ${amountText} ${symbol}`);
  console.log(`Memo ref:    ${ref}`);
  console.log(`Memo id:     ${memoId}`);
  console.log(`Memo note:   ${note}`);
  console.log(`Call hash:   ${callDataHash}`);
  console.log(`Gas estimate:${estimatedGas.toString()}\n`);

  const tx = await wallet.sendTransaction(txRequest);
  console.log(`Submitted:   ${EXPLORER_URL}/tx/${tx.hash}`);

  const receipt = await tx.wait();
  if (!receipt) throw new Error("Transaction was not mined.");
  if (receipt.status !== 1) throw new Error(`Memo transaction reverted: ${tx.hash}`);

  const beforeMemoEvents: ethers.LogDescription[] = [];
  const memoEvents: ethers.LogDescription[] = [];
  const transferEvents: ethers.LogDescription[] = [];

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === MEMO_ADDRESS.toLowerCase()) {
      const parsed = memoInterface.parseLog(log);
      if (!parsed) continue;
      if (parsed.name === "BeforeMemo") beforeMemoEvents.push(parsed);
      if (parsed.name === "Memo") memoEvents.push(parsed);
    }
    if (log.address.toLowerCase() === usdcAddress.toLowerCase()) {
      const parsed = erc20Interface.parseLog(log);
      if (!parsed) continue;
      if (parsed.name === "Transfer") transferEvents.push(parsed);
    }
  }

  if (beforeMemoEvents.length !== 1 || memoEvents.length !== 1) {
    throw new Error("Expected exactly one BeforeMemo event and one Memo event.");
  }

  const memoArgs = memoEvents[0].args;
  if (memoArgs.sender.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`Unexpected memo sender: ${memoArgs.sender}`);
  }
  if (memoArgs.target.toLowerCase() !== usdcAddress.toLowerCase()) {
    throw new Error(`Unexpected memo target: ${memoArgs.target}`);
  }
  if (memoArgs.callDataHash !== callDataHash) {
    throw new Error(`Unexpected callDataHash: ${memoArgs.callDataHash}`);
  }
  if (memoArgs.memoId !== memoId || ethers.hexlify(memoArgs.memo) !== memoBytesHex) {
    throw new Error("Memo event did not include the expected memoId and memo bytes.");
  }

  const matchingTransfer = transferEvents.find((event) => {
    const args = event.args;
    return (
      args.from.toLowerCase() === wallet.address.toLowerCase() &&
      args.to.toLowerCase() === recipient.address.toLowerCase() &&
      args.value === amount
    );
  });
  if (!matchingTransfer) {
    throw new Error("Expected USDC Transfer event was not found in the receipt.");
  }

  const memoTopic = memoInterface.getEvent("Memo")?.topicHash;
  if (!memoTopic) throw new Error("Memo event topic not found.");
  const matchingLogs = await provider.getLogs({
    address: MEMO_ADDRESS,
    topics: [memoTopic, null, null, memoId],
    fromBlock: receipt.blockNumber,
    toBlock: receipt.blockNumber,
  });
  if (matchingLogs.length !== 1) {
    throw new Error(`Expected one Memo log for memoId, found ${matchingLogs.length}.`);
  }

  const [senderBalanceAfter, recipientBalanceAfter, senderGasAfter, recipientGasAfter] =
    await Promise.all([
      usdc.balanceOf(wallet.address) as Promise<bigint>,
      usdc.balanceOf(recipient.address) as Promise<bigint>,
      provider.getBalance(wallet.address),
      provider.getBalance(recipient.address),
    ]);

  console.log("\n=== Confirmed ===\n");
  console.log(`Transaction: ${EXPLORER_URL}/tx/${tx.hash}`);
  console.log(`Block:       ${receipt.blockNumber}`);
  console.log(`Memo index:  ${memoArgs.memoIndex.toString()}`);
  console.log(`Memo logs:   ${matchingLogs.length} matching memoId`);
  console.log(
    `Transfer:    ${formatUsdc(amount, decimals)} ${symbol} ${wallet.address} -> ${recipient.address}`,
  );
  console.log(
    `Sender ${symbol}:    ${formatUsdc(senderBalanceBefore, decimals)} -> ${formatUsdc(senderBalanceAfter, decimals)}`,
  );
  console.log(
    `Recipient ${symbol}: ${formatUsdc(recipientBalanceBefore, decimals)} -> ${formatUsdc(recipientBalanceAfter, decimals)}`,
  );
  console.log(
    `Sender gas:     ${ethers.formatEther(senderGasBefore)} -> ${ethers.formatEther(senderGasAfter)} USDC native`,
  );
  console.log(`Recipient gas:  ${ethers.formatEther(recipientGasAfter)} USDC native`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
