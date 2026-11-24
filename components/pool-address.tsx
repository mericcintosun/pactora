"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { explorerAddress, POOL_ADDRESS } from "@/lib/aevum";
import { shortHex } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The contract every sign, withdraw, collect and create control talks to, shown right
 * next to those controls: shortened address, full address in the title, a copy control
 * and an explorer link. Without NEXT_PUBLIC_CONTRACT_ADDRESS it says practice mode.
 */
export function PoolAddress({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  if (!POOL_ADDRESS) {
    return <p className={cn("text-xs text-muted-foreground", className)}>Practice mode: no contract connected</p>;
  }
  const address = POOL_ADDRESS;

  async function copy() {
    await navigator.clipboard.writeText(address).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs", className)}>
      <span>
        Contract: QuorumPool{" "}
        <span className="break-all font-semibold" title={address}>
          {shortHex(address)}
        </span>
      </span>
      <Button type="button" variant="link" size="sm" className="h-11 text-xs sm:h-auto" onClick={copy}>
        {copied ? "Address copied" : "Copy address"}
      </Button>
      <a
        href={explorerAddress(address)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center underline underline-offset-2 sm:min-h-0"
      >
        View on explorer
      </a>
    </div>
  );
}
