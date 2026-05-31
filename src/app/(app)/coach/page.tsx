"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Dices,
  Send,
  Trash2,
  Loader2,
  Bot,
  User,
  Delete,
  Eraser,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  TILE_COUNT,
  MAN_BASE,
  PIN_BASE,
  SOU_BASE,
  HONOR_BASE,
  emptyHand,
  handSize,
  handToNotation,
  parseHand,
  tileGlyph,
  tileLabel,
} from "@/lib/mahjong/tiles";
import { analyzeHand } from "@/lib/mahjong/shanten";
import { YAKU, LESSONS } from "@/lib/mahjong/yaku";

const SUIT_GROUPS: { label: string; base: number; length: number }[] = [
  { label: "Characters (man)", base: MAN_BASE, length: 9 },
  { label: "Circles (pin)", base: PIN_BASE, length: 9 },
  { label: "Bamboo (sou)", base: SOU_BASE, length: 9 },
  { label: "Honors", base: HONOR_BASE, length: 7 },
];

const EXAMPLE_HANDS: { label: string; notation: string }[] = [
  { label: "Tenpai", notation: "123m456m789m123p9p" },
  { label: "1-shanten", notation: "123m456m789m13p9p9s" },
  { label: "Chiitoitsu", notation: "1199m2288p3377s11z" },
  { label: "Messy 14", notation: "123m456m1234p9s9s9z" },
];

function shantenLabel(shanten: number): string {
  if (shanten < 0) return "Complete hand!";
  if (shanten === 0) return "Tenpai — ready to win";
  if (shanten === 1) return "1-shanten — one away from tenpai";
  return `${shanten}-shanten`;
}

function Tile({
  index,
  onClick,
  title,
  size = "md",
}: {
  index: number;
  onClick?: () => void;
  title?: string;
  size?: "sm" | "md";
}) {
  const isHonor = index >= HONOR_BASE;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? tileLabel(index)}
      disabled={!onClick}
      className={cn(
        "flex items-center justify-center rounded-md border bg-background leading-none transition-colors",
        onClick && "hover:bg-accent hover:border-primary cursor-pointer",
        !onClick && "cursor-default",
        size === "md" ? "h-12 w-9 text-3xl" : "h-9 w-7 text-2xl",
        // Honors get a subtle accent so they read differently from suits.
        isHonor && "text-primary",
      )}
    >
      <span className="-mt-0.5">{tileGlyph(index)}</span>
    </button>
  );
}

export default function CoachPage() {
  const [hand, setHand] = useState<number[]>(() => emptyHand());
  const [notationInput, setNotationInput] = useState("");
  const [input, setInput] = useState("");
  const [optimisticMsg, setOptimisticMsg] = useState<string | null>(null);
  const [optimisticReply, setOptimisticReply] = useState<string | null>(null);
  const [showYaku, setShowYaku] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const notation = useMemo(() => handToNotation(hand), [hand]);
  const size = handSize(hand);
  const analysis = useMemo(() => analyzeHand(hand), [hand]);

  const { data: history, isLoading } = trpc.mahjong.getHistory.useQuery();
  const utils = trpc.useUtils();

  const sendMutation = trpc.mahjong.sendMessage.useMutation({
    onSuccess: (data) => {
      setOptimisticReply(data.content);
      utils.mahjong.getHistory.invalidate().then(() => {
        setOptimisticMsg(null);
        setOptimisticReply(null);
      });
    },
    onError: (error) => {
      toast.error("Failed to reach the coach", { description: error.message });
      setOptimisticMsg(null);
    },
  });

  const clearMutation = trpc.mahjong.clearHistory.useMutation({
    onSuccess: () => {
      toast.success("Coaching history cleared");
      utils.mahjong.getHistory.invalidate();
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, optimisticMsg, optimisticReply]);

  // ----- hand editing -----
  function addTile(index: number) {
    setHand((prev) => {
      if (handSize(prev) >= 14 || prev[index] >= 4) return prev;
      const next = prev.slice();
      next[index] += 1;
      return next;
    });
  }

  function removeTile(index: number) {
    setHand((prev) => {
      if (prev[index] <= 0) return prev;
      const next = prev.slice();
      next[index] -= 1;
      return next;
    });
  }

  function clearHand() {
    setHand(emptyHand());
    setNotationInput("");
  }

  function applyNotation(text: string) {
    setNotationInput(text);
    if (!text.trim()) {
      setHand(emptyHand());
      return;
    }
    try {
      const counts = parseHand(text);
      if (handSize(counts) > 14) {
        toast.error("That's more than 14 tiles");
        return;
      }
      setHand(counts);
    } catch {
      // Ignore while the user is mid-typing; analysis just won't update.
    }
  }

  function loadExample(notationStr: string) {
    setNotationInput(notationStr);
    setHand(parseHand(notationStr));
  }

  const tilesInHand: number[] = [];
  for (let i = 0; i < TILE_COUNT; i++) {
    for (let k = 0; k < hand[i]; k++) tilesInHand.push(i);
  }

  // ----- coach chat -----
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    setOptimisticMsg(trimmed);
    setOptimisticReply(null);
    setInput("");
    sendMutation.mutate({
      message: trimmed,
      hand: notation || undefined,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function askAboutHand() {
    if (!notation) {
      toast.error("Build a hand first");
      return;
    }
    const msg =
      size % 3 === 2
        ? "What should I discard from this hand, and why?"
        : "How should I develop this hand? What am I waiting on?";
    setOptimisticMsg(msg);
    setOptimisticReply(null);
    sendMutation.mutate({ message: msg, hand: notation });
  }

  const sizeHint =
    size === 0
      ? "Tap tiles below to build a hand."
      : size % 3 === 1
        ? "Showing tiles that improve your hand (acceptance)."
        : size % 3 === 2
          ? "Showing ranked discards. Discard the top tile for the widest wait."
          : `${size} tiles — add or remove to reach 13 or 14 for full analysis.`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Dices className="h-7 w-7 text-primary" />
        <div>
          <h1 className="font-sans-display text-2xl font-bold tracking-tight">
            Mahjong Coach
          </h1>
          <p className="text-sm text-muted-foreground">
            Build a Riichi hand, see its shanten and best discards, then ask the
            coach why.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Left column: hand builder + analysis */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Your hand</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {size}/14 tiles
                </span>
              </CardTitle>
              <CardDescription>{sizeHint}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Current hand display */}
              <div className="flex min-h-14 flex-wrap items-center gap-1 rounded-lg border border-dashed bg-muted/30 p-2">
                {tilesInHand.length === 0 ? (
                  <span className="px-2 text-sm text-muted-foreground">
                    No tiles yet — tap the palette below.
                  </span>
                ) : (
                  tilesInHand.map((t, i) => (
                    <Tile
                      key={`${t}-${i}`}
                      index={t}
                      title={`Remove ${tileLabel(t)}`}
                      onClick={() => removeTile(t)}
                    />
                  ))
                )}
              </div>

              {/* Notation input + actions */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={notationInput || notation}
                  onChange={(e) => applyNotation(e.target.value)}
                  placeholder="e.g. 123m456p789s11z"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeTile(tilesInHand[tilesInHand.length - 1])}
                  disabled={tilesInHand.length === 0}
                >
                  <Delete className="mr-1.5 h-3.5 w-3.5" />
                  Undo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearHand}
                  disabled={tilesInHand.length === 0}
                >
                  <Eraser className="mr-1.5 h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>

              {/* Examples */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Examples:</span>
                {EXAMPLE_HANDS.map((ex) => (
                  <Button
                    key={ex.label}
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => loadExample(ex.notation)}
                  >
                    {ex.label}
                  </Button>
                ))}
              </div>

              {/* Tile palette */}
              <div className="flex flex-col gap-3 border-t pt-4">
                {SUIT_GROUPS.map((group) => (
                  <div key={group.label} className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {group.label}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {Array.from({ length: group.length }).map((_, r) => {
                        const idx = group.base + r;
                        const remaining = 4 - hand[idx];
                        return (
                          <div
                            key={idx}
                            className="flex flex-col items-center gap-0.5"
                          >
                            <Tile index={idx} onClick={() => addTile(idx)} />
                            <span
                              className={cn(
                                "text-[10px] tabular-nums",
                                remaining === 0
                                  ? "text-destructive"
                                  : "text-muted-foreground/50",
                              )}
                            >
                              {remaining}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Analysis */}
          {size > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  Analysis
                  <Badge
                    variant={
                      analysis.shanten < 0
                        ? "default"
                        : analysis.shanten === 0
                          ? "acid"
                          : "secondary"
                    }
                  >
                    {shantenLabel(analysis.shanten)}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Computed locally — exact shanten, acceptance, and discard
                  efficiency. No API key needed.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Acceptance for 3n+1 hands */}
                {analysis.acceptance && (
                  <div>
                    <div className="mb-2 text-sm font-medium">
                      Tiles that improve your hand{" "}
                      <span className="text-muted-foreground">
                        ({analysis.acceptance.count} tiles)
                      </span>
                    </div>
                    {analysis.acceptance.tiles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No improving tiles — try a different shape.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {analysis.acceptance.tiles.map((t) => (
                          <Tile key={t} index={t} size="sm" />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Discards for 3n+2 hands */}
                {analysis.discards && (
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-medium">Best discards</div>
                    {analysis.discards.slice(0, 5).map((d, i) => (
                      <div
                        key={d.tile}
                        className={cn(
                          "flex items-center gap-3 rounded-md border p-2",
                          i === 0 && "border-primary/50 bg-primary/5",
                        )}
                      >
                        <Tile index={d.tile} size="sm" />
                        <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                          <span className="font-medium">
                            Discard {d.tileLabel}
                          </span>
                          <span className="text-muted-foreground">
                            → {shantenLabel(d.shanten).toLowerCase()}
                          </span>
                          <span className="text-muted-foreground">
                            accepts <span className="tabular-nums">{d.ukeire}</span>{" "}
                            tiles
                          </span>
                        </div>
                        {i === 0 && <Badge variant="acid">Best</Badge>}
                      </div>
                    ))}
                  </div>
                )}

                <Button onClick={askAboutHand} className="self-start">
                  <Bot className="mr-1.5 h-4 w-4" />
                  Ask the coach about this hand
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Yaku reference */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Yaku reference
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowYaku((v) => !v)}
                >
                  {showYaku ? "Hide" : "Show"}
                </Button>
              </CardTitle>
              <CardDescription>
                You always need at least one yaku to win.
              </CardDescription>
            </CardHeader>
            {showYaku && (
              <CardContent className="flex flex-col gap-2">
                {YAKU.map((y) => (
                  <div
                    key={y.name}
                    className="flex items-start gap-3 border-b pb-2 last:border-0 last:pb-0"
                  >
                    <Badge variant="outline" className="mt-0.5 shrink-0">
                      {y.han} han{y.openPenalty ? "*" : ""}
                    </Badge>
                    <div>
                      <span className="text-sm font-medium">
                        {y.name}{" "}
                        <span className="text-muted-foreground">
                          {y.japanese}
                        </span>
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {y.description}
                      </p>
                    </div>
                  </div>
                ))}
                <p className="pt-1 text-[11px] text-muted-foreground/70">
                  * one han lower when the hand is open.
                </p>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right column: coach chat */}
        <Card className="flex h-[calc(100vh-10rem)] flex-col overflow-hidden lg:sticky lg:top-6">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Coach
              </span>
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
            </CardTitle>
          </CardHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (!history || history.length === 0) && !optimisticMsg ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Bot className="mb-4 h-14 w-14 text-muted-foreground/30" />
                <h2 className="mb-1 text-base font-semibold">
                  Your Riichi coach
                </h2>
                <p className="mb-5 max-w-xs text-sm text-muted-foreground">
                  Build a hand on the left and ask for advice, or just ask a
                  question about rules, yaku, or strategy.
                </p>
                <div className="flex flex-col gap-2">
                  {LESSONS.slice(0, 4).map((l) => (
                    <Button
                      key={l.title}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setInput(`Tell me more: ${l.title}`);
                        inputRef.current?.focus();
                      }}
                    >
                      {l.title}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {(history ?? []).map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2.5",
                      msg.role === "user" ? "justify-end" : "",
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted",
                      )}
                    >
                      {msg.role === "user" && msg.hand && (
                        <div className="mb-1 font-mono text-[11px] opacity-70">
                          {msg.hand}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    {msg.role === "user" && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {optimisticMsg && (
                  <div className="flex justify-end gap-2.5">
                    <div className="max-w-[85%] rounded-lg bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
                      <p className="whitespace-pre-wrap">{optimisticMsg}</p>
                    </div>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                )}
                {optimisticMsg && !optimisticReply && (
                  <div className="flex gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Thinking...
                    </div>
                  </div>
                )}
                {optimisticReply && (
                  <div className="flex gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="max-w-[85%] rounded-lg bg-muted px-3.5 py-2.5 text-sm">
                      <p className="whitespace-pre-wrap">{optimisticReply}</p>
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
            className="flex items-end gap-2 border-t p-3"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your hand, rules, or strategy..."
              rows={1}
              className="flex-1 resize-none rounded-lg border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={!!optimisticMsg}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || !!optimisticMsg}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
