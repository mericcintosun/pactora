// Core-path logging: one line per step, `[core] step key=value ...`.
// Only ids, hashes, counts and durations. Never a key, a signature or a request payload:
// any field whose name looks like one is dropped before printing.
import { LOG_PREFIX } from "./config";

type Field = string | number | bigint | boolean | undefined | null;

const BLOCKED = /key|secret|sig|payload|body|private|mnemonic|^[rsv]$/i;

export function log(step: string, fields: Record<string, Field> = {}): void {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || BLOCKED.test(k)) continue;
    parts.push(`${k}=${String(v)}`);
  }
  console.log(`${LOG_PREFIX} ${step}${parts.length ? ` ${parts.join(" ")}` : ""}`);
}

/** Milliseconds since `start` (from Date.now()). */
export const since = (start: number): number => Date.now() - start;
