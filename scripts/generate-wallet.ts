/**
 * Локальний генератор некастодіального гаманця-деплоєра для Arc Testnet.
 *
 * Генерує свіжу пару ключів (приватний ключ + адреса) ЛОКАЛЬНО за допомогою viem,
 * нічого не надсилаючи в мережу. Повний приватний ключ записується ЛИШЕ у `.env.local`
 * (який ігнорується git'ом). У консоль виводиться тільки адреса та маскований ключ.
 *
 * Використання:
 *   node --no-warnings --experimental-strip-types scripts/generate-wallet.ts
 *   node --no-warnings --experimental-strip-types scripts/generate-wallet.ts --force   # перезаписати наявний ключ
 *
 * ⚠️ ТІЛЬКИ ДЛЯ ТЕСТНЕТУ. Ніколи не використовуйте згенерований так ключ у мейннеті
 *    чи для зберігання реальних коштів.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";
import * as path from "path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const DEFAULT_RPC = "https://rpc.testnet.arc.network";

function readEnv(envPath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

function writeEnv(envPath: string, vars: Record<string, string>) {
  const existing = readEnv(envPath);
  Object.assign(existing, vars);
  const content =
    Object.entries(existing)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n";
  fs.writeFileSync(envPath, content);
}

function mask(key: string): string {
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

function main() {
  const force = process.argv.includes("--force");
  const envPath = path.resolve(process.cwd(), ".env.local");
  const env = readEnv(envPath);

  const PLACEHOLDER = ["", "your_private_key_here"];
  const hasRealKey = env.PRIVATE_KEY && !PLACEHOLDER.includes(env.PRIVATE_KEY);

  if (hasRealKey && !force) {
    console.error(
      "\n  ⚠ У .env.local уже є PRIVATE_KEY. Аборт, щоб не перезаписати наявний ключ." +
        "\n  Перегенерувати навмисно: додайте прапорець --force\n",
    );
    process.exit(1);
  }

  const privateKey = generatePrivateKey(); // 0x + 64 hex, криптографічно випадковий
  const account = privateKeyToAccount(privateKey);

  // Записуємо у .env.local; RPC ставимо лише якщо ще не заданий.
  const toWrite: Record<string, string> = { PRIVATE_KEY: privateKey };
  if (!env.NEXT_PUBLIC_ALCHEMY_RPC_URL) {
    toWrite.NEXT_PUBLIC_ALCHEMY_RPC_URL = DEFAULT_RPC;
  }
  writeEnv(envPath, toWrite);

  console.log("\n=== Згенеровано гаманець-деплоєр (ТІЛЬКИ ТЕСТНЕТ) ===\n");
  console.log("  Адреса (поповнюйте її газом):");
  console.log(`  ${account.address}\n`);
  console.log(`  Приватний ключ (маскований): ${mask(privateKey)}`);
  console.log("  Повний приватний ключ записано у .env.local (gitignored).\n");
  console.log("  Наступні кроки:");
  console.log("   1. Закиньте тестовий USDC на адресу вище (faucet.circle.com → Arc Testnet).");
  console.log("   2. npm run deploy");
  console.log("   3. (Опц.) Імпортуйте ключ із .env.local у MetaMask, щоб діяти як користувач.\n");
}

main();
