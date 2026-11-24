import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMarketIntel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().max(60).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { priceStats, fxSnapshot } = await import("./market.server");
    const [stats, fx] = await Promise.all([priceStats(data.query), fxSnapshot()]);
    return { stats, fx };
  });

export const searchOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ query: z.string().max(80), quantity: z.number().int().min(1).max(100000), state: z.string().max(40).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { searchAndRank } = await import("./market.server");
    const { ngnPerUsd } = await import("./celo.server");
    const [offers, fx] = await Promise.all([searchAndRank(data.query, data.quantity, data.state), ngnPerUsd().catch(() => null)]);
    return { offers, fx };
  });

export const createOrderFromOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(100000), state: z.string().max(40).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { createProposal } = await import("./orders.server");
    try {
      const r = await createProposal({ userId: context.userId, productId: data.productId, quantity: data.quantity, ...(data.state ? { deliveryState: data.state } : {}) });
      return { ok: true as const, orderId: r.order.id };
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : "Could not create order" };
    }
  });

export const buyMarketReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product: z.string().min(2).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const { buyReport } = await import("./x402.server");
    const origin = new URL(getRequest().url).origin;
    try {
      const r = await buyReport(context.userId, origin, data.product);
      return { ok: true as const, reportJson: JSON.stringify(r.data), txHash: r.txHash, amountUsd: r.amountUsd };
    } catch (e) {
      console.error("x402 buy failed", e);
      return { ok: false as const, reason: e instanceof Error ? e.message.slice(0, 240) : "Payment failed" };
    }
  });
