import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getWalletOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { agentConfigured, agentAccount, getBalances } = await import("./celo.server");
    const { spentLast24h } = await import("./orders.server");
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const { data: ownerExists } = await context.supabase.rpc("wallet_owner_exists");
    const { data: identity } = await context.supabase.from("agent_identity").select("*").maybeSingle();
    const configured = agentConfigured();
    let address: string | null = null;
    let balances: Awaited<ReturnType<typeof getBalances>> | null = null;
    let balanceError: string | null = null;
    if (configured) {
      address = agentAccount().address;
      try {
        balances = await getBalances(address as `0x${string}`);
      } catch (e) {
        console.error("balance read failed", e);
        balanceError = "Could not reach Celo right now";
      }
    }
    return {
      configured,
      address,
      balances,
      balanceError,
      isOwner: (roles ?? []).some((r) => r.role === "wallet_owner"),
      ownerExists: !!ownerExists,
      spent24hUsd: await spentLast24h(context.userId),
      spentX402_24hUsd: await spentLast24h(context.userId, "x402"),
      identity: identity ?? null,
      x402Configured: !!process.env["X402_FACILITATOR_API_KEY"],
    };
  });

export const claimAgentWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("claim_agent_wallet");
    if (error) return { ok: false, reason: "Could not claim the wallet" };
    return { ok: !!data, reason: data ? null : "Wallet ownership must be assigned by the project owner" };
  });

export const registerAgentOnchain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isOwner } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "wallet_owner" });
    if (!isOwner) return { ok: false as const, reason: "Only the agent wallet owner can register the agent" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("agent_identity").select("agent_id").maybeSingle();
    if (existing?.agent_id) return { ok: false as const, reason: `Already registered as agent #${existing.agent_id}` };
    const { registerAgentIdentity, agentAccount } = await import("./celo.server");
    const { ERC8004 } = await import("./celo");
    const origin = new URL(getRequest().url).origin;
    const agentURI = `${origin}/api/public/agent-registration`;
    try {
      const { agentId, hash } = await registerAgentIdentity(agentURI);
      await supabaseAdmin.from("agent_identity").upsert({
        id: 1,
        agent_id: agentId,
        agent_address: agentAccount().address,
        agent_uri: agentURI,
        registry: `eip155:42220:${ERC8004.identityRegistry}`,
        tx_hash: hash,
        registered_at: new Date().toISOString(),
      });
      return { ok: true as const, agentId, txHash: hash };
    } catch (e) {
      console.error("8004 register failed", e);
      const msg = e instanceof Error ? e.message : "";
      return { ok: false as const, reason: msg.includes("AGENT_WALLET_NOT_CONFIGURED") ? "Agent wallet is not set up yet" : "Registration failed — make sure the agent wallet has a little CELO or USDC for gas" };
    }
  });
