import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/app/Logo";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => search.parse(s),
  head: () => ({
    meta: [
      { title: "Sign in — MarketMate AI" },
      { name: "description", content: "Sign in to your MarketMate AI procurement agent." },
      { property: "og:title", content: "Sign in — MarketMate AI" },
      { property: "og:description", content: "Sign in to your MarketMate AI procurement agent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safePath(p?: string) {
  if (!p) return "/dashboard";
  try {
    const u = new URL(p, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

function GoogleG() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
  );
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [business, setBusiness] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: safePath(redirect) as "/dashboard", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((e, session) => {
      if (e === "SIGNED_IN" && session) navigate({ to: safePath(redirect) as "/dashboard", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: fullName, business_name: business } },
        });
        if (error) throw error;
        if (!data.session) setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "lovable") {
    sessionStorage.setItem("mm_after_login", safePath(redirect));
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Sign-in failed. Please try again.");
  }

  return (
    <div className="grid min-h-screen bg-hero lg:grid-cols-2">
      <div className="hidden flex-col justify-between p-10 lg:flex">
        <Logo />
        <div>
          <h2 className="max-w-md text-4xl font-extrabold leading-tight">
            Your Business. Your Agent. <span className="text-gradient-primary">Your Market.</span>
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Tell the agent what you need. It finds suppliers, compares landed prices, and pays in dollar stablecoins on Celo — only within the limits you set.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Payments settle on Celo mainnet · Verifiable on Celoscan</p>
      </div>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          {sent ? (
            <div className="rounded-2xl border bg-card p-6">
              <h1 className="text-xl font-bold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">We sent a confirmation link to {email}. Open it to activate your account.</p>
              <Button variant="subtle" className="mt-4 w-full" onClick={() => { setSent(false); setMode("signin"); }}>Back to sign in</Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{mode === "signin" ? "Welcome back" : "Create your business account"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{mode === "signin" ? "Sign in to your procurement agent." : "Buyers and suppliers use the same account."}</p>
              <div className="mt-6 grid gap-2">
                <Button type="button" variant="subtle" className="h-11" onClick={() => oauth("google")}><GoogleG /> Continue with Google</Button>
                <Button type="button" variant="subtle" className="h-11" onClick={() => oauth("lovable")}><LovableMark /> Continue with Lovable</Button>
              </div>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
              <form onSubmit={submit} className="space-y-3">
                {mode === "signup" && (
                  <>
                    <div className="space-y-1.5"><Label htmlFor="fn">Your name</Label><Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Amaka Okafor" required /></div>
                    <div className="space-y-1.5"><Label htmlFor="bn">Business name</Label><Input id="bn" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Okafor Family Supermarket" required /></div>
                  </>
                )}
                <div className="space-y-1.5"><Label htmlFor="em">Email</Label><Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
                <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} /></div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</Button>
              </form>
              <p className="mt-5 text-center text-sm text-muted-foreground">
                {mode === "signin" ? "New to MarketMate?" : "Already have an account?"}{" "}
                <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                  {mode === "signin" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
