import { createFileRoute } from "@tanstack/react-router";
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader } from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";

// Paid API: aggregated marketplace price intelligence, sold per request over x402 (USDC on Celo mainnet).
export const Route = createFileRoute("/api/public/x402/market-report")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { facilitator, reportRequirements } = await import("@/lib/x402.server");
        const url = new URL(request.url);
        const product = (url.searchParams.get("product") ?? "rice").slice(0, 60);
        let requirements;
        try {
          requirements = reportRequirements();
        } catch {
          return Response.json({ error: "Agent wallet not configured" }, { status: 503 });
        }
        const paymentRequired: PaymentRequired = {
          x402Version: 2,
          error: "Payment required",
          resource: {
            url: `${url.origin}${url.pathname}?product=${encodeURIComponent(product)}`,
            description: `MarketMate market report: ${product} prices across Nigerian suppliers + Mento FX`,
            mimeType: "application/json",
          },
          accepts: [requirements],
        };

        const sig = request.headers.get("PAYMENT-SIGNATURE") ?? request.headers.get("X-PAYMENT");
        if (!sig) {
          return new Response(JSON.stringify(paymentRequired), {
            status: 402,
            headers: {
              "content-type": "application/json",
              "PAYMENT-REQUIRED": encodePaymentRequiredHeader(paymentRequired),
              "cache-control": "no-store",
            },
          });
        }

        const fac = facilitator();
        if (!fac) return Response.json({ error: "x402 facilitator not configured" }, { status: 503 });

        let payload;
        try {
          payload = decodePaymentSignatureHeader(sig);
        } catch {
          return Response.json({ error: "Malformed payment header" }, { status: 400 });
        }
        const verify = await fac.verify(payload, requirements);
        if (!verify.isValid) {
          return Response.json({ error: "Payment invalid", reason: verify.invalidReason ?? null }, { status: 402 });
        }
        const settle = await fac.settle(payload, requirements);
        if (!settle.success) {
          return Response.json({ error: "Settlement failed", reason: settle.errorReason ?? null }, { status: 402 });
        }

        const { buildMarketReport } = await import("@/lib/market.server");
        const report = await buildMarketReport(product);
        return new Response(JSON.stringify({ ...report, payment: { transaction: settle.transaction, network: settle.network } }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "PAYMENT-RESPONSE": encodePaymentResponseHeader(settle),
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
