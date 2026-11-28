// x402 on Celo mainnet: both the paid resource (market report) and the agent-side payer.
import { HTTPFacilitatorClient, decodePaymentRequiredHeader, decodePaymentResponseHeader, encodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentRequired, PaymentRequirements } from "@x402/core/types";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { CELO_NETWORK_CAIP, TOKENS, X402_FACILITATOR_URL } from "./celo";
import { agentAccount } from "./celo.server";

export const REPORT_PRICE_ATOMIC = "10000"; // 0.01 USDC (6 decimals)
export const REPORT_PRICE_USD = 0.01;

export function reportPayTo(): `0x${string}` {
  const configured = process.env["X402_PAY_TO"]?.trim();
  if (configured && /^0x[0-9a-fA-F]{40}$/.test(configured)) return configured as `0x${string}`;
  throw new Error("Configure an independent report provider's X402_PAY_TO address");
}

export function reportRequirements(): PaymentRequirements {
  return {
    scheme: "exact",
    network: CELO_NETWORK_CAIP,
    asset: TOKENS.USDC.address,
    amount: REPORT_PRICE_ATOMIC,
    payTo: reportPayTo(),
    maxTimeoutSeconds: 300,
    extra: { name: "USDC", version: "2" },
  };
}

export function facilitator() {
  const key = process.env["X402_FACILITATOR_API_KEY"]?.trim();
  if (!key) return null;
  return new HTTPFacilitatorClient({
    url: X402_FACILITATOR_URL,
    createAuthHeaders: async () => {
      const h = { "X-API-Key": key };
      return { verify: h, settle: h, supported: h };
    },
  });
}

export type X402PaidResult<T> = {
  data: T;
  txHash: string | null;
  amountUsd: number;
  payTo: string;
};

/** Pre-flight: fetch unpaid, read the 402 requirements so the policy can be checked before anything is signed. */
export async function readPaymentRequired(url: string): Promise<{ required: PaymentRequired; offer: PaymentRequirements } | { free: Response }> {
  const res = await fetch(url);
  if (res.status !== 402) return { free: res };
  const header = res.headers.get("PAYMENT-REQUIRED");
  const required = header ? decodePaymentRequiredHeader(header) : ((await res.json()) as PaymentRequired);
  const offer = required.accepts.find(
    (a) =>
      a.scheme === "exact" &&
      a.network === CELO_NETWORK_CAIP &&
      a.asset.toLowerCase() === TOKENS.USDC.address.toLowerCase(),
  );
  if (!offer) throw new Error("No Celo USDC payment option offered by this API");
  return { required, offer };
}

export async function payAndFetch(url: string, required: PaymentRequired, offer: PaymentRequirements) {
  const account = agentAccount();
  // Sign precisely the policy-checked offer, never a fresh offer from a second 402 response.
  const client = new x402Client().register(CELO_NETWORK_CAIP, new ExactEvmScheme(account));
  const payload = await client.createPaymentPayload({ ...required, accepts: [offer] });
  const res = await fetch(url, { method: "GET", redirect: "error", headers: { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(payload) } });
  const receiptHeader = res.headers.get("PAYMENT-RESPONSE");
  const receipt = receiptHeader ? decodePaymentResponseHeader(receiptHeader) : null;
  return { res, receipt };
}

/** Agent buys a market report over x402, within the owner's per-call and daily x402 limits. */
export async function buyReport(userId: string, origin: string, product: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { isWalletOwner, loadPolicy } = await import("./orders.server");
  if (!(await isWalletOwner(userId))) throw new Error("Only the agent wallet owner can spend from the agent wallet");
  const { data: pol } = await supabaseAdmin.from("spending_policies").select("x402_enabled,x402_max_per_call_usd,x402_daily_limit_usd,approved_tokens").eq("owner_id", userId).maybeSingle();
  await loadPolicy(userId);
  if (!pol?.x402_enabled) throw new Error("Paid data (x402) is turned off in your spending controls");
  if (!pol.approved_tokens.includes("USDC")) throw new Error("USDC is not an approved payment token");
  if (!facilitator()) throw new Error("x402 facilitator is not configured");

  const url = `${origin}/api/public/x402/market-report?product=${encodeURIComponent(product)}`;
  const pre = await readPaymentRequired(url);
  if ("free" in pre) {
    if (!pre.free.ok) throw new Error(`Data API error ${pre.free.status}`);
    return { data: await pre.free.json(), txHash: null, amountUsd: 0, payTo: "" };
  }
  const amountUsd = Number(pre.offer.amount) / 10 ** TOKENS.USDC.decimals;
  if (!Number.isFinite(amountUsd) || amountUsd <= 0 || pre.offer.payTo.toLowerCase() !== reportPayTo().toLowerCase()) throw new Error("Invalid or unexpected paid API offer");
  if (pre.offer.payTo.toLowerCase() === agentAccount().address.toLowerCase()) throw new Error("Paid reports require an independent provider, not a payment to the agent itself");
  if (amountUsd > Number(pol.x402_max_per_call_usd)) {
    throw new Error(`API asks $${amountUsd}, above your x402 per-call limit of $${pol.x402_max_per_call_usd}`);
  }
  const { data: reservationId, error } = await supabaseAdmin.rpc("reserve_spend", {
    _owner: userId,
    _order: null as unknown as string,
    _kind: "x402",
    _token: "USDC",
    _amount: amountUsd,
    _amount_usd: amountUsd,
    _to: pre.offer.payTo,
    _daily_limit_usd: Number(pol.x402_daily_limit_usd),
    _description: `x402 · market report: ${product}`,
  });
  if (error || !reservationId) {
    throw new Error(error?.message.includes("DAILY_LIMIT_EXCEEDED") ? "Daily x402 limit reached" : "Could not reserve x402 spend");
  }
  try {
    const { res, receipt } = await payAndFetch(url, pre.required, pre.offer);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Paid request failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const txHash = receipt?.transaction ?? (data as { payment?: { transaction?: string } }).payment?.transaction ?? null;
    if (!receipt?.success || !txHash || receipt.network !== CELO_NETWORK_CAIP) throw new Error("Settlement could not be verified; spend remains reserved");
    const { waitForTx } = await import("./celo.server");
    const chainReceipt = await waitForTx(txHash as `0x${string}`);
    if (chainReceipt.status !== "success") throw new Error("Settlement reverted");
    await supabaseAdmin.from("wallet_transactions").update({ status: "confirmed", tx_hash: txHash }).eq("id", reservationId);
    return { data, txHash, amountUsd, payTo: pre.offer.payTo };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // A provider can settle and then lose the response. Do not free this allowance or automatically repay.
    await supabaseAdmin.from("wallet_transactions").update({ status: "pending", error: msg.slice(0, 300) }).eq("id", reservationId);
    throw e;
  }
}
