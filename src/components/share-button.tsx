"use client";

import { useState } from "react";
import { Share2, Copy, Mail, Check } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { env } from "@/lib/env";

interface ShareButtonProps {
  type: "album" | "wantlist";
  albumId?: string;
  title: string;
}

export function ShareButton({ type, albumId, title }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const createLinkMutation = trpc.share.createLink.useMutation();

  async function handleShare() {
    try {
      const result = await createLinkMutation.mutateAsync({
        type,
        albumId: type === "album" ? albumId : undefined,
        expiresInDays: 30,
      });

      const baseUrl = typeof window !== "undefined"
        ? window.location.origin
        : env.NEXT_PUBLIC_BASE_URL;
      const shareUrl = `${baseUrl}/share/${result.token}`;

      // Try native share API first (mobile)
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: `${title} - VinylIQ`,
            url: shareUrl,
          });
          return;
        } catch {
          // User cancelled or not supported, fall through to clipboard
        }
      }

      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to create share link");
    }
  }

  async function handleCopyLink() {
    try {
      const result = await createLinkMutation.mutateAsync({
        type,
        albumId: type === "album" ? albumId : undefined,
        expiresInDays: 30,
      });

      const baseUrl = typeof window !== "undefined"
        ? window.location.origin
        : env.NEXT_PUBLIC_BASE_URL;
      const shareUrl = `${baseUrl}/share/${result.token}`;

      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to create share link");
    }
  }

  async function handleEmailShare() {
    try {
      const result = await createLinkMutation.mutateAsync({
        type,
        albumId: type === "album" ? albumId : undefined,
        expiresInDays: 30,
      });

      const baseUrl = typeof window !== "undefined"
        ? window.location.origin
        : env.NEXT_PUBLIC_BASE_URL;
      const shareUrl = `${baseUrl}/share/${result.token}`;

      const subject = encodeURIComponent(`Check out ${title} on VinylIQ`);
      const body = encodeURIComponent(`${title}\n\n${shareUrl}`);
      window.open(`mailto:?subject=${subject}&body=${body}`);
    } catch {
      toast.error("Failed to create share link");
    }
  }

  // On mobile-capable devices, use simple share button
  const isMobileCapable =
    typeof navigator !== "undefined" && "share" in navigator;

  if (isMobileCapable) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleShare}
        disabled={createLinkMutation.isPending}
      >
        <Share2 className="mr-1 h-4 w-4" />
        Share
      </Button>
    );
  }

  // Desktop: dropdown with copy link + email
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={createLinkMutation.isPending}
        >
          <Share2 className="mr-1 h-4 w-4" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCopyLink}>
          {copied ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEmailShare}>
          <Mail className="mr-2 h-4 w-4" />
          Email
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
