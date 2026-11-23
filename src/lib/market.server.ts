// Server-only marketplace data access: offers with real supplier stats, and aggregate market intelligence.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rankOffers, type OfferInput, type SupplierStats } from "./procurement";
import { mentoQuotes, referenceRates } from "./celo.server";
import { isEvmAddress } from "./celo";

export async function supplierStats(supplierIds: string[]): Promise<Record<string, SupplierStats>> {
  const out: Record<string, SupplierStats> = {};
  for (const id of supplierIds) out[id] = { deliveredOrders: 0, onTimeDeliveries: 0, cancelledOrDeclined: 0, totalOrders: 0 };
  if (supplierIds.length === 0) return out;
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("supplier_id,status,paid_at,delivered_at,delivery_days")
    .in("supplier_id", supplierIds)
    .in("status", ["paid", "confirmed", "shipped", "delivered", "declined"]);
  if (error) throw error;
  for (const o of data ?? []) {
    const s = out[o.supplier_id];
    if (!s) continue;
    s.totalOrders++;
    if (o.status === "declined") s.cancelledOrDeclined++;
    if (o.status === "delivered") {
      s.deliveredOrders++;
      if (o.paid_at && o.delivered_at) {
        const due = new Date(o.paid_at).getTime() + ((o.delivery_days ?? 2) + 1) * 86_400_000;
        if (new Date(o.delivered_at).getTime() <= due) s.onTimeDeliveries++;
      }
    }
  }
  return out;
}

export async function loadOffers(query: string): Promise<OfferInput[]> {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !["bags", "bag", "the", "and", "for", "kg"].includes(t));
  let q = supabaseAdmin
    .from("products")
    .select("*, suppliers!inner(id,business_name,state,city,verification_status,payout_wallet)")
    .eq("active", true)
    .limit(100);
  if (terms.length > 0) {
    q = q.or(terms.flatMap((t) => [`name.ilike.%${t}%`, `category.ilike.%${t}%`]).join(","));
  }
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const stats = await supplierStats([...new Set(rows.map((r) => r.supplier_id))]);
  return rows.map((r) => {
    const s = r.suppliers as unknown as { id: string; business_name: string; state: string; city: string; verification_status: string; payout_wallet: string | null };
    return {
      productId: r.id,
      productName: r.name,
      unit: r.unit,
      category: r.category,
      unitPriceNgn: Number(r.unit_price_ngn),
      stockQty: r.stock_qty,
      minOrderQty: r.min_order_qty,
      deliveryFeeNgn: Number(r.delivery_fee_ngn),
      deliveryFeePerUnitNgn: Number(r.delivery_fee_per_unit_ngn),
      deliveryDays: r.delivery_days,
      deliversTo: r.delivers_to ?? [],
      supplierId: s.id,
      supplierName: s.business_name,
      supplierState: s.state,
      supplierCity: s.city,
      verificationStatus: s.verification_status,
      hasPayoutWallet: isEvmAddress(s.payout_wallet),
      stats: stats[s.id] ?? { deliveredOrders: 0, onTimeDeliveries: 0, cancelledOrDeclined: 0, totalOrders: 0 },
    };
  });
}

export async function searchAndRank(query: string, quantity: number, deliveryState?: string) {
  const offers = await loadOffers(query);
  return rankOffers(offers, quantity, deliveryState);
}

export async function priceStats(rawQuery?: string) {
  const query = rawQuery?.replace(/[^a-zA-Z0-9 ]/g, "").trim() || undefined;
  let q = supabaseAdmin.from("price_history").select("product_id,product_name,category,unit,unit_price_ngn,recorded_at").order("recorded_at", { ascending: true }).limit(2000);
  if (query) q = q.or(`product_name.ilike.%${query}%,category.ilike.%${query}%`);
  const { data, error } = await q;
  if (error) throw error;
  const { data: products } = await supabaseAdmin.from("products").select("id,name,category,unit,unit_price_ngn,active").eq("active", true).limit(1000);

  // Current prices grouped by category+unit.
  const groups: Record<string, { category: string; unit: string; prices: number[]; products: number }> = {};
  for (const p of products ?? []) {
    if (query && !(`${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase()))) continue;
    const k = `${p.category}|${p.unit}`;
    groups[k] ??= { category: p.category, unit: p.unit, prices: [], products: 0 };
    groups[k].prices.push(Number(p.unit_price_ngn));
    groups[k].products++;
  }
  const current = Object.values(groups).map((g) => {
    const sorted = [...g.prices].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    return {
      category: g.category,
      unit: g.unit,
      listings: g.products,
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      avg: Math.round(avg),
      spreadPct: sorted[0] ? Math.round((((sorted[sorted.length - 1] ?? 0) - sorted[0]) / sorted[0]) * 100) : 0,
    };
  });

  // Daily average trend from recorded price changes.
  const byDay: Record<string, number[]> = {};
  for (const h of data ?? []) {
    const d = h.recorded_at.slice(0, 10);
    (byDay[d] ??= []).push(Number(h.unit_price_ngn));
  }
  const trend = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length), points: v.length }));
  return { current, trend, priceChanges: (data ?? []).length };
}

export async function fxSnapshot() {
  const [mento, ref] = await Promise.all([mentoQuotes().catch(() => null), referenceRates()]);
  return { mento, reference: ref, fetchedAt: new Date().toISOString() };
}

export async function buildMarketReport(product: string) {
  const [stats, fx] = await Promise.all([priceStats(product), fxSnapshot()]);
  return {
    product,
    generatedAt: new Date().toISOString(),
    source: "MarketMate supplier listings (live) + Mento Broker onchain quotes",
    prices: stats.current,
    trend: stats.trend,
    fx,
  };
}
