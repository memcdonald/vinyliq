"use client";

import { useState } from "react";
import { Globe, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CsvImportDialog } from "@/components/csv-import-dialog";

type PriorityFilter = "all" | "core" | "supporting";

export default function SourcesPage() {
  const [filter, setFilter] = useState<PriorityFilter>("all");

  const { data: sources, isLoading } = trpc.sources.getAll.useQuery();
  const utils = trpc.useUtils();

  const removeMutation = trpc.sources.removeSource.useMutation({
    onSuccess: () => {
      toast.success("Source removed");
      utils.sources.getAll.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to remove source", { description: error.message });
    },
  });

  const filtered =
    sources?.filter((s) => filter === "all" || s.priority === filter) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Data Sources</h1>
            {!isLoading && (
              <p className="text-sm text-muted-foreground">
                {sources?.length ?? 0}{" "}
                {sources?.length === 1 ? "source" : "sources"}
              </p>
            )}
          </div>
        </div>
        <CsvImportDialog />
      </div>

      {/* Priority filter */}
      <div className="mb-4 flex gap-1">
        {(
          [
            ["all", "All"],
            ["core", "Core"],
            ["supporting", "Supporting"],
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
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Globe className="mb-4 h-16 w-16 text-muted-foreground/40" />
          <h2 className="mb-2 text-lg font-semibold">No sources yet</h2>
          <p className="mb-6 max-w-md text-sm text-muted-foreground">
            Import a CSV of your vinyl research sources to get started.
          </p>
          <CsvImportDialog />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Pulse Use</th>
                <th className="px-4 py-3 font-medium">Access</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((source) => (
                <tr key={source.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        source.priority === "core" ? "default" : "secondary"
                      }
                    >
                      {source.priority}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {source.sourceName}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      source.sourceName
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {source.category ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {source.pulseUse ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {source.accessMethod ?? "—"}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                    {source.notes ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeMutation.mutate({ id: source.id })}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
