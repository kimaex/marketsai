// Pure procurement rules shared by the agent, server functions and UI. No I/O here.

export type SupplierStats = {
  deliveredOrders: number;
  onTimeDeliveries: number;
  cancelledOrDeclined: number;
  totalOrders: number;
};

export type OfferInput = {
  productId: string;
  productName: string;
  unit: string;
  category: string;
  unitPriceNgn: number;
  stockQty: number;
  minOrderQty: number;
  deliveryFeeNgn: number;
  deliveryFeePerUnitNgn: number;
  deliveryDays: number;
  deliversTo: string[];
  supplierId: string;
  supplierName: string;
  supplierState: string;
  supplierCity: string;
  verificationStatus: string;
  hasPayoutWallet: boolean;
  stats: SupplierStats;
};

export type RankedOffer = OfferInput & {
  quantity: number;
  goodsNgn: number;
  deliveryNgn: number;
  totalNgn: number;
  reliability: number; // 0..1
  reliabilityBasis: string;
  score: number; // 0..100
  eligible: boolean;
  issues: string[];
};

export function deliveryCostNgn(o: Pick<OfferInput, "deliveryFeeNgn" | "deliveryFeePerUnitNgn">, qty: number) {
  return round2(o.deliveryFeeNgn + o.deliveryFeePerUnitNgn * qty);
}

/** Reliability from real order history only. New suppliers get a neutral 0.5 and are labelled as such. */
export function reliabilityScore(stats: SupplierStats, verificationStatus: string) {
  const verifiedBonus = verificationStatus === "verified" ? 0.1 : 0;
  if (stats.totalOrders === 0) {
    return { value: Math.min(1, 0.5 + verifiedBonus), basis: "No order history yet" };
  }
  const onTime = stats.deliveredOrders > 0 ? stats.onTimeDeliveries / stats.deliveredOrders : 0.5;
  const failRate = stats.cancelledOrDeclined / stats.totalOrders;
  // Confidence grows with volume; blends toward neutral when there are few orders.
  const confidence = Math.min(1, stats.totalOrders / 10);
  const raw = 0.7 * onTime + 0.3 * (1 - failRate);
  const value = Math.min(1, 0.5 * (1 - confidence) + raw * confidence + verifiedBonus);
  return {
    value: round2(value),
    basis: `${stats.deliveredOrders} delivered, ${Math.round(onTime * 100)}% on time, ${stats.totalOrders} orders`,
  };
}

export const RANK_WEIGHTS = { price: 0.5, reliability: 0.3, speed: 0.2 } as const;

export function rankOffers(offers: OfferInput[], quantity: number, deliveryState?: string): RankedOffer[] {
  const priced = offers.map((o) => {
    const goodsNgn = round2(o.unitPriceNgn * quantity);
    const deliveryNgn = deliveryCostNgn(o, quantity);
    const issues: string[] = [];
    if (o.stockQty < quantity) issues.push(`Only ${o.stockQty} in stock`);
    if (quantity < o.minOrderQty) issues.push(`Minimum order is ${o.minOrderQty}`);
    if (deliveryState && o.deliversTo.length > 0 && !o.deliversTo.some((s) => eqi(s, deliveryState)) && !eqi(o.supplierState, deliveryState)) {
      issues.push(`Does not deliver to ${deliveryState}`);
    }
    if (!o.hasPayoutWallet) issues.push("No Celo payout wallet");
    const rel = reliabilityScore(o.stats, o.verificationStatus);
    return {
      ...o,
      quantity,
      goodsNgn,
      deliveryNgn,
      totalNgn: round2(goodsNgn + deliveryNgn),
      reliability: rel.value,
      reliabilityBasis: rel.basis,
      score: 0,
      eligible: issues.length === 0,
      issues,
    };
  });

  const eligible = priced.filter((p) => p.eligible);
  const pool = eligible.length > 0 ? eligible : priced;
  const minTotal = Math.min(...pool.map((p) => p.totalNgn));
  const minDays = Math.min(...pool.map((p) => p.deliveryDays));

  for (const p of priced) {
    const priceScore = p.totalNgn > 0 ? minTotal / p.totalNgn : 0;
    const speedScore = (minDays + 1) / (p.deliveryDays + 1);
    const s = RANK_WEIGHTS.price * priceScore + RANK_WEIGHTS.reliability * p.reliability + RANK_WEIGHTS.speed * speedScore;
    p.score = Math.round(s * 1000) / 10;
  }

  return priced.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.totalNgn - b.totalNgn);
}

/** Savings of the chosen offer vs the average total of the other eligible quotes. 0 when there is nothing to compare. */
export function savingsVsAlternatives(chosenTotalNgn: number, otherTotalsNgn: number[]) {
  if (otherTotalsNgn.length === 0) return 0;
  const avg = otherTotalsNgn.reduce((a, b) => a + b, 0) / otherTotalsNgn.length;
  return Math.max(0, round2(avg - chosenTotalNgn));
}

export function ngnToUsd(amountNgn: number, ngnPerUsd: number) {
  if (!(ngnPerUsd > 0)) throw new Error("Invalid FX rate");
  // Round up to the cent so the supplier is never underpaid.
  return Math.ceil((amountNgn / ngnPerUsd) * 100) / 100;
}

// ---------------- Spending permissions ----------------

export type SpendingPolicy = {
  max_per_tx_usd: number;
  daily_limit_usd: number;
  restrict_to_approved_suppliers: boolean;
  approved_supplier_ids: string[];
  approved_tokens: string[];
  autonomous_enabled: boolean;
  autonomous_max_usd: number;
};

export type PaymentCheckInput = {
  policy: SpendingPolicy;
  amountUsd: number;
  supplierId: string;
  token: string;
  spentLast24hUsd: number;
  /** "owner" = the owner pressed Approve; "autonomous" = the agent wants to pay on its own. */
  mode: "owner" | "autonomous";
};

export type PaymentCheck = {
  allowed: boolean;
  /** Hard blocks: the payment can never go through under the current policy. */
  blocks: string[];
  /** True when the agent must stop and ask the owner. */
  needsOwnerApproval: boolean;
  approvalReasons: string[];
};

export function checkPayment(i: PaymentCheckInput): PaymentCheck {
  const p = i.policy;
  const blocks: string[] = [];
  const approvalReasons: string[] = [];

  if (!(i.amountUsd > 0)) blocks.push("Amount must be greater than zero");
  if (i.amountUsd > Number(p.max_per_tx_usd)) {
    blocks.push(`Exceeds the per-transaction limit of $${Number(p.max_per_tx_usd).toFixed(2)}`);
  }
  if (i.spentLast24hUsd + i.amountUsd > Number(p.daily_limit_usd)) {
    blocks.push(
      `Would exceed the daily limit of $${Number(p.daily_limit_usd).toFixed(2)} ($${i.spentLast24hUsd.toFixed(2)} already spent in the last 24h)`,
    );
  }
  if (!p.approved_tokens.includes(i.token)) blocks.push(`${i.token} is not an approved payment token`);
  const supplierApproved = p.approved_supplier_ids.includes(i.supplierId);
  if (p.restrict_to_approved_suppliers && !supplierApproved) blocks.push("Supplier is not on your approved list");

  if (i.mode === "autonomous") {
    if (!p.autonomous_enabled) approvalReasons.push("Autonomous purchasing is off");
    else {
      if (!supplierApproved) approvalReasons.push("Autonomous purchases only go to approved suppliers");
      if (i.amountUsd > Number(p.autonomous_max_usd)) {
        approvalReasons.push(`Above your autonomous limit of $${Number(p.autonomous_max_usd).toFixed(2)}`);
      }
    }
  }

  const needsOwnerApproval = i.mode === "autonomous" && approvalReasons.length > 0;
  return { allowed: blocks.length === 0 && !needsOwnerApproval, blocks, needsOwnerApproval, approvalReasons };
}

/** Allowed supplier-side status transitions. Payment states are only ever set by the server after onchain confirmation. */
export const SUPPLIER_TRANSITIONS: Record<string, string[]> = {
  paid: ["confirmed", "declined"],
  confirmed: ["shipped"],
  shipped: ["delivered"],
};

export function canSupplierMove(from: string, to: string) {
  return (SUPPLIER_TRANSITIONS[from] ?? []).includes(to);
}

function eqi(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
