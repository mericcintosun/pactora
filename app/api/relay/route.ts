// Gasless relayer. Buyers only sign; this route pays the tQDAY gas.
// Live path: RELAYER_PRIVATE_KEY and NEXT_PUBLIC_CONTRACT_ADDRESS are set, the route
// submits legacy transactions to QuorumPool / tUSD8 on Aevum testnet.
// Mock path: neither is set, the route answers with a placeholder hash so the UI flow
// can be rehearsed without a funded wallet.
import { NextResponse } from "next/server";
import { createWalletClient, http, isAddress, isHex, parseSignature, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { aevumTestnet, AEVUM_RPC, POOL_ADDRESS, publicClient, quorumPoolAbi, TUSD8_ADDRESS, tusd8Abi } from "@/lib/aevum";
import { hexFrom } from "@/lib/data";

export const runtime = "nodejs";

type Body =
  | { action: "pledge"; poolId: number; buyer: string; signature: string }
  | { action: "cancel"; poolId: number; buyer: string; nonce: string; signature: string }
  | { action: "settle"; poolId: number };

// Best-effort per-instance rate limit: 12 requests per minute per IP.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 12;
}

function splitSig(signature: Hex) {
  const { r, s, v, yParity } = parseSignature(signature);
  return { r, s, v: v !== undefined ? Number(v) : yParity + 27 };
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "The request was not valid JSON." }, { status: 400 });
  }
  if (!body || !["pledge", "cancel", "settle"].includes(body.action) || !Number.isInteger(body.poolId) || body.poolId < 1) {
    return NextResponse.json({ error: "Unknown action or campaign." }, { status: 400 });
  }
  if (body.action !== "settle") {
    if (!isAddress(body.buyer) || !isHex(body.signature)) {
      return NextResponse.json({ error: "The wallet address or signature is malformed." }, { status: 400 });
    }
  }

  const key = process.env.RELAYER_PRIVATE_KEY as Hex | undefined;
  if (!key || !POOL_ADDRESS) {
    // Mock path. TODO: remove once the relayer wallet is funded on Aevum.
    return NextResponse.json({
      mode: "mock",
      txHash: `0x${hexFrom(`${body.action}:${body.poolId}:${Date.now()}`, 64)}`,
    });
  }

  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain: aevumTestnet, transport: http(AEVUM_RPC) });
  const poolId = BigInt(body.poolId);

  try {
    // Aevum wants legacy transactions: passing gasPrice makes viem send type 0.
    const gasPrice = await publicClient.getGasPrice();
    let txHash: Hex;

    if (body.action === "pledge") {
      const { v, r, s } = splitSig(body.signature as Hex);
      txHash = await wallet.writeContract({
        address: POOL_ADDRESS, abi: quorumPoolAbi, functionName: "pledge",
        args: [poolId, body.buyer as Address, BigInt(0), v, r, s], gasPrice,
      });
    } else if (body.action === "cancel") {
      if (!isHex(body.nonce)) return NextResponse.json({ error: "Missing nonce." }, { status: 400 });
      const { v, r, s } = splitSig(body.signature as Hex);
      const cancelTx = await wallet.writeContract({
        address: TUSD8_ADDRESS, abi: tusd8Abi, functionName: "cancelAuthorization",
        args: [body.buyer as Address, body.nonce as Hex, v, r, s], gasPrice,
      });
      await publicClient.waitForTransactionReceipt({ hash: cancelTx });
      txHash = await wallet.writeContract({
        address: POOL_ADDRESS, abi: quorumPoolAbi, functionName: "withdrawPledge",
        args: [poolId, body.buyer as Address], gasPrice,
      });
    } else {
      txHash = await wallet.writeContract({
        address: POOL_ADDRESS, abi: quorumPoolAbi, functionName: "settle", args: [poolId], gasPrice,
      });
    }

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, retryCount: 8 });
    if (receipt.status !== "success") {
      return NextResponse.json({ error: "The transaction reverted on chain. Nothing was charged.", txHash }, { status: 409 });
    }
    return NextResponse.json({ mode: "live", txHash });
  } catch (err) {
    const message = err instanceof Error ? err.message.split("\n")[0] : "Unknown error";
    return NextResponse.json({ error: `The relayer could not submit this: ${message}` }, { status: 502 });
  }
}
