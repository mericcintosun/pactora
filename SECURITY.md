# Security

What Pactora asks of your wallet, and what it can and cannot do with it.

## 1. Contract address and chain

| Contract | Address |
| --- | --- |
| tUSD8 | `0x456569838f1d43009A91ebA4263147Afd7233483` |
| QuorumPool | not deployed yet |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |

Network: Aevum testnet, chain id 44005. Test tokens only.

The QuorumPool row is copied from README "Testnet addresses" and stays "not deployed yet" until the deploy step runs. After the deploy, the same address goes into README, this table and `NEXT_PUBLIC_CONTRACT_ADDRESS` (read in `lib/config.ts` as `POOL_ADDRESS`); the app never holds the address as a literal. Without it, every page runs in practice mode and the footer says "Practice mode: no contract connected".

## 2. Wallet permissions

The app sends exactly these requests to an injected wallet, and only after you press a button:

- `eth_requestAccounts`: when you press "Connect wallet", "Count me in", "Withdraw my signature" or "Open batch" without a connected account. Nothing is requested when a page loads.
- `eth_chainId`: right after connecting, to check you are on chain 44005.
- `wallet_switchEthereumChain`, then `wallet_addEthereumChain` if the wallet does not know the chain: only when you press "Switch to Aevum", always for chain 44005.
- `eth_signTypedData_v4` (EIP-712): "Count me in" asks for a tUSD8 `ReceiveWithAuthorization`; "Withdraw my signature" asks for a tUSD8 `CancelAuthorization`. Both are readable typed messages, never a blind `eth_sign` or `personal_sign`.
- `eth_sendTransaction`: only "Open batch" on a live deploy, which calls `QuorumPool.createPool` from the seller's wallet. It moves no tUSD8.

Connecting never starts a signature or a transaction by itself. Before each button the page shows one plain sentence that says what the popup will ask for, with the amount and the pool address.

## 3. Approval amounts

None. Pactora never calls `approve`, never asks for an allowance, and the contract never calls `transferFrom`. EIP-3009 needs no approval.

Each signature authorizes exactly one amount (the batch price), to exactly one recipient (QuorumPool, the only address that can redeem a `receiveWithAuthorization`), until exactly one time (`validBefore` equals the batch deadline), with a nonce bound to that pool, that buyer and that round. If the batch never reaches its minimum, the signature expires unused. "Withdraw my signature" cancels it on the token before the deadline.

Contract side: `settle` is guarded by a reentrancy lock and checks that the pool's tUSD8 balance grew by exactly the signed total before it pays the seller. Every state change emits an event (`PoolCreated`, `Pledged`, `PledgeWithdrawn`, `PledgeDropped`, `Settled`).

## 4. Source

https://github.com/mericcintosun/pactora

Contract: `contracts/src/QuorumPool.sol`, tests: `contracts/test/QuorumPool.t.sol`, wallet requests: `lib/wallet-state.ts` and `components/wallet-bar.tsx`, typed data: `lib/aevum.ts`.
