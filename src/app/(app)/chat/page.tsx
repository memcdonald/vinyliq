"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, Trash2, Loader2, Bot, User } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: history, isLoading } = trpc.chat.getHistory.useQuery();
  const utils = trpc.useUtils();

  const sendMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setInput("");
      utils.chat.getHistory.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to send message", { description: error.message });
    },
  });

  const clearMutation = trpc.chat.clearHistory.useMutation({
    onSuccess: () => {
      toast.success("Chat cleared");
      utils.chat.getHistory.invalidate();
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate({ message: trimmed });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b py-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
            <p className="text-sm text-muted-foreground">
              Ask about vinyl, get personalized advice
            </p>
          </div>
        </div>
        {history && history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={cn("flex gap-3", i % 2 === 0 ? "justify-end" : "")}>
                <Skeleton className="h-16 w-3/4 rounded-lg" />
              </div>
            ))}
          </div>
        ) : !history || history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Bot className="mb-4 h-16 w-16 text-muted-foreground/40" />
            <h2 className="mb-2 text-lg font-semibold">
              Your vinyl advisor
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Ask me anything about vinyl collecting, album recommendations,
              pressing quality, market trends, or building your collection.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {[
                "What should I collect next?",
                "Tell me about Japanese pressings",
                "How do I spot a good pressing?",
              ].map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setInput(q);
                    inputRef.current?.focus();
                  }}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "",
                )}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-3 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            {sendMutation.isPending && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t py-4"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about vinyl..."
          rows={1}
          className="flex-1 resize-none rounded-lg border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={sendMutation.isPending}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || sendMutation.isPending}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
