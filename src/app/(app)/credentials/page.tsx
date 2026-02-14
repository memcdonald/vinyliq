"use client";

import {
  KeyRound,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Disc3,
  Music,
  Bot,
  Database,
  Shield,
  LinkIcon,
  Unlink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

function StatusIndicator({ configured }: { configured: boolean }) {
  return configured ? (
    <div className="flex items-center gap-1.5 text-sm text-success">
      <CheckCircle2 className="h-4 w-4" />
      <span>Configured</span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <XCircle className="h-4 w-4" />
      <span>Not configured</span>
    </div>
  );
}

function CredentialRow({
  label,
  envVar,
  configured,
  extra,
}: {
  label: string;
  envVar: string;
  configured: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="font-mono text-xs text-muted-foreground">{envVar}</p>
      </div>
      <div className="flex items-center gap-3">
        {extra}
        <StatusIndicator configured={configured} />
      </div>
    </div>
  );
}

function DiscogsConnection({
  connected,
  username,
  hasConsumerKey,
}: {
  connected: boolean;
  username: string | null;
  hasConsumerKey: boolean;
}) {
  const utils = trpc.useUtils();

  const { refetch: fetchAuthUrl, isFetching: isConnecting } =
    trpc.settings.getDiscogsAuthUrl.useQuery(undefined, {
      enabled: false,
    });

  const disconnectMutation = trpc.settings.disconnectDiscogs.useMutation({
    onSuccess: () => {
      toast.success("Discogs disconnected");
      utils.settings.getCredentialsStatus.invalidate();
      utils.settings.getConnectedAccounts.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to disconnect", { description: error.message });
    },
  });

  async function handleConnect() {
    try {
      const result = await fetchAuthUrl();
      if (result.data?.url) {
        window.location.href = result.data.url;
      }
    } catch {
      toast.error("Failed to start Discogs auth");
    }
  }

  if (!hasConsumerKey) return null;

  if (connected) {
    return (
      <div className="flex items-center gap-2 pt-1">
        <Badge variant="secondary" className="text-[10px]">
          Connected{username ? `: ${username}` : ""}
        </Badge>
        <Button
          variant="ghost"
          size="xs"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => disconnectMutation.mutate()}
          disabled={disconnectMutation.isPending}
        >
          <Unlink className="h-3 w-3 mr-1" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="xs"
      className="mt-1"
      onClick={handleConnect}
      disabled={isConnecting}
    >
      {isConnecting ? (
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      ) : (
        <LinkIcon className="h-3 w-3 mr-1" />
      )}
      Connect Discogs
    </Button>
  );
}

function SpotifyConnection({
  connected,
  hasClientId,
}: {
  connected: boolean;
  hasClientId: boolean;
}) {
  const utils = trpc.useUtils();

  const { refetch: fetchAuthUrl, isFetching: isConnecting } =
    trpc.settings.getSpotifyAuthUrl.useQuery(undefined, {
      enabled: false,
    });

  const disconnectMutation = trpc.settings.disconnectSpotify.useMutation({
    onSuccess: () => {
      toast.success("Spotify disconnected");
      utils.settings.getCredentialsStatus.invalidate();
      utils.settings.getConnectedAccounts.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to disconnect", { description: error.message });
    },
  });

  async function handleConnect() {
    try {
      const result = await fetchAuthUrl();
      if (result.data?.url) {
        window.location.href = result.data.url;
      }
    } catch {
      toast.error("Failed to start Spotify auth");
    }
  }

  if (!hasClientId) return null;

  if (connected) {
    return (
      <div className="flex items-center gap-2 pt-1">
        <Badge variant="secondary" className="text-[10px]">
          Connected
        </Badge>
        <Button
          variant="ghost"
          size="xs"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => disconnectMutation.mutate()}
          disabled={disconnectMutation.isPending}
        >
          <Unlink className="h-3 w-3 mr-1" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="xs"
      className="mt-1"
      onClick={handleConnect}
      disabled={isConnecting}
    >
      {isConnecting ? (
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      ) : (
        <LinkIcon className="h-3 w-3 mr-1" />
      )}
      Connect Spotify
    </Button>
  );
}

export default function CredentialsPage() {
  const { data: status, isLoading } = trpc.settings.getCredentialsStatus.useQuery();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <KeyRound className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-sans-display">Credentials</h1>
          <p className="text-sm text-muted-foreground">
            API keys and service connections
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : status ? (
        <>
          {/* Music Services */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Disc3 className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Music Services</CardTitle>
              </div>
              <CardDescription>
                Collection import and music data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Discogs</p>
                    <p className="font-mono text-xs text-muted-foreground">DISCOGS_CONSUMER_KEY</p>
                  </div>
                  <StatusIndicator configured={status.discogs.consumerKey} />
                </div>
                <DiscogsConnection
                  connected={status.discogs.connected}
                  username={status.discogs.username ?? null}
                  hasConsumerKey={status.discogs.consumerKey}
                />
              </div>
              <Separator />
              <div className="py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Spotify</p>
                    <p className="font-mono text-xs text-muted-foreground">SPOTIFY_CLIENT_ID</p>
                  </div>
                  <StatusIndicator configured={status.spotify.clientId} />
                </div>
                <SpotifyConnection
                  connected={status.spotify.connected}
                  hasClientId={status.spotify.clientId}
                />
              </div>
            </CardContent>
          </Card>

          {/* AI Services */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-muted-foreground" />
                <CardTitle>AI Services</CardTitle>
              </div>
              <CardDescription>
                Power suggestions, evaluations, and chat
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <CredentialRow
                label="Anthropic (Claude)"
                envVar="ANTHROPIC_API_KEY"
                configured={status.ai.anthropic}
                extra={
                  status.ai.provider === "claude" && status.ai.anthropic ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Active
                    </Badge>
                  ) : null
                }
              />
              <Separator />
              <CredentialRow
                label="OpenAI"
                envVar="OPENAI_API_KEY"
                configured={status.ai.openai}
                extra={
                  status.ai.provider === "openai" && status.ai.openai ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Active
                    </Badge>
                  ) : null
                }
              />
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Active Provider</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    AI_PROVIDER
                  </p>
                </div>
                <Badge variant="outline">{status.ai.provider}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Infrastructure */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Infrastructure</CardTitle>
              </div>
              <CardDescription>
                Caching and storage services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CredentialRow
                label="Upstash Redis"
                envVar="UPSTASH_REDIS_REST_URL"
                configured={status.cache.redis}
              />
            </CardContent>
          </Card>

          {/* Auth */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Authentication</CardTitle>
              </div>
              <CardDescription>Session and auth configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <CredentialRow
                label="Auth Secret"
                envVar="BETTER_AUTH_SECRET"
                configured={status.auth.secret}
              />
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Auth URL</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    BETTER_AUTH_URL
                  </p>
                </div>
                <span className="font-mono text-xs">{status.auth.url}</span>
              </div>
            </CardContent>
          </Card>

          {/* Help text */}
          <p className="text-center text-xs text-muted-foreground">
            API keys are set via environment variables in your deployment platform.
            Service accounts (Discogs, Spotify) can be connected above.
          </p>
        </>
      ) : null}
    </div>
  );
}
