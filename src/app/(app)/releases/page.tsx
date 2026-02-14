"use client";

import { useState } from "react";
import { CalendarClock, RefreshCw, Rss } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { ReleaseCard } from "@/components/release-card";
import { AddReleaseDialog } from "@/components/add-release-dialog";
import { ManageSourcesSheet } from "@/components/manage-sources-sheet";
import { CsvImportDialog } from "@/components/csv-import-dialog";

type SortBy = "date" | "collectability" | "title";
type StatusFilter = "upcoming" | "released" | "archived" | undefined;

function ReleasesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <Card key={i} className="overflow-hidden py-0">
          <Skeleton className="aspect-square w-full" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function ReleasesPage() {
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("upcoming");

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

  function handleRefresh() {
    fetchAllMutation.mutate(undefined, {
      onSettled: () => {
        utils.releases.getUpcoming.invalidate();
      },
    });
  }

  const items = data?.items ?? [];

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
      </div>

      {isLoading ? (
        <ReleasesSkeleton />
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => (
            <ReleaseCard
              key={item.id}
              id={item.id}
              title={item.title}
              artistName={item.artistName}
              labelName={item.labelName}
              releaseDate={item.releaseDate}
              coverImage={item.coverImage}
              orderUrl={item.orderUrl}
              collectabilityScore={item.collectabilityScore}
              pressRun={item.pressRun}
              coloredVinyl={item.coloredVinyl}
              sourceName={item.sourceName}
            />
          ))}
        </div>
      )}
    </div>
  );
}
