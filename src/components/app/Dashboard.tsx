import { Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpRight,
  ArrowRight,
  Wallet,
  Package,
  TrendingUp,
  ShoppingBag,
  ShieldCheck,
  Store,
  CircleDollarSign,
} from "lucide-react";
import { accountData } from "@/lib/app-data";
import { getWalletOverview } from "@/lib/wallet.functions";
import { ngn, usd, dateTime, ORDER_STATUS_LABEL } from "@/lib/format";
import { txUrl, shortHash } from "@/lib/celo";
import { PageHeader } from "./AppShell";
import { LogoMark } from "./Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Dashboard() {
  const { data: a } = useSuspenseQuery(accountData);
  const walletFn = useServerFn(getWalletOverview);
  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: () => walletFn() });
  const orders = a.orders.filter((o) => o.buyer_id === a.user.id);
  const paid = orders.filter((o) => o.payment_status === "paid");
  const active = orders.filter(
    (o) => !["delivered", "cancelled", "declined", "failed"].includes(o.status),
  );
  const totalBalance = wallet?.balances?.tokens.reduce((v, t) => v + t.balance, 0);
  const stats = [
    {
      icon: Wallet,
      label: "Business wallet",
      value: totalBalance === undefined ? "—" : usd(totalBalance),
      foot: wallet?.configured ? "Celo mainnet · USD stablecoins" : "Wallet not connected",
    },
    {
      icon: ShoppingBag,
      label: "Total purchases",
      value: ngn(paid.reduce((v, o) => v + Number(o.total_ngn), 0)),
      foot: `${paid.length} paid purchase${paid.length === 1 ? "" : "s"}`,
    },
    {
      icon: TrendingUp,
      label: "Money saved",
      value: ngn(paid.reduce((v, o) => v + Number(o.savings_ngn), 0)),
      foot: "Compared with alternative quotes",
    },
    {
      icon: Package,
      label: "Active orders",
      value: String(active.length).padStart(2, "0"),
      foot: `${orders.filter((o) => o.status === "proposed").length} awaiting approval`,
    },
  ];
  return (
    <>
      <PageHeader
        title={`Welcome${a.profile?.full_name ? `, ${a.profile.full_name.split(" ")[0]}` : " to MarketMate"}`}
        subtitle={a.profile?.business_name ?? "Your business, moving forward."}
        actions={
          <>
            <Badge variant="onchain">Celo mainnet</Badge>
            <Button asChild variant="subtle">
              <Link to="/settings">
                <ShieldCheck /> Spending controls
              </Link>
            </Button>
          </>
        }
      />
      <div className="space-y-7 px-4 lg:px-8">
        <section className="agent-band flex flex-col justify-between gap-6 border-y border-primary/20 py-7 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <LogoMark className="size-14 shrink-0" />
            <div>
              <div className="mb-1 text-xs font-semibold text-primary">
                YOUR PROCUREMENT PARTNER
              </div>
              <h2 className="text-2xl font-bold">What does your business need today?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your Business. Your Agent. Your Market.
              </p>
            </div>
          </div>
          <Button asChild variant="hero" size="lg">
            <Link to="/agent">
              Start a procurement <ArrowRight />
            </Link>
          </Button>
        </section>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border bg-card p-5">
              <div className="flex justify-between text-sm text-muted-foreground">
                {s.label}
                <s.icon className="size-4 text-primary" />
              </div>
              <div className="mt-4 font-display text-3xl font-bold">{s.value}</div>
              <p className="mt-2 text-xs text-muted-foreground">{s.foot}</p>
            </div>
          ))}
        </div>
        {!a.suppliers.length && (
          <section className="flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Your market starts with real suppliers</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                No supplier listings yet. Invite a supplier to register their business and products.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/supplier">
                <Store /> Register a supplier
              </Link>
            </Button>
          </section>
        )}
        <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Recent orders</h2>
              <Button asChild variant="link" size="sm">
                <Link to="/orders">
                  View all <ArrowUpRight />
                </Link>
              </Button>
            </div>
            {!orders.length ? (
              <Empty
                icon={Package}
                title="No purchases yet"
                text="Your purchase requests and delivery updates will appear here."
              />
            ) : (
              <div className="divide-y">
                {orders.slice(0, 5).map((o) => (
                  <Link
                    key={o.id}
                    to="/orders"
                    className="flex items-center justify-between gap-3 py-4"
                  >
                    <div>
                      <div className="font-semibold">{o.product_name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {o.order_number} · {o.quantity} × {o.unit}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{ngn(o.total_ngn)}</div>
                      <div className="mt-1 text-xs text-primary">
                        {ORDER_STATUS_LABEL[o.status]}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Onchain activity</h2>
              <Badge variant="onchain">Verifiable</Badge>
            </div>
            {!a.transactions.length ? (
              <Empty
                icon={CircleDollarSign}
                title="No transactions yet"
                text="Only real transactions appear here. No simulated payments."
              />
            ) : (
              <div className="divide-y">
                {a.transactions.slice(0, 5).map((t) => (
                  <div key={t.id} className="py-3">
                    <div className="flex justify-between text-sm">
                      <span>{t.kind === "x402" ? "Paid API request" : "Supplier payment"}</span>
                      <span>
                        {usd(t.amount_usd)} {t.token}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>{dateTime(t.created_at)}</span>
                      {t.tx_hash ? (
                        <a
                          href={txUrl(t.tx_hash)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-onchain"
                        >
                          {shortHash(t.tx_hash)} ↗
                        </a>
                      ) : (
                        <span>{t.status}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
export function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Package;
  title: string;
  text: string;
}) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center border-y border-dashed py-8 text-center">
      <Icon className="mb-3 size-7 text-muted-foreground" />
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
