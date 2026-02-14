"use client";

import { useState, useEffect } from "react";
import {
  KeyRound,
  CheckCircle2,
  XCircle,
  Disc3,
  Bot,
  Database,
  Shield,
  LinkIcon,
  Unlink,
  Loader2,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Trash2,
  Sparkles,
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

function ApiKeyInput({
  provider,
  label,
  configured,
  maskedKey,
  fromEnv,
}: {
  provider: "anthropic" | "openai";
  label: string;
  configured: boolean;
  maskedKey: string | null;
  fromEnv: boolean;
}) {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [showKey, setShowKey] = useState(false);

  const saveMutation = trpc.settings.saveApiKey.useMutation({
    onSuccess: () => {
      toast.success(`${label} API key saved`);
      utils.settings.getCredentialsStatus.invalidate();
      setEditing(false);
      setValue("");
    },
    onError: (error) => {
      toast.error("Failed to save", { description: error.message });
    },
  });

  const removeMutation = trpc.settings.removeApiKey.useMutation({
    onSuccess: () => {
      toast.success(`${label} API key removed`);
      utils.settings.getCredentialsStatus.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to remove", { description: error.message });
    },
  });

  if (editing) {
    return (
      <div className="space-y-2 py-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{label}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Enter ${label} API key...`}
              className="w-full rounded-lg border bg-background px-3 py-2 pr-10 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate({ provider, apiKey: value })}
            disabled={!value.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false);
              setValue("");
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {maskedKey ? (
          <p className="font-mono text-xs text-muted-foreground">
            Key: {maskedKey}
          </p>
        ) : fromEnv ? (
          <p className="text-xs text-muted-foreground">Set via environment variable</p>
        ) : (
          <p className="text-xs text-muted-foreground">No key configured</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="xs"
          onClick={() => setEditing(true)}
        >
          {configured ? "Change" : "Add Key"}
        </Button>
        {maskedKey && (
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => removeMutation.mutate({ provider })}
            disabled={removeMutation.isPending}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
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
    trpc.settings.getDiscogsAuthUrl.useQuery(undefined, { enabled: false });

  const disconnectMutation = trpc.settings.disconnectDiscogs.useMutation({
    onSuccess: () => {
      toast.success("Discogs disconnected");
      utils.settings.getCredentialsStatus.invalidate();
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
    trpc.settings.getSpotifyAuthUrl.useQuery(undefined, { enabled: false });

  const disconnectMutation = trpc.settings.disconnectSpotify.useMutation({
    onSuccess: () => {
      toast.success("Spotify disconnected");
      utils.settings.getCredentialsStatus.invalidate();
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

function AiPreferences({
  hasAnthropic,
  hasOpenai,
}: {
  hasAnthropic: boolean;
  hasOpenai: boolean;
}) {
  const utils = trpc.useUtils();
  const { data: prefs, isLoading } = trpc.settings.getAiPreferences.useQuery();

  const [chatPrompt, setChatPrompt] = useState("");
  const [chatPromptDirty, setChatPromptDirty] = useState(false);
  const [recPrompt, setRecPrompt] = useState("");
  const [recPromptDirty, setRecPromptDirty] = useState(false);

  useEffect(() => {
    if (prefs?.chatSystemPrompt) {
      setChatPrompt(prefs.chatSystemPrompt);
    }
    if (prefs?.recommendationPrompt) {
      setRecPrompt(prefs.recommendationPrompt);
    }
  }, [prefs?.chatSystemPrompt, prefs?.recommendationPrompt]);

  const updateMutation = trpc.settings.updateAiPreferences.useMutation({
    onSuccess: () => {
      toast.success("AI preferences saved");
      utils.settings.getAiPreferences.invalidate();
      utils.settings.getCredentialsStatus.invalidate();
      setChatPromptDirty(false);
      setRecPromptDirty(false);
    },
    onError: (error) => {
      toast.error("Failed to save", { description: error.message });
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;

  const currentProvider = prefs?.provider ?? "claude";
  const canSwitch = hasAnthropic && hasOpenai;

  return (
    <div className="space-y-4">
      {/* Provider switcher */}
      {canSwitch && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Active Provider</p>
            <p className="text-xs text-muted-foreground">
              Choose which AI to use for chat, evaluations, and recommendations
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              variant={currentProvider === "claude" ? "default" : "outline"}
              size="xs"
              onClick={() =>
                updateMutation.mutate({ provider: "claude" })
              }
              disabled={updateMutation.isPending}
            >
              Claude
            </Button>
            <Button
              variant={currentProvider === "openai" ? "default" : "outline"}
              size="xs"
              onClick={() =>
                updateMutation.mutate({ provider: "openai" })
              }
              disabled={updateMutation.isPending}
            >
              OpenAI
            </Button>
          </div>
        </div>
      )}

      {!canSwitch && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Active Provider</p>
            <p className="text-xs text-muted-foreground">
              Add both API keys to switch between providers
            </p>
          </div>
          <Badge variant="outline">{currentProvider}</Badge>
        </div>
      )}

      <Separator />

      {/* Chat system prompt */}
      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium">Chat System Prompt</p>
          <p className="text-xs text-muted-foreground">
            Customize how the AI assistant behaves. Your collection profile is always appended.
          </p>
        </div>
        <textarea
          value={chatPrompt}
          onChange={(e) => {
            setChatPrompt(e.target.value);
            setChatPromptDirty(true);
          }}
          placeholder="You are VinylIQ, a knowledgeable vinyl record advisor..."
          rows={4}
          className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            onClick={() =>
              updateMutation.mutate({
                chatSystemPrompt: chatPrompt.trim() || null,
              })
            }
            disabled={!chatPromptDirty || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Save className="h-3 w-3 mr-1" />
            )}
            Save
          </Button>
          {prefs?.chatSystemPrompt && (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => {
                setChatPrompt("");
                setChatPromptDirty(true);
                updateMutation.mutate({ chatSystemPrompt: null });
              }}
              disabled={updateMutation.isPending}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Recommendation prompt */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Recommendation Prompt</p>
            <p className="text-xs text-muted-foreground">
              Customize how AI curates album recommendations for you. Your taste profile is always included.
            </p>
          </div>
        </div>
        <textarea
          value={recPrompt}
          onChange={(e) => {
            setRecPrompt(e.target.value);
            setRecPromptDirty(true);
          }}
          placeholder="You are a vinyl record expert and curator. Based on the collector's taste profile, recommend albums they would love..."
          rows={4}
          className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            onClick={() =>
              updateMutation.mutate({
                recommendationPrompt: recPrompt.trim() || null,
              })
            }
            disabled={!recPromptDirty || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Save className="h-3 w-3 mr-1" />
            )}
            Save
          </Button>
          {prefs?.recommendationPrompt && (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => {
                setRecPrompt("");
                setRecPromptDirty(true);
                updateMutation.mutate({ recommendationPrompt: null });
              }}
              disabled={updateMutation.isPending}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CredentialsPage() {
  const { data: status, isLoading } =
    trpc.settings.getCredentialsStatus.useQuery();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <KeyRound className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-sans-display">
            Credentials
          </h1>
          <p className="text-sm text-muted-foreground">
            API keys, service connections, and AI configuration
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
          {/* AI Services — API Keys */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-muted-foreground" />
                <CardTitle>AI Services</CardTitle>
              </div>
              <CardDescription>
                API keys for AI-powered recommendations, chat, and evaluations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <ApiKeyInput
                provider="anthropic"
                label="Anthropic (Claude)"
                configured={status.ai.anthropic}
                maskedKey={status.ai.anthropicMasked ?? null}
                fromEnv={status.ai.anthropicFromEnv}
              />
              <Separator />
              <ApiKeyInput
                provider="openai"
                label="OpenAI"
                configured={status.ai.openai}
                maskedKey={status.ai.openaiMasked ?? null}
                fromEnv={status.ai.openaiFromEnv}
              />
              <Separator />
              <AiPreferences
                hasAnthropic={status.ai.anthropic}
                hasOpenai={status.ai.openai}
              />
            </CardContent>
          </Card>

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
                    <p className="font-mono text-xs text-muted-foreground">
                      DISCOGS_CONSUMER_KEY
                    </p>
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
                    <p className="font-mono text-xs text-muted-foreground">
                      SPOTIFY_CLIENT_ID
                    </p>
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

          {/* Infrastructure */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Infrastructure</CardTitle>
              </div>
              <CardDescription>Caching and storage services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Upstash Redis</p>
                  <p className="font-mono text-xs text-muted-foreground">UPSTASH_REDIS_REST_URL</p>
                </div>
                <StatusIndicator configured={status.cache.redis} />
              </div>
            </CardContent>
          </Card>

          {/* Auth */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Authentication</CardTitle>
              </div>
              <CardDescription>
                Session and auth configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Auth Secret</p>
                  <p className="font-mono text-xs text-muted-foreground">BETTER_AUTH_SECRET</p>
                </div>
                <StatusIndicator configured={status.auth.secret} />
              </div>
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
            AI API keys can be added above or set via environment variables.
            Music service credentials are configured via environment variables in your deployment platform.
          </p>
        </>
      ) : null}
    </div>
  );
}
