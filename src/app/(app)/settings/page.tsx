"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings,
  ExternalLink,
  Unlink,
  Download,
  Music,
  Disc3,
} from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/server/auth/client";
import { trpc } from "@/lib/trpc/client";

function SettingsContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const connectedAccounts = trpc.settings.getConnectedAccounts.useQuery();
  const utils = trpc.useUtils();

  const disconnectDiscogs = trpc.settings.disconnectDiscogs.useMutation({
    onSuccess: () => {
      toast.success("Discogs account disconnected");
      utils.settings.getConnectedAccounts.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to disconnect Discogs: ${error.message}`);
    },
  });

  const disconnectSpotify = trpc.settings.disconnectSpotify.useMutation({
    onSuccess: () => {
      toast.success("Spotify account disconnected");
      utils.settings.getConnectedAccounts.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to disconnect Spotify: ${error.message}`);
    },
  });

  const importDiscogs = trpc.settings.importDiscogsCollection.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  const importSpotify = trpc.settings.importSpotifyLibrary.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  // Show toast on OAuth callback redirect
  useEffect(() => {
    const discogsStatus = searchParams.get("discogs");
    const spotifyStatus = searchParams.get("spotify");

    if (discogsStatus === "connected") {
      toast.success("Discogs account connected successfully");
      connectedAccounts.refetch();
    } else if (discogsStatus === "error") {
      const reason = searchParams.get("reason") ?? "unknown";
      toast.error(`Failed to connect Discogs: ${reason}`);
    }

    if (spotifyStatus === "connected") {
      toast.success("Spotify account connected successfully");
      connectedAccounts.refetch();
    } else if (spotifyStatus === "error") {
      const reason = searchParams.get("reason") ?? "unknown";
      toast.error(`Failed to connect Spotify: ${reason}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleConnectDiscogs = async () => {
    try {
      const result = await utils.settings.getDiscogsAuthUrl.fetch();
      window.location.href = result.url;
    } catch (error) {
      toast.error(
        `Failed to start Discogs connection: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const handleConnectSpotify = async () => {
    try {
      const result = await utils.settings.getSpotifyAuthUrl.fetch();
      window.location.href = result.url;
    } catch (error) {
      toast.error(
        `Failed to start Spotify connection: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const discogs = connectedAccounts.data?.discogs;
  const spotify = connectedAccounts.data?.spotify;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 md:p-10">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Settings className="size-7 text-muted-foreground" />
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {session?.user ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="text-sm font-medium">
                  {session.user.name ?? "Not set"}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="text-sm font-medium">
                  {session.user.email}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
        </CardContent>
      </Card>

      {/* Connected Accounts Section */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            Link your music services to import your collection and library
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Discogs */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Disc3 className="size-5 text-muted-foreground" />
              <h3 className="font-medium">Discogs</h3>
              {discogs?.connected && (
                <Badge variant="secondary">Connected</Badge>
              )}
            </div>

            {connectedAccounts.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Checking connection...
              </p>
            ) : discogs?.connected ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Connected as{" "}
                  <span className="font-medium text-foreground">
                    {discogs.username}
                  </span>
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => importDiscogs.mutate()}
                    disabled={importDiscogs.isPending}
                  >
                    <Download className="mr-1.5 size-4" />
                    {importDiscogs.isPending
                      ? "Importing..."
                      : "Import Collection"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnectDiscogs.mutate()}
                    disabled={disconnectDiscogs.isPending}
                  >
                    <Unlink className="mr-1.5 size-4" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Connect your Discogs account to import your vinyl collection.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnectDiscogs}
                >
                  <ExternalLink className="mr-1.5 size-4" />
                  Connect Discogs
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Spotify */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Music className="size-5 text-muted-foreground" />
              <h3 className="font-medium">Spotify</h3>
              {spotify?.connected && (
                <Badge variant="secondary">Connected</Badge>
              )}
            </div>

            {connectedAccounts.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Checking connection...
              </p>
            ) : spotify?.connected ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Your Spotify account is connected.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => importSpotify.mutate()}
                    disabled={importSpotify.isPending}
                  >
                    <Download className="mr-1.5 size-4" />
                    {importSpotify.isPending
                      ? "Importing..."
                      : "Import Library"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnectSpotify.mutate()}
                    disabled={disconnectSpotify.isPending}
                  >
                    <Unlink className="mr-1.5 size-4" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Connect your Spotify account to import your saved albums.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnectSpotify}
                >
                  <ExternalLink className="mr-1.5 size-4" />
                  Connect Spotify
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl p-6 md:p-10"><p className="text-muted-foreground">Loading settings...</p></div>}>
      <SettingsContent />
    </Suspense>
  );
}
