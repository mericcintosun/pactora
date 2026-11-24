# CLAUDE.md

Pactora: pre-orders for small makers on Aevum testnet with tUSD8. Read these first:

- `IDENTITY.md` is law for every color, font, route, layout and animation. Append to its Amendments only.
- `DEMO.md` is the demo contract: 6 steps, each tied to a route file. Keep every step working.
- `HANDOFF.md` holds current state, decisions, mocks and the next step.

## Commands

```bash
npm run build                          # must stay green after every change
npm run seed                           # prints seed count and sha256; Node 22.6+ (strip-types)
cd contracts && forge build && forge test
```

## Layout

- `lib/types.ts` shared types and `ApiResponse<T>`; `lib/data/seed.ts` fixed seed (erasable TS only); `lib/format.ts` formatters.
- `lib/adapter/` the data seam: `getAdapter()` returns fake unless `ADAPTER_MODE` is exactly `real`. Pages and `/api/campaigns` read through `readCampaignList` / `readCampaign`, which fall back to seed data when a live read fails (the `FALLBACK` block in `lib/adapter/index.ts`).
- `lib/wallet-state.ts` the eight wallet states, `classifyError` and the one `injected()` lookup; `components/wallet-bar.tsx` renders them.
- `npm run demo:reset` checks seed determinism and, with the relayer key set, opens a fresh live pool.
- `lib/aevum.ts` chain config, ABIs, EIP-712 builders, live reads. `app/api/relay/route.ts` gasless relayer (mock hash when unconfigured).

## Stack pitfalls

- Aevum testnet chainId 44005.
- Shanghai EVM: `evm_version = "shanghai"` in `contracts/foundry.toml`.
- Legacy transactions only: `--legacy` for forge, `gasPrice` / `type: "legacy"` in viem.
- `eth_getLogs` is capped at 1,000 blocks: always read history with `getLogsChunked`.

## Never touch

- `node_modules`
- `.next`
- `public/illustrations`

## Vercel guardrails

- No runtime filesystem writes.
- `useSearchParams` only under `Suspense`.
- No Node-only APIs in edge paths; no custom server; no `output: export`.
- Every `process.env` key mirrored in `.env.example`.

## Rules

- Colors only through `app/globals.css` tokens; primitives from `components/ui/*`, never a bare `<button>` or `<input>`.
- English copy, no em dash or en dash, no filler vocabulary.
- Never commit `.env.local` or any key.

when compacting preserve the list of modified files and test commands
