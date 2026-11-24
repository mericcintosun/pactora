// npm test: node --experimental-strip-types --test tests/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { campaignIdSchema, PRACTICE_NONCE, PRACTICE_SIGNATURE, relayBodySchema } from "../lib/schemas.ts";

const buyer = "0x1111111111111111111111111111111111111111";
const signature = `0x${"ab".repeat(65)}`;
const nonce = `0x${"cd".repeat(32)}`;

test("pledge: valid body passes, short signature fails", () => {
  assert.equal(relayBodySchema.safeParse({ action: "pledge", poolId: 1, buyer, signature }).success, true);
  assert.equal(relayBodySchema.safeParse({ action: "pledge", poolId: 1, buyer, signature: "0x00" }).success, false);
});

test("cancel: valid body passes, missing nonce fails", () => {
  assert.equal(relayBodySchema.safeParse({ action: "cancel", poolId: 7, buyer, nonce, signature }).success, true);
  assert.equal(relayBodySchema.safeParse({ action: "cancel", poolId: 7, buyer, signature }).success, false);
});

test("settle: valid body passes, pool id 0 and floats fail", () => {
  assert.equal(relayBodySchema.safeParse({ action: "settle", poolId: 3 }).success, true);
  assert.equal(relayBodySchema.safeParse({ action: "settle", poolId: 0 }).success, false);
  assert.equal(relayBodySchema.safeParse({ action: "settle", poolId: 1.5 }).success, false);
});

test("unknown action fails", () => {
  assert.equal(relayBodySchema.safeParse({ action: "drain", poolId: 1 }).success, false);
});

test("practice placeholders satisfy the schema", () => {
  const body = { action: "cancel", poolId: 1, buyer, nonce: PRACTICE_NONCE, signature: PRACTICE_SIGNATURE, practice: true };
  assert.equal(relayBodySchema.safeParse(body).success, true);
});

test("idempotencyKey: optional, 16 to 80 safe characters", () => {
  const key = "settle-3-0123456789abcdef0123456789abcdef01234567";
  assert.equal(relayBodySchema.safeParse({ action: "settle", poolId: 3, idempotencyKey: key }).success, true);
  assert.equal(relayBodySchema.safeParse({ action: "pledge", poolId: 1, buyer, signature, idempotencyKey: key }).success, true);
  assert.equal(relayBodySchema.safeParse({ action: "settle", poolId: 3, idempotencyKey: "too-short" }).success, false);
  assert.equal(relayBodySchema.safeParse({ action: "settle", poolId: 3, idempotencyKey: "k".repeat(81) }).success, false);
  assert.equal(relayBodySchema.safeParse({ action: "settle", poolId: 3, idempotencyKey: "has spaces in the key!!" }).success, false);
});

test("campaign ids: slugs and pool numbers pass, paths fail", () => {
  assert.equal(campaignIdSchema.safeParse("kavruk-guji").success, true);
  assert.equal(campaignIdSchema.safeParse("12").success, true);
  assert.equal(campaignIdSchema.safeParse("../etc").success, false);
});
