import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const accountData = queryOptions({
  queryKey: ["account"],
  queryFn: async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw new Error("Please sign in");
    const [profile, policy, orders, suppliers, products, messages, transactions] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
        supabase.from("spending_policies").select("*").eq("owner_id", auth.user.id).maybeSingle(),
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("suppliers").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false }).limit(500),
        supabase
          .from("chat_messages")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("wallet_transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
    for (const r of [profile, policy, orders, suppliers, products, messages, transactions])
      if (r.error) throw new Error(r.error.message);
    return {
      user: auth.user,
      profile: profile.data,
      policy: policy.data,
      orders: orders.data ?? [],
      suppliers: suppliers.data ?? [],
      products: products.data ?? [],
      messages: (messages.data ?? []).reverse(),
      transactions: transactions.data ?? [],
    };
  },
});
export function pageHead(title: string, description: string) {
  return {
    meta: [
      { title: `${title} — MarketMate AI` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} — MarketMate AI` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
