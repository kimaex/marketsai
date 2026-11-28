import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Wallet, Save, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { accountData } from "@/lib/app-data";
import { getWalletOverview, registerAgentOnchain } from "@/lib/wallet.functions";
import { supabase } from "@/integrations/supabase/client";
import { addressUrl, txUrl } from "@/lib/celo";
import { usd } from "@/lib/format";
import { PageHeader } from "./AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function Settings() {
  const { data: a } = useSuspenseQuery(accountData);
  const qc = useQueryClient();
  const walletFn = useServerFn(getWalletOverview),
    register = useServerFn(registerAgentOnchain);
  const { data: w } = useQuery({ queryKey: ["wallet"], queryFn: () => walletFn() });
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const p = await supabase
      .from("spending_policies")
      .upsert({
        owner_id: a.user.id,
        max_per_tx_usd: Number(f.get("per")),
        daily_limit_usd: Number(f.get("daily")),
        approved_tokens: f.getAll("token").map(String),
        approved_supplier_ids: f.getAll("supplier").map(String),
        restrict_to_approved_suppliers: f.has("restricted"),
        autonomous_enabled: f.has("auto"),
        autonomous_max_usd: Number(f.get("autoMax")),
        x402_enabled: f.has("x402"),
        x402_max_per_call_usd: Number(f.get("xmax")),
        x402_daily_limit_usd: Number(f.get("xdaily")),
      });
    setBusy(false);
    if (p.error) toast.error(p.error.message);
    else {
      toast.success("Spending controls saved");
      qc.invalidateQueries({ queryKey: ["account"] });
    }
  }
  return (
    <>
      <PageHeader
        title="Wallet & spending controls"
        subtitle="You decide what your agent can spend."
      />
      <div className="space-y-8 px-4 lg:px-8">
        <section className="border-b pb-6">
          <div className="flex items-center gap-2">
            <Wallet className="text-primary" />
            <h2 className="text-xl font-bold">Agent wallet</h2>
            <Badge variant="onchain">Celo mainnet</Badge>
          </div>
          {w?.address ? (
            <>
              <p className="mt-3 break-all font-mono text-sm">{w.address}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(w.address ?? "");
                    toast.success("Address copied");
                  }}
                >
                  <Copy />
                  Copy
                </Button>
                <Button asChild variant="outline">
                  <a href={addressUrl(w.address)} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    Explorer
                  </a>
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Fund this address with Celo-mainnet USDC and a little CELO for gas. Never send
                tokens on a different network.
              </p>
              <div className="mt-4 flex flex-wrap gap-5">
                {w.balances?.tokens.map((t) => (
                  <div key={t.symbol}>
                    <span className="text-xs text-muted-foreground">{t.symbol}</span>
                    <div className="text-xl font-semibold">{usd(t.balance)}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-warning">
              Not configured. The project owner must add a dedicated agent wallet key in Project
              Settings → Secrets. No funds can be sent yet.
            </p>
          )}
          {w && !w.ownerExists && (
            <p className="mt-4 text-sm text-warning">Wallet ownership has not been assigned. Only the project owner can authorize a business account to spend.</p>
          )}
          {w?.ownerExists && (
            <p className="mt-3 text-xs text-muted-foreground">
              {w.isOwner
                ? "You own this agent wallet."
                : "This agent wallet is owned by another account. You cannot spend its funds."}
            </p>
          )}
        </section>
        <form onSubmit={save} className="max-w-3xl space-y-5">
          <h2 className="text-xl font-bold">Spending permissions</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              name="per"
              label="Maximum per payment (USD)"
              value={a.policy?.max_per_tx_usd ?? 25}
            />
            <NumberField
              name="daily"
              label="Rolling 24-hour spending limit (USD)"
              value={a.policy?.daily_limit_usd ?? 50}
            />
          </div>
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">Approved payment tokens</legend>
            <div className="flex gap-5">
              {["USDC", "USDT", "USDm"].map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="token"
                    value={t}
                    defaultChecked={(a.policy?.approved_tokens ?? ["USDC"]).includes(t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="restricted"
              defaultChecked={a.policy?.restrict_to_approved_suppliers}
            />
            Only pay approved suppliers
          </label>
          <fieldset className="space-y-2">
            <legend className="mb-3 text-sm font-semibold">Approved suppliers</legend>
            {!a.suppliers.length && (
              <p className="text-xs text-muted-foreground">No suppliers registered yet.</p>
            )}
            {a.suppliers.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="supplier"
                  value={s.id}
                  defaultChecked={a.policy?.approved_supplier_ids.includes(s.id)}
                />
                {s.business_name}{" "}
                <span className="text-xs text-muted-foreground">({s.verification_status})</span>
              </label>
            ))}
          </fieldset>
          <section className="space-y-4 border-y py-5">
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" name="auto" defaultChecked={a.policy?.autonomous_enabled} />
              Enable autonomous purchasing
            </label>
            <p className="text-sm text-muted-foreground">
              Only for approved suppliers, approved tokens, and amounts within all limits.
              Otherwise, the agent must ask you first.
            </p>
            <NumberField
              name="autoMax"
              label="Maximum autonomous purchase (USD)"
              value={a.policy?.autonomous_max_usd ?? 0}
            />
          </section>
          <section className="space-y-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="x402" defaultChecked={a.policy?.x402_enabled ?? false} />
              Allow explicitly requested paid API calls (x402)
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                name="xmax"
                label="Maximum per API call (USD)"
                value={a.policy?.x402_max_per_call_usd ?? 0.01}
              />
              <NumberField
                name="xdaily"
                label="API spending per 24 hours (USD)"
                value={a.policy?.x402_daily_limit_usd ?? 0.1}
              />
            </div>
          </section>
          <Button type="submit" disabled={busy}>
            <Save />
            Save permissions
          </Button>
        </form>
        <section className="border-t pt-5">
          <h2 className="text-xl font-bold">ERC-8004 agent identity</h2>
          {w?.identity?.agent_id ? (
            <>
              <p className="mt-2 text-primary">Registered agent #{w.identity.agent_id}</p>
              {w.identity.tx_hash && (
                <a
                  className="text-sm text-onchain"
                  href={txUrl(w.identity.tx_hash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Registration transaction ↗
                </a>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                No independently verified reputation reviews loaded yet.
              </p>
            </>
          ) : (
            <>
              <p className="my-3 text-sm text-muted-foreground">
                Not registered onchain. Registration requires a real transaction and gas funds.
              </p>
              <Button
                variant="outline"
                disabled={!w?.isOwner || !w.configured || busy}
                onClick={async () => {
                  if (!window.confirm("Register the agent on Celo mainnet? This spends real gas."))
                    return;
                  setBusy(true);
                  try {
                    const r = await register();
                    if (r.ok) {
                      toast.success(`Registered agent #${r.agentId}`);
                      qc.invalidateQueries({ queryKey: ["wallet"] });
                    } else toast.error(r.reason);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Register on Celo
              </Button>
            </>
          )}
        </section>
        <ProfileForm />
      </div>
    </>
  );
}
function NumberField({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <label className="block text-sm">
      {label}
      <Input
        className="mt-2"
        name={name}
        type="number"
        min="0"
        step="any"
        defaultValue={value}
        required
      />
    </label>
  );
}
function ProfileForm() {
  const { data: a } = useSuspenseQuery(accountData);
  const qc = useQueryClient();
  return (
    <form
      className="max-w-2xl space-y-4 border-t pt-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const r = await supabase
          .from("profiles")
          .update({
            full_name: String(f.get("name")),
            business_name: String(f.get("business")),
            state: String(f.get("state")),
            city: String(f.get("city")),
            delivery_address: String(f.get("address")),
          })
          .eq("id", a.user.id);
        if (r.error) toast.error(r.error.message);
        else {
          toast.success("Business profile saved");
          qc.invalidateQueries({ queryKey: ["account"] });
        }
      }}
    >
      <h2 className="text-xl font-bold">Business profile</h2>
      {[
        ["name", "Your name", a.profile?.full_name],
        ["business", "Business name", a.profile?.business_name],
        ["state", "Delivery state", a.profile?.state],
        ["city", "City", a.profile?.city],
        ["address", "Delivery address", a.profile?.delivery_address],
      ].map(([name, label, value]) => (
        <label className="block text-sm" key={name}>
          {label}
          <Input className="mt-2" name={name ?? ""} defaultValue={value ?? ""} />
        </label>
      ))}
      <Button type="submit" variant="outline">
        <Save /> Save profile
      </Button>
    </form>
  );
}
