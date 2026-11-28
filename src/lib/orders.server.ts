// Server-only order + payment engine. Every payment passes checkPayment() and the atomic reserve_spend() DB guard.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkPayment, ngnToUsd, savingsVsAlternatives, type SpendingPolicy } from "./procurement";
import { isEvmAddress, PAY_TOKENS, type PayToken } from "./celo";
import { searchAndRank } from "./market.server";
import { ngnPerUsd, sendStablecoin, waitForTx } from "./celo.server";

export async function loadPolicy(userId: string): Promise<SpendingPolicy> {
  const { data } = await supabaseAdmin.from("spending_policies").select("*").eq("owner_id", userId).maybeSingle();
  if (data) {
    return { ...data, max_per_tx_usd: Number(data.max_per_tx_usd), daily_limit_usd: Number(data.daily_limit_usd), autonomous_max_usd: Number(data.autonomous_max_usd) };
  }
  const { data: created, error } = await supabaseAdmin.from("spending_policies").insert({ owner_id: userId }).select("*").single();
  if (error) throw error;
  return { ...created, max_per_tx_usd: Number(created.max_per_tx_usd), daily_limit_usd: Number(created.daily_limit_usd), autonomous_max_usd: Number(created.autonomous_max_usd) };
}

export async function spentLast24h(userId: string, kind = "supplier_payment") {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("wallet_transactions")
    .select("amount_usd")
    .eq("owner_id", userId)
    .eq("kind", kind)
    .in("status", ["reserved", "pending", "confirmed"])
    .gt("created_at", since);
  if (error) throw error;
  return (data ?? []).reduce((a, r) => a + Number(r.amount_usd), 0);
}

export async function isWalletOwner(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", userId).eq("role", "wallet_owner").maybeSingle();
  return !!data;
}

async function logEvent(orderId: string, event: string, detail: string | null, actor: string, txHash?: string | null) {
  await supabaseAdmin.from("order_events").insert({ order_id: orderId, event, detail, actor, tx_hash: txHash ?? null });
}

export async function createProposal(args: {
  userId: string;
  productId: string;
  quantity: number;
  deliveryState?: string;
  deliveryAddress?: string;
  payToken?: string;
  note?: string;
}) {
  const { data: product, error } = await supabaseAdmin.from("products").select("*").eq("id", args.productId).maybeSingle();
  if (error) throw error;
  if (!product || !product.active) throw new Error("Product not found or inactive");

  // Snapshot the competing quotes for the same search so savings are evidence-based.
  const ranked = await searchAndRank(`${product.name} ${product.category}`, args.quantity, args.deliveryState);
  const sameUnit = ranked.filter((r) => r.unit.toLowerCase() === product.unit.toLowerCase());
  const chosen = sameUnit.find((r) => r.productId === product.id) ?? ranked.find((r) => r.productId === product.id);
  if (!chosen) throw new Error("Could not price this product");
  if (!chosen.eligible) throw new Error(`Cannot order: ${chosen.issues.join("; ")}`);
  const others = sameUnit.filter((r) => r.productId !== product.id && r.eligible).map((r) => r.totalNgn);
  const savings = savingsVsAlternatives(chosen.totalNgn, others);

  const fx = await ngnPerUsd();
  const totalUsd = ngnToUsd(chosen.totalNgn, fx.rate);
  const policy = await loadPolicy(args.userId);
  const token = (PAY_TOKENS as string[]).includes(args.payToken ?? "") ? (args.payToken as PayToken) : ((policy.approved_tokens[0] as PayToken) ?? "USDC");

  const { data: profile } = await supabaseAdmin.from("profiles").select("delivery_address,city,state").eq("id", args.userId).maybeSingle();

  const { data: order, error: oerr } = await supabaseAdmin
    .from("orders")
    .insert({
      buyer_id: args.userId,
      supplier_id: chosen.supplierId,
      product_id: product.id,
      product_name: product.name,
      unit: product.unit,
      quantity: args.quantity,
      unit_price_ngn: chosen.unitPriceNgn,
      delivery_fee_ngn: chosen.deliveryNgn,
      total_ngn: chosen.totalNgn,
      fx_rate_ngn_per_usd: fx.rate,
      fx_source: fx.source,
      total_usd: totalUsd,
      pay_token: token,
      delivery_days: chosen.deliveryDays,
      delivery_address: args.deliveryAddress ?? [profile?.delivery_address, profile?.city, profile?.state].filter(Boolean).join(", ") ?? null,
      buyer_note: args.note ?? null,
      savings_ngn: savings,
      comparison: sameUnit.slice(0, 6).map((r) => ({
        productId: r.productId,
        supplierName: r.supplierName,
        totalNgn: r.totalNgn,
        unitPriceNgn: r.unitPriceNgn,
        deliveryNgn: r.deliveryNgn,
        deliveryDays: r.deliveryDays,
        score: r.score,
        eligible: r.eligible,
        issues: r.issues,
      })),
    })
    .select("*")
    .single();
  if (oerr) throw oerr;
  await logEvent(order.id, "proposed", `Agent proposed ${args.quantity} × ${product.unit} ${product.name} from ${chosen.supplierName}`, "agent");

  const check = checkPayment({
    policy,
    amountUsd: totalUsd,
    supplierId: chosen.supplierId,
    token,
    spentLast24hUsd: await spentLast24h(args.userId),
    mode: "autonomous",
  });
  return { order, check, supplierName: chosen.supplierName };
}

export type PaymentOutcome =
  | { ok: true; txHash: string; orderId: string }
  | { ok: false; reason: string; blocks?: string[]; needsOwnerApproval?: boolean };

export async function executePayment(userId: string, orderId: string, mode: "owner" | "autonomous"): Promise<PaymentOutcome> {
  if (!(await isWalletOwner(userId))) {
    return { ok: false, reason: "Only the agent wallet owner can authorize payments. Ownership must be assigned by the project owner." };
  }
  const { data: order } = await supabaseAdmin.from("orders").select("*, suppliers(id,business_name,payout_wallet)").eq("id", orderId).maybeSingle();
  if (!order || order.buyer_id !== userId) return { ok: false, reason: "Order not found" };
  if (order.status !== "proposed" && order.status !== "failed") return { ok: false, reason: `Order is already ${order.status}` };
  const supplier = order.suppliers as unknown as { id: string; business_name: string; payout_wallet: string | null };
  if (!isEvmAddress(supplier.payout_wallet)) return { ok: false, reason: "Supplier has no valid Celo payout wallet" };

  const policy = await loadPolicy(userId);
  const amountUsd = Number(order.total_usd);
  const check = checkPayment({
    policy,
    amountUsd,
    supplierId: order.supplier_id,
    token: order.pay_token,
    spentLast24hUsd: await spentLast24h(userId),
    mode,
  });
  if (!check.allowed) {
    return { ok: false, reason: check.blocks[0] ?? check.approvalReasons[0] ?? "Not allowed by spending policy", blocks: [...check.blocks, ...check.approvalReasons], needsOwnerApproval: check.needsOwnerApproval };
  }

  // Lock the order so it can never be paid twice.
  const { data: locked } = await supabaseAdmin
    .from("orders")
    .update({ status: "paying", payment_status: "pending", approval_mode: mode === "owner" ? "manual" : "autonomous", approved_at: new Date().toISOString(), payment_error: null })
    .eq("id", orderId)
    .in("status", ["proposed", "failed"])
    .select("id")
    .maybeSingle();
  if (!locked) return { ok: false, reason: "Order is already being paid" };

  // Atomic daily-limit reservation in the database.
  const { data: reservationId, error: rerr } = await supabaseAdmin.rpc("reserve_spend", {
    _owner: userId,
    _order: orderId,
    _kind: "supplier_payment",
    _token: order.pay_token,
    _amount: amountUsd,
    _amount_usd: amountUsd,
    _to: supplier.payout_wallet,
    _daily_limit_usd: policy.daily_limit_usd,
    _description: `${order.order_number} · ${order.quantity} × ${order.product_name} → ${supplier.business_name}`,
  });
  if (rerr || !reservationId) {
    await supabaseAdmin.from("orders").update({ status: "proposed", payment_status: "unpaid" }).eq("id", orderId);
    return { ok: false, reason: rerr?.message.includes("DAILY_LIMIT_EXCEEDED") ? "Daily spending limit reached" : "Could not reserve spend" };
  }
  await logEvent(orderId, "approved", mode === "owner" ? "Owner approved the purchase" : "Auto-approved under your autonomous purchasing rule", mode === "owner" ? "buyer" : "agent");

  let hash: `0x${string}`;
  try {
    const sent = await sendStablecoin(order.pay_token as PayToken, supplier.payout_wallet, amountUsd);
    hash = sent.hash;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("payment send failed", msg);
    const definitelyNotSent = msg.includes("AGENT_WALLET_NOT_CONFIGURED") || msg.includes("INSUFFICIENT_BALANCE");
    if (!definitelyNotSent) {
      const reason = "Payment outcome is uncertain. Retry is blocked until the wallet transaction is reconciled.";
      await supabaseAdmin.from("wallet_transactions").update({ status: "pending", error: reason }).eq("id", reservationId);
      await supabaseAdmin.from("orders").update({ payment_error: reason }).eq("id", orderId);
      return { ok: false, reason };
    }
    const friendly = msg.includes("AGENT_WALLET_NOT_CONFIGURED")
      ? "Agent wallet is not set up yet"
      : msg.includes("INSUFFICIENT_BALANCE")
        ? msg.replace("INSUFFICIENT_BALANCE: ", "Not enough funds: ")
        : "The payment could not be sent";
    await supabaseAdmin.from("wallet_transactions").update({ status: "failed", error: friendly }).eq("id", reservationId);
    await supabaseAdmin.from("orders").update({ status: "failed", payment_status: "failed", payment_error: friendly }).eq("id", orderId);
    await logEvent(orderId, "payment_failed", friendly, "agent");
    return { ok: false, reason: friendly };
  }

  await supabaseAdmin.from("wallet_transactions").update({ status: "pending", tx_hash: hash }).eq("id", reservationId);
  await supabaseAdmin.from("orders").update({ tx_hash: hash }).eq("id", orderId);
  await logEvent(orderId, "payment_sent", `Sent ${amountUsd} ${order.pay_token} on Celo mainnet`, "chain", hash);

  try {
    const receipt = await waitForTx(hash);
    if (receipt.status !== "success") throw new Error("reverted");
  } catch (e) {
    const reverted = e instanceof Error && e.message === "reverted";
    if (reverted) {
      await supabaseAdmin.from("wallet_transactions").update({ status: "failed", error: "Transaction reverted" }).eq("id", reservationId);
      await supabaseAdmin.from("orders").update({ status: "failed", payment_status: "failed", payment_error: "Transaction reverted onchain" }).eq("id", orderId);
      await logEvent(orderId, "payment_failed", "Transaction reverted onchain", "chain", hash);
      return { ok: false, reason: "Transaction reverted onchain" };
    }
    // Still pending: leave it; the order page re-checks.
    return { ok: true, txHash: hash, orderId };
  }

  await markPaid(orderId, reservationId as string, hash);
  return { ok: true, txHash: hash, orderId };
}

export async function markPaid(orderId: string, walletTxId: string | null, hash: string) {
  if (walletTxId) await supabaseAdmin.from("wallet_transactions").update({ status: "confirmed" }).eq("id", walletTxId);
  else await supabaseAdmin.from("wallet_transactions").update({ status: "confirmed" }).eq("tx_hash", hash);
  const { data } = await supabaseAdmin
    .from("orders")
    .update({ status: "paid", payment_status: "paid", paid_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "paying")
    .select("id")
    .maybeSingle();
  if (data) await logEvent(orderId, "paid", "Payment confirmed onchain. Supplier notified.", "chain", hash);
}
