# HANDOFF: Pactora

You are picking up a working Next.js 15 scaffold. Read this file top to bottom, then read `IDENTITY.md`, then start on Mission item 1. Keep `npm run build` green after every change.

## 1. Context

**Product:** Pactora
**One-liner:** Pre-orders for small makers. Buyers only sign. When enough orders arrive, every payment is collected in one transaction; if the batch falls short, nobody's money ever moves.

**Plain pitch:** A small coffee roaster needs at least 10 orders before a new lot is worth roasting, so she opens a Pactora page. You land on it and press "I'm in". Your wallet asks for one signature and nothing leaves your account. The moment the counter reaches 10, every buyer's payment moves to the roaster at once and everyone gets a receipt. If the deadline passes with fewer than 10, nothing happens at all: your money never left, so there is no refund to wait for. Change your mind before the deadline and you can withdraw your signature with one click.

**Mechanism:** each buyer signs a tUSD8 EIP-3009 `receiveWithAuthorization` whose `to` is the QuorumPool contract, with a fixed value, `validBefore` equal to the campaign deadline and a nonce bound to `(pool, poolId, buyer, round)`. Only the `to` address can redeem a `receiveWithAuthorization`, so nobody but the pool can spend it. When the count reaches the minimum, anyone calls `settle(poolId)`; the pool redeems every authorization in one transaction and forwards the total to the seller. One failing authorization reverts the whole settle. Short of the threshold, the signatures simply expire.

**Hackathon:** Aevum Builder Challenge #1 (QDay), https://dorahacks.io/hackathon/qday
**Submission deadline:** 2026-12-11 08:00 UTC (16:00 UTC+8). Demo Day for the top 5: 2026-12-15 06:00 UTC, 3 to 5 minute live presentation.
**Target track:** 1st Place ($800 USDT). One submission is ranked for 1st/2nd/3rd automatically; there are no sponsor bounties. Theme category to pick on DoraHacks: Crowdfunding.

**Verified submission requirements:**
1. Public GitHub repo with clean, readable code.
2. Demo video link (required in the DoraHacks form; the builder records it).
3. Proof of QDay infrastructure: a smart contract using tUSD8 on Aevum testnet (this is QuorumPool).
4. Live deployment: working demo (Vercel, https://pactora.vercel.app).
5. One end-to-end flow: contract, simple UI, verified source code.
6. Documentation: problem, architecture, key workflows, technology list (README.md).
7. Top 5 present live at Demo Day.
Rules: all code written inside the event window, test tokens on Aevum testnet only.

**Judging (weights from qday.io/builder-challenge):** Innovation 20, UX 15, Technical quality 15, Real-world utility 15, Safety and controls 15, Demo 10, Docs 10. Judges explicitly ask for visible tx hashes, explorer links, spend caps, expiry, instant revocation and an architecture flowchart in the README.

## 2. Current state

Identity: see IDENTITY.md (direction D7, structure S2, archetype L7, kit K7)

Pressroom look: newsprint ground, 2px black rules, black headline bars, one signal red per screen, sharp corners, Libre Caslon Text for h1/h2 and Libre Franklin for body. M3 scale entrance (`pactora-scale-in`) in `app/globals.css` with a reduced-motion block.

### Routes (S2 landing-workspace, verb = "pledge")

| Route | File | What it shows |
| --- | --- | --- |
| `/` | `app/page.tsx` | L7 diagonal landing: clip-path black block, headline left, live `CampaignBoard` right; one CTA opens Ayşe's roast batch |
| `/pledge` | `app/pledge/page.tsx` | Workspace: seller batch form (`BatchWorkspace`) plus the full board; `?example=kavruk-guji` preloads the example |
| `/pledge/[id]` | `app/pledge/[id]/page.tsx` | One campaign as a shareable page: counter, signer list, sign / withdraw / collect, tx log, copy-link control (`CampaignRoom`) |
| `/how` | `app/how/page.tsx` | Method, contract rules, Aevum / tUSD8 addresses, safety controls |
| `POST /api/relay` | `app/api/relay/route.ts` | Gasless relayer for pledge, withdraw and settle |

Header links: Campaigns (`/pledge`), Live batch (`/pledge/kavruk-guji`), How it works (`/how`), plus the CTA "Open a batch".

### File map

- `lib/types.ts`: shared types (`Campaign`, `Pledge`, `CampaignStatus`, `PledgeState`) and `ApiResponse<T>`.
- `lib/data/seed.ts`: 11 fixed seed campaigns (Istanbul roaster, Izmir tailor, Kadıköy riso printer, Porto letterpress, Berlin bakery, Ayvalık olive press, Ankara bindery, Austin hot sauce, Lisbon ceramics, Kars felt co-op, plus the lapsed Kavruk Peru lot `kavruk-peru-lapsed` at 3/5): 5 open, 3 collected, 3 lapsed. Also `hexFrom`, `BUYERS`, `DEMO_SIGNERS`, `EXAMPLE_CAMPAIGN_ID`, `LAPSED_EXAMPLE_ID`, `activePledges`, `getSeedCampaign`. Erasable TS only (loaded by `scripts/seed.mjs` with `--experimental-strip-types`). Placeholder hashes are deterministic, not real txs.
- `lib/format.ts`: `formatTusd`, `formatUtc`, `shortHex`.
- `lib/adapter/`: `types.ts` (`CampaignAdapter`: list, get, createBatch, pledge, withdraw, collect), `fake.ts` (seed reads, deterministic `hexFrom` tx hashes), `real.ts` (reads delegate to `lib/aevum.ts`; writes throw "Real adapter is implemented in Phase 2"), `index.ts` (`getAdapter()`, real only when `ADAPTER_MODE === "real"`).
- `app/api/campaigns/route.ts` and `app/api/campaigns/[id]/route.ts`: GET list / one, `ApiResponse<T>` through `getAdapter()`, 404 for unknown ids.
- `scripts/seed.mjs`: `npm run seed` prints the seed count and a sha256 of `JSON.stringify(campaigns)`; writes nothing.
- `lib/aevum.ts`: the Aevum integration module. viem chain definition for 44005, QuorumPool ABI, tUSD8 EIP-712 typed data for `ReceiveWithAuthorization` and `CancelAuthorization`, `pledgeNonce`, `getLogsChunked` (1,000 block windows), `loadCampaign` (seed slug or live multicall read), `listCampaigns`.
- `app/api/relay/route.ts`: real viem wallet client path when `RELAYER_PRIVATE_KEY` and `NEXT_PUBLIC_CONTRACT_ADDRESS` are set (legacy txs); otherwise returns a mock hash with `mode: "mock"`.
- `components/campaign-board.tsx`: kit signature 1 (see below).
- `components/campaign-room.tsx`: the live campaign room; motion counter, auto-animated signer list, sign/withdraw/collect, receipt log, lapsed-batch balance comparison.
- `components/batch-workspace.tsx`: seller form (title, price, minimum, maximum, hours) creating a batch.
- `components/nav-links.tsx`: client nav links with `usePathname`, `aria-current="page"` and an underline on the active link.
- `app/loading.tsx`, `app/pledge/loading.tsx`, `app/pledge/[id]/loading.tsx`: pressroom placeholder blocks.
- `contracts/test/QuorumPool.t.sol`: one test, `test_settleRevertsBelowThreshold`, no forge-std (local `Vm` interface, mock token).
- `components/site-header.tsx`, `components/brand-mark.tsx`, `components/scene-slot.tsx`, `components/ui/*`: chrome and primitives (sharp, 2px black borders).
- `contracts/src/QuorumPool.sol`: `createPool`, `pledge`, `withdrawPledge`, `dropPledge`, `settle`, `nonceFor`, `entrantsOf`, `isPledged`. `contracts/script/Deploy.s.sol`, `contracts/script/Smoke.s.sol`, `contracts/README.md`. `contracts/src/App.sol` is leftover template code that nothing deploys; delete it once you touch contracts.
- Brand: `public/logo.svg`, `app/icon.svg`, `app/opengraph-image.tsx`, `public/illustrations/scene-1..3.svg` (scene 1 and 2 on `/`, scene 3 on `/how`).

### Real vs mocked

Real today: the contract, the EIP-712 typed data builders, the relayer's live viem path, the multicall read in `loadCampaign`, `getLogsChunked`.
Data seam: pages and `/api/campaigns` read only through `getAdapter()`. Default (`ADAPTER_MODE` unset or `fake`) is `lib/adapter/fake.ts` on seed data, so `isLive` never switches pages to RPC reads. `lib/adapter/real.ts` reads via `loadCampaign` / `listCampaigns`; its writes throw until Phase 2.
Mocked (each marked `TODO: swap mock`):
- `lib/adapter/fake.ts` entirely, and the write methods of `lib/adapter/real.ts`.
- `CampaignRoom.join` / withdraw / collect in `components/campaign-room.tsx`: without a deployed pool they sign as the `DEMO_SIGNERS` practice wallets and get mock hashes from the relay.
- `BatchWorkspace` submit in `components/batch-workspace.tsx`: returns a mock create tx instead of calling `createPool`.
- `POST /api/relay` mock branch in `app/api/relay/route.ts`.
- `loadCampaign` in `lib/aevum.ts`: per-buyer state and timestamps are not yet read from `Pledged` / `PledgeWithdrawn` logs.

### Interaction kit (K7 flip)

- Shipped: **signature 1, auto-animated collection.** `components/campaign-board.tsx` (`"use client"`, `useAutoAnimate`) on `/`. Rows are ordered by how many signatures each batch still needs; the filter (Gathering / Collected / Lapsed) and the "+ Sign" practice control change real seed counts and rows visibly move. The signer list in `CampaignRoom` is also auto-animated.
- To build: **signature 2, view morph.** Clicking a board row morphs into the campaign room header via `motion` `layoutId` (wrap board and room summary in `LayoutGroup`, shared id `campaign-${id}`).
- To build: **signature 3, inline sort/compare.** On `/pledge`, a sort control (signatures needed, deadline, price) that reorders the board rows, and on lapsed batches a before/after balance compare that reorders by balance.

### One-mark proof (header home link, `components/site-header.tsx`)

```tsx
<Link href="/" className="flex items-center gap-2.5">
  <BrandMark size={30} />
  <span className="font-display text-2xl font-bold">Pactora</span>
</Link>
```

## 3. Mission (priority order)

1. **Verify tUSD8 first (0.5 h).** Fund deployer, relayer and 5 demo wallets from faucet.qday.info (once per address per 24 h, do it on day one). Run `cast call 0x456569838f1d43009A91ebA4263147Afd7233483 "name()"`, `"version()"`, `"decimals()"` and check `receiveWithAuthorization` / `cancelAuthorization` exist (fork test). If `receiveWithAuthorization` is missing, switch the pool to `transferWithAuthorization` with `to = pool` and document the front-run limit in README Known constraints. Fix the EIP-712 domain in `lib/aevum.ts` if name/version differ.
2. **QuorumPool tests and deploy (3.5 h).** Add `contracts/test/QuorumPool.t.sol` with a mock EIP-3009 token: below-threshold settle reverts, settle after deadline reverts, cancelled authorization cannot be redeemed, direct `receiveWithAuthorization` by a front-runner fails, an empty-wallet buyer reverts settle until `dropPledge`. Then deploy with the commands in `contracts/README.md`:
   ```bash
   cd contracts && forge build
   PRIVATE_KEY=$FARM_EVM_PRIVATE_KEY forge script script/Deploy.s.sol --rpc-url https://rpc-test.qday.info --broadcast --legacy
   DEPLOYED_CONTRACT=0xYourPool PRIVATE_KEY=$FARM_EVM_PRIVATE_KEY forge script script/Smoke.s.sol --rpc-url https://rpc-test.qday.info --broadcast --legacy
   ```
   Done = address in `.env.local` and README Testnet addresses, `/how` shows it with an explorer link.
3. **Gasless sign and withdraw (3 h).** Replace the mock branches in `CampaignRoom` and the relay with the live path (already drafted). Withdraw = buyer signs `CancelAuthorization`, relayer calls `withdrawPledge`. Add rate limiting per IP and pool validation in the relay. Done = a fresh wallet with 0 tQDAY signs, the counter ticks, its tUSD8 balance is unchanged, the tx link opens on the explorer.
4. **Live campaign room (2.5 h).** Poll `activeCount` / `entrantsOf` via multicall every 4 s, fill per-buyer state from logs with `getLogsChunked`, show a per-signer balance warning when a buyer's tUSD8 balance drops below the price. Collect button enables at threshold. Plain-language errors for every revert reason.
5. **Seller form live (1 h).** `BatchWorkspace` calls `createPool` from the seller's wallet (legacy tx), shows the create tx link, routes to `/pledge/<poolId>`.
6. **Receipts and the lapsed screen (1.5 h).** Settled page lists every `Transfer` from the settle tx; lapsed page shows before/after balances per buyer ("nobody's balance changed").
7. **Kit signatures 2 and 3 (1 h)** as described above.
8. **Wow moment rehearsal (1 h).** Five browser profiles sign Ayşe's 5-order batch in turn; buyer 4 withdraws and rejoins; at 5/5 press Collect; open the explorer on the single settle tx showing five tUSD8 transfers in and 10 tUSD8 to the seller. Right next to it, the lapsed batch at 3/5 with identical balances. Record every tx hash in the README.
9. **Docs and verify (1.5 h).** README flowchart, addresses, commit link, `forge verify-contract` retries.

90-second demo script: 0-15 s seller creates "min 5, 2 tUSD8, 24 h" and the create tx link appears; 15-45 s five wallets sign, counter 1/5 to 5/5, one withdraw and rejoin; 45-65 s Collect, single tx with five transfers on the explorer; 65-75 s code view of the `to = pool` rule and the green front-run test; 75-90 s the lapsed batch with unchanged balances.

## 4. Constraints

- Next.js 15 App Router, TypeScript strict, Tailwind v4 (no config file), deploys to Vercel. No custom server, no filesystem writes, no server state: signatures live on chain through the relayer.
- Aevum: chainId 44005, Shanghai EVM (`evm_version = "shanghai"`), legacy transactions (`--legacy`, `type: "legacy"` in viem), `eth_getLogs` capped at 1,000 blocks (always use `getLogsChunked`).
- `IDENTITY.md` is law for every color, font, route, layout and animation. Colors only through `app/globals.css` tokens, no raw hex in components, sharp corners, red on one element per screen. Primitives from `components/ui/`, never bare `<button>` or `<input>`. Append to its Amendments section only.
- Copy: English, no em dashes or en dashes, no filler vocabulary (seamless, leverage, robust, unlock and friends), plain human tone, concrete numbers.
- Never commit `.env.local` or any private key. `RELAYER_PRIVATE_KEY` goes into Vercel env only.
- Scope: if the deadline is at risk, cut kit signature 3 and the seller form polish before touching the sign / collect / lapsed flow.
- Run `npm run build` after every change; it must stay green.

## 5. Definition of done

- QuorumPool deployed on Aevum testnet, address and verified-source (or commit) link in README.
- Live on https://pactora.vercel.app with `NEXT_PUBLIC_CONTRACT_ADDRESS` and `RELAYER_PRIVATE_KEY` set; `mode: "live"` returned by the relay.
- README "Live demo" line correct, Testnet addresses and real tx hashes filled.
- The 90-second flow works end to end on testnet and with seed data when env is empty.
- Wow moment rehearsed at least twice with five funded wallets; demo video recorded and linked in the DoraHacks form.

## 6. Phase 1: walking skeleton and demo path

**Goal:** the whole 90-second demo in `DEMO.md` is clickable on seed data with `ADAPTER_MODE=fake`, with no wallet, RPC or key, and five seams in place (typed core and seed, adapter and API stubs, docs, shell states, one contract test). The look is unchanged.

**Status:** all five slices written. Not built, not run: the agent had no shell. One item is open (see Failed attempts): `lib/data.ts` still exists as an empty `export {};` module and must be deleted by the runner.

**Decisions:**
- `getAdapter()` returns real only for `ADAPTER_MODE === "real"`. The relay's mock branch remains the fake write path used by the UI; adapter write methods exist for API completeness and Phase 2.
- New seed batch `kavruk-peru-lapsed` (poolId 11, min 5, 2 tUSD8, lapsed at 3/5) is DEMO step 6. `kavruk-guji` is unchanged (3 signed, 1 withdrawn).
- `CampaignRoom` practice mode: "Count me in" stays available while a practice wallet is free, and "Withdraw my signature" is shown for the last practice signer. Before this the counter stalled at 4/5 because after one sign only Withdraw was offered. This is what makes DEMO step 3 reach 5/5.
- `CampaignRoom` shows a "Receipt, one transaction" card after Collect (and on seed batches that were collected): the settle hash, one row per transfer, and the total to the seller. This is DEMO step 4.
- Board empty state text is now "No batches here yet." (it replaces the old sentence instead of adding a second one).
- `/` uses an absolute title; the layout template is `"%s | Pactora"`. A global `:focus-visible` outline in ACCENT was added to `app/globals.css`.
- `NEXT_PUBLIC_BRAND_FILES` (read in `lib/brand-files.ts`, set by `next.config.ts`) is now listed in `.env.example` so every `process.env` key is mirrored. It is not a new key.
- An error message containing "Unlock a browser wallet" was reworded to "Open a browser wallet" (banned word).

**Failed attempts / shortfalls:**
- `lib/data.ts` could not be deleted (the agent has Write/Edit only, no delete). Its content was replaced with an empty `export {};` and a "DELETE THIS FILE" comment, and nothing imports it. Runner: `git rm lib/data.ts`. It is listed in slice 1 of `.farm-commits.json`.

**Files changed:**
- Created: `lib/types.ts`, `lib/format.ts`, `lib/data/seed.ts`, `scripts/seed.mjs`, `lib/adapter/{types,fake,real,index}.ts`, `app/api/campaigns/route.ts`, `app/api/campaigns/[id]/route.ts`, `components/nav-links.tsx`, `app/loading.tsx`, `app/pledge/loading.tsx`, `app/pledge/[id]/loading.tsx`, `contracts/test/QuorumPool.t.sol`, `DEMO.md`, `CLAUDE.md`, `.farm-commits.json`.
- Edited: `package.json` (seed script), `.env.example`, `lib/aevum.ts`, `app/api/relay/route.ts` (import only), `app/page.tsx`, `app/pledge/page.tsx`, `app/pledge/[id]/page.tsx`, `app/how/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/error.tsx`, `app/not-found.tsx`, `app/opengraph-image.tsx` (comment only), `components/site-header.tsx`, `components/campaign-board.tsx`, `components/campaign-room.tsx`, `components/batch-workspace.tsx`, `README.md`, `HANDOFF.md`.
- To delete: `lib/data.ts`.

**Commands run:** none, agent has no shell. Runner to run: `npm install`, `npm run build`, `npm run seed` twice (Node 22.6+; on 22.6 itself the `.ts` ESM detection may need Node 22.7+ or newer), `cd contracts && forge build && forge test`.

**Open questions:**
- None needed a new dependency, route or env key.
- DEMO step 3 begins at 3/5 (seed: 3 signed, 1 withdrawn), so on seed data the demo shows signatures 4 and 5 plus a withdraw and rejoin, not 1/5 through 5/5. Should Phase 2 or the rehearsal start from a fresh pool at 0/5 for the video?

**Next best step:** Phase 2, swap fake for real behind `lib/adapter/real.ts`. Start with the tUSD8 `receiveWithAuthorization` check (Mission item 1), then the Phase 2 contract suite and the deploy.

## 7. Phase 2: QuorumPool settle goes real on Aevum

**Goal:** DEMO step 4 ("Collect all payments") calls `QuorumPool.settle` on Aevum 44005 through the server relayer, and step 3 (`pledge`, `withdrawPledge`) uses the same path. Steps 1, 2, 5 and 6 stay on seed data or practice mode. `ADAPTER_MODE` unset or `fake` still plays all six steps.

**Status:** all five slices written. Nothing was built, tested or run: the agent had Read, Write, Edit, Glob and Grep only. Settle and pledge/withdraw are wired to the live relayer for numeric pool ids when the real adapter is on.

**What went real (code written, not yet exercised on chain):**
- `lib/relayer.ts`: `submitPledge` (pre-checks `isPledged`, `nonceFor`, then `authorizationState`, refuses duplicates), `submitCancel` (`cancelAuthorization` on tUSD8 unless already used, then `withdrawPledge`), `submitSettle` (decodes the receipt's tUSD8 `Transfer` logs and `Settled` total), `submitCreatePool`. Legacy `gasPrice`, `waitForTransactionReceipt`, every call through `withTimeoutAndRetry`.
- `app/api/relay/route.ts`: `relayBodySchema.safeParse` first, then the rate limit, then the practice/mock branch, then the live branch. Every failure is `{ error, hint }`.
- `lib/aevum.ts` `loadCampaign`: per-buyer `isPledged` and tUSD8 `balanceOf` in one multicall, sign times plus `createTx` / `settleTx` from `PoolCreated`, `Pledged`, `Settled` logs via `getLogsChunked`. `listCampaigns` adds the 6 newest live pools to the board.
- `components/campaign-room.tsx`: on a numeric id with `mode === "real"`, "Count me in" signs `ReceiveWithAuthorization` in the injected wallet and posts to `/api/relay`; "Collect all payments" posts `settle` and renders the returned hash, the decoded transfer rows and the seller total.

**Still fixtures or practice:** the 11 seed batches (always practice, even in real mode), the seller form's practice path in `components/batch-workspace.tsx` (its drafted seller-wallet `createPool` branch is kept but routes nowhere live yet), the relay's mock branch (practice flag or no relayer key), `lib/adapter/fake.ts` entirely.

**Env the runner must fill:** `RELAYER_PRIVATE_KEY` (secret, server only, listed in `.farm-live.json`) and `NEXT_PUBLIC_CONTRACT_ADDRESS` (written by the deploy step). The real adapter turns on only with `ADAPTER_MODE=real` **and** `NEXT_PUBLIC_CONTRACT_ADDRESS`. Contract scripts read `PRIVATE_KEY` (`vm.envUint`, from `FARM_EVM_PRIVATE_KEY`), `TUSD8_ADDRESS` (optional, `vm.envOr`) and `DEPLOYED_CONTRACT` (`vm.envAddress`, the deployed pool address); sources are in `contracts/README.md`.

**Decisions:**
- Relay bodies carry an optional `practice: true`. Seed pages always send it, so practice mode keeps answering `mode: "mock"` even on a deploy where the live relayer is configured. Practice sends schema-valid zero values (`PRACTICE_SIGNATURE`, `PRACTICE_NONCE` in `lib/schemas.ts`), so validation stays strict (65-byte signature, 32-byte nonce).
- `ADAPTER_MODE` is read only in `lib/adapter/index.ts`; the rule ("real" plus a pool address) lives in `parseAdapterMode` in `lib/config.ts`. `RELAYER_PRIVATE_KEY` is read only in `lib/relayer.ts` (`readKey`, lazily, per call).
- Pages pass `getAdapter().mode` to `CampaignRoom` and `BatchWorkspace` as a prop; the old `isLive` export is gone. `ModeLine` (`components/mode-line.tsx`, server component) prints the sample or live sentence on `/`, `/pledge` and `/pledge/[id]`.
- `withTimeoutAndRetry` does not retry contract reverts. Writes are retried once on timeout; a duplicate send would revert at gas estimation because the pool already holds the pledge or is settled. viem's own transport retries are set to 0 so the retry count stays exactly 1.
- `/pledge/[id]` has `revalidate = 5` and `/` has `revalidate = 30`, so live pools are not frozen at build time.
- Contract: `settle` computes `total = orders * price` in the effects block (equal to the per-redemption sum because `activeCount` counts exactly the active entrants). The `NotPledged` check moved out of `_deactivate` into `dropPledge` and `withdrawPledge`, so each body reads checks, effects, interactions. The entrant cap check in `pledge` moved before the signature recovery.
- `tests/` is excluded in `tsconfig.json` because `tests/schemas.test.ts` imports `../lib/schemas.ts` with its extension (needed by `node --experimental-strip-types`).
- `/api/campaigns/[id]` validates the id with `campaignIdSchema`; unknown ids answer 404 with `error: "invalid_input"` (the union has no `not_found` code).

**Failed attempts:** none. No error was seen twice because nothing could be run.

**Files changed:**
- Created: `contracts/test/MockTUSD8.sol`, `lib/config.ts`, `lib/errors.ts`, `lib/schemas.ts`, `lib/log.ts`, `lib/http.ts`, `lib/relayer.ts`, `components/mode-line.tsx`, `scripts/proof.mjs`, `tests/schemas.test.ts`, `.farm-live.json`, `.farm-commits.json`.
- Edited: `contracts/src/QuorumPool.sol`, `contracts/test/QuorumPool.t.sol`, `contracts/README.md`, `lib/aevum.ts`, `lib/types.ts`, `lib/adapter/{types,fake,real,index}.ts`, `app/api/relay/route.ts`, `app/api/campaigns/route.ts`, `app/api/campaigns/[id]/route.ts`, `app/page.tsx`, `app/pledge/page.tsx`, `app/pledge/[id]/page.tsx`, `app/how/page.tsx`, `components/campaign-room.tsx`, `components/batch-workspace.tsx`, `package.json`, `.env.example`, `tsconfig.json`, `README.md`, `HANDOFF.md`.
- Unchanged on purpose: `contracts/script/Deploy.s.sol`, `contracts/script/Smoke.s.sol` (Smoke already reads `vm.envAddress("DEPLOYED_CONTRACT")` and makes one `createPool` call), `components/campaign-board.tsx`, `lib/data/seed.ts`.

**Commands run:** none. Runner: `npm install`, `npm run build`, `git rm lib/data.ts` if still present, then `npm run proof`. Human: `npm run test:contracts`, `npm test`.

**Unverified (needs a command):**
- TypeScript: two viem typing spots carry the most risk. `lib/aevum.ts` `readLivePool` passes a dynamic `ContractFunctionParameters[]` to `multicall` and casts the result to `unknown[]`; `lib/aevum.ts` `readHistory` reads `l.args.poolId` on the union from `parseEventLogs`. If the build rejects either, split the per-buyer multicall into two homogeneous ones and cast `l.args` to `{ poolId: bigint }`.
- Forge: the suite has never been compiled. `MockTUSD8` deliberately does not inherit `IERC3009Token`; the pool receives `IERC3009Token(address(token))`.
- On chain: whether tUSD8 really exposes `receiveWithAuthorization` and the `{ name: "tUSD8", version: "2" }` domain. Read the `tusd8-capabilities` Proof block in README first.
- Unmet acceptance item, by design: the double-hyphen tripwire matches the Mermaid edges in README.md lines 33 to 39 (Phase 1 text; Mermaid edge syntax needs the double hyphen). The banned-word hit on HANDOFF.md line 119 is the Phase 1 rule that lists those words.

**Manual checklist (human, before the live spot check):**
- Fund from https://faucet.qday.info/en or Discord `/faucet <address>` (once per address per 24 h): deployer about 1 tQDAY, relayer about 2 tQDAY, 5 demo wallets with at least 4 tUSD8 each (gas is not needed for buyers).
- Press the farm's deploy step, then set `RELAYER_PRIVATE_KEY` and `ADAPTER_MODE=real` on Vercel.
- Open a live pool (Smoke opens one with min 5 at 2 tUSD8 for 24 h, seller = deployer), go to `/pledge/<poolId>`, sign from five wallets, press Collect, open the settle tx on https://explorer-test.qday.info.
- Phase 1 question still open: should the video start a fresh pool at 0/5? A live pool from Smoke does start at 0/5; the seed batch `kavruk-guji` starts at 3/5.

**Open questions:**
- No new dependency beyond the pre-approved `zod`, no new env key, no new route.
- Live withdraw needs the same browser session that signed (`mine` is set on sign). Recognising a returning signer from the connected wallet is Phase 3 wallet UX.
- `submitCreatePool` makes the relayer the seller. Phase 3 should either have sellers call `createPool` from their own wallet (the drafted branch in `batch-workspace.tsx`) or add a seller argument to the contract.

**Next best step:** Phase 3, wallet and transaction lifecycle UX: recognise the connected wallet as a signer on load, pending, mined and failed states per action, `router.refresh` after each live write, persistence-free state, and `demo:reset`.
