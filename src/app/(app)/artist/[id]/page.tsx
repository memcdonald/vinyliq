'use client';

import { use, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, User, Users, ExternalLink } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

function ArtistSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="mb-6 h-5 w-24" />
      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function ArtistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const discogsId = Number(id);
  const [releasePage, setReleasePage] = useState(1);

  const { data: artist, isLoading, isError } = trpc.artist.getByDiscogsId.useQuery(
    { discogsId },
    { enabled: !isNaN(discogsId) },
  );

  const { data: releasesData, isLoading: releasesLoading } = trpc.artist.getReleases.useQuery(
    { discogsId, page: releasePage },
    { enabled: !isNaN(discogsId) },
  );

  if (isNaN(discogsId)) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h1 className="mb-2 text-2xl font-bold text-destructive">Invalid Artist ID</h1>
          <Button asChild variant="outline">
            <Link href="/search">Back to Search</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) return <ArtistSkeleton />;

  if (isError || !artist) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h1 className="mb-2 text-2xl font-bold text-destructive">
            Failed to Load Artist
          </h1>
          <Button asChild variant="outline">
            <Link href="/search">Back to Search</Link>
          </Button>
        </div>
      </div>
    );
  }

  const primaryImage = artist.images.find((img) => img.type === 'primary') ?? artist.images[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
        <Link href="/search">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Search
        </Link>
      </Button>

      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        {/* Artist image */}
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
          {primaryImage ? (
            <Image
              src={primaryImage.uri}
              alt={artist.name}
              fill
              sizes="(max-width: 768px) 100vw, 280px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User className="h-24 w-24 text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Artist info */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {artist.name}
            </h1>
            {artist.realName && (
              <p className="mt-1 text-sm text-muted-foreground">
                Real name: {artist.realName}
              </p>
            )}
          </div>

          {artist.profile && (
            <p className="max-h-40 overflow-y-auto text-sm text-muted-foreground whitespace-pre-line">
              {artist.profile.slice(0, 800)}
              {artist.profile.length > 800 ? '...' : ''}
            </p>
          )}

          {/* External links */}
          {artist.urls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {artist.urls.slice(0, 5).map((url) => {
                const domain = (() => {
                  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
                })();
                return (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {domain}
                  </a>
                );
              })}
            </div>
          )}

          <Separator />

          {/* Members / Groups */}
          {artist.members.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <Users className="h-4 w-4 text-muted-foreground" />
                Members
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {artist.members.map((m) => (
                  <Link key={m.id} href={`/artist/${m.id}`}>
                    <Badge variant={m.active ? 'default' : 'secondary'} className="cursor-pointer">
                      {m.name}
                      {!m.active && ' (former)'}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {artist.groups.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <Users className="h-4 w-4 text-muted-foreground" />
                Groups
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {artist.groups.map((g) => (
                  <Link key={g.id} href={`/artist/${g.id}`}>
                    <Badge variant={g.active ? 'default' : 'secondary'} className="cursor-pointer">
                      {g.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Discography */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>
            Discography
            {releasesData && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({releasesData.pagination.items} releases)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {releasesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : releasesData && releasesData.releases.length > 0 ? (
            <>
              <div className="space-y-1">
                {releasesData.releases.map((release) => {
                  const href =
                    release.type === 'master'
                      ? `/album/master-${release.id}`
                      : `/album/release-${release.id}`;
                  return (
                    <Link
                      key={`${release.type}-${release.id}`}
                      href={href}
                      className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                    >
                      {release.thumb ? (
                        <Image
                          src={release.thumb}
                          alt={release.title}
                          width={40}
                          height={40}
                          className="rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                          <User className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{release.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {release.year > 0 ? release.year : 'Unknown'}
                          {release.label && ` - ${release.label}`}
                          {release.role && release.role !== 'Main' && ` (${release.role})`}
                        </p>
                      </div>
                      {release.format && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {release.format}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Pagination */}
              {releasesData.pagination.pages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={releasePage <= 1}
                    onClick={() => setReleasePage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {releasesData.pagination.page} of {releasesData.pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={releasePage >= releasesData.pagination.pages}
                    onClick={() => setReleasePage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No releases found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
