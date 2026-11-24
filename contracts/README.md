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

- `PRIVATE_KEY`: deployer key (testnet wallet funded from faucet.qday.info).
  Both scripts read it with `vm.envUint("PRIVATE_KEY")` and pass it to
  `vm.startBroadcast(pk)`, so the key travels in the process environment, never
  as a `--private-key` argument visible in `ps`. The farm runner sets it from
  `FARM_EVM_PRIVATE_KEY`.
- `TUSD8_ADDRESS` (optional): overrides the tUSD8 address baked into `Deploy.s.sol`.
- `DEPLOYED_CONTRACT`: the QuorumPool address, read by `Smoke.s.sol`.

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

## Tests to write next (`test/QuorumPool.t.sol`)

Below threshold reverts, settle after deadline reverts, cancelled authorization
cannot be redeemed, a front-runner calling `receiveWithAuthorization` directly
fails because only the pool is the `to`, and a buyer with an empty wallet reverts
the whole settle until the seller drops them.
