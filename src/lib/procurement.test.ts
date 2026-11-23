import { describe, expect, it } from "vitest";
import { canSupplierMove, checkPayment, ngnToUsd, rankOffers, savingsVsAlternatives, type OfferInput, type SpendingPolicy } from "./procurement";

const policy: SpendingPolicy = {
  max_per_tx_usd: 25,
  daily_limit_usd: 50,
  restrict_to_approved_suppliers: false,
  approved_supplier_ids: ["sup-a"],
  approved_tokens: ["USDC"],
  autonomous_enabled: false,
  autonomous_max_usd: 0,
};

describe("spending permissions", () => {
  it("blocks a payment above the per-transaction limit", () => {
    const r = checkPayment({ policy, amountUsd: 25.01, supplierId: "sup-a", token: "USDC", spentLast24hUsd: 0, mode: "owner" });
    expect(r.allowed).toBe(false);
  });
  it("blocks a payment that would exceed the daily limit", () => {
    const r = checkPayment({ policy, amountUsd: 20, supplierId: "sup-a", token: "USDC", spentLast24hUsd: 31, mode: "owner" });
    expect(r.allowed).toBe(false);
  });
  it("allows an owner-approved payment within limits", () => {
    const r = checkPayment({ policy, amountUsd: 20, supplierId: "sup-b", token: "USDC", spentLast24hUsd: 30, mode: "owner" });
    expect(r.allowed).toBe(true);
  });
  it("blocks tokens the owner has not approved", () => {
    const r = checkPayment({ policy, amountUsd: 5, supplierId: "sup-a", token: "USDT", spentLast24hUsd: 0, mode: "owner" });
    expect(r.allowed).toBe(false);
  });
  it("blocks unapproved suppliers when the owner restricts to the approved list", () => {
    const r = checkPayment({ policy: { ...policy, restrict_to_approved_suppliers: true }, amountUsd: 5, supplierId: "sup-b", token: "USDC", spentLast24hUsd: 0, mode: "owner" });
    expect(r.allowed).toBe(false);
  });
  it("requires owner approval when autonomous purchasing is off", () => {
    const r = checkPayment({ policy, amountUsd: 5, supplierId: "sup-a", token: "USDC", spentLast24hUsd: 0, mode: "autonomous" });
    expect(r.needsOwnerApproval).toBe(true);
    expect(r.allowed).toBe(false);
  });
  it("lets the agent pay alone only for approved suppliers under the autonomous limit", () => {
    const auto = { ...policy, autonomous_enabled: true, autonomous_max_usd: 10 };
    expect(checkPayment({ policy: auto, amountUsd: 9, supplierId: "sup-a", token: "USDC", spentLast24hUsd: 0, mode: "autonomous" }).allowed).toBe(true);
    expect(checkPayment({ policy: auto, amountUsd: 11, supplierId: "sup-a", token: "USDC", spentLast24hUsd: 0, mode: "autonomous" }).allowed).toBe(false);
    expect(checkPayment({ policy: auto, amountUsd: 9, supplierId: "sup-b", token: "USDC", spentLast24hUsd: 0, mode: "autonomous" }).allowed).toBe(false);
  });
});

const base: OfferInput = {
  productId: "p1", productName: "Rice", unit: "50kg bag", category: "Grains", unitPriceNgn: 80000, stockQty: 100, minOrderQty: 1,
  deliveryFeeNgn: 10000, deliveryFeePerUnitNgn: 0, deliveryDays: 2, deliversTo: [], supplierId: "s1", supplierName: "A",
  supplierState: "Lagos", supplierCity: "Ikeja", verificationStatus: "unverified", hasPayoutWallet: true,
  stats: { deliveredOrders: 0, onTimeDeliveries: 0, cancelledOrDeclined: 0, totalOrders: 0 },
};

describe("supplier ranking", () => {
  it("includes delivery cost in the total", () => {
    const [o] = rankOffers([{ ...base, deliveryFeePerUnitNgn: 500 }], 20);
    expect(o?.totalNgn).toBe(80000 * 20 + 10000 + 500 * 20);
  });
  it("ranks the cheaper of two otherwise equal suppliers first", () => {
    const r = rankOffers([{ ...base, productId: "exp", unitPriceNgn: 90000 }, { ...base, productId: "cheap", unitPriceNgn: 78000 }], 20);
    expect(r[0]?.productId).toBe("cheap");
  });
  it("puts suppliers without enough stock last", () => {
    const r = rankOffers([{ ...base, productId: "low", unitPriceNgn: 50000, stockQty: 5 }, { ...base, productId: "ok" }], 20);
    expect(r[0]?.productId).toBe("ok");
    expect(r[1]?.eligible).toBe(false);
  });
});

describe("money", () => {
  it("rounds naira to dollars up to the cent", () => {
    expect(ngnToUsd(10000, 1353.55)).toBe(7.39);
  });
  it("reports savings against the average of other quotes", () => {
    expect(savingsVsAlternatives(1_600_000, [1_700_000, 1_800_000])).toBe(150_000);
    expect(savingsVsAlternatives(1_600_000, [])).toBe(0);
  });
  it("only lets suppliers move orders forward after payment", () => {
    expect(canSupplierMove("proposed", "confirmed")).toBe(false);
    expect(canSupplierMove("paid", "confirmed")).toBe(true);
    expect(canSupplierMove("confirmed", "delivered")).toBe(false);
  });
});
