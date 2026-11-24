// Error codes shared by the API routes, the relayer and the UI. The UI switches on
// `error`, never on hint text. Hints are one plain sentence with no stack and no
// provider text.

export type ErrorCode =
  | "invalid_input"
  | "upstream_timeout"
  | "upstream_error"
  | "parse_failure"
  | "not_configured"
  | "rate_limited"
  | "reverted";

export type ApiError = { error: ErrorCode; hint: string };

export const DEFAULT_HINTS: Record<ErrorCode, string> = {
  invalid_input: "The request was missing a field or had a malformed value.",
  upstream_timeout: "Aevum testnet did not answer in time. Try again in a moment.",
  upstream_error: "Aevum testnet returned an error. Try again in a moment.",
  parse_failure: "The answer from Aevum testnet could not be read.",
  not_configured: "The live relayer is not configured on this deploy.",
  rate_limited: "Too many requests from this address. Wait a minute and try again.",
  reverted: "The contract refused this transaction. Nothing was charged.",
};

export const HTTP_STATUS: Record<ErrorCode, number> = {
  invalid_input: 400,
  upstream_timeout: 504,
  upstream_error: 502,
  parse_failure: 502,
  not_configured: 503,
  rate_limited: 429,
  reverted: 409,
};

export function apiError(code: ErrorCode, hint?: string): ApiError {
  return { error: code, hint: hint ?? DEFAULT_HINTS[code] };
}

export function isApiError(x: unknown): x is ApiError {
  return typeof x === "object" && x !== null && "error" in x && "hint" in x;
}

/** Plain hints for QuorumPool's custom errors, keyed by error name. */
export const REVERT_HINTS: Record<string, string> = {
  UnknownPool: "There is no batch with that number on Aevum.",
  PoolClosed: "This batch is closed: it was already collected or its deadline passed.",
  BadParams: "The batch settings were refused: check the price, the minimum and the deadline.",
  AlreadyPledged: "This wallet already has a live signature on this batch.",
  NotPledged: "This wallet has no live signature on this batch.",
  PoolFull: "This batch already has its maximum number of orders.",
  BadSignature: "The signature does not match this wallet and batch.",
  NonceUsed: "This authorization was already used or cancelled. Sign again for a fresh one.",
  NotAllowed: "Only the buyer, or the relayer after a cancellation, can do that.",
  BelowThreshold: "Below the minimum. Nobody was charged.",
  TransferFailed: "The payout to the seller failed, so the whole collection was undone.",
};
