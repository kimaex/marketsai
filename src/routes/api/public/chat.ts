import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const Route = createFileRoute("/api/public/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization");
        if (!authorization?.startsWith("Bearer "))
          return new Response("Sign in required", { status: 401 });
        const url = process.env["SUPABASE_URL"],
          key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return new Response("Service unavailable", { status: 503 });
        const client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: authorization } },
        });
        const { data: auth, error } = await client.auth.getUser(authorization.slice(7));
        if (error || !auth.user) return new Response("Sign in required", { status: 401 });
        const parsed = z
          .object({ text: z.string().trim().min(1).max(2000) })
          .safeParse(await request.json());
        if (!parsed.success) return new Response("Invalid message", { status: 400 });
        const { runAgentTurn } = await import("@/lib/agent.server");
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (value: unknown) => {
              try {
                controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
              } catch {
                /* connection closed */
              }
            };
            try {
              const result = await runAgentTurn(
                auth.user.id,
                parsed.data.text,
                new URL(request.url).origin,
                send,
                request.signal,
              );
              send({ done: true, text: result.text, parts: result.parts });
            } catch {
              send({ error: "The request could not finish. Reload to recover saved messages." });
            } finally {
              controller.close();
            }
          },
        });
        return new Response(stream, {
          headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" },
        });
      },
    },
  },
});
