"use client";

import { useState, useMemo } from "react";
import {
  CalendarClock,
  RefreshCw,
  Rss,
  Search,
  Heart,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FunkySpinner } from "@/components/ui/funky-spinner";
import { AddReleaseDialog } from "@/components/add-release-dialog";
import { ManageSourcesSheet } from "@/components/manage-sources-sheet";
import { CsvImportDialog } from "@/components/csv-import-dialog";

type SortBy = "date" | "collectability" | "title" | "artist";
type StatusFilter = "upcoming" | "released" | "archived" | undefined;

function ScoreCell({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <span className="text-muted-foreground">--</span>;
  const val = Math.round(score);
  const color =
    val >= 7
      ? "text-success"
      : val >= 4
        ? "text-acid-halo"
        : "text-muted-foreground";
  return <span className={`font-semibold tabular-nums ${color}`}>{val}/10</span>;
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

export default function ReleasesPage() {
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("upcoming");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = trpc.releases.getUpcoming.useQuery({
    status: statusFilter,
    sortBy,
    sortOrder: sortBy === "collectability" ? "desc" : "desc",
  });

  const fetchAllMutation = trpc.releases.fetchAllSources.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.totalAdded > 0
          ? `Found ${result.totalAdded} new releases`
          : "No new releases found",
      );
    },
    onError: (error) => {
      toast.error("Failed to refresh sources", { description: error.message });
    },
  });

  const utils = trpc.useUtils();

  const addMutation = trpc.collection.add.useMutation({
    onSuccess: (_, vars) => {
      toast.success(`Added to wantlist`);
      utils.collection.getAll.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to add to wantlist", { description: error.message });
    },
  });

  function handleRefresh() {
    fetchAllMutation.mutate(undefined, {
      onSettled: () => {
        utils.releases.getUpcoming.invalidate();
      },
    });
  }

  const items = useMemo(() => {
    const all = data?.items ?? [];
    if (!searchQuery.trim()) return all;
    const q = searchQuery.toLowerCase();
    return all.filter(
      (item) =>
        item.artistName.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q),
    );
  }, [data?.items, searchQuery]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-sans-display">Upcoming Releases</h1>
            {!isLoading && (
              <p className="text-sm text-muted-foreground">
                {items.length} {items.length === 1 ? "release" : "releases"}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddReleaseDialog />
          <CsvImportDialog />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={fetchAllMutation.isPending}
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${fetchAllMutation.isPending ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <ManageSourcesSheet />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {([
            ["upcoming", "Upcoming"],
            ["released", "Released"],
            ["archived", "Archived"],
            [undefined, "All"],
          ] as const).map(([value, label]) => (
            <Button
              key={label}
              variant={statusFilter === value ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setStatusFilter(value as StatusFilter)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex gap-1">
          {([
            ["date", "Date"],
            ["collectability", "Collectability"],
            ["title", "Title"],
            ["artist", "Artist"],
          ] as const).map(([value, label]) => (
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
        <div className="relative ml-auto w-full sm:w-48">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search releases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {isLoading ? (
        <>
          <FunkySpinner className="py-8" />
          <TableSkeleton />
        </>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Rss className="mb-4 h-16 w-16 text-muted-foreground/40" />
          <h2 className="mb-2 text-lg font-semibold">No releases yet</h2>
          <p className="mb-6 max-w-md text-sm text-muted-foreground">
            Add RSS feeds, URLs, or manual entries to track upcoming vinyl releases.
          </p>
          <div className="flex gap-2">
            <AddReleaseDialog />
            <ManageSourcesSheet />
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="whitespace-nowrap px-4 py-2.5 font-medium">Score</th>
                <th className="px-4 py-2.5 font-medium">Artist</th>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Label</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Date</th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Details</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => {
                const formattedDate = item.releaseDate
                  ? new Date(item.releaseDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : null;

                return (
                  <tr key={item.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <ScoreCell score={item.collectabilityScore} />
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3 font-medium">
                      {item.artistName}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3">
                      {item.title}
                    </td>
                    <td className="hidden max-w-[120px] truncate px-4 py-3 text-muted-foreground sm:table-cell">
                      {item.labelName ?? "--"}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground md:table-cell">
                      {formattedDate ?? "--"}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {item.pressRun && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {item.pressRun} copies
                          </span>
                        )}
                        {item.coloredVinyl && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                            Color
                          </span>
                        )}
                        {item.sourceName && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {item.sourceName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Add to wantlist"
                          onClick={() =>
                            addMutation.mutate({
                              discogsId: 0,
                              title: item.title,
                              status: "wanted",
                            })
                          }
                          disabled={addMutation.isPending}
                        >
                          <Heart className="h-3.5 w-3.5" />
                        </Button>
                        {item.orderUrl && (
                          <a
                            href={item.orderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Order">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
