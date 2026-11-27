import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  LayoutDashboard,
  LineChart,
  LogOut,
  Package,
  Settings2,
  Store,
  Truck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo, LogoMark } from "./Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/hooks/use-auth";

const NAV = [
  { to: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { to: "/agent", label: "AI Agent", short: "Agent", icon: Bot },
  { to: "/marketplace", label: "Marketplace", short: "Market", icon: Store },
  { to: "/orders", label: "Orders", short: "Orders", icon: Package },
  { to: "/market", label: "Market intelligence", short: "Prices", icon: LineChart },
  { to: "/supplier", label: "Supplier portal", short: "Supply", icon: Truck },
  { to: "/settings", label: "Wallet & controls", short: "Wallet", icon: Settings2 },
] as const;

const MOBILE = ["/dashboard", "/agent", "/marketplace", "/orders", "/settings"];

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthUser();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { redirect: undefined }, replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="px-5 py-6">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <n.icon className={cn("size-4", active && "text-primary")} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
          <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start px-2"
            onClick={signOut}
          >
            <LogOut /> Sign out
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/dashboard" className="flex items-center gap-2">
          <LogoMark className="size-8" />
          <span className="font-display text-base font-bold">
            MarketMate <span className="text-gradient-primary">AI</span>
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Market intelligence">
            <Link to="/market">
              <LineChart />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Supplier portal">
            <Link to="/supplier">
              <Truck />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut}>
            <LogOut />
          </Button>
        </div>
      </header>

      <main className="pb-24 lg:pb-10 lg:pl-64">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.filter((n) => MOBILE.includes(n.to)).map((n) => {
          const active = pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <n.icon className="size-5" />
              {n.short}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-6 pb-4 sm:flex-row sm:items-end sm:justify-between lg:px-8 lg:pt-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
