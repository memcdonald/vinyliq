'use client';

import { Compass, RefreshCw, Sparkles, Music } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FunkySpinner } from '@/components/ui/funky-spinner';

function RecommendationCardSkeleton() {
  return (
    <div className="w-[180px] flex-shrink-0">
      <Skeleton className="aspect-square w-full rounded-lg" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <Skeleton className="mt-1 h-3 w-full" />
    </div>
  );
}

function RecommendationCard({
  item,
}: {
  item: {
    albumId: string;
    title: string;
    thumb: string | null;
    coverImage: string | null;
    year: number | null;
    genres: string[];
    discogsId: number | null;
    explanation: string;
  };
}) {
  const image = item.coverImage ?? item.thumb;
  const href = item.discogsId ? `/album/release-${item.discogsId}` : '#';

  return (
    <Link href={href} className="group block w-[180px] flex-shrink-0">
      <Card className="overflow-hidden border-0 bg-transparent shadow-none">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
          {image ? (
            <Image
              src={image}
              alt={item.title}
              fill
              sizes="180px"
              className="object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music className="h-8 w-8 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <CardContent className="space-y-1 px-1 pt-2">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
            {item.title}
          </h3>
          {item.year && (
            <p className="text-xs text-muted-foreground">{item.year}</p>
          )}
          <p className="line-clamp-2 text-xs text-muted-foreground/80 italic">
            {item.explanation}
          </p>
          {item.genres.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.genres.slice(0, 2).map((g) => (
                <Badge key={g} variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {g}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DiscoverPage() {
  const { data: groups, isLoading, isError, error } = trpc.recommendation.getGroups.useQuery();

  const refreshMutation = trpc.recommendation.refresh.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.recommendation.getGroups.invalidate();
    },
    onError: (err) => {
      toast.error(`Failed to refresh: ${err.message}`);
    },
  });

  const utils = trpc.useUtils();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
        <div className="flex items-center gap-3">
          <Compass className="size-7 text-muted-foreground" />
          <h1 className="text-3xl font-bold tracking-tight font-sans-display">Discover</h1>
        </div>
        <FunkySpinner className="py-8" />
        {Array.from({ length: 3 }).map((_, groupIdx) => (
          <div key={groupIdx} className="space-y-4">
            <Skeleton className="h-7 w-48" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <RecommendationCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-6xl p-6 md:p-10">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h1 className="mb-2 text-2xl font-bold text-destructive">
            Failed to Load Recommendations
          </h1>
          <p className="mb-4 max-w-md text-sm text-muted-foreground">
            {error?.message ?? 'An unexpected error occurred.'}
          </p>
          <Button variant="outline" onClick={() => utils.recommendation.getGroups.invalidate()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="flex items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-md text-center">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
            <Sparkles className="size-12 text-muted-foreground" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">No Recommendations Yet</h2>
              <p className="text-sm text-muted-foreground">
                Add some albums to your collection first. We&apos;ll use your taste to find music you&apos;ll love.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/search">Search for Albums</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Compass className="size-7 text-muted-foreground" />
          <h1 className="text-3xl font-bold tracking-tight font-sans-display">Discover</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          <RefreshCw className={`mr-1.5 size-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          {refreshMutation.isPending ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Recommendation Groups */}
      {groups.map((group) => (
        <section key={group.strategy} className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">{group.title}</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
            {group.items.map((item) => (
              <RecommendationCard key={item.albumId} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
