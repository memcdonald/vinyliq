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
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
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
    <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
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

export default function CredentialsPage() {
  const { data: status, isLoading } = trpc.settings.getCredentialsStatus.useQuery();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <KeyRound className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credentials</h1>
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
              <CredentialRow
                label="Discogs Consumer Key"
                envVar="DISCOGS_CONSUMER_KEY"
                configured={status.discogs.consumerKey}
                extra={
                  status.discogs.connected ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Connected{status.discogs.username ? `: ${status.discogs.username}` : ""}
                    </Badge>
                  ) : null
                }
              />
              <Separator />
              <CredentialRow
                label="Spotify Client ID"
                envVar="SPOTIFY_CLIENT_ID"
                configured={status.spotify.clientId}
                extra={
                  status.spotify.connected ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Connected
                    </Badge>
                  ) : null
                }
              />
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
            Environment variables are set in your deployment platform
            (Vercel, .env file, etc.) and cannot be edited from this page.
          </p>
        </>
      ) : null}
    </div>
  );
}
