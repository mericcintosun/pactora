// npm run demo:reset: puts the demo back to a known start.
//   node --experimental-strip-types scripts/demo-reset.mjs   (Node 22.6+)
//
// (a) Determinism: loads lib/data/seed.ts the same way scripts/seed.mjs does, hashes the
//     seed twice (from two separate module loads) and exits 1 if the hashes differ.
// (b) Store: there is none. Practice state lives in component memory, so a page reload
//     is the reset. No database, no KV, nothing to migrate.
// (c) On-chain fixture: when RELAYER_PRIVATE_KEY and NEXT_PUBLIC_CONTRACT_ADDRESS are both
//     set, opens a FRESH live pool (min 5, 2 tUSD8, 24 h, relayer as seller) with a legacy
//     transaction and prints its id and explorer link. Old pools stay on chain, but the demo
//     walk starts from this new pool or from the seed ids, so stale state cannot change what
//     the audience sees.
// The key is read from the environment (or .env.local) and is never printed.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ------------------------------------------------------------- (a) determinism

const first = await import("../lib/data/seed.ts");
const hashA = createHash("sha256").update(JSON.stringify(first.campaigns)).digest("hex");
let second;
try {
  // A query string makes Node load a second, independent module instance.
  second = await import("../lib/data/seed.ts?demo-reset=2");
} catch {
  second = first;
  console.log("note: a second module instance could not be loaded; hashing the same instance again.");
}
const hashB = createHash("sha256").update(JSON.stringify(second.campaigns)).digest("hex");
console.log(`seed campaigns: ${first.campaigns.length}`);
console.log(`seed sha256 (load 1): ${hashA}`);
console.log(`seed sha256 (load 2): ${hashB}`);
if (hashA !== hashB) {
  console.log("FAIL: the seed is not deterministic. Look for Date.now() or Math.random() in lib/data/seed.ts.");
  process.exit(1);
}
const ids = new Set(first.campaigns.map((c) => c.id));
for (const id of ["kavruk-guji", "kavruk-peru-lapsed"]) {
  if (!ids.has(id)) {
    console.log(`FAIL: seed id ${id} is missing; DEMO.md steps 2, 3, 4 and 6 rely on it.`);
    process.exit(1);
  }
}
console.log("seed: deterministic, kavruk-guji and kavruk-peru-lapsed present.");

// -------------------------------------------------------------------- env

function readEnv() {
  const env = {};
  const file = join(ROOT, ".env.local");
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  for (const [k, v] of Object.entries(process.env)) if (v) env[k] = v;
  return env;
}

const ENV = readEnv();
const MODE = ENV.ADAPTER_MODE === "real" ? "real" : "fake";

// ------------------------------------------------------------------- (b) store

console.log("store: none. Practice state lives in browser memory only; reloading a page resets it.");
if (MODE === "fake") {
  console.log("mode: fake. The six DEMO.md steps run on seed data; reload the page to start the walk over.");
}

// ------------------------------------------------------------ (c) fresh pool

const POOL = /^0x[0-9a-fA-F]{40}$/.test(ENV.NEXT_PUBLIC_CONTRACT_ADDRESS || "") ? ENV.NEXT_PUBLIC_CONTRACT_ADDRESS : "";
const RAW_KEY = ENV.RELAYER_PRIVATE_KEY || "";
const KEY = RAW_KEY.startsWith("0x") ? RAW_KEY : `0x${RAW_KEY}`;

if (!POOL || !RAW_KEY) {
  const missing = [!RAW_KEY && "RELAYER_PRIVATE_KEY", !POOL && "NEXT_PUBLIC_CONTRACT_ADDRESS"].filter(Boolean).join(" and ");
  console.log(`fresh pool: Not run: ${missing} not set, so no live pool was opened.`);
  process.exit(0);
}
if (!/^0x[0-9a-fA-F]{64}$/.test(KEY)) {
  console.log("fresh pool: Not run: RELAYER_PRIVATE_KEY is not 32 bytes of hex.");
  process.exit(0);
}

const { createPublicClient, createWalletClient, defineChain, http, parseEventLogs, parseUnits } = await import("viem");
const { privateKeyToAccount } = await import("viem/accounts");

const CHAIN_ID = Number(ENV.NEXT_PUBLIC_CHAIN_ID || 44005);
const RPC = ENV.NEXT_PUBLIC_AEVUM_RPC || "https://rpc-test.qday.info";
const EXPLORER = ENV.NEXT_PUBLIC_EXPLORER_URL || "https://explorer-test.qday.info";
const DECIMALS = Number(ENV.NEXT_PUBLIC_TUSD8_DECIMALS || 6);

// Same fragments as quorumPoolAbi in lib/aevum.ts (createPool and PoolCreated). That
// module imports through the "@/" alias, which plain Node cannot resolve, so the two
// entries are restated here; the call shape matches contracts/script/Smoke.s.sol.
const abi = [
  {
    type: "function", name: "createPool", stateMutability: "nonpayable",
    inputs: [
      { name: "title", type: "string" }, { name: "price", type: "uint256" }, { name: "minOrders", type: "uint32" },
      { name: "maxOrders", type: "uint32" }, { name: "deadline", type: "uint64" },
    ],
    outputs: [{ name: "poolId", type: "uint256" }],
  },
  {
    type: "event", name: "PoolCreated",
    inputs: [
      { name: "poolId", type: "uint256", indexed: true }, { name: "seller", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false }, { name: "minOrders", type: "uint32", indexed: false },
      { name: "deadline", type: "uint64", indexed: false }, { name: "title", type: "string", indexed: false },
    ],
  },
];

const chain = defineChain({
  id: CHAIN_ID,
  name: "Aevum Testnet",
  nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const transport = http(RPC, { timeout: 12_000, retryCount: 1 });
const publicClient = createPublicClient({ chain, transport });
const account = privateKeyToAccount(KEY);
const wallet = createWalletClient({ account, chain, transport });

try {
  const block = await publicClient.getBlock();
  const deadline = block.timestamp + 24n * 3600n;
  const gasPrice = await publicClient.getGasPrice();
  const hash = await wallet.writeContract({
    address: POOL,
    abi,
    functionName: "createPool",
    // 2 tUSD8, min 5, max 12, closes in 24 hours: the DEMO.md trigger numbers.
    args: ["Demo: Guji natural 250 g", parseUnits("2", DECIMALS), 5, 12, deadline],
    gasPrice,
    type: "legacy",
  });
  console.log(`fresh pool: createPool sent from the relayer (the relayer is the seller), tx ${EXPLORER}/tx/${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
  if (receipt.status !== "success") {
    console.log("fresh pool: FAIL: createPool reverted.");
    process.exit(1);
  }
  const created = parseEventLogs({ abi, eventName: "PoolCreated", logs: receipt.logs })[0];
  const poolId = created ? String(created.args.poolId) : "unknown";
  console.log(`fresh pool: id ${poolId}, opened at 0/5. Walk the live demo at /pledge/${poolId}.`);
  console.log("old pools: they stay on chain, but the demo walk starts from this pool or from the seed ids.");
} catch (err) {
  const reason = String(err?.shortMessage || err?.message || "unknown error").split("\n")[0];
  console.log(`fresh pool: FAIL: ${reason}`);
  process.exit(1);
}
