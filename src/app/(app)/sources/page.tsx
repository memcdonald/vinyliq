"use client";

import { useState } from "react";
import {
  Globe,
  Trash2,
  ExternalLink,
  Pencil,
  Save,
  X,
  Plus,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CsvImportDialog } from "@/components/csv-import-dialog";

type PriorityFilter = "all" | "core" | "supporting";

interface EditingSource {
  id: string;
  sourceName: string;
  url: string;
  category: string;
  priority: string;
  pulseUse: string;
  accessMethod: string;
  notes: string;
}

function EditRow({
  source,
  onCancel,
  onSaved,
}: {
  source: EditingSource;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(source);
  const updateMutation = trpc.sources.updateSource.useMutation({
    onSuccess: () => {
      toast.success("Source updated");
      onSaved();
    },
    onError: (error) => {
      toast.error("Failed to update", { description: error.message });
    },
  });

  function handleSave() {
    updateMutation.mutate({
      id: form.id,
      sourceName: form.sourceName || undefined,
      url: form.url || null,
      category: form.category || null,
      priority: form.priority || undefined,
      pulseUse: form.pulseUse || null,
      accessMethod: form.accessMethod || null,
      notes: form.notes || null,
    });
  }

  return (
    <tr className="border-b bg-muted/30">
      <td className="px-4 py-2">
        <select
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
          className="rounded border bg-background px-2 py-1 text-xs"
        >
          <option value="core">core</option>
          <option value="supporting">supporting</option>
        </select>
      </td>
      <td className="px-4 py-2">
        <input
          value={form.sourceName}
          onChange={(e) => setForm({ ...form, sourceName: e.target.value })}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
          placeholder="Source name"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          className="w-full rounded border bg-background px-2 py-1 text-sm font-mono"
          placeholder="URL"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
          placeholder="Category"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
          placeholder="Notes"
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-success hover:text-success"
            onClick={handleSave}
            disabled={!form.sourceName.trim() || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function AddRow({ onCancel, onAdded }: { onCancel: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    sourceName: "",
    url: "",
    category: "",
    priority: "core",
    notes: "",
  });

  const addMutation = trpc.sources.bulkAddSources.useMutation({
    onSuccess: () => {
      toast.success("Source added");
      onAdded();
    },
    onError: (error) => {
      toast.error("Failed to add", { description: error.message });
    },
  });

  function handleAdd() {
    addMutation.mutate({
      sources: [
        {
          sourceName: form.sourceName,
          url: form.url || undefined,
          category: form.category || undefined,
          priority: form.priority,
          notes: form.notes || undefined,
        },
      ],
    });
  }

  return (
    <tr className="border-b bg-primary/5">
      <td className="px-4 py-2">
        <select
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
          className="rounded border bg-background px-2 py-1 text-xs"
        >
          <option value="core">core</option>
          <option value="supporting">supporting</option>
        </select>
      </td>
      <td className="px-4 py-2">
        <input
          value={form.sourceName}
          onChange={(e) => setForm({ ...form, sourceName: e.target.value })}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
          placeholder="Source name (required)"
          autoFocus
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          className="w-full rounded border bg-background px-2 py-1 text-sm font-mono"
          placeholder="URL"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
          placeholder="Category"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
          placeholder="Notes"
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-success hover:text-success"
            onClick={handleAdd}
            disabled={!form.sourceName.trim() || addMutation.isPending}
          >
            {addMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function SourcesPage() {
  const [filter, setFilter] = useState<PriorityFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

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
            <h1 className="text-2xl font-bold tracking-tight font-sans-display">Data Sources</h1>
            {!isLoading && (
              <p className="text-sm text-muted-foreground">
                {sources?.length ?? 0}{" "}
                {sources?.length === 1 ? "source" : "sources"}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Source
          </Button>
          <CsvImportDialog />
        </div>
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
      ) : filtered.length === 0 && !adding ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Globe className="mb-4 h-16 w-16 text-muted-foreground/40" />
          <h2 className="mb-2 text-lg font-semibold">No sources yet</h2>
          <p className="mb-6 max-w-md text-sm text-muted-foreground">
            Add sources manually or import a CSV of your vinyl research sources.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => setAdding(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Source
            </Button>
            <CsvImportDialog />
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {adding && (
                <AddRow
                  onCancel={() => setAdding(false)}
                  onAdded={() => {
                    setAdding(false);
                    utils.sources.getAll.invalidate();
                  }}
                />
              )}
              {filtered.map((source) =>
                editingId === source.id ? (
                  <EditRow
                    key={source.id}
                    source={{
                      id: source.id,
                      sourceName: source.sourceName,
                      url: source.url ?? "",
                      category: source.category ?? "",
                      priority: source.priority,
                      pulseUse: source.pulseUse ?? "",
                      accessMethod: source.accessMethod ?? "",
                      notes: source.notes ?? "",
                    }}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => {
                      setEditingId(null);
                      utils.sources.getAll.invalidate();
                    }}
                  />
                ) : (
                  <tr key={source.id} className="border-b last:border-0 hover:bg-muted/30">
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
                      {source.sourceName}
                    </td>
                    <td className="px-4 py-3">
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono"
                        >
                          {new URL(source.url).hostname}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {source.category ?? "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                      {source.notes ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingId(source.id);
                            setAdding(false);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeMutation.mutate({ id: source.id })}
                          disabled={removeMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
