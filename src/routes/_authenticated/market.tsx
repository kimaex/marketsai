import { createFileRoute } from "@tanstack/react-router";
import { accountData, pageHead } from "@/lib/app-data";
import { MarketIntel } from "@/components/app/MarketIntel";
export const Route = createFileRoute("/_authenticated/market")({
  loader: ({ context }) => context.queryClient.ensureQueryData(accountData),
  head: () => pageHead("Market", "Supplier price comparisons and live African currency quotes."),
  component: MarketIntel,
});
