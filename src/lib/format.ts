export const ngn = (v: number | string | null | undefined) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(
    Number(v ?? 0),
  );
export const usd = (v: number | string | null | undefined, digits = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: Math.max(digits, 2),
  }).format(Number(v ?? 0));
export const num = (v: number | string | null | undefined, digits = 2) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(Number(v ?? 0));
export const dateTime = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";

export const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT Abuja","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara",
];

export const ORDER_STATUS_LABEL: Record<string, string> = {
  proposed: "Awaiting approval",
  paying: "Paying onchain",
  paid: "Paid — awaiting supplier",
  confirmed: "Confirmed by supplier",
  shipped: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  declined: "Declined by supplier",
  failed: "Payment failed",
};
