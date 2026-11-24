import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canSupplierMove } from "./procurement";
import type { Database } from "@/integrations/supabase/types";

const idInput = z.object({ orderId: z.string().uuid() });

export const approveAndPay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    const { executePayment } = await import("./orders.server");
    return executePayment(context.userId, data.orderId, "owner");
  });

export const refreshPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: order } = await context.supabase.from("orders").select("id,status,tx_hash,buyer_id").eq("id", data.orderId).maybeSingle();
    if (!order || order.status !== "paying" || !order.tx_hash) return { status: order?.status ?? "unknown" };
    const { publicClient } = await import("./celo.server");
    const { markPaid } = await import("./orders.server");
    try {
      const r = await publicClient().getTransactionReceipt({ hash: order.tx_hash as `0x${string}` });
      if (r.status === "success") {
        await markPaid(order.id, null, order.tx_hash);
        return { status: "paid" };
      }
    } catch {
      /* not mined yet */
    }
    return { status: "paying" };
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated } = await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", data.orderId)
      .eq("buyer_id", context.userId)
      .in("status", ["proposed", "failed"])
      .select("id")
      .maybeSingle();
    if (!updated) return { ok: false as const, reason: "Only unpaid orders can be cancelled" };
    await supabaseAdmin.from("order_events").insert({ order_id: data.orderId, event: "cancelled", detail: "Cancelled by owner", actor: "buyer" });
    return { ok: true as const };
  });

const supplierInput = z.object({
  orderId: z.string().uuid(),
  to: z.enum(["confirmed", "declined", "shipped", "delivered"]),
  note: z.string().max(500).optional(),
});

export const supplierUpdateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => supplierInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin.from("orders").select("id,status,supplier_id,suppliers(owner_id,business_name)").eq("id", data.orderId).maybeSingle();
    const sup = order?.suppliers as unknown as { owner_id: string; business_name: string } | null;
    if (!order || sup?.owner_id !== context.userId) return { ok: false as const, reason: "Order not found" };
    if (!canSupplierMove(order.status, data.to)) return { ok: false as const, reason: `Can't move from ${order.status} to ${data.to}` };
    const now = new Date().toISOString();
    const patch: Database["public"]["Tables"]["orders"]["Update"] = { status: data.to, supplier_note: data.note ?? null };
    if (data.to === "confirmed") patch.confirmed_at = now;
    if (data.to === "shipped") patch.shipped_at = now;
    if (data.to === "delivered") patch.delivered_at = now;
    const { data: updated } = await supabaseAdmin.from("orders").update(patch).eq("id", order.id).eq("status", order.status).select("id").maybeSingle();
    if (!updated) return { ok: false as const, reason: "Order changed, refresh and try again" };
    const labels: Record<string, string> = {
      confirmed: `${sup.business_name} confirmed the order`,
      declined: `${sup.business_name} declined the order — contact them about a refund`,
      shipped: `${sup.business_name} dispatched the goods`,
      delivered: `${sup.business_name} marked the order delivered`,
    };
    await supabaseAdmin.from("order_events").insert({ order_id: order.id, event: data.to, detail: [labels[data.to], data.note].filter(Boolean).join(" — "), actor: "supplier" });
    return { ok: true as const };
  });

export const buyerConfirmDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated } = await supabaseAdmin
      .from("orders")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", data.orderId)
      .eq("buyer_id", context.userId)
      .in("status", ["confirmed", "shipped"])
      .select("id")
      .maybeSingle();
    if (!updated) return { ok: false as const, reason: "Order can't be marked received yet" };
    await supabaseAdmin.from("order_events").insert({ order_id: data.orderId, event: "delivered", detail: "Owner confirmed goods received", actor: "buyer" });
    return { ok: true as const };
  });
