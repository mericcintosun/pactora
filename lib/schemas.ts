// Edge validation for the app's own API routes. zod only, erasable TypeScript, so
// node --experimental-strip-types can import it in tests/schemas.test.ts.
import { z } from "zod";

export const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Expected a 0x address.");
export const bytes32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Expected 32 bytes of 0x hex.");
/** 65-byte ECDSA signature (r, s, v) as 0x hex. */
export const signatureSchema = z.string().regex(/^0x[0-9a-fA-F]{130}$/, "Expected a 65-byte 0x signature.");
export const poolIdSchema = z.number().int().min(1).max(1_000_000_000);

/** Practice mode (seed batches) sets this so the relay answers with a placeholder even when live is configured. */
const practice = z.boolean().optional();

export const pledgeBodySchema = z.object({
  action: z.literal("pledge"),
  poolId: poolIdSchema,
  buyer: addressSchema,
  signature: signatureSchema,
  practice,
});

export const cancelBodySchema = z.object({
  action: z.literal("cancel"),
  poolId: poolIdSchema,
  buyer: addressSchema,
  nonce: bytes32Schema,
  signature: signatureSchema,
  practice,
});

export const settleBodySchema = z.object({
  action: z.literal("settle"),
  poolId: poolIdSchema,
  practice,
});

export const relayBodySchema = z.discriminatedUnion("action", [pledgeBodySchema, cancelBodySchema, settleBodySchema]);

export type RelayBody = z.infer<typeof relayBodySchema>;
export type PledgeBody = z.infer<typeof pledgeBodySchema>;
export type CancelBody = z.infer<typeof cancelBodySchema>;
export type SettleBody = z.infer<typeof settleBodySchema>;

/** Page and API ids: a seed slug ("kavruk-guji") or a numeric live pool id ("12"). */
export const campaignIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Expected a batch slug or a pool number.");

/** Placeholder values practice mode sends, shaped so they pass the schema above. */
export const PRACTICE_SIGNATURE = `0x${"00".repeat(65)}`;
export const PRACTICE_NONCE = `0x${"00".repeat(32)}`;
