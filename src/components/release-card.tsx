"use client";

import Image from "next/image";
import { Music, ExternalLink, Heart, Calendar } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CollectabilityBadge } from "@/components/collectability-badge";

interface ReleaseCardProps {
  id: string;
  title: string;
  artistName: string;
  labelName?: string | null;
  releaseDate?: Date | null;
  coverImage?: string | null;
  orderUrl?: string | null;
  collectabilityScore?: number | null;
  pressRun?: number | null;
  coloredVinyl?: boolean | null;
  sourceName?: string | null;
}

export function ReleaseCard({
  title,
  artistName,
  labelName,
  releaseDate,
  coverImage,
  orderUrl,
  collectabilityScore,
  pressRun,
  coloredVinyl,
  sourceName,
}: ReleaseCardProps) {
  const utils = trpc.useUtils();
  const addMutation = trpc.collection.add.useMutation({
    onSuccess: () => {
      toast.success(`"${title}" added to wantlist`);
      utils.collection.getAll.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to add to wantlist", { description: error.message });
    },
  });

  const formattedDate = releaseDate
    ? new Date(releaseDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Card className="h-full overflow-hidden py-0 transition-shadow hover:shadow-md">
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <Music className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}
        {collectabilityScore !== null && collectabilityScore !== undefined && (
          <div className="absolute right-2 top-2">
            <CollectabilityBadge score={collectabilityScore} size="md" />
          </div>
        )}
      </div>
      <CardContent className="space-y-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
          {title}
        </h3>
        <p className="truncate text-xs text-muted-foreground">{artistName}</p>
        {labelName && (
          <p className="truncate text-xs text-muted-foreground">{labelName}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {formattedDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formattedDate}
            </span>
          )}
          {pressRun && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
              {pressRun} copies
            </span>
          )}
          {coloredVinyl && (
            <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
              Color
            </span>
          )}
        </div>
        {sourceName && (
          <p className="truncate text-[10px] text-muted-foreground/60">
            via {sourceName}
          </p>
        )}
        <div className="flex items-center gap-1.5 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={() => {
              addMutation.mutate({
                discogsId: 0,
                title,
                status: "wanted",
              });
            }}
            disabled={addMutation.isPending}
          >
            <Heart className="mr-1 h-3 w-3" />
            Wantlist
          </Button>
          {orderUrl && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              asChild
            >
              <a href={orderUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
