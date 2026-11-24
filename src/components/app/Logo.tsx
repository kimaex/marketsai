import { cn } from "@/lib/utils";

/** MarketMate mark: a market basket whose handle is an agent "signal" arc. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden="true">
      <defs>
        <linearGradient id="mm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--primary-glow)" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#mm-g)" />
      <path d="M12 17h16l-1.8 11.2a2 2 0 0 1-2 1.8h-8.4a2 2 0 0 1-2-1.8L12 17Z" fill="var(--primary-foreground)" />
      <path d="M14.5 15.5a5.5 5.5 0 0 1 11 0" fill="none" stroke="var(--primary-foreground)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="20" cy="10" r="2" fill="var(--onchain)" />
      <path d="M17 21.5v4M20 21.5v4M23 21.5v4" stroke="url(#mm-g)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-lg font-bold tracking-tight">
            MarketMate <span className="text-gradient-primary">AI</span>
          </div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Procurement agent</div>
        </div>
      )}
    </div>
  );
}
