import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Bot, Coins, LineChart, ShieldCheck, Truck } from "lucide-react";
import hero from "@/assets/hero-market.jpg";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MarketMate AI — Autonomous procurement agent for African businesses" },
      { name: "description", content: "Tell MarketMate what your shop needs. It finds suppliers, compares landed prices, and pays in dollar stablecoins on Celo within your limits." },
      { property: "og:title", content: "MarketMate AI — Your Business. Your Agent. Your Market." },
      { property: "og:description", content: "An AI procurement agent that sources, compares and pays Nigerian suppliers on Celo mainnet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const STEPS = [
  { icon: Bot, title: "Ask in plain words", body: "“I need 20 bags of rice for my supermarket in Lagos.”" },
  { icon: LineChart, title: "Agent compares", body: "Goods + delivery, real order history and delivery time — ranked, no invented prices." },
  { icon: ShieldCheck, title: "You approve", body: "Per-transaction and daily limits, approved suppliers and tokens. Nothing moves without permission." },
  { icon: Coins, title: "Paid on Celo", body: "USDC, USDT or USDm sent onchain to the supplier. Every hash links to Celoscan." },
  { icon: Truck, title: "Tracked to your door", body: "Supplier confirms, dispatches and delivers — the order timeline updates live." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <div className="flex gap-2">
          <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link to="/auth" search={{ redirect: undefined }}>Sign in</Link></Button>
          <Button asChild variant="hero"><Link to="/auth" search={{ redirect: undefined }}>Get started</Link></Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-6 pb-16 lg:grid-cols-[1.1fr_1fr] lg:pt-14">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-onchain/30 bg-onchain/10 px-3 py-1 text-xs font-semibold text-onchain">
            <span className="size-1.5 rounded-full bg-onchain" /> Live on Celo mainnet · Nigeria first
          </div>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            Your Business.<br />Your Agent.<br /><span className="text-gradient-primary">Your Market.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            MarketMate is an AI procurement agent for African shops and wholesalers. It finds suppliers, compares landed prices, and pays them in dollar stablecoins — only within the spending permissions you set.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg"><Link to="/auth" search={{ redirect: undefined }}>Start procuring <ArrowRight /></Link></Button>
            <Button asChild variant="subtle" size="lg"><Link to="/auth" search={{ redirect: undefined }}>I'm a supplier</Link></Button>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><BadgeCheck className="size-4 text-primary" /> x402 pay-per-request data</span>
            <span className="flex items-center gap-2"><BadgeCheck className="size-4 text-primary" /> ERC-8004 agent identity</span>
            <span className="flex items-center gap-2"><BadgeCheck className="size-4 text-primary" /> Mento onchain FX</span>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 rounded-[2rem] bg-gradient-primary opacity-20 blur-3xl" aria-hidden />
          <img src={hero} width={1280} height={1024} alt="Supermarket owner in Lagos reviewing a purchase on her phone" className="relative aspect-[5/4] w-full rounded-3xl border object-cover shadow-card" />
          <div className="absolute -bottom-5 left-4 right-4 rounded-2xl border bg-popover/95 p-4 shadow-card backdrop-blur sm:left-auto sm:w-72">
            <div className="text-xs text-muted-foreground">Agent recommendation</div>
            <div className="mt-1 font-display font-bold">20 × 50kg rice · best landed price</div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Awaiting your approval</span>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">USDC</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="text-2xl font-bold sm:text-3xl">One job, done end to end</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-2xl border bg-gradient-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <s.icon className="size-5 text-primary" />
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              </div>
              <div className="mt-4 font-display font-bold">{s.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">MarketMate AI · Built on Celo</footer>
    </div>
  );
}
