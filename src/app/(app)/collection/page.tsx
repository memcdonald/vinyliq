"use client";

import Image from "next/image";
import Link from "next/link";
import { Library, Star, Search, BarChart3, Disc3, Heart, Headphones } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

function CollectionSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <Card key={i} className="overflow-hidden py-0">
          <Skeleton className="aspect-square w-full" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function CollectionStats() {
  const { data: stats, isLoading } = trpc.collection.stats.useQuery();

  if (isLoading) {
    return (
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!stats || stats.totalAlbums === 0) return null;

  return (
    <div className="mb-8 space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Disc3 className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="text-2xl font-bold">{stats.owned}</p>
              <p className="text-xs text-muted-foreground">Owned</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Heart className="h-8 w-8 text-wine-rose shrink-0" />
            <div>
              <p className="text-2xl font-bold">{stats.wanted}</p>
              <p className="text-xs text-muted-foreground">Wanted</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Headphones className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="text-2xl font-bold">{stats.listened}</p>
              <p className="text-xs text-muted-foreground">Listened</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Star className="h-8 w-8 text-acid-halo shrink-0" />
            <div>
              <p className="text-2xl font-bold">
                {stats.avgRating !== null ? stats.avgRating.toFixed(1) : '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                Avg Rating ({stats.rated})
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Genre and Decade breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        {stats.topGenres.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4" />
                Top Genres
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.topGenres.map((g) => (
                <div key={g.genre} className="flex items-center justify-between">
                  <span className="text-sm">{g.genre}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${Math.max((g.count / stats.topGenres[0].count) * 80, 8)}px`,
                      }}
                    />
                    <span className="text-xs text-muted-foreground w-6 text-right">
                      {g.count}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {stats.topDecades.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4" />
                By Decade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.topDecades.map((d) => (
                <div key={d.decade} className="flex items-center justify-between">
                  <span className="text-sm">{d.decade}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${Math.max((d.count / Math.max(...stats.topDecades.map((x) => x.count))) * 80, 8)}px`,
                      }}
                    />
                    <span className="text-xs text-muted-foreground w-6 text-right">
                      {d.count}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function CollectionPage() {
  const { data, isLoading } = trpc.collection.getAll.useQuery({
    status: "owned",
  });

  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Library className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-sans-display">
              Your Collection
            </h1>
            {!isLoading && (
              <p className="text-sm text-muted-foreground">
                {items.length} {items.length === 1 ? "album" : "albums"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Dashboard */}
      <CollectionStats />

      {isLoading ? (
        <CollectionSkeleton />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Library className="mb-4 h-16 w-16 text-muted-foreground/40" />
          <h2 className="mb-2 text-lg font-semibold">
            Your collection is empty
          </h2>
          <p className="mb-6 max-w-md text-sm text-muted-foreground">
            Search for albums to add to your collection.
          </p>
          <Button asChild>
            <Link href="/search">
              <Search className="mr-2 h-4 w-4" />
              Search Albums
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => {
            const href = item.discogsMasterId
              ? `/album/master-${item.discogsMasterId}`
              : item.discogsId
                ? `/album/release-${item.discogsId}`
                : "#";

            return (
              <Link key={item.id} href={href} className="group block">
                <Card className="h-full overflow-hidden py-0 transition-shadow hover:shadow-md">
                  <div className="relative aspect-square w-full overflow-hidden bg-muted">
                    {item.thumb || item.coverImage ? (
                      <Image
                        src={item.coverImage || item.thumb || ""}
                        alt={item.title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <svg
                          className="h-12 w-12 text-muted-foreground/40"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.846a2.25 2.25 0 00-1.632-2.163l-6.75-1.93A2.25 2.25 0 005.25 2.896v15.357a2.25 2.25 0 001.632 2.163l1.32.377a1.803 1.803 0 10.99-3.467l-2.31-.66A2.25 2.25 0 015.25 14.5V4.846"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <CardContent className="space-y-1.5 p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {item.year && <span>{item.year}</span>}
                    </div>
                    {item.rating && (
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < item.rating!
                                ? "fill-acid-halo text-acid-halo"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    {item.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.genres.slice(0, 2).map((g) => (
                          <Badge
                            key={g}
                            variant="secondary"
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {g}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
