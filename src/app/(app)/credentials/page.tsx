"use client";

import { useState, useEffect } from "react";
import {
  KeyRound,
  CheckCircle2,
  XCircle,
  Bot,
  Disc3,
  Music,
  Shield,
  Database,
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

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function StatusDot({ configured }: { configured: boolean }) {
  return configured ? (
    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
  ) : (
    <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
  );
}

function SiteKeyRow({
  configKey,
  label,
  description,
  icon,
}: {
  configKey: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}) {
  const { data: status } = trpc.siteConfig.getStatus.useQuery();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [showKey, setShowKey] = useState(false);

  const info = status?.[configKey];

  const saveMutation = trpc.siteConfig.saveKey.useMutation({
    onSuccess: () => {
      toast.success(`${label} saved`);
      utils.siteConfig.getStatus.invalidate();
      utils.settings.getCredentialsStatus.invalidate();
      setEditing(false);
      setValue("");
    },
    onError: (error) => toast.error("Failed to save", { description: error.message }),
  });

  const removeMutation = trpc.siteConfig.removeKey.useMutation({
    onSuccess: () => {
      toast.success(`${label} removed`);
      utils.siteConfig.getStatus.invalidate();
      utils.settings.getCredentialsStatus.invalidate();
    },
    onError: (error) => toast.error("Failed to remove", { description: error.message }),
  });

  if (editing) {
    return (
      <div className="space-y-2 py-3">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-medium">{label}</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Enter ${label}...`}
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
            onClick={() => saveMutation.mutate({ key: configKey as never, value })}
            disabled={!value.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setValue(""); }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground truncate">
            {info?.masked
              ? info.masked
              : info?.fromEnv
                ? "Set via environment variable"
                : description}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          {info?.configured ? "Change" : "Add"}
        </Button>
        {info?.fromDb && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => removeMutation.mutate({ key: configKey as never })}
            disabled={removeMutation.isPending}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
        <StatusDot configured={!!info?.configured} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Preferences (provider switch, prompts)
// ---------------------------------------------------------------------------

function AiPreferences() {
  const { data: status } = trpc.siteConfig.getStatus.useQuery();
  const { data: prefs, isLoading } = trpc.settings.getAiPreferences.useQuery();
  const utils = trpc.useUtils();

  const hasAnthropic = !!status?.anthropic_api_key?.configured;
  const hasOpenai = !!status?.openai_api_key?.configured;

  const [chatPrompt, setChatPrompt] = useState("");
  const [chatDirty, setChatDirty] = useState(false);
  const [recPrompt, setRecPrompt] = useState("");
  const [recDirty, setRecDirty] = useState(false);

  useEffect(() => {
    if (prefs?.chatSystemPrompt) setChatPrompt(prefs.chatSystemPrompt);
    if (prefs?.recommendationPrompt) setRecPrompt(prefs.recommendationPrompt);
  }, [prefs?.chatSystemPrompt, prefs?.recommendationPrompt]);

  const updateMutation = trpc.settings.updateAiPreferences.useMutation({
    onSuccess: () => {
      toast.success("AI preferences saved");
      utils.settings.getAiPreferences.invalidate();
      setChatDirty(false);
      setRecDirty(false);
    },
    onError: (error) => toast.error("Failed to save", { description: error.message }),
  });

  if (isLoading) return <Skeleton className="h-24 w-full rounded-lg" />;

  const currentProvider = prefs?.provider ?? "claude";
  const canSwitch = hasAnthropic && hasOpenai;

  return (
    <div className="space-y-4 pt-2">
      <Separator />

      {/* Provider switcher */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Active Provider</p>
          <p className="text-xs text-muted-foreground">
            {canSwitch ? "Choose which AI to use" : "Add both keys to switch providers"}
          </p>
        </div>
        {canSwitch ? (
          <div className="flex gap-1">
            {(["claude", "openai"] as const).map((p) => (
              <Button
                key={p}
                variant={currentProvider === p ? "default" : "outline"}
                size="sm"
                onClick={() => updateMutation.mutate({ provider: p })}
                disabled={updateMutation.isPending}
              >
                {p === "claude" ? "Claude" : "OpenAI"}
              </Button>
            ))}
          </div>
        ) : (
          <Badge variant="outline">{currentProvider}</Badge>
        )}
      </div>

      {/* Chat prompt */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Chat System Prompt</p>
        <textarea
          value={chatPrompt}
          onChange={(e) => { setChatPrompt(e.target.value); setChatDirty(true); }}
          placeholder="You are VinylIQ, a knowledgeable vinyl record advisor..."
          rows={3}
          className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => updateMutation.mutate({ chatSystemPrompt: chatPrompt.trim() || null })}
            disabled={!chatDirty || updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
            Save
          </Button>
          {prefs?.chatSystemPrompt && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => { setChatPrompt(""); setChatDirty(true); updateMutation.mutate({ chatSystemPrompt: null }); }}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Recommendation prompt */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Recommendation Prompt</p>
        </div>
        <textarea
          value={recPrompt}
          onChange={(e) => { setRecPrompt(e.target.value); setRecDirty(true); }}
          placeholder="You are a vinyl record expert and curator..."
          rows={3}
          className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => updateMutation.mutate({ recommendationPrompt: recPrompt.trim() || null })}
            disabled={!recDirty || updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
            Save
          </Button>
          {prefs?.recommendationPrompt && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => { setRecPrompt(""); setRecDirty(true); updateMutation.mutate({ recommendationPrompt: null }); }}
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

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CredentialsPage() {
  const { data: status, isLoading } = trpc.siteConfig.getStatus.useQuery();
  const { data: legacyStatus } = trpc.settings.getCredentialsStatus.useQuery();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <KeyRound className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-sans-display">
            Credentials
          </h1>
          <p className="text-sm text-muted-foreground">
            API keys and service configuration
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* AI Services */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-muted-foreground" />
                <CardTitle>AI Services</CardTitle>
              </div>
              <CardDescription>
                Powers recommendations, chat, collectability scoring, and evaluations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border">
              <SiteKeyRow
                configKey="anthropic_api_key"
                label="Anthropic API Key"
                description="For Claude — recommendations, chat, scoring"
                icon={<Bot className="h-4 w-4 text-muted-foreground shrink-0" />}
              />
              <SiteKeyRow
                configKey="openai_api_key"
                label="OpenAI API Key"
                description="Alternative AI provider"
                icon={<Bot className="h-4 w-4 text-muted-foreground shrink-0" />}
              />
              <AiPreferences />
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
                Collection import and music data integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border">
              <SiteKeyRow
                configKey="discogs_consumer_key"
                label="Discogs Consumer Key"
                description="Required for Discogs OAuth and collection import"
                icon={<Disc3 className="h-4 w-4 text-muted-foreground shrink-0" />}
              />
              <SiteKeyRow
                configKey="discogs_consumer_secret"
                label="Discogs Consumer Secret"
                description="Paired with consumer key"
                icon={<Disc3 className="h-4 w-4 text-muted-foreground shrink-0" />}
              />
              <SiteKeyRow
                configKey="spotify_client_id"
                label="Spotify Client ID"
                description="Required for Spotify OAuth and library import"
                icon={<Music className="h-4 w-4 text-muted-foreground shrink-0" />}
              />
              <SiteKeyRow
                configKey="spotify_client_secret"
                label="Spotify Client Secret"
                description="Paired with client ID"
                icon={<Music className="h-4 w-4 text-muted-foreground shrink-0" />}
              />
            </CardContent>
          </Card>

          {/* Infrastructure (read-only status) */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Infrastructure</CardTitle>
              </div>
              <CardDescription>
                Environment-level configuration (set via deployment platform)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border">
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Database</p>
                    <p className="text-xs text-muted-foreground font-mono">DATABASE_URL</p>
                  </div>
                </div>
                <StatusDot configured={true} />
              </div>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Redis Cache</p>
                    <p className="text-xs text-muted-foreground font-mono">UPSTASH_REDIS_REST_URL</p>
                  </div>
                </div>
                <StatusDot configured={!!legacyStatus?.cache?.redis} />
              </div>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Auth</p>
                    <p className="text-xs text-muted-foreground font-mono">BETTER_AUTH_SECRET</p>
                  </div>
                </div>
                <StatusDot configured={!!legacyStatus?.auth?.secret} />
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Keys set here are stored in the database and override environment variables.
            Infrastructure keys must be set in your deployment platform.
          </p>
        </>
      )}
    </div>
  );
}
