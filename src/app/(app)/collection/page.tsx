"use client";

import Image from "next/image";
import Link from "next/link";
import { Library, Star, Search } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
            <h1 className="text-2xl font-bold tracking-tight">
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
                                ? "fill-yellow-400 text-yellow-400"
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
