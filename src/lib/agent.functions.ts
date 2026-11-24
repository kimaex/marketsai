import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendAgentMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { runAgentTurn } = await import("./agent.server");
    const origin = new URL(getRequest().url).origin;
    const r = await runAgentTurn(context.userId, data.text, origin);
    return { text: r.text, partsJson: JSON.stringify(r.parts) };
  });

export const clearAgentChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.from("chat_messages").delete().eq("owner_id", context.userId);
    return { ok: !error };
  });
