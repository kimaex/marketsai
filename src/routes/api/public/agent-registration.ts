import { createFileRoute } from "@tanstack/react-router";

// ERC-8004 agent registration file (agentURI target). Public by design: it only describes the agent.
export const Route = createFileRoute("/api/public/agent-registration")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { ERC8004 } = await import("@/lib/celo");
        const { data: id } = await supabaseAdmin.from("agent_identity").select("agent_id,agent_address").maybeSingle();
        const body = {
          type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
          name: "MarketMate AI",
          description:
            "Autonomous procurement agent for African small businesses: finds suppliers, compares landed prices, and pays approved purchases in USD stablecoins on Celo within owner-defined spending permissions.",
          image: `${origin}/favicon.ico`,
          services: [
            { name: "web", endpoint: origin },
            { name: "x402-market-report", endpoint: `${origin}/api/public/x402/market-report` },
          ],
          active: true,
          x402Support: true,
          supportedTrust: ["reputation"],
          ...(id?.agent_address ? { agentWallet: `eip155:42220:${id.agent_address}` } : {}),
          registrations: id?.agent_id
            ? [{ agentId: Number(id.agent_id), agentRegistry: `eip155:42220:${ERC8004.identityRegistry}` }]
            : [],
        };
        return Response.json(body, { headers: { "cache-control": "public, max-age=300" } });
      },
    },
  },
});
