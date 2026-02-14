"use client";

import { useState } from "react";
import { Settings2, Plus, Trash2, Rss, Globe, FileText } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const SOURCE_ICONS = {
  rss: Rss,
  url: Globe,
  manual: FileText,
} as const;

export function ManageSourcesSheet() {
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newType, setNewType] = useState<"rss" | "url" | "manual">("rss");

  const utils = trpc.useUtils();
  const { data: sources, isLoading } = trpc.releases.getSources.useQuery();

  const addMutation = trpc.releases.addSource.useMutation({
    onSuccess: () => {
      toast.success("Source added");
      utils.releases.getSources.invalidate();
      setNewName("");
      setNewUrl("");
    },
    onError: (error) => {
      toast.error("Failed to add source", { description: error.message });
    },
  });

  const removeMutation = trpc.releases.removeSource.useMutation({
    onSuccess: () => {
      toast.success("Source removed");
      utils.releases.getSources.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to remove source", { description: error.message });
    },
  });

  const toggleMutation = trpc.releases.updateSource.useMutation({
    onSuccess: () => {
      utils.releases.getSources.invalidate();
    },
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName) return;
    addMutation.mutate({
      name: newName,
      type: newType,
      url: newUrl || undefined,
    });
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="mr-1 h-4 w-4" />
          Sources
        </Button>
      </SheetTrigger>
      <SheetContent className="w-80 overflow-y-auto sm:w-96">
        <SheetHeader>
          <SheetTitle>Manage Sources</SheetTitle>
          <SheetDescription>
            Add RSS feeds or URLs to track upcoming vinyl releases.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Add new source form */}
          <form onSubmit={handleAdd} className="space-y-2 rounded-lg border p-3">
            <div className="flex gap-1">
              {(["rss", "url", "manual"] as const).map((type) => {
                const Icon = SOURCE_ICONS[type];
                return (
                  <Button
                    key={type}
                    type="button"
                    variant={newType === type ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setNewType(type)}
                  >
                    <Icon className="mr-1 h-3 w-3" />
                    {type.toUpperCase()}
                  </Button>
                );
              })}
            </div>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Source name"
              required
            />
            {newType !== "manual" && (
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder={newType === "rss" ? "RSS feed URL" : "Website URL"}
                type="url"
              />
            )}
            <Button type="submit" size="sm" className="w-full" disabled={addMutation.isPending}>
              <Plus className="mr-1 h-3 w-3" />
              Add Source
            </Button>
          </form>

          {/* Existing sources */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading sources...</p>
          ) : sources && sources.length > 0 ? (
            <div className="space-y-2">
              {sources.map((source) => {
                const Icon = SOURCE_ICONS[source.type as keyof typeof SOURCE_ICONS] ?? Globe;
                return (
                  <div
                    key={source.id}
                    className="flex items-center gap-2 rounded-lg border p-2"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{source.name}</p>
                      {source.url && (
                        <p className="truncate text-xs text-muted-foreground">
                          {source.url}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0"
                      onClick={() =>
                        toggleMutation.mutate({
                          id: source.id,
                          enabled: !source.enabled,
                        })
                      }
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          source.enabled ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0 text-destructive hover:text-destructive"
                      onClick={() => removeMutation.mutate({ id: source.id })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              No sources configured yet.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
