"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddReleaseDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [labelName, setLabelName] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [orderUrl, setOrderUrl] = useState("");
  const [pressRun, setPressRun] = useState("");
  const [coloredVinyl, setColoredVinyl] = useState(false);
  const [numbered, setNumbered] = useState(false);
  const [specialPackaging, setSpecialPackaging] = useState("");

  const utils = trpc.useUtils();
  const addMutation = trpc.releases.addManualRelease.useMutation({
    onSuccess: () => {
      toast.success("Release added");
      utils.releases.getUpcoming.invalidate();
      setOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to add release", { description: error.message });
    },
  });

  function resetForm() {
    setTitle("");
    setArtistName("");
    setLabelName("");
    setReleaseDate("");
    setOrderUrl("");
    setPressRun("");
    setColoredVinyl(false);
    setNumbered(false);
    setSpecialPackaging("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addMutation.mutate({
      title,
      artistName,
      labelName: labelName || undefined,
      releaseDate: releaseDate ? new Date(releaseDate) : undefined,
      orderUrl: orderUrl || undefined,
      pressRun: pressRun ? parseInt(pressRun, 10) : undefined,
      coloredVinyl,
      numbered,
      specialPackaging: specialPackaging || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Add Release
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Upcoming Release</DialogTitle>
          <DialogDescription>
            Manually add a release you&apos;re tracking.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm font-medium">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Album title"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Artist *</label>
            <Input
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="Artist name"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Label</label>
            <Input
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
              placeholder="Record label"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Release Date</label>
            <Input
              type="date"
              value={releaseDate}
              onChange={(e) => setReleaseDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Order URL</label>
            <Input
              value={orderUrl}
              onChange={(e) => setOrderUrl(e.target.value)}
              placeholder="https://..."
              type="url"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Press Run</label>
            <Input
              value={pressRun}
              onChange={(e) => setPressRun(e.target.value)}
              placeholder="e.g. 500"
              type="number"
              min={1}
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={coloredVinyl}
                onChange={(e) => setColoredVinyl(e.target.checked)}
                className="rounded"
              />
              Colored Vinyl
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={numbered}
                onChange={(e) => setNumbered(e.target.checked)}
                className="rounded"
              />
              Numbered
            </label>
          </div>
          <div>
            <label className="text-sm font-medium">Special Packaging</label>
            <Input
              value={specialPackaging}
              onChange={(e) => setSpecialPackaging(e.target.value)}
              placeholder="e.g. Gatefold, Box Set"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? "Adding..." : "Add Release"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
