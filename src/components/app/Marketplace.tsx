import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Store, Search, MapPin, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { accountData } from "@/lib/app-data";
import { searchOffers, createOrderFromOffer } from "@/lib/market.functions";
import { ngn, usd } from "@/lib/format";
import { PageHeader } from "./AppShell";
import { Empty } from "./Dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { RankedOffer } from "@/lib/procurement";

export function Marketplace() {
  const { data: a } = useSuspenseQuery(accountData);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [quantity, setQuantity] = useState(20);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<RankedOffer[] | null>(null);
  const [fx, setFx] = useState<number | null>(null);
  const search = useServerFn(searchOffers),
    propose = useServerFn(createOrderFromOffer);
  async function compare() {
    setBusy(true);
    try {
      const r = await search({
        data: { query, quantity, ...(a.profile?.state ? { state: a.profile.state } : {}) },
      });
      setResults(r.offers);
      setFx(r.fx?.rate ?? null);
    } catch {
      toast.error("Could not compare suppliers");
    } finally {
      setBusy(false);
    }
  }
  async function order(id: string) {
    setBusy(true);
    try {
      const r = await propose({
        data: { productId: id, quantity, ...(a.profile?.state ? { state: a.profile.state } : {}) },
      });
      if (r.ok) {
        toast.success("Purchase proposed — review it before paying");
        navigate({ to: "/orders" });
      } else toast.error(r.reason);
    } finally {
      setBusy(false);
    }
  }
  const products = a.products.filter((p) =>
    `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Supplier marketplace"
        subtitle={`${a.suppliers.length} businesses · ${a.products.length} live listings · Nigeria`}
      />
      <div className="space-y-6 px-4 lg:px-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            compare();
          }}
          className="flex flex-wrap items-end gap-3 border-b pb-5"
        >
          <label className="min-w-44 flex-1 text-xs text-muted-foreground">
            Product
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setResults(null);
              }}
              placeholder="Search rice, oil, flour…"
              className="mt-2"
            />
          </label>
          <label className="w-24 text-xs text-muted-foreground">
            Quantity
            <Input
              type="number"
              min={1}
              max={100000}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="mt-2"
            />
          </label>
          <Button disabled={busy} type="submit">
            <Search /> {busy ? "Comparing…" : "Compare prices"}
          </Button>
        </form>
        {!a.products.length ? (
          <Empty
            icon={Store}
            title="The market is ready for suppliers"
            text="Only real supplier listings appear here. Register a supplier business to add products."
          />
        ) : results ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.map((r, i) => (
              <article key={r.productId} className="rounded-lg border bg-card p-5">
                <div className="flex justify-between gap-2">
                  <Badge variant={i === 0 && r.eligible ? "success" : "muted"}>
                    {i === 0 && r.eligible ? "Top ranked" : `Rank ${i + 1}`}
                  </Badge>
                  <Verification status={r.verificationStatus} />
                </div>
                <h2 className="mt-4 text-xl font-bold">{r.productName}</h2>
                <div className="mt-1 text-sm">{r.supplierName}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  {r.supplierCity}, {r.supplierState}
                </div>
                <div className="mt-5 font-display text-2xl font-bold">{ngn(r.totalNgn)}</div>
                <p className="text-xs text-muted-foreground">
                  {quantity} × {r.unit} · delivery {ngn(r.deliveryNgn)} included
                </p>
                {fx && (
                  <p className="mt-1 text-sm text-primary">
                    ≈ {usd(r.totalNgn / fx)} USD stablecoins
                  </p>
                )}
                <div className="mt-4 flex justify-between text-sm">
                  <span>{r.deliveryDays} day delivery</span>
                  <span>{r.score}/100 score</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{r.reliabilityBasis}</p>
                {r.issues.map((x) => (
                  <p className="mt-2 text-xs text-warning" key={x}>
                    {x}
                  </p>
                ))}
                <Button
                  className="mt-5 w-full"
                  disabled={busy || !r.eligible}
                  onClick={() => order(r.productId)}
                >
                  Review purchase <ArrowRight />
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((p) => {
              const s = a.suppliers.find((s) => s.id === p.supplier_id);
              return (
                <article className="rounded-lg border bg-card p-5" key={p.id}>
                  <div className="flex justify-between">
                    <Badge variant="muted">{p.category}</Badge>
                    <Verification status={s?.verification_status ?? "unverified"} />
                  </div>
                  <h2 className="mt-4 text-xl font-bold">{p.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {s?.business_name} · {s?.city}
                  </p>
                  <div className="mt-5 text-2xl font-bold">
                    {ngn(p.unit_price_ngn)}
                    <span className="text-xs font-normal text-muted-foreground"> / {p.unit}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {p.stock_qty} available · minimum {p.min_order_qty} · {p.delivery_days} day
                    delivery
                  </p>
                  <Button
                    variant="outline"
                    className="mt-5 w-full"
                    disabled={busy}
                    onClick={() => order(p.id)}
                  >
                    Request {quantity} units
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
export function Verification({ status }: { status: string }) {
  return (
    <Badge variant={status === "verified" ? "success" : status === "pending" ? "warning" : "muted"}>
      {status === "verified"
        ? "Verified"
        : status === "pending"
          ? "Verification pending"
          : "Unverified"}
    </Badge>
  );
}
