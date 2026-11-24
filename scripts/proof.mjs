// npm run proof: gathers on-chain and test evidence and rewrites the PROOF blocks in
// README.md. Node ESM, viem only, no secrets (reads NEXT_PUBLIC_* values only), always
// exits 0, finishes in under two minutes. Each block is rewritten between
//   <!-- PROOF:BEGIN <name> --> and <!-- PROOF:END <name> -->
// Anything that cannot run writes one honest "Not run in this build: <reason>." line.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbi,
  toBytes,
  toFunctionSelector,
} from "viem";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const README = join(ROOT, "README.md");
const CALL_TIMEOUT_MS = 8_000;
const CALL_RETRIES = 1;
const RPC_BUDGET_MS = 25_000;
const FORGE_TIMEOUT_MS = 90_000;

// ------------------------------------------------------------------ env (public only)

function publicEnv() {
  const env = {};
  const file = join(ROOT, ".env.local");
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*(NEXT_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("NEXT_PUBLIC_") && v) env[k] = v;
  }
  return env;
}

const ENV = publicEnv();
const RPC = ENV.NEXT_PUBLIC_AEVUM_RPC || "https://rpc-test.qday.info";
const CHAIN_ID = Number(ENV.NEXT_PUBLIC_CHAIN_ID || 44005);
const TUSD8 = ENV.NEXT_PUBLIC_TUSD8_ADDRESS || "0x456569838f1d43009A91ebA4263147Afd7233483";
const POOL = /^0x[0-9a-fA-F]{40}$/.test(ENV.NEXT_PUBLIC_CONTRACT_ADDRESS || "") ? ENV.NEXT_PUBLIC_CONTRACT_ADDRESS : "";

// --------------------------------------------------------------------- JSON-RPC

const started = Date.now();
let rpcId = 0;

async function rpcOnce(method, params) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(`RPC error ${json.error.code ?? ""}`.trim());
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

async function rpc(method, params = []) {
  let last;
  for (let attempt = 0; attempt <= CALL_RETRIES; attempt++) {
    if (Date.now() - started > RPC_BUDGET_MS) throw new Error("the RPC time budget ran out");
    try {
      return await rpcOnce(method, params);
    } catch (err) {
      last = err;
    }
  }
  const why = last?.name === "AbortError" ? "timed out" : last?.message || "failed";
  throw new Error(`${method} ${why}`);
}

const erc20 = parseAbi([
  "function name() view returns (string)",
  "function version() view returns (string)",
  "function decimals() view returns (uint8)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  "function poolCount() view returns (uint256)",
]);

async function call(to, functionName) {
  const data = encodeFunctionData({ abi: erc20, functionName });
  const out = await rpc("eth_call", [{ to, data }, "latest"]);
  return decodeFunctionResult({ abi: erc20, functionName, data: out });
}

async function tryCall(to, functionName) {
  try {
    return { ok: true, value: await call(to, functionName) };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// ------------------------------------------------------------------------ proofs

const SIGS = {
  receiveWithAuthorization: "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)",
  cancelAuthorization: "cancelAuthorization(address,bytes32,uint8,bytes32,bytes32)",
  transferWithAuthorization: "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)",
  authorizationState: "authorizationState(address,bytes32)",
};
// EIP-1967 implementation slot, and the older slot used by USDC's FiatTokenProxy.
const IMPL_SLOTS = [
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
  "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3",
];

async function codeWithImplementation(address) {
  const code = await rpc("eth_getCode", [address, "latest"]);
  for (const slot of IMPL_SLOTS) {
    const word = await rpc("eth_getStorageAt", [address, slot, "latest"]).catch(() => null);
    if (word && /^0x0*$/.test(word) === false) {
      const impl = `0x${word.slice(-40)}`;
      const implCode = await rpc("eth_getCode", [impl, "latest"]).catch(() => "0x");
      if (implCode && implCode.length > 2) return { code: code + implCode.slice(2), proxy: impl };
    }
  }
  return { code, proxy: null };
}

async function proofTusd8() {
  const lines = [];
  const [name, version, decimals, separator] = await Promise.all([
    tryCall(TUSD8, "name"),
    tryCall(TUSD8, "version"),
    tryCall(TUSD8, "decimals"),
    tryCall(TUSD8, "DOMAIN_SEPARATOR"),
  ]);
  if (!name.ok && !decimals.ok) throw new Error(name.reason);
  lines.push(`- Token \`${TUSD8}\` on chain ${CHAIN_ID}`);
  lines.push(`- \`name()\`: ${name.ok ? `"${name.value}"` : `no answer (${name.reason})`}`);
  lines.push(`- \`version()\`: ${version.ok ? `"${version.value}"` : `no answer (${version.reason})`}`);
  lines.push(`- \`decimals()\`: ${decimals.ok ? String(decimals.value) : `no answer (${decimals.reason})`}`);

  if (separator.ok && name.ok && version.ok) {
    const expected = keccak256(
      encodeAbiParameters(
        [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }, { type: "address" }],
        [
          keccak256(toBytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
          keccak256(toBytes(String(name.value))),
          keccak256(toBytes(String(version.value))),
          BigInt(CHAIN_ID),
          TUSD8,
        ],
      ),
    );
    const match = expected.toLowerCase() === String(separator.value).toLowerCase();
    lines.push(
      `- \`DOMAIN_SEPARATOR()\` ${match ? "matches" : "does not match"} the EIP-712 domain built from that name, version and chain ${CHAIN_ID}.`,
    );
    if (name.value !== "tUSD8" || version.value !== "2") {
      lines.push(`- The app signs with { name: "tUSD8", version: "2" }; update \`tusd8Domain\` in \`lib/aevum.ts\` to the values above.`);
    }
  }

  const { code, proxy } = await codeWithImplementation(TUSD8);
  if (proxy) lines.push(`- Proxy: implementation at \`${proxy}\`; selectors checked in both bytecodes.`);
  const found = {};
  for (const [fn, sig] of Object.entries(SIGS)) {
    const selector = toFunctionSelector(sig);
    found[fn] = code.toLowerCase().includes(selector.slice(2).toLowerCase());
    lines.push(`- \`${fn}\` (${selector}): ${found[fn] ? "present in bytecode" : "not found in bytecode"}`);
  }
  if (!found.receiveWithAuthorization) {
    lines.push(
      "- receiveWithAuthorization is missing: the next phase switches QuorumPool to transferWithAuthorization with to = pool and documents the front-run limit.",
    );
  }
  const summary = `tusd8-capabilities: name=${name.ok ? name.value : "?"} version=${version.ok ? version.value : "?"} decimals=${
    decimals.ok ? decimals.value : "?"
  } receiveWithAuthorization=${found.receiveWithAuthorization ? "yes" : "no"}`;
  return { body: lines.join("\n"), summary };
}

async function proofLatency() {
  const t0 = Date.now();
  const chainHex = await rpc("eth_chainId");
  const ms = Date.now() - t0;
  const blockHex = await rpc("eth_blockNumber");
  const chainId = Number(BigInt(chainHex));
  const block = BigInt(blockHex);
  const lines = [
    `- RPC \`${RPC}\``,
    `- Chain id: ${chainId}${chainId === CHAIN_ID ? "" : ` (expected ${CHAIN_ID})`}`,
    `- Latest block: ${block}`,
    `- Round trip for \`eth_chainId\`: ${ms} ms`,
  ];
  let poolPart = "pool=unset";
  if (POOL) {
    const code = await rpc("eth_getCode", [POOL, "latest"]);
    const size = Math.max(0, (code.length - 2) / 2);
    const count = await tryCall(POOL, "poolCount");
    lines.push(`- QuorumPool \`${POOL}\`: ${size} bytes of code, \`poolCount()\` = ${count.ok ? String(count.value) : `no answer (${count.reason})`}`);
    poolPart = `pool=${size}B poolCount=${count.ok ? count.value : "?"}`;
  } else {
    lines.push("- QuorumPool: NEXT_PUBLIC_CONTRACT_ADDRESS is not set, so the pool was not read.");
  }
  return { body: lines.join("\n"), summary: `chain-latency: chainId=${chainId} block=${block} rtt=${ms}ms ${poolPart}` };
}

function proofForge() {
  const probe = spawnSync("forge", ["--version"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) {
    return { body: "Not run in this build: forge is not installed.", summary: "contract-tests: forge not installed" };
  }
  const run = spawnSync("forge", ["test"], {
    cwd: join(ROOT, "contracts"),
    encoding: "utf8",
    timeout: FORGE_TIMEOUT_MS,
    killSignal: "SIGKILL",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (run.error) {
    const why = run.error.code === "ETIMEDOUT" ? "forge test passed the 90 s limit and was stopped" : "forge test could not start";
    return { body: `Not run in this build: ${why}.`, summary: `contract-tests: ${why}` };
  }
  // Strip ANSI colour codes, then keep forge's own summary line.
  const out = `${run.stdout}\n${run.stderr}`.replace(/\u001b\[[0-9;]*m/g, "");
  const summaryLine =
    out.split("\n").reverse().find((l) => /Ran \d+ test suites?/.test(l)) ||
    out.split("\n").reverse().find((l) => /Suite result:/.test(l));
  if (!summaryLine) {
    return { body: `Not run in this build: forge test exited ${run.status} without a summary line.`, summary: "contract-tests: no summary" };
  }
  const verdict = run.status === 0 ? "pass" : "fail";
  return {
    body: `- \`forge test\` (${verdict}, exit ${run.status}): ${summaryLine.trim()}`,
    summary: `contract-tests: ${verdict} ${summaryLine.trim()}`,
  };
}

// ------------------------------------------------------------------- README I/O

function upsert(readme, name, body) {
  const begin = `<!-- PROOF:BEGIN ${name} -->`;
  const end = `<!-- PROOF:END ${name} -->`;
  const block = `${begin}\n${body}\n${end}`;
  const i = readme.indexOf(begin);
  const j = readme.indexOf(end);
  if (i !== -1 && j > i) return readme.slice(0, i) + block + readme.slice(j + end.length);
  if (!readme.includes("\n## Proof\n")) readme = `${readme.trimEnd()}\n\n## Proof\n`;
  const at = readme.indexOf("\n## Proof\n") + "\n## Proof\n".length;
  const next = readme.indexOf("\n## ", at);
  const insertAt = next === -1 ? readme.length : next;
  return `${readme.slice(0, insertAt).trimEnd()}\n\n${block}\n${readme.slice(insertAt)}`;
}

async function guarded(name, fn) {
  try {
    return await fn();
  } catch (err) {
    const reason = String(err?.message || "unknown error").split("\n")[0].replace(/\.$/, "");
    return { body: `Not run in this build: ${reason}.`, summary: `${name}: not run (${reason})` };
  }
}

async function main() {
  const results = [
    ["tusd8-capabilities", await guarded("tusd8-capabilities", proofTusd8)],
    ["chain-latency", await guarded("chain-latency", proofLatency)],
    ["contract-tests", await guarded("contract-tests", async () => proofForge())],
  ];
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  let readme = existsSync(README) ? readFileSync(README, "utf8") : "# Pactora\n";
  for (const [name, r] of results) {
    readme = upsert(readme, name, `_Generated by \`npm run proof\` at ${stamp}._\n\n${r.body}`);
    console.log(r.summary);
  }
  try {
    writeFileSync(README, readme);
  } catch (err) {
    console.log(`README.md was not written: ${err?.message || "write failed"}`);
  }
}

main()
  .catch((err) => console.log(`proof: stopped early (${err?.message || "unknown error"})`))
  .finally(() => process.exit(0));
