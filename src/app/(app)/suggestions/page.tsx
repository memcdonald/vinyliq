"use client";

import { useState } from "react";
import {
  Sparkles,
  ThumbsUp,
  X,
  ExternalLink,
  Radar,
  Loader2,
  Music,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type StatusFilter = "new" | "interested" | "dismissed";
type SortBy = "combined" | "taste" | "collectability" | "date";

function ScoreBadge({ score, label }: { score: number | null; label: string }) {
  if (score === null) return null;
  const pct = label === "taste" ? Math.round(score * 100) : Math.round(score);
  const max = label === "taste" ? 100 : 100;
  const color =
    pct >= 70
      ? "bg-success/15 text-success"
      : pct >= 40
        ? "bg-acid-halo/15 text-acid-halo"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}>
      {label} {pct}/{max}
    </span>
  );
}

function SuggestionCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex gap-4 p-4">
        <Skeleton className="h-20 w-20 shrink-0 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuggestionsPage() {
  const [filter, setFilter] = useState<StatusFilter>("new");
  const [sortBy, setSortBy] = useState<SortBy>("combined");

  const { data: suggestions, isLoading } = trpc.suggestions.getAll.useQuery({
    status: filter,
    limit: 50,
  });
  const { data: stats } = trpc.suggestions.getStats.useQuery();
  const utils = trpc.useUtils();

  const probeMutation = trpc.suggestions.probe.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Probe complete: ${data.totalDiscovered} new suggestions found`,
      );
      utils.suggestions.getAll.invalidate();
      utils.suggestions.getStats.invalidate();
    },
    onError: (error) => {
      toast.error("Probe failed", { description: error.message });
    },
  });

  const dismissMutation = trpc.suggestions.dismiss.useMutation({
    onSuccess: () => {
      utils.suggestions.getAll.invalidate();
      utils.suggestions.getStats.invalidate();
    },
  });

  const interestedMutation = trpc.suggestions.markInterested.useMutation({
    onSuccess: () => {
      toast.success("Marked as interested");
      utils.suggestions.getAll.invalidate();
      utils.suggestions.getStats.invalidate();
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-sans-display">Suggestions</h1>
            {stats && (
              <p className="text-sm text-muted-foreground">
                {stats.new} new · {stats.interested} interested ·{" "}
                {stats.total} total
              </p>
            )}
          </div>
        </div>
        <Button
          onClick={() => probeMutation.mutate()}
          disabled={probeMutation.isPending}
          size="sm"
        >
          {probeMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Radar className="mr-2 h-4 w-4" />
          )}
          Probe Sources
        </Button>
      </div>

      {/* Filters and sort */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(
            [
              ["new", "New"],
              ["interested", "Interested"],
              ["dismissed", "Dismissed"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={filter === value ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter(value)}
            >
              {label}
              {stats && (
                <span className="ml-1 opacity-60">
                  ({stats[value]})
                </span>
              )}
            </Button>
          ))}
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex gap-1">
          {(
            [
              ["combined", "Best Match"],
              ["taste", "Taste"],
              ["collectability", "Collectability"],
              ["date", "Newest"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={sortBy === value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSortBy(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SuggestionCardSkeleton key={i} />
          ))}
        </div>
      ) : !suggestions || suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Sparkles className="mb-4 h-16 w-16 text-muted-foreground/40" />
          <h2 className="mb-2 text-lg font-semibold">
            {filter === "new" ? "No new suggestions" : `No ${filter} suggestions`}
          </h2>
          <p className="mb-6 max-w-md text-sm text-muted-foreground">
            {filter === "new"
              ? "Hit \"Probe Sources\" to scan your data sources for new releases that match your taste."
              : "Suggestions you mark will appear here."}
          </p>
          {filter === "new" && (
            <Button
              onClick={() => probeMutation.mutate()}
              disabled={probeMutation.isPending}
            >
              {probeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Radar className="mr-2 h-4 w-4" />
              )}
              Probe Sources
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {[...suggestions].sort((a, b) => {
            switch (sortBy) {
              case "taste":
                return (b.tasteScore ?? 0) - (a.tasteScore ?? 0);
              case "collectability":
                return (b.collectabilityScore ?? 0) - (a.collectabilityScore ?? 0);
              case "date":
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              default:
                return (b.combinedScore ?? 0) - (a.combinedScore ?? 0);
            }
          }).map((s) => (
            <Card key={s.id} className="overflow-hidden">
              <CardContent className="flex gap-4 p-4">
                {/* Cover image */}
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                  {s.coverImage ? (
                    <Image
                      src={s.coverImage}
                      alt={s.title}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Music className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col gap-1.5 overflow-hidden">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold leading-tight">
                        {s.title}
                      </h3>
                      <p className="truncate text-sm text-muted-foreground">
                        {s.artistName}
                        {s.labelName && ` · ${s.labelName}`}
                      </p>
                    </div>
                    {s.orderUrl && (
                      <a
                        href={s.orderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
                  </div>

                  {/* Scores */}
                  <div className="flex flex-wrap gap-1.5">
                    <ScoreBadge score={s.collectabilityScore} label="collect" />
                    <ScoreBadge score={s.tasteScore} label="taste" />
                    {s.sourceName && (
                      <Badge variant="outline" className="text-[10px]">
                        {s.sourceName}
                      </Badge>
                    )}
                  </div>

                  {/* AI explanation */}
                  {s.aiExplanation && (
                    <p className="line-clamp-2 text-xs italic text-muted-foreground/80">
                      {s.aiExplanation}
                    </p>
                  )}

                  {/* Actions */}
                  {filter === "new" && (
                    <div className="mt-1 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => interestedMutation.mutate({ id: s.id })}
                        disabled={interestedMutation.isPending}
                      >
                        <ThumbsUp className="mr-1 h-3 w-3" />
                        Interested
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => dismissMutation.mutate({ id: s.id })}
                        disabled={dismissMutation.isPending}
                      >
                        <X className="mr-1 h-3 w-3" />
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
