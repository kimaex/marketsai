import { createFileRoute } from "@tanstack/react-router";
import { accountData, pageHead } from "@/lib/app-data";
import { Dashboard } from "@/components/app/Dashboard";
export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(accountData),
  head: () =>
    pageHead("Dashboard", "Your business wallet, procurement activity and order overview."),
  component: Dashboard,
});
