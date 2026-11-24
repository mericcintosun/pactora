"use client";

import { useState } from "react";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { explorerTx } from "@/lib/aevum";
import { AEVUM_RPC, EXPLORER_URL } from "@/lib/config";
import { REVERT_HINTS } from "@/lib/errors";
import { shortHex } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AEVUM_CHAIN_ID,
  classifyError,
  injected,
  TxError,
  type TxAction,
  type TxErrorCode,
  type WalletState,
} from "@/lib/wallet-state";

const ACTION_NOUN: Record<TxAction, string> = {
  connect: "wallet connection",
  pledge: "signature",
  cancel: "withdrawal",
  settle: "collection",
  create: "new batch",
};

/** Copy for a failure that did not come with a contract rule of its own. */
const FAILED_COPY: Record<TxErrorCode, string> = {
  invalid_input: "The request was refused before it reached the chain.",
  reverted: "The contract refused this transaction. Nothing was charged.",
  rate_limited: "Too many tries from this connection. Wait a minute and try again.",
  upstream_timeout: "Aevum testnet is slow to answer. Nothing was charged; try again in a moment.",
  upstream_error: "The relayer could not reach Aevum testnet. Nothing was charged.",
  parse_failure: "The answer from Aevum testnet could not be read. Nothing was charged.",
  not_configured: "Live relaying is switched off on this deploy. The seeded batches still work in practice mode.",
  wallet_missing: "No browser wallet was found. Open one that can join Aevum testnet.",
};

const REVERT_TEXT = new Set(Object.values(REVERT_HINTS));

/** The contract rule when the relay named one, else the plain copy for the code. */
function failureText(code: TxErrorCode, hint: string): string {
  if (hint && (REVERT_TEXT.has(hint) || code === "invalid_input" || code === "reverted")) return hint;
  return FAILED_COPY[code];
}

/** Ask the wallet to move to Aevum; add the chain first if the wallet has never seen it. */
async function switchToAevum(): Promise<void> {
  const eth = injected();
  if (!eth) throw new TxError("wallet_missing", FAILED_COPY.wallet_missing);
  const chainId = `0x${AEVUM_CHAIN_ID.toString(16)}`;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (err) {
    if (classifyError(err) === "rejected") throw err;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: "Aevum Testnet",
          nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
          rpcUrls: [AEVUM_RPC],
          blockExplorerUrls: [EXPLORER_URL],
        },
      ],
    });
  }
}

function assertNever(x: never): never {
  throw new Error(`Unhandled wallet state ${JSON.stringify(x)}`);
}

/**
 * One line of wallet truth above the action buttons. Exactly one branch per WalletState
 * kind; the `never` check makes a ninth kind a type error until it gets its own copy.
 */
export function WalletBar({
  state,
  onConnect,
  onSwitched,
  onRetry,
  className,
}: {
  state: WalletState;
  onConnect?: () => void;
  onSwitched?: () => void;
  onRetry?: () => void;
  className?: string;
}) {
  const [switchNote, setSwitchNote] = useState<string | null>(null);

  async function doSwitch() {
    setSwitchNote(null);
    try {
      await switchToAevum();
      onSwitched?.();
    } catch (err) {
      setSwitchNote(
        classifyError(err) === "rejected"
          ? "The switch was declined. The wallet stays where it was."
          : "The wallet could not switch. Add Aevum testnet (chain 44005) by hand and try again.",
      );
    }
  }

  const box = cn("border-2 border-foreground px-3 py-2 text-sm", className);

  switch (state.kind) {
    case "disconnected":
      return (
        <div role="status" className={cn(box, "flex flex-wrap items-center justify-between gap-3")}>
          <span>No wallet connected. Signing a live batch needs a browser wallet on Aevum testnet; it never costs you gas.</span>
          {onConnect && (
            <Button size="sm" variant="outline" onClick={onConnect}>
              Connect wallet
            </Button>
          )}
        </div>
      );
    case "connecting":
      return (
        <p role="status" className={box}>
          Waiting for your wallet to share an account. Check the wallet window.
        </p>
      );
    case "wrong-network":
      return (
        <div role="status" className={cn(box, "space-y-2 border-warn")}>
          <p>
            {shortHex(state.account)} is on chain {state.chainId}. Pactora runs on Aevum testnet, chain {AEVUM_CHAIN_ID}.
          </p>
          <Button size="sm" variant="outline" onClick={doSwitch}>
            Switch to Aevum
          </Button>
          {switchNote && <p className="text-warn">{switchNote}</p>}
        </div>
      );
    case "idle":
      return (
        <p role="status" className={box}>
          {state.practice
            ? `Practice wallet ${shortHex(state.account)} is connected. Signatures come from seeded demo wallets and nothing is sent to Aevum.`
            : `Connected as ${shortHex(state.account)} on Aevum testnet, chain ${AEVUM_CHAIN_ID}.`}
        </p>
      );
    case "tx-pending":
      return (
        <p role="status" aria-busy="true" className={cn(box, "font-semibold")}>
          {state.label}
        </p>
      );
    case "tx-confirmed":
      return (
        <p role="status" className={cn(box, "overflow-x-auto border-ok")}>
          <span className="font-semibold text-ok">Confirmed.</span> The {ACTION_NOUN[state.action]} is in.{" "}
          {state.mock ? (
            <span className="text-muted-foreground">Practice hash {shortHex(state.txHash)}, not on chain.</span>
          ) : (
            <a className="font-semibold underline" href={explorerTx(state.txHash)} target="_blank" rel="noreferrer">
              {shortHex(state.txHash)} on the explorer
            </a>
          )}
        </p>
      );
    case "tx-rejected":
      return (
        <div role="status" className={cn(box, "flex flex-wrap items-center justify-between gap-3")}>
          <span>The wallet was closed before the {ACTION_NOUN[state.action]} was signed. Nothing was signed and nothing moved.</span>
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              Open the wallet again
            </Button>
          )}
        </div>
      );
    case "tx-failed":
      return (
        <ErrorState
          className={className}
          title={`The ${ACTION_NOUN[state.action]} did not go through`}
          hint={`The contract or the network refused it. ${failureText(state.code, state.hint)}`}
          reset={() => onRetry?.()}
        />
      );
    default:
      return assertNever(state);
  }
}
