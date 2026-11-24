# QuorumPool (Foundry)

One contract: `src/QuorumPool.sol`. It holds no buyer funds until the moment of
settlement, and then only for the length of one transaction.

Target: Aevum testnet, chain id `44005`, RPC `https://rpc-test.qday.info`,
Shanghai EVM, legacy (type 0) transactions.

```bash
cd contracts
forge build

# deploy (prints the QuorumPool address in the Deployed event)
PRIVATE_KEY=$FARM_EVM_PRIVATE_KEY forge script script/Deploy.s.sol \
  --rpc-url https://rpc-test.qday.info --broadcast --legacy

# one safe interaction: opens a 5-order pool, moves no tokens
DEPLOYED_CONTRACT=0xYourPool PRIVATE_KEY=$FARM_EVM_PRIVATE_KEY forge script script/Smoke.s.sol \
  --rpc-url https://rpc-test.qday.info --broadcast --legacy

# source verification (the Aevum explorer verifier has been flaky, retry before the deadline)
forge verify-contract 0xYourPool src/QuorumPool.sol:QuorumPool \
  --chain-id 44005 --constructor-args $(cast abi-encode "constructor(address)" 0x456569838f1d43009A91ebA4263147Afd7233483)
```

TESTNET ONLY. The farm app's contract-deploy step reads the chain id first and
refuses mainnet ids, writes the deployed address back into `.env.local` and
README, and saves the explorer link.

## Environment

Every `vm.env*` name the scripts read, and where its value comes from:

| Name | Read by | Cheatcode | Where the value comes from |
| --- | --- | --- | --- |
| `PRIVATE_KEY` | `Deploy.s.sol`, `Smoke.s.sol` | `vm.envUint("PRIVATE_KEY")` | The deployer's testnet key. The farm runner sets it from `FARM_EVM_PRIVATE_KEY`; fund it with about 1 tQDAY from faucet.qday.info first. |
| `TUSD8_ADDRESS` (optional) | `Deploy.s.sol` | `vm.envOr("TUSD8_ADDRESS", ...)` | Overrides the tUSD8 address baked into the script (`0x456569838f1d43009A91ebA4263147Afd7233483`, from the aevum-starter-kit README). |
| `DEPLOYED_CONTRACT` | `Smoke.s.sol` | `vm.envAddress("DEPLOYED_CONTRACT")` | The QuorumPool address printed by `Deploy.s.sol` (the `Deployed` event). The app reads the same value as `NEXT_PUBLIC_CONTRACT_ADDRESS`. |

The key is passed to `vm.startBroadcast(pk)`, so it travels in the process
environment, never as a `--private-key` argument visible in `ps`.

## Functions

| Function | Who calls it | What it checks |
| --- | --- | --- |
| `createPool(title, price, minOrders, maxOrders, deadline)` | seller | deadline in the future, `maxOrders <= 128` |
| `pledge(poolId, buyer, validAfter, v, r, s)` | relayer | recovers the buyer from tUSD8's EIP-712 domain, nonce unused, pool open and not full |
| `withdrawPledge(poolId, buyer)` | buyer, or relayer after `cancelAuthorization` | caller is the buyer, or the token reports the nonce as used |
| `dropPledge(poolId, buyer)` | seller | removes a pledge whose wallet was emptied |
| `settle(poolId)` | anyone | active pledges >= minOrders, before deadline; one failed redemption reverts all |

Nonce per buyer: `keccak256(abi.encode(pool, poolId, buyer, round))`. The round
bumps after a withdrawal so a buyer can rejoin with a fresh signature.

## Tests (`test/QuorumPool.t.sol`)

```bash
cd contracts && forge test        # or from the repo root: npm run test:contracts
```

No forge-std: the cheatcodes the suite needs (`sign`, `addr`, `prank`, `warp`,
`expectRevert`, `expectEmit`) are declared in a local `Vm` interface.
`test/MockTUSD8.sol` stands in for tUSD8 with real EIP-3009 behaviour: EIP-712
domain `{ name: "tUSD8", version: "2" }`, `receiveWithAuthorization` that only the
`to` address may call, `validAfter` / `validBefore` checks, signer recovery,
single-use nonces, `cancelAuthorization`, `authorizationState` and `mint`.

| Test | What it proves |
| --- | --- |
| `test_settleHappyPath` | five signed buyers, one settle, seller gets 5 x price, `Settled` emitted, pool keeps 0 |
| `test_settleRevertsBelowThreshold` | below the minimum, `BelowThreshold` and nothing moves |
| `test_settleAfterDeadlineReverts` | after the deadline, `PoolClosed` |
| `test_cancelledAuthorizationBlocksSettleThenWithdrawWorks` | a cancelled authorization reverts settle; the relayer can then `withdrawPledge` |
| `test_withdrawByStrangerWithoutCancelReverts` | nobody can withdraw a live pledge for someone else |
| `test_frontRunnerCannotRedeem` | calling `receiveWithAuthorization` directly fails: only the pool can redeem |
| `test_emptyWalletRevertsUntilSellerDrops` | an emptied wallet reverts the whole settle; after `dropPledge` the rest settle |
| `test_dropPledgeByStrangerReverts` | `dropPledge` is seller only (`NotAllowed`) |
| `test_badSignatureReverts` | a signature from another key is `BadSignature` |
| `test_duplicatePledgeReverts` | one live pledge per buyer (`AlreadyPledged`) |
| `testFuzz_settleTotalEqualsPriceTimesOrders` | for 1 to 24 orders and any non-zero price, seller gets orders x price and the pool ends at 0 |

## Checks, effects, interactions

`pledge`, `withdrawPledge`, `dropPledge` and `settle` each read in that order in
the function body. The only external calls before an effect are view reads on
the token (`authorizationState`, `DOMAIN_SEPARATOR`). `settle` marks the pool
settled before the first `receiveWithAuthorization`, and its loop is bounded by
`MAX_ENTRIES` (256), which `pledge` enforces. Every state change the UI shows has
an event: `PoolCreated`, `Pledged`, `PledgeWithdrawn`, `PledgeDropped`, `Settled`.
