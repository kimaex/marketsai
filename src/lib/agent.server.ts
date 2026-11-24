// MarketMate procurement agent: a tool-using loop on the Lovable AI Gateway (Responses surface).
import { generateResponse, GatewayError, type ResponsesInputItem } from "@lovable.dev/ai-gateway";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { searchAndRank, priceStats, fxSnapshot } from "./market.server";
import { createProposal, executePayment, loadPolicy, spentLast24h, isWalletOwner } from "./orders.server";
import { ngnPerUsd } from "./celo.server";
import { ngnToUsd } from "./procurement";

const MODEL = "openai/gpt-6-astra" as const;

export type ChatPart =
  | { type: "tool"; name: string; input: unknown; summary: string; ok: boolean }
  | { type: "offers"; query: string; quantity: number; fxRate: number | null; offers: OfferCard[] }
  | { type: "proposal"; orderId: string; orderNumber: string; autoPaid: boolean; txHash: string | null; blocks: string[]; approvalReasons: string[] }
  | { type: "report"; product: string; txHash: string | null; amountUsd: number };

export type OfferCard = {
  productId: string;
  productName: string;
  unit: string;
  supplierName: string;
  supplierCity: string;
  supplierState: string;
  verificationStatus: string;
  unitPriceNgn: number;
  deliveryNgn: number;
  totalNgn: number;
  totalUsd: number | null;
  deliveryDays: number;
  reliability: number;
  reliabilityBasis: string;
  score: number;
  eligible: boolean;
  issues: string[];
};

const tools = [
  {
    type: "function" as const,
    name: "search_suppliers",
    description:
      "Search live MarketMate supplier listings for a product, price the full order (goods + delivery) and rank suppliers by price (50%), reliability from real order history (30%) and delivery speed (20%). Always call this before recommending anything.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Product keywords, e.g. 'rice' or 'vegetable oil'" },
        quantity: { type: "integer", minimum: 1 },
        delivery_state: { type: "string", description: "Nigerian state for delivery, e.g. Lagos. Optional." },
      },
      required: ["query", "quantity"],
      additionalProperties: false,
    },
    strict: false,
  },
  {
    type: "function" as const,
    name: "get_fx_rates",
    description: "Live currency conversion: Mento onchain quotes (USDm→NGNm/KESm/GHSm/ZARm on Celo) plus an off-chain reference rate.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: false,
  },
  {
    type: "function" as const,
    name: "get_spending_status",
    description: "The owner's spending permissions, amount already spent in the last 24h, and whether this user can authorize agent-wallet payments.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: false,
  },
  {
    type: "function" as const,
    name: "get_market_trends",
    description: "Free aggregate price statistics (min/avg/max, spread, daily trend) computed from MarketMate listings.",
    parameters: { type: "object", properties: { query: { type: "string" } }, additionalProperties: false },
    strict: false,
  },
  {
    type: "function" as const,
    name: "create_purchase_proposal",
    description:
      "Create a purchase order for one specific product_id from search_suppliers. It is NOT paid: the owner must approve it in the app, unless their autonomous purchasing rule allows it (approved supplier and under the autonomous limit), in which case the agent pays on Celo immediately. Only call when the user asked to buy/order or agreed to your recommendation.",
    parameters: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        quantity: { type: "integer", minimum: 1 },
        delivery_state: { type: "string" },
        note: { type: "string" },
      },
      required: ["product_id", "quantity"],
      additionalProperties: false,
    },
    strict: false,
  },
  {
    type: "function" as const,
    name: "list_orders",
    description: "The user's recent orders with status, payment status and transaction hash.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: false,
  },
  {
    type: "function" as const,
    name: "buy_market_report",
    description:
      "Pay $0.01 USDC per request over x402 on Celo mainnet for the premium MarketMate market report (prices + trend + onchain FX). Only use when the user explicitly asks for a paid/premium report.",
    parameters: { type: "object", properties: { product: { type: "string" } }, required: ["product"], additionalProperties: false },
    strict: false,
  },
];

function systemPrompt(ctx: { business: string; city: string; state: string; today: string }) {
  return `You are MarketMate AI, an autonomous procurement agent for African small businesses, starting with Nigeria.
You are working for: ${ctx.business || "a Nigerian business"}${ctx.city || ctx.state ? ` in ${[ctx.city, ctx.state].filter(Boolean).join(", ")}` : ""}. Today is ${ctx.today}.
Tagline: "Your Business. Your Agent. Your Market."

How you work:
1. Understand the request (product, quantity, delivery location). If delivery state is unknown, use the business's state.
2. Call search_suppliers. Compare total landed cost (goods + delivery), reliability and delivery time.
3. Recommend the best option in plain language, say why, and state savings vs the other quotes.
4. When the user wants to proceed, call create_purchase_proposal. Then tell them to tap "Approve & pay" on the card — or, if it was auto-paid under their rule, give the transaction hash.

Hard rules:
- Never invent suppliers, prices, stock, delivery times or ratings. Only use numbers returned by tools. If search returns nothing, say no supplier has listed it yet and suggest inviting suppliers to register on MarketMate.
- Never say a supplier is "verified" unless its verificationStatus is "verified". "pending" means documents submitted but not yet checked; "unverified" means no evidence.
- Reliability for suppliers with no order history is neutral — say so instead of implying they are reliable.
- You cannot move money yourself outside the owner's spending permissions. Never claim a payment happened unless a tool returned a transaction hash.
- Prices are in Naira (₦). Payments settle in USD stablecoins on Celo mainnet, converted at the live rate.
- Be concise: short paragraphs or a compact list. The app shows rich cards for offers and orders, so don't repeat every number.`;
}

type OutputItem =
  | { type: "message"; content?: { type: string; text?: string }[] }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: string };

export async function runAgentTurn(userId: string, text: string, origin: string) {
  const { data: profile } = await supabaseAdmin.from("profiles").select("business_name,city,state").eq("id", userId).maybeSingle();
  const { data: history } = await supabaseAdmin
    .from("chat_messages")
    .select("role,content")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const { error: insErr } = await supabaseAdmin.from("chat_messages").insert({ owner_id: userId, role: "user", content: text });
  if (insErr) throw new Error("Could not save your message");

  const input: ResponsesInputItem[] = [];
  for (const m of (history ?? []).reverse()) {
    if (!m.content) continue;
    if (m.role === "user") input.push({ role: "user", content: m.content } as ResponsesInputItem);
    else input.push({ role: "assistant", content: [{ type: "output_text", text: m.content }] } as ResponsesInputItem);
  }
  input.push({ role: "user", content: text } as ResponsesInputItem);

  const parts: ChatPart[] = [];
  let finalText = "";
  const instructions = systemPrompt({
    business: profile?.business_name ?? "",
    city: profile?.city ?? "",
    state: profile?.state ?? "",
    today: new Date().toDateString(),
  });

  for (let step = 0; step < 7; step++) {
    let response;
    try {
      response = await generateResponse({ model: MODEL, instructions, input, tools });
    } catch (e) {
      if (e instanceof GatewayError) {
        console.error("gateway error", e.code, e.httpStatus, e.ids);
        finalText = e.httpStatus === 402 ? "AI credits are exhausted for this workspace. Please top up and try again." : e.httpStatus === 429 ? "I'm getting too many requests right now — please try again in a minute." : "I couldn't reach the AI service. Please try again.";
      } else {
        console.error(e);
        finalText = "Something went wrong while thinking. Please try again.";
      }
      break;
    }
    const output = ((response as unknown as { output?: OutputItem[] }).output ?? []) as OutputItem[];
    const calls = output.filter((o): o is Extract<OutputItem, { type: "function_call" }> => o.type === "function_call" && "call_id" in o);
    const texts = output
      .filter((o): o is Extract<OutputItem, { type: "message" }> => o.type === "message")
      .flatMap((m) => (m.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? ""));
    if (calls.length === 0) {
      finalText = texts.join("\n").trim();
      break;
    }
    for (const call of calls) {
      input.push({ type: "function_call", call_id: call.call_id, name: call.name, arguments: call.arguments } as ResponsesInputItem);
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.arguments || "{}");
      } catch {
        /* keep empty */
      }
      const result = await runTool(userId, origin, call.name, args, parts);
      input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) } as ResponsesInputItem);
    }
  }

  if (!finalText) finalText = "Done. Check the cards above for details.";
  const { error } = await supabaseAdmin.from("chat_messages").insert({ owner_id: userId, role: "assistant", content: finalText, parts: parts as unknown as never });
  if (error) console.error("assistant save failed", error);
  return { text: finalText, parts };
}

async function runTool(userId: string, origin: string, name: string, args: Record<string, unknown>, parts: ChatPart[]) {
  try {
    switch (name) {
      case "search_suppliers": {
        const query = String(args["query"] ?? "").slice(0, 80);
        const quantity = Math.max(1, Math.min(100000, Math.floor(Number(args["quantity"] ?? 1))));
        const state = args["delivery_state"] ? String(args["delivery_state"]) : undefined;
        const [ranked, fx] = await Promise.all([searchAndRank(query, quantity, state), ngnPerUsd().catch(() => null)]);
        const offers: OfferCard[] = ranked.slice(0, 8).map((r) => ({
          productId: r.productId,
          productName: r.productName,
          unit: r.unit,
          supplierName: r.supplierName,
          supplierCity: r.supplierCity,
          supplierState: r.supplierState,
          verificationStatus: r.verificationStatus,
          unitPriceNgn: r.unitPriceNgn,
          deliveryNgn: r.deliveryNgn,
          totalNgn: r.totalNgn,
          totalUsd: fx ? ngnToUsd(r.totalNgn, fx.rate) : null,
          deliveryDays: r.deliveryDays,
          reliability: r.reliability,
          reliabilityBasis: r.reliabilityBasis,
          score: r.score,
          eligible: r.eligible,
          issues: r.issues,
        }));
        parts.push({ type: "offers", query, quantity, fxRate: fx?.rate ?? null, offers });
        parts.push({ type: "tool", name, input: args, summary: `${ranked.length} listing(s) found`, ok: true });
        return { count: ranked.length, fx, offers };
      }
      case "get_fx_rates": {
        const fx = await fxSnapshot();
        parts.push({ type: "tool", name, input: {}, summary: fx.mento?.["NGN"] ? `1 USDm = ₦${fx.mento["NGN"].rate.toFixed(2)} (Mento onchain)` : "Rates fetched", ok: true });
        return fx;
      }
      case "get_spending_status": {
        const [policy, spent, owner] = await Promise.all([loadPolicy(userId), spentLast24h(userId), isWalletOwner(userId)]);
        parts.push({ type: "tool", name, input: {}, summary: `$${spent.toFixed(2)} of $${policy.daily_limit_usd} spent today`, ok: true });
        return { policy, spentLast24hUsd: spent, canAuthorizePayments: owner };
      }
      case "get_market_trends": {
        const s = await priceStats(args["query"] ? String(args["query"]) : undefined);
        parts.push({ type: "tool", name, input: args, summary: `${s.current.length} price group(s)`, ok: true });
        return s;
      }
      case "create_purchase_proposal": {
        const productId = String(args["product_id"] ?? "");
        const quantity = Math.max(1, Math.floor(Number(args["quantity"] ?? 1)));
        const r = await createProposal({
          userId,
          productId,
          quantity,
          ...(args["delivery_state"] ? { deliveryState: String(args["delivery_state"]) } : {}),
          ...(args["note"] ? { note: String(args["note"]).slice(0, 300) } : {}),
        });
        let autoPaid = false;
        let txHash: string | null = null;
        let payNote: string | null = null;
        if (r.check.allowed) {
          const pay = await executePayment(userId, r.order.id, "autonomous");
          if (pay.ok) {
            autoPaid = true;
            txHash = pay.txHash;
          } else payNote = pay.reason;
        }
        parts.push({
          type: "proposal",
          orderId: r.order.id,
          orderNumber: r.order.order_number,
          autoPaid,
          txHash,
          blocks: r.check.blocks,
          approvalReasons: r.check.approvalReasons,
        });
        parts.push({ type: "tool", name, input: args, summary: autoPaid ? `Auto-paid ${r.order.order_number}` : `Created ${r.order.order_number}`, ok: true });
        return {
          orderNumber: r.order.order_number,
          supplier: r.supplierName,
          totalNgn: r.order.total_ngn,
          totalUsd: r.order.total_usd,
          token: r.order.pay_token,
          savingsNgn: r.order.savings_ngn,
          status: autoPaid ? "paid_autonomously" : "awaiting_owner_approval",
          txHash,
          policyBlocks: r.check.blocks,
          approvalReasons: r.check.approvalReasons,
          autoPayError: payNote,
        };
      }
      case "list_orders": {
        const { data } = await supabaseAdmin
          .from("orders")
          .select("order_number,product_name,quantity,unit,total_ngn,total_usd,pay_token,status,payment_status,tx_hash,created_at,suppliers(business_name)")
          .eq("buyer_id", userId)
          .order("created_at", { ascending: false })
          .limit(10);
        parts.push({ type: "tool", name, input: {}, summary: `${data?.length ?? 0} order(s)`, ok: true });
        return data ?? [];
      }
      case "buy_market_report": {
        const { buyReport } = await import("./x402.server");
        const product = String(args["product"] ?? "rice").slice(0, 60);
        const r = await buyReport(userId, origin, product);
        parts.push({ type: "report", product, txHash: r.txHash, amountUsd: r.amountUsd });
        parts.push({ type: "tool", name, input: args, summary: `Paid $${r.amountUsd} via x402`, ok: true });
        return r.data;
      }
      default:
        return { error: "Unknown tool" };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("tool failed", name, msg);
    parts.push({ type: "tool", name, input: args, summary: msg.slice(0, 160), ok: false });
    return { error: msg.slice(0, 300) };
  }
}
