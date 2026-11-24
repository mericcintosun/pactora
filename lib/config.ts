// Single source of configuration for Pactora. Every env key read here is mirrored
// in .env.example. This module is imported by client components (through
// lib/aevum.ts), so it only reads NEXT_PUBLIC_ values and never a secret.
//
// Two server-only names are declared here but read elsewhere, on purpose:
//   ADAPTER_MODE         read only in lib/adapter/index.ts, parsed by parseAdapterMode below
//   RELAYER_PRIVATE_KEY  read only (and lazily) in lib/relayer.ts
import type { Address } from "viem";

// ---------------------------------------------------------------- chain + token

/** Aevum testnet chain id. NEXT_PUBLIC_CHAIN_ID, default 44005. */
export const AEVUM_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 44005);

/** Aevum JSON-RPC endpoint. NEXT_PUBLIC_AEVUM_RPC. */
export const AEVUM_RPC = process.env.NEXT_PUBLIC_AEVUM_RPC || "https://rpc-test.qday.info";

/** Block explorer base URL for tx and address links. NEXT_PUBLIC_EXPLORER_URL. */
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer-test.qday.info";

/** tUSD8 (EIP-3009) on Aevum testnet. NEXT_PUBLIC_TUSD8_ADDRESS. */
export const TUSD8_ADDRESS = (process.env.NEXT_PUBLIC_TUSD8_ADDRESS ||
  "0x456569838f1d43009A91ebA4263147Afd7233483") as Address;

/** tUSD8 decimals. NEXT_PUBLIC_TUSD8_DECIMALS, default 6. */
export const TUSD8_DECIMALS = Number(process.env.NEXT_PUBLIC_TUSD8_DECIMALS || 6);

/** QuorumPool address, written by the deploy step. Never a literal. */
export const POOL_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || undefined) as Address | undefined;

/** Multicall3 (same address on every EVM chain that has it). */
export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as Address;

// -------------------------------------------------------------- outbound calls

/** Per attempt timeout for every RPC call. */
export const CALL_TIMEOUT_MS = 12_000;
/** Exactly one retry after the first attempt. */
export const CALL_RETRIES = 1;
/** How long the relayer waits for a receipt per attempt. */
export const RECEIPT_TIMEOUT_MS = 60_000;
/** Relay requests per IP per minute (best effort, per server instance). */
export const RATE_LIMIT_PER_MIN = 12;
/** How far back history reads walk, in blocks (1,000 block chunks). */
export const LOG_LOOKBACK_BLOCKS = BigInt(10_000);
/** How many of the newest live pools the real adapter adds to the board. */
export const LIVE_POOLS_ON_BOARD = 6;
/** Prefix of every core-path log line. */
export const LOG_PREFIX = "[core]";

// ----------------------------------------------------------------- mode + keys

export type AdapterMode = "fake" | "real";

/** Name of the server env var that selects the adapter. Read only in lib/adapter/index.ts. */
export const ADAPTER_MODE_ENV = "ADAPTER_MODE";

/** Name of the relayer's secret key env var. Read only in lib/relayer.ts. */
export const RELAYER_KEY_ENV = "RELAYER_PRIVATE_KEY";

/**
 * "real" only when the raw value is exactly "real" AND the pool address is set.
 * Anything else (unset, "fake", a typo, a half-configured deploy) is "fake".
 */
export function parseAdapterMode(raw: string | undefined): AdapterMode {
  return raw === "real" && Boolean(POOL_ADDRESS) ? "real" : "fake";
}
