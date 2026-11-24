// Server component: one sentence that says where the page's data comes from.
// Pages pass the read outcome's mode (and whether the FALLBACK in lib/adapter/index.ts
// served seed data) in, so no client file ever touches the selector.
import { AEVUM_CHAIN_ID, explorerAddress, POOL_ADDRESS } from "@/lib/aevum";
import type { AdapterMode } from "@/lib/config";
import { shortHex } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ModeLine({ mode, fallback = false, className }: { mode: AdapterMode; fallback?: boolean; className?: string }) {
  return (
    <p className={cn("border-2 border-foreground bg-card px-4 py-2 text-sm text-foreground", className)}>
      {mode === "real" && POOL_ADDRESS ? (
        <>
          Live on Aevum testnet ({AEVUM_CHAIN_ID}): reads come from QuorumPool at{" "}
          <a href={explorerAddress(POOL_ADDRESS)} target="_blank" rel="noreferrer" className="font-semibold underline">
            {shortHex(POOL_ADDRESS)}
          </a>
          , writes go through the gasless relayer.
        </>
      ) : fallback ? (
        "Sample data: Aevum testnet did not answer within 4 seconds, so this page shows seeded batches and practice wallets. Reload to try the chain again."
      ) : (
        "Sample data: this page shows seeded batches and practice wallets, not Aevum."
      )}
    </p>
  );
}
