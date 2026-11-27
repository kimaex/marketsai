import { useState } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";
import { accountData } from "@/lib/app-data";
import { supabase } from "@/integrations/supabase/client";
import { isEvmAddress } from "@/lib/celo";
import { PageHeader } from "./AppShell";
import { Orders } from "./Orders";
import { Verification } from "./Marketplace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SupplierPortal() {
  const { data: a } = useSuspenseQuery(accountData);
  const qc = useQueryClient();
  const own = a.suppliers.find((s) => s.owner_id === a.user.id);
  const [tab, setTab] = useState("products");
  const [busy, setBusy] = useState(false);
  async function business(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const wallet = String(f.get("wallet") ?? "");
    if (wallet && !isEvmAddress(wallet)) {
      toast.error("Enter a valid Celo wallet address");
      return;
    }
    setBusy(true);
    const fields = {
      business_name: String(f.get("name")),
      state: String(f.get("state")),
      city: String(f.get("city")),
      payout_wallet: wallet || null,
      cac_number: String(f.get("cac")) || null,
    };
    const r = own
      ? await supabase.from("suppliers").update(fields).eq("id", own.id)
      : await supabase.from("suppliers").insert({ ...fields, owner_id: a.user.id });
    setBusy(false);
    if (r.error) toast.error(r.error.message);
    else {
      toast.success("Business saved");
      qc.invalidateQueries({ queryKey: ["account"] });
    }
  }
  async function product(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!own) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    const r = await supabase
      .from("products")
      .insert({
        supplier_id: own.id,
        name: String(f.get("name")),
        unit: String(f.get("unit")),
        unit_price_ngn: Number(f.get("price")),
        stock_qty: Number(f.get("stock")),
        delivery_fee_ngn: Number(f.get("delivery")),
        delivery_days: Number(f.get("days")),
        min_order_qty: 1,
      });
    setBusy(false);
    if (r.error) toast.error(r.error.message);
    else {
      toast.success("Product listed");
      form.reset();
      qc.invalidateQueries({ queryKey: ["account"] });
    }
  }
  return (
    <>
      <PageHeader
        title="Supplier portal"
        subtitle={own?.business_name ?? "Register your business and start supplying."}
      />
      <div className="space-y-7 px-4 lg:px-8">
        <div className="flex gap-2 border-b pb-3">
          {["products", "orders", "business"].map((t) => (
            <Button key={t} variant={tab === t ? "default" : "ghost"} onClick={() => setTab(t)}>
              {t[0]?.toUpperCase()}
              {t.slice(1)}
            </Button>
          ))}
        </div>
        {!own || tab === "business" ? (
          <form onSubmit={business} className="max-w-2xl space-y-4">
            <div className="flex justify-between">
              <h2 className="text-xl font-bold">Business details</h2>
              {own && <Verification status={own.verification_status} />}
            </div>
            <Field name="name" label="Business name" value={own?.business_name ?? ""} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="state" label="State" value={own?.state ?? ""} />
              <Field name="city" label="City" value={own?.city ?? ""} />
            </div>
            <Field
              name="wallet"
              label="Celo payout wallet"
              value={own?.payout_wallet ?? ""}
              required={false}
            />
            <Field
              name="cac"
              label="CAC registration number (optional)"
              value={own?.cac_number ?? ""}
              required={false}
            />
            <p className="text-xs text-muted-foreground">
              Submitting a CAC number does not verify your business. Verification requires
              independent review.
            </p>
            <Button disabled={busy} type="submit">
              <Save />
              Save business
            </Button>
          </form>
        ) : tab === "orders" ? (
          <Orders supplier />
        ) : (
          <>
            <form onSubmit={product} className="max-w-2xl space-y-4 border-b pb-6">
              <h2 className="text-xl font-bold">List a product</h2>
              <Field name="name" label="Product name" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="unit" label="Unit" value="50kg bag" />
                <Field name="price" label="Price per unit (₦)" type="number" min="0.01" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field name="stock" label="Available inventory" type="number" value="20" min="0" />
                <Field name="delivery" label="Delivery fee (₦)" type="number" value="0" min="0" />
              </div>
              <Field name="days" label="Delivery days" type="number" value="2" min="0" />
              <Button disabled={busy} type="submit">
                <Plus /> List product
              </Button>
            </form>
            <section>
              <h2 className="mb-4 text-xl font-bold">Your inventory</h2>
              {a.products
                .filter((p) => p.supplier_id === own.id)
                .map((p) => (
                  <Inventory
                    key={p.id}
                    product={p}
                    onSave={() => qc.invalidateQueries({ queryKey: ["account"] })}
                  />
                ))}
            </section>
          </>
        )}
      </div>
    </>
  );
}
function Field({
  name,
  label,
  value = "",
  type = "text",
  required = true,
  min,
}: {
  name: string;
  label: string;
  value?: string;
  type?: string;
  required?: boolean;
  min?: string;
}) {
  return (
    <label className="block text-sm">
      {label}
      <Input
        className="mt-2"
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        {...(min ? { min, step: type === "number" ? "any" : undefined } : {})}
      />
    </label>
  );
}
function Inventory({
  product: p,
  onSave,
}: {
  product: { id: string; name: string; stock_qty: number; unit_price_ngn: number };
  onSave: () => unknown;
}) {
  const [price, setPrice] = useState(p.unit_price_ngn),
    [stock, setStock] = useState(p.stock_qty);
  return (
    <form
      className="mb-3 flex flex-wrap items-end gap-3 border-b pb-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await supabase
          .from("products")
          .update({ unit_price_ngn: price, stock_qty: stock })
          .eq("id", p.id);
        if (r.error) toast.error(r.error.message);
        else {
          toast.success("Inventory updated");
          onSave();
        }
      }}
    >
      <h3 className="w-full font-semibold">{p.name}</h3>
      <label className="text-xs text-muted-foreground">
        Unit price
        <Input
          aria-label={`${p.name} price`}
          type="number"
          min="0.01"
          step="any"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
      </label>
      <label className="text-xs text-muted-foreground">
        Stock
        <Input
          aria-label={`${p.name} stock`}
          type="number"
          min="0"
          value={stock}
          onChange={(e) => setStock(Number(e.target.value))}
        />
      </label>
      <Button type="submit" variant="outline">
        <Save /> Update
      </Button>
    </form>
  );
}
