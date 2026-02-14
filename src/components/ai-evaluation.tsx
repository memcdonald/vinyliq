"use client";

import { Sparkles, CheckCircle, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AiEvaluationProps {
  albumId: string;
}

function ScoreBadge({ score }: { score: number }) {
  let colorClass: string;
  if (score >= 8) {
    colorClass = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  } else if (score >= 5) {
    colorClass = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  } else {
    colorClass = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-sm font-bold",
        colorClass,
      )}
    >
      {score}/10
    </span>
  );
}

export function AiEvaluation({ albumId }: AiEvaluationProps) {
  const { data: aiConfig } = trpc.ai.isConfigured.useQuery();
  const evaluateMutation = trpc.ai.evaluateAlbum.useMutation();

  if (!aiConfig?.configured) return null;

  if (evaluateMutation.isIdle) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Get a personalized evaluation of this album based on your taste profile.
          </p>
          <Button
            size="sm"
            onClick={() => evaluateMutation.mutate({ albumId })}
            disabled={!albumId}
          >
            <Sparkles className="mr-1 h-4 w-4" />
            Analyze Album
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (evaluateMutation.isPending) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 animate-pulse" />
            AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (evaluateMutation.isError) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-destructive">
            {evaluateMutation.error.message}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => evaluateMutation.mutate({ albumId })}
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = evaluateMutation.data;
  if (!data) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            AI Analysis
          </CardTitle>
          <ScoreBadge score={data.score} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed">{data.evaluation}</p>

        {data.highlights.length > 0 && (
          <div className="space-y-1.5">
            {data.highlights.map((highlight, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
                <span>{highlight}</span>
              </div>
            ))}
          </div>
        )}

        {data.concerns.length > 0 && (
          <div className="space-y-1.5">
            {data.concerns.map((concern, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{concern}</span>
              </div>
            ))}
          </div>
        )}

        {data.cached && (
          <p className="text-xs text-muted-foreground/60">
            Cached result. Click to refresh.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
