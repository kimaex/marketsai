import { useState, useRef, useEffect } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { accountData } from "@/lib/app-data";
import { clearAgentChat } from "@/lib/agent.functions";
import { ngn, usd } from "@/lib/format";
import { txUrl } from "@/lib/celo";
import { PageHeader } from "./AppShell";
import { LogoMark } from "./Logo";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import type { ChatPart } from "@/lib/agent.server";

export function AgentChat() {
  const { data: a } = useSuspenseQuery(accountData);
  const qc = useQueryClient();
  const clear = useServerFn(clearAgentChat);
  const [liveText, setLiveText] = useState("");
  const [liveParts, setLiveParts] = useState<ChatPart[]>([]);
  const [text, setText] = useState(""),
    [pending, setPending] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  async function send(value: string) {
    if (pending || !value.trim()) return;
    setPending(value);
    setText("");
    setLiveText("");
    setLiveParts([]);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Please sign in");
      const res = await fetch("/api/public/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({ text: value }),
      });
      if (!res.ok || !res.body) throw new Error("Request failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as {
            text?: string;
            parts?: ChatPart[];
            reset?: boolean;
            error?: string;
            done?: boolean;
          };
          if (event.error) throw new Error(event.error);
          if (event.reset) setLiveText("");
          if (event.text) setLiveText((t) => (event.done ? (event.text ?? t) : t + event.text));
          if (event.parts) setLiveParts(event.parts);
        }
      }
      await qc.invalidateQueries({ queryKey: ["account"] });
    } catch {
      toast.error("The agent could not complete your request. Your message is preserved.");
      setText(value);
    } finally {
      setPending(null);
      input.current?.focus();
    }
  }
  return (
    <>
      <PageHeader
        title="Your procurement agent"
        subtitle="One conversation. Saved to your business account."
        actions={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear conversation"
            onClick={async () => {
              if (window.confirm("Delete this conversation?")) {
                await clear();
                qc.invalidateQueries({ queryKey: ["account"] });
              }
            }}
          >
            <Trash2 />
          </Button>
        }
      />
      <div className="chat-workspace mx-auto flex max-w-4xl flex-col px-4 lg:px-8">
        <Conversation>
          <ConversationContent>
            {!a.messages.length && !pending ? (
              <div className="mx-auto max-w-md py-3 text-center">
                <LogoMark className="mx-auto size-16" />
                <h2 className="mt-5 text-2xl font-bold">Let's source your next purchase.</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  What product, quantity and delivery location do you have in mind?
                </p>
                <div className="mt-6 space-y-2">
                  {[
                    "Find 20 bags of rice for my supermarket in Lagos",
                    "Compare current rice prices",
                    "Show my spending permissions",
                  ].map((t) => (
                    <Button
                      key={t}
                      variant="outline"
                      className="h-auto w-full whitespace-normal py-3 text-left"
                      onClick={() => send(t)}
                    >
                      {t}
                      <ArrowRight />
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              a.messages.map((m) => (
                <Message key={m.id} from={m.role === "user" ? "user" : "assistant"}>
                  <MessageContent>
                    {m.role === "assistant" && (
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
                        <LogoMark className="size-5" />
                        MarketMate AI
                      </div>
                    )}
                    {m.role === "assistant" &&
                      Array.isArray(m.parts) &&
                      (m.parts as unknown as ChatPart[]).map((p, i) => <Part key={i} part={p} />)}
                    <MessageResponse>{m.content}</MessageResponse>
                  </MessageContent>
                </Message>
              ))
            )}
            {pending && (
              <>
                <Message from="user">
                  <MessageContent>{pending}</MessageContent>
                </Message>
                <Message from="assistant">
                  <MessageContent>
                    {liveParts.map((part, i) => (
                      <Part key={i} part={part} />
                    ))}
                    {liveText ? (
                      <MessageResponse>{liveText}</MessageResponse>
                    ) : (
                      <Shimmer>Checking suppliers and your spending permissions…</Shimmer>
                    )}
                  </MessageContent>
                </Message>
              </>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <div className="pb-2 pt-3">
          <PromptInput onSubmit={(m) => send(m.text)}>
            <PromptInputTextarea
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!!pending}
              placeholder="I need 20 bags of rice delivered to Lagos…"
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit
                status={pending ? "submitted" : "ready"}
                disabled={!!pending || !text.trim()}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </>
  );
}
function Part({ part: p }: { part: ChatPart }) {
  if (p.type === "tool")
    return (
      <Tool defaultOpen={false}>
        <ToolHeader
          type="dynamic-tool"
          toolName={p.name}
          title={p.name.replaceAll("_", " ")}
          state={p.ok ? "output-available" : "output-error"}
        />
        <ToolContent>
          <ToolInput input={p.input} />
          <ToolOutput output={p.summary} errorText={p.ok ? undefined : p.summary} />
        </ToolContent>
      </Tool>
    );
  if (p.type === "offers")
    return (
      <div className="my-3 space-y-2">
        {p.offers.map((o, i) => (
          <div className="rounded-lg border p-4" key={o.productId}>
            <div className="flex justify-between gap-3">
              <div>
                <span className="text-xs text-primary">
                  {i === 0 && o.eligible ? "Top ranked" : `Option ${i + 1}`}
                </span>
                <h3 className="font-semibold">{o.supplierName}</h3>
                <p className="text-xs text-muted-foreground">
                  {o.productName} · {o.verificationStatus}
                </p>
              </div>
              <div className="text-right">
                <div className="font-bold">{ngn(o.totalNgn)}</div>
                {o.totalUsd && <p className="text-xs text-muted-foreground">≈ {usd(o.totalUsd)}</p>}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {p.quantity} × {o.unit} · {o.deliveryDays} day delivery · {o.reliabilityBasis}
            </p>
          </div>
        ))}
      </div>
    );
  if (p.type === "proposal")
    return (
      <div className="my-3 rounded-lg border border-primary/30 p-4">
        <h3 className="font-bold">Purchase {p.orderNumber}</h3>
        <p className="mt-1 text-sm">
          {p.autoPaid
            ? "Payment submitted under your autonomous rule."
            : "Review this purchase before authorizing any payment."}
        </p>
        {[...p.blocks, ...p.approvalReasons].map((x) => (
          <p key={x} className="mt-1 text-xs text-warning">
            {x}
          </p>
        ))}
        <Button asChild className="mt-3" size="sm">
          <Link to="/orders">
            Review purchase <ArrowRight />
          </Link>
        </Button>
      </div>
    );
  if (p.type === "report")
    return (
      <div className="my-3 rounded-lg border p-4">
        Market report: {p.product} · {usd(p.amountUsd, 4)}{" "}
        {p.txHash && (
          <a href={txUrl(p.txHash)} target="_blank" rel="noreferrer" className="text-onchain">
            Transaction ↗
          </a>
        )}
      </div>
    );
  return null;
}
