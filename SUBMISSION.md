# Pactora: DoraHacks submission text

Fields in the order of the DoraHacks BUIDL form. Character limits are noted where the form is known to set one; check the form before pasting.

## Project name

Pactora

## One-liner (tagline, keep under about 100 characters)

Pre-orders for small makers: buyers only sign, and nobody pays unless the batch fills.

## Description

### Problem

A coffee roaster needs five bags sold before a lot is worth roasting. A print shop needs twenty. Small makers sell against a minimum order, and today they either take the money up front and promise refunds, or collect promises in a group chat and watch half of them vanish at payment time. On-chain crowdfunding contracts lock funds inside the contract, so a failed campaign makes every backer claim a refund and pay gas for it.

### Solution

Each buyer signs one tUSD8 `receiveWithAuthorization` (EIP-3009) message whose recipient is the QuorumPool contract, for a fixed amount, valid until the batch deadline. Nothing leaves the buyer's wallet when they sign, and a relayer pays the gas. When the count reaches the minimum, anyone presses collect: `settle` redeems every signature in one transaction and forwards the total to the seller. If one redemption fails, the whole transaction reverts. If the deadline passes short, the signatures expire and nobody's balance changes. A buyer can withdraw before the deadline with one more gasless signature (`CancelAuthorization`).

### Architecture

- `contracts/src/QuorumPool.sol`: `createPool`, `pledge` (checks the signature against the tUSD8 domain), `withdrawPledge`, `dropPledge`, `settle` (reentrancy lock, measured balance delta).
- `app/api/relay/route.ts` and `lib/relayer.ts`: zod-validated gasless relayer that submits pledge, cancel and settle as legacy transactions on Aevum.
- `lib/aevum.ts`: chain config, ABIs, the tUSD8 EIP-712 typed data, multicall reads and chunked log reads (1,000-block windows).
- `lib/adapter/`: pages read through one adapter, seed data in practice mode and live reads in real mode, with a seed fallback if Aevum does not answer within 4 seconds.
- Next.js 15 pages: `/` landing with the live board, `/pledge` batch desk, `/pledge/[id]` one batch as a shareable page, `/how` method and addresses.

### Key workflows

1. Seller opens a batch: product, price, minimum, hours (`/pledge`).
2. Buyers sign "Count me in"; the counter climbs; one buyer withdraws and signs again (`/pledge/kavruk-guji`).
3. At 5/5, "Collect all payments": the receipt shows one settle tx, five transfers of 2 tUSD8 and 10 tUSD8 to the seller.
4. A lapsed batch at 3/5 shows every buyer's balance identical before and after (`/pledge/kavruk-peru-lapsed`).

### Technology

Next.js 15, React 19, TypeScript 5, Tailwind CSS 4, viem 2, zod 3, Motion 14, AutoAnimate 0.11, Solidity (`^0.8.20`, solc 0.8.24, shanghai EVM), Foundry, Aevum testnet (chain 44005), tUSD8, Vercel.

## Track

Crowdfunding

## Repository

https://github.com/mericcintosun/pactora

## Live demo

https://pactora-smoky.vercel.app

The live site runs on sample data until the QuorumPool redeploy, and each page says so in its mode line ("Sample data: QuorumPool is not deployed on this build yet, so this page shows seeded batches and practice wallets.").

## Proof of QDay infrastructure

QuorumPool redeems tUSD8 `receiveWithAuthorization` on Aevum testnet, chain id 44005. tUSD8: `0x456569838f1d43009A91ebA4263147Afd7233483`. The token's name, version, decimals, domain separator and the presence of `receiveWithAuthorization`, `cancelAuthorization` and `authorizationState` are read on chain by `npm run proof` and recorded in the README Proof section. The QuorumPool address and its explorer link (https://explorer-test.qday.info) are in the README "Deployed addresses" table.

## Documentation

README.md (problem, architecture diagram, workflows, technology, constraints, proof), DEMO.md (the 90-second path), SECURITY.md (wallet permissions, signature bounds, contract audit notes).

## Demo Day

Available for the live Demo Day on 2026-12-15 06:00 UTC (3 to 5 minute presentation, top 5).
