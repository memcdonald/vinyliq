"use client";

import { Library, Heart, Headphones, ChevronDown, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CollectionActionsProps {
  albumId: string;
  discogsId: number;
  discogsType: "master" | "release";
  title: string;
  thumb: string;
  year: number;
  genres: string[];
  styles: string[];
  coverImage: string;
}

const STATUS_CONFIG = {
  owned: {
    label: "In Collection",
    icon: Library,
    actionLabel: "Add to Collection",
  },
  wanted: {
    label: "In Wantlist",
    icon: Heart,
    actionLabel: "Add to Wantlist",
  },
  listened: {
    label: "Listened",
    icon: Headphones,
    actionLabel: "Mark as Listened",
  },
} as const;

type CollectionStatus = keyof typeof STATUS_CONFIG;

export function CollectionActions({
  albumId,
  discogsId,
  discogsType,
  title,
  thumb,
  year,
  genres,
  styles,
  coverImage,
}: CollectionActionsProps) {
  const utils = trpc.useUtils();

  // Check if the album is already in the user's collection.
  // If albumId is empty (album not yet in our DB), skip the query.
  const { data: existingItem, isLoading: isCheckingCollection } =
    trpc.collection.getItemByAlbumId.useQuery(
      { albumId },
      { enabled: !!albumId, retry: false },
    );

  const addMutation = trpc.collection.add.useMutation({
    onSuccess: (_data, variables) => {
      const statusLabel = STATUS_CONFIG[variables.status as CollectionStatus].label;
      toast.success(`"${title}" added`, {
        description: `Status: ${statusLabel}`,
      });
      utils.collection.getAll.invalidate();
      utils.collection.getItemByAlbumId.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to add album", {
        description: error.message,
      });
    },
  });

  const updateMutation = trpc.collection.updateStatus.useMutation({
    onSuccess: (_data, variables) => {
      if (variables.status) {
        const statusLabel = STATUS_CONFIG[variables.status as CollectionStatus].label;
        toast.success(`"${title}" updated`, {
          description: `Status: ${statusLabel}`,
        });
      }
      utils.collection.getAll.invalidate();
      utils.collection.getItemByAlbumId.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to update album", {
        description: error.message,
      });
    },
  });

  const removeMutation = trpc.collection.remove.useMutation({
    onSuccess: () => {
      toast.success(`"${title}" removed from collection`);
      utils.collection.getAll.invalidate();
      utils.collection.getItemByAlbumId.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to remove album", {
        description: error.message,
      });
    },
  });

  const isMutating =
    addMutation.isPending || updateMutation.isPending || removeMutation.isPending;

  const handleAdd = (status: CollectionStatus) => {
    addMutation.mutate({
      discogsId,
      discogsMasterId: discogsType === "master" ? discogsId : undefined,
      title,
      thumb,
      year,
      genres,
      styles,
      coverImage,
      status,
    });
  };

  const handleChangeStatus = (status: CollectionStatus) => {
    if (!existingItem) return;
    updateMutation.mutate({
      id: existingItem.id,
      status,
    });
  };

  const handleRemove = () => {
    if (!existingItem) return;
    removeMutation.mutate({ id: existingItem.id });
  };

  const currentStatus = existingItem?.status as CollectionStatus | undefined;
  const isInCollection = !!existingItem;

  if (isCheckingCollection && albumId) {
    return (
      <Button size="lg" className="w-full sm:w-auto" disabled>
        <Library className="mr-2 h-4 w-4" />
        Loading...
      </Button>
    );
  }

  if (isInCollection && currentStatus) {
    const config = STATUS_CONFIG[currentStatus];
    const StatusIcon = config.icon;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={isMutating}
          >
            <StatusIcon className="mr-2 h-4 w-4" />
            {config.label}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Change Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(STATUS_CONFIG) as CollectionStatus[]).map((status) => {
            const statusConfig = STATUS_CONFIG[status];
            const Icon = statusConfig.icon;
            const isActive = status === currentStatus;
            return (
              <DropdownMenuItem
                key={status}
                onClick={() => handleChangeStatus(status)}
                disabled={isActive}
              >
                <Icon className="mr-2 h-4 w-4" />
                {statusConfig.actionLabel}
                {isActive && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={handleRemove}>
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="lg"
          className="w-full sm:w-auto"
          disabled={isMutating}
        >
          <Library className="mr-2 h-4 w-4" />
          Add to Collection
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {(Object.keys(STATUS_CONFIG) as CollectionStatus[]).map((status) => {
          const statusConfig = STATUS_CONFIG[status];
          const Icon = statusConfig.icon;
          return (
            <DropdownMenuItem
              key={status}
              onClick={() => handleAdd(status)}
            >
              <Icon className="mr-2 h-4 w-4" />
              {statusConfig.actionLabel}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
