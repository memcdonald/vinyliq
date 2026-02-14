'use client';

import { useEffect, useRef } from 'react';
import { ExternalLink, Tag, Music, Sparkles } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface AlbumEnrichmentProps {
  albumId: string;
  title: string;
  artists: string[];
  year?: number;
  labels?: { name: string; catno: string }[];
  identifiers?: { type: string; value: string }[];
}

export function AlbumEnrichment({
  albumId,
  title,
  artists,
  year,
  labels,
  identifiers,
}: AlbumEnrichmentProps) {
  const enrichMutation = trpc.album.enrich.useMutation();
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (!albumId || triggeredRef.current) return;
    triggeredRef.current = true;

    const barcodes = identifiers
      ?.filter((i) => i.type === 'Barcode')
      .map((i) => i.value)
      .filter((v) => v.length > 0) ?? [];

    const catno = labels?.[0]?.catno || undefined;
    const label = labels?.[0]?.name || undefined;

    enrichMutation.mutate({
      albumId,
      title,
      artists,
      year,
      barcodes,
      catno,
      label,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId]);

  if (!albumId) return null;

  if (enrichMutation.isPending) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            Enriched Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-16 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    );
  }

  if (enrichMutation.isError || !enrichMutation.data) {
    return null;
  }

  const { musicbrainz, spotify } = enrichMutation.data;
  const hasMbData = musicbrainz && musicbrainz.tags.length > 0;
  const hasSpotifyData = spotify && spotify.spotifyUrl;

  if (!hasMbData && !hasSpotifyData) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" />
          Enriched Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* MusicBrainz tags */}
        {hasMbData && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Tag className="h-3.5 w-3.5" />
              Community Tags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {musicbrainz.tags.slice(0, 15).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
            {musicbrainz.rating !== null && (
              <p className="text-sm text-muted-foreground">
                MusicBrainz rating: {musicbrainz.rating.toFixed(1)} / 5
                {musicbrainz.ratingCount > 0 && (
                  <span> ({musicbrainz.ratingCount} votes)</span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Spotify link */}
        {hasSpotifyData && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Music className="h-3.5 w-3.5" />
              Spotify
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {spotify.spotifyUrl && (
                <a
                  href={spotify.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#1DB954] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in Spotify
                </a>
              )}
              {spotify.popularity !== null && (
                <span className="text-sm text-muted-foreground">
                  Popularity: {spotify.popularity}/100
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
