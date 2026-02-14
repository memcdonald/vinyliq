'use client';

import { use, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Star, Users, Heart } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { CollectionActions } from '@/components/collection-actions';
import { AlbumEnrichment } from '@/components/album-enrichment';

function parseAlbumId(id: string): { type: 'master' | 'release'; discogsId: number } | null {
  const match = id.match(/^(master|release)-(\d+)$/);
  if (!match) return null;
  return {
    type: match[1] as 'master' | 'release',
    discogsId: Number(match[2]),
  };
}

function formatArtists(
  artists: { id: number; name: string; join: string }[],
): string {
  return artists
    .map((a, i) => {
      const name = a.name;
      if (i < artists.length - 1 && a.join) {
        return `${name} ${a.join} `;
      }
      return name;
    })
    .join('');
}

function AlbumDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="mb-6 h-5 w-24" />
      <div className="grid gap-8 md:grid-cols-[350px_1fr]">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
          <Separator />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const parsed = parseAlbumId(id);

  const { data, isLoading, isError, error } = trpc.album.getByDiscogsId.useQuery(
    { discogsId: parsed?.discogsId ?? 0, type: parsed?.type ?? 'release' },
    { enabled: !!parsed },
  );

  // Ensure the album exists in our DB so we can get an internal UUID for collection actions.
  const ensureAlbumMutation = trpc.album.ensureAlbum.useMutation();
  const albumEnsured = ensureAlbumMutation.data;
  const ensuredRef = useRef(false);

  useEffect(() => {
    if (!data || !parsed || ensuredRef.current) return;
    ensuredRef.current = true;

    const primaryImage = data.images?.find((img) => img.type === 'primary') ?? data.images?.[0];
    ensureAlbumMutation.mutate({
      discogsId: data.id,
      discogsMasterId: parsed.type === 'master' ? data.id : undefined,
      title: data.title,
      thumb: primaryImage?.uri ?? '',
      coverImage: primaryImage?.uri ?? '',
      year: data.year > 0 ? data.year : undefined,
      genres: data.genres,
      styles: data.styles,
      country: data.country ?? undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, parsed]);

  if (!parsed) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h1 className="mb-2 text-2xl font-bold text-destructive">Invalid Album ID</h1>
          <p className="mb-4 text-muted-foreground">
            The album ID &quot;{id}&quot; is not in a valid format.
          </p>
          <Button asChild variant="outline">
            <Link href="/search">Back to Search</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <AlbumDetailSkeleton />;
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h1 className="mb-2 text-2xl font-bold text-destructive">
            Failed to Load Album
          </h1>
          <p className="mb-4 max-w-md text-sm text-muted-foreground">
            {error?.message ?? 'An unexpected error occurred while loading the album.'}
          </p>
          <Button asChild variant="outline">
            <Link href="/search">Back to Search</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const artistString = formatArtists(data.artists);
  const primaryImage = data.images.find((img) => img.type === 'primary') ?? data.images[0];
  const tracklistItems = data.tracklist.filter((t) => t.type === 'track');
  const headings = data.tracklist.filter((t) => t.type === 'heading');

  // Build grouped tracklist (tracks grouped under headings like Side A, Side B)
  const groupedTracklist: { heading: string | null; tracks: typeof tracklistItems }[] = [];
  let currentGroup: { heading: string | null; tracks: typeof tracklistItems } = {
    heading: null,
    tracks: [],
  };

  for (const item of data.tracklist) {
    if (item.type === 'heading') {
      if (currentGroup.tracks.length > 0 || currentGroup.heading !== null) {
        groupedTracklist.push(currentGroup);
      }
      currentGroup = { heading: item.title, tracks: [] };
    } else if (item.type === 'track') {
      currentGroup.tracks.push(item);
    }
  }
  if (currentGroup.tracks.length > 0 || currentGroup.heading !== null) {
    groupedTracklist.push(currentGroup);
  }

  const formatDescriptions =
    data.formats.length > 0
      ? data.formats
          .map((f) => {
            const parts = [f.name];
            if (f.descriptions.length > 0) {
              parts.push(f.descriptions.join(', '));
            }
            return parts.join(' - ');
          })
          .join('; ')
      : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
        <Link href="/search">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Search
        </Link>
      </Button>

      <div className="grid gap-8 md:grid-cols-[350px_1fr]">
        {/* Cover art */}
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
          {primaryImage ? (
            <Image
              src={primaryImage.uri}
              alt={data.title}
              fill
              sizes="(max-width: 768px) 100vw, 350px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg
                className="h-24 w-24 text-muted-foreground/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
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

        {/* Album info */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {data.title}
            </h1>
            <p className="mt-1 text-lg text-muted-foreground">{artistString}</p>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {data.year > 0 && <span>{data.year}</span>}
            {data.country && <span>{data.country}</span>}
            {data.labels.length > 0 && (
              <span>
                {data.labels.map((l) => l.name).join(', ')}
                {data.labels[0]?.catno && ` - ${data.labels[0].catno}`}
              </span>
            )}
          </div>

          {/* Format */}
          {formatDescriptions && (
            <p className="text-sm text-muted-foreground">{formatDescriptions}</p>
          )}

          {/* Genre and style badges */}
          <div className="flex flex-wrap gap-1.5">
            {data.genres.map((genre) => (
              <Badge key={genre} variant="default">
                {genre}
              </Badge>
            ))}
            {data.styles.map((style) => (
              <Badge key={style} variant="secondary">
                {style}
              </Badge>
            ))}
          </div>

          {/* Community stats */}
          {data.community && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-1.5 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{data.community.have.toLocaleString()}</span>
                  <span className="text-muted-foreground">have</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Heart className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{data.community.want.toLocaleString()}</span>
                  <span className="text-muted-foreground">want</span>
                </div>
                {data.community.rating.count > 0 && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Star className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {data.community.rating.average.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground">
                      / 5 ({data.community.rating.count.toLocaleString()} ratings)
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Collection actions */}
          <CollectionActions
            albumId={albumEnsured?.id ?? ''}
            discogsId={data.id}
            discogsType={parsed.type}
            title={data.title}
            thumb={primaryImage?.uri ?? ''}
            year={data.year}
            genres={data.genres}
            styles={data.styles}
            coverImage={primaryImage?.uri ?? ''}
          />
        </div>
      </div>

      {/* Tracklist */}
      {data.tracklist.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Tracklist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {groupedTracklist.map((group, groupIdx) => (
                <div key={groupIdx}>
                  {group.heading && (
                    <div className="mb-1 mt-3 first:mt-0">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.heading}
                      </span>
                    </div>
                  )}
                  {group.tracks.map((track, trackIdx) => (
                    <div
                      key={`${groupIdx}-${trackIdx}`}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                    >
                      <span className="w-8 text-right text-sm text-muted-foreground">
                        {track.position}
                      </span>
                      <span className="flex-1 text-sm">{track.title}</span>
                      {track.duration && (
                        <span className="text-sm text-muted-foreground">
                          {track.duration}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {data.notes && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {data.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Enriched data from MusicBrainz + Spotify */}
      {albumEnsured?.id && (
        <AlbumEnrichment
          albumId={albumEnsured.id}
          title={data.title}
          artists={data.artists.map((a) => a.name)}
          year={data.year > 0 ? data.year : undefined}
          labels={data.labels}
          identifiers={data.identifiers}
        />
      )}
    </div>
  );
}
