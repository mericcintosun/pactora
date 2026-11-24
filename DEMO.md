# Pactora demo (90 seconds)

**Problem:** A small maker needs a minimum number of pre-orders before a batch is worth making, and today buyers either pay up front and wait for refunds, or promise in a group chat and vanish at payment time.

**Trigger:** A seller opens a batch: min 5 orders, 2 tUSD8 each, 24 hours.

**Wow moment:** The fifth signature turns the counter to 5/5, Collect moves five wallets' tUSD8 to the seller in one transaction, and right next to it a lapsed batch at 3/5 shows every balance identical before and after.

**Closing line:** "If the deadline passes short, nothing happens, because your money never left."

Demo start route: `/`

Runs fully on seed data with `ADAPTER_MODE=fake` (or unset): no wallet, no RPC, no key. Contract verbs on screen map to `QuorumPool.pledge`, `QuorumPool.withdrawPledge` and `QuorumPool.settle`.

## Steps

1. **`/`** (`app/page.tsx`), 0 to 5 s. Landing with the diagonal split and the live board of batches. Header CTA "Open a batch".
2. **`/pledge?example=kavruk-guji`** (`app/pledge/page.tsx`), 5 to 15 s. The seller form is preloaded with Kavruk Coffee Roasters: min 5, 2 tUSD8, 24 h. Press "Open batch"; the create tx hash appears and the batch joins the board.
3. **`/pledge/kavruk-guji`** (`app/pledge/[id]/page.tsx`), 15 to 45 s. Practice wallets sign with "Count me in" (`pledge`) and the counter climbs to 5/5. One wallet presses "Withdraw my signature" (`withdrawPledge`) and signs again.
4. **Same page** (`app/pledge/[id]/page.tsx`), 45 to 65 s. Press "Collect all payments" (`settle`). The receipt shows one settle tx, five transfers of 2 tUSD8 into the pool, and the 10 tUSD8 total to the seller.
5. **`/how`** (`app/how/page.tsx`), 65 to 75 s. The signed message with `to = QuorumPool` (only the pool can redeem it) and the six safety controls.
6. **`/pledge/kavruk-peru-lapsed`** (`app/pledge/[id]/page.tsx`), 75 to 90 s. The lapsed batch at 3/5: every buyer's balance before and after is identical. Close with the line above.
