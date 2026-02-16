"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings,
  ExternalLink,
  Unlink,
  Download,
  Music,
  Disc3,
  Loader2,
  RefreshCw,
  Brain,
  Sparkles,
  Send,
  ChevronDown,
  ChevronUp,
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
import { Input } from "@/components/ui/input";
import { useSession } from "@/server/auth/client";
import { trpc } from "@/lib/trpc/client";

function ImportProgress({ service }: { service: "discogs" | "spotify" }) {
  const { data: progress } = trpc.settings.getImportProgress.useQuery(
    { service },
    { refetchInterval: 1000 },
  );

  if (!progress || progress.status === "completed") return null;

  const pct = progress.total > 0
    ? Math.round((progress.imported / progress.total) * 100)
    : 0;

  return (
    <div className="space-y-1.5 pt-2">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {progress.status === "running" && (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          {progress.message}
        </span>
        <span className="font-mono text-muted-foreground">
          {progress.imported}/{progress.total}
          {progress.errors > 0 && ` (${progress.errors} errors)`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

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
        <h1 className="text-3xl font-bold tracking-tight font-sans-display">Settings</h1>
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

      {/* Taste Profile Section — ABOVE Connected Accounts */}
      <TasteProfileCard />

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
                <ImportProgress service="discogs" />
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
                <ImportProgress service="spotify" />
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

function TasteProfileCard() {
  const { data: taste, isLoading: tasteLoading } = trpc.settings.getTasteProfile.useQuery();
  const { data: aiAnalysis, isLoading: analysisLoading } = trpc.settings.getSpotifyPreferenceAnalysis.useQuery();
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustmentText, setAdjustmentText] = useState("");
  const utils = trpc.useUtils();

  const refreshMutation = trpc.settings.refreshTasteProfile.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Taste profile updated: ${data.topGenres.length} genres, ${data.topArtists.length} artists`,
      );
      utils.settings.getTasteProfile.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to refresh: ${error.message}`);
    },
  });

  const analyzeMutation = trpc.settings.analyzeSpotifyPreferences.useMutation({
    onSuccess: () => {
      toast.success("Taste analysis complete!");
      utils.settings.getSpotifyPreferenceAnalysis.invalidate();
    },
    onError: (error) => {
      toast.error(`Analysis failed: ${error.message}`);
    },
  });

  const adjustMutation = trpc.settings.adjustTasteProfile.useMutation({
    onSuccess: () => {
      toast.success("Taste profile adjusted!");
      utils.settings.getSpotifyPreferenceAnalysis.invalidate();
      setAdjustmentText("");
      setShowAdjust(false);
    },
    onError: (error) => {
      toast.error(`Adjustment failed: ${error.message}`);
    },
  });

  const isLoading = tasteLoading || analysisLoading;
  const hasAnyData = taste || aiAnalysis;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="size-5" />
              Taste Profile
            </CardTitle>
            <CardDescription>
              Your musical identity — built from your collection, Spotify, and conversations
            </CardDescription>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              title="Recompute genre/artist weights from collection"
            >
              <RefreshCw
                className={`mr-1.5 size-4 ${refreshMutation.isPending ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading taste profile...</p>
        ) : !hasAnyData ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">
              No taste profile yet. Connect Spotify or add albums to your collection, then analyze your taste.
            </p>
            <div className="flex justify-center gap-2">
              <Button
                size="sm"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
              >
                {refreshMutation.isPending ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Brain className="mr-1.5 size-4" />
                )}
                Build Taste Profile
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
              >
                {analyzeMutation.isPending ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 size-4" />
                )}
                Analyze My Taste
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* AI Analysis Section */}
            {aiAnalysis ? (
              <div className="space-y-4">
                {/* Personality Label */}
                {aiAnalysis.listeningPersonality && (
                  <div className="text-center">
                    <span className="text-lg font-semibold tracking-tight">
                      {aiAnalysis.listeningPersonality}
                    </span>
                  </div>
                )}

                {/* Summary */}
                {aiAnalysis.summary && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {aiAnalysis.summary}
                  </p>
                )}

                {/* Genre + Mood Badges */}
                {aiAnalysis.topGenres.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Genres</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {aiAnalysis.topGenres.map((g) => (
                        <Badge key={g} variant="secondary" className="text-xs">
                          {g}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {aiAnalysis.moods.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Moods</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {aiAnalysis.moods.map((m) => (
                        <Badge key={m} variant="outline" className="text-xs">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {aiAnalysis.eras.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Eras</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {aiAnalysis.eras.map((e) => (
                        <Badge key={e} variant="outline" className="text-xs">
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Insights */}
                {aiAnalysis.keyInsights.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Key Insights</h4>
                    <ul className="space-y-1">
                      {aiAnalysis.keyInsights.map((insight, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-muted-foreground/40">•</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Collection Highlights */}
                {aiAnalysis.collectionHighlights && aiAnalysis.collectionHighlights.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Collection Highlights</h4>
                    <ul className="space-y-1">
                      {aiAnalysis.collectionHighlights.map((highlight, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-muted-foreground/40">•</span>
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Vinyl Recommendations */}
                {aiAnalysis.vinylRecommendations.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Vinyl Recommendations</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {aiAnalysis.vinylRecommendations.map((rec) => (
                        <Badge key={rec} variant="secondary" className="text-xs font-normal">
                          {rec}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Action buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => analyzeMutation.mutate()}
                      disabled={analyzeMutation.isPending}
                    >
                      {analyzeMutation.isPending ? (
                        <Loader2 className="mr-1.5 size-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1.5 size-4" />
                      )}
                      Re-analyze
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowAdjust(!showAdjust)}
                    >
                      {showAdjust ? (
                        <ChevronUp className="mr-1.5 size-4" />
                      ) : (
                        <ChevronDown className="mr-1.5 size-4" />
                      )}
                      Adjust
                    </Button>
                  </div>
                  {aiAnalysis.analyzedAt && (
                    <p className="text-[10px] text-muted-foreground/60">
                      Analyzed: {new Date(aiAnalysis.analyzedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Adjust input */}
                {showAdjust && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. I'm more into jazz lately, less pop..."
                      value={adjustmentText}
                      onChange={(e) => setAdjustmentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && adjustmentText.trim()) {
                          adjustMutation.mutate({ adjustments: adjustmentText.trim() });
                        }
                      }}
                      disabled={adjustMutation.isPending}
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (adjustmentText.trim()) {
                          adjustMutation.mutate({ adjustments: adjustmentText.trim() });
                        }
                      }}
                      disabled={!adjustmentText.trim() || adjustMutation.isPending}
                    >
                      {adjustMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* No AI analysis yet, but we have numerical taste data */
              <div className="space-y-4">
                <div className="text-center py-3">
                  <p className="text-sm text-muted-foreground mb-3">
                    Get a rich AI-powered analysis of your musical personality.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => analyzeMutation.mutate()}
                    disabled={analyzeMutation.isPending}
                  >
                    {analyzeMutation.isPending ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1.5 size-4" />
                    )}
                    Analyze My Taste
                  </Button>
                </div>

                <Separator />
              </div>
            )}

            {/* Numerical taste data (always shown if available) */}
            {taste && (
              <div className="space-y-4">
                {taste.topGenres.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Top Genres (by weight)</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {taste.topGenres.map((g) => (
                        <Badge key={g.genre} variant="secondary" className="text-xs">
                          {g.genre}
                          <span className="ml-1 opacity-60">{g.weight}%</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {taste.topArtists.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Top Artists</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {taste.topArtists.map((a) => (
                        <Badge key={a} variant="outline" className="text-xs">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {taste.computedAt && (
                  <p className="text-[10px] text-muted-foreground/60">
                    Weights updated: {new Date(taste.computedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl p-6 md:p-10"><p className="text-muted-foreground">Loading settings...</p></div>}>
      <SettingsContent />
    </Suspense>
  );
}
