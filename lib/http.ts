// One wrapper for every outbound call: a per-attempt timeout of CALL_TIMEOUT_MS and
// exactly CALL_RETRIES (1) retry. Failures become a CallError carrying an ErrorCode.
// Contract reverts are never retried: the chain already gave its answer.
import { BaseError, ContractFunctionRevertedError } from "viem";
import { CALL_RETRIES, CALL_TIMEOUT_MS } from "./config";
import { DEFAULT_HINTS, REVERT_HINTS, type ApiError, type ErrorCode } from "./errors";

export class CallError extends Error {
  readonly code: ErrorCode;
  readonly hint: string;
  constructor(code: ErrorCode, hint?: string) {
    super(hint ?? DEFAULT_HINTS[code]);
    this.name = "CallError";
    this.code = code;
    this.hint = hint ?? DEFAULT_HINTS[code];
  }
  toApiError(): ApiError {
    return { error: this.code, hint: this.hint };
  }
}

class TimeoutError extends Error {
  constructor() {
    super("timeout");
    this.name = "TimeoutError";
  }
}

/** The QuorumPool custom error name inside a viem error, if there is one. */
export function revertName(err: unknown): string | undefined {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      return reverted.data?.errorName ?? reverted.reason ?? "reverted";
    }
  }
  return undefined;
}

/** Map any thrown value to an ErrorCode plus a plain hint. Never echoes provider text. */
export function toCallError(err: unknown): CallError {
  if (err instanceof CallError) return err;
  if (err instanceof TimeoutError) return new CallError("upstream_timeout");
  const name = revertName(err);
  if (name) return new CallError("reverted", REVERT_HINTS[name] ?? DEFAULT_HINTS.reverted);
  const text = err instanceof Error ? `${err.name} ${err.message}` : "";
  if (/timed? ?out|TimeoutError/i.test(text)) return new CallError("upstream_timeout");
  if (/SyntaxError|JSON|parse|decode/i.test(text)) return new CallError("parse_failure");
  return new CallError("upstream_error");
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Cap a whole read (several calls, retries included) at `ms`. Past the cap it rejects
 * with CallError("upstream_timeout"); the underlying calls are left to finish unseen.
 */
export async function withBudget<T>(p: Promise<T>, ms: number): Promise<T> {
  try {
    return await withTimeout(p, ms);
  } catch (err) {
    throw toCallError(err);
  }
}

/**
 * Run `fn` with a timeout per attempt and one retry. `timeoutMs` may only raise the
 * per-attempt limit for receipt waits (RECEIPT_TIMEOUT_MS); the retry count is fixed.
 */
export async function withTimeoutAndRetry<T>(fn: () => Promise<T>, opts: { timeoutMs?: number } = {}): Promise<T> {
  const ms = opts.timeoutMs ?? CALL_TIMEOUT_MS;
  let last: CallError = new CallError("upstream_error");
  for (let attempt = 0; attempt <= CALL_RETRIES; attempt++) {
    try {
      return await withTimeout(fn(), ms);
    } catch (err) {
      last = toCallError(err);
      if (last.code === "reverted" || last.code === "invalid_input") break;
    }
  }
  throw last;
}
