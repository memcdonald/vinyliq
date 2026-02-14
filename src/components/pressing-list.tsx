'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Disc3, Globe, ChevronLeft, ChevronRight, Users, Heart } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface PressingListProps {
  masterId: number | null;
  currentReleaseId: number;
}

/** Map of country codes/names to flag emojis for common vinyl pressing countries. */
const COUNTRY_FLAGS: Record<string, string> = {
  US: '\u{1F1FA}\u{1F1F8}',
  UK: '\u{1F1EC}\u{1F1E7}',
  Germany: '\u{1F1E9}\u{1F1EA}',
  France: '\u{1F1EB}\u{1F1F7}',
  Japan: '\u{1F1EF}\u{1F1F5}',
  Canada: '\u{1F1E8}\u{1F1E6}',
  Italy: '\u{1F1EE}\u{1F1F9}',
  Netherlands: '\u{1F1F3}\u{1F1F1}',
  Australia: '\u{1F1E6}\u{1F1FA}',
  Spain: '\u{1F1EA}\u{1F1F8}',
  Brazil: '\u{1F1E7}\u{1F1F7}',
  Sweden: '\u{1F1F8}\u{1F1EA}',
  Mexico: '\u{1F1F2}\u{1F1FD}',
  Europe: '\u{1F1EA}\u{1F1FA}',
  Argentina: '\u{1F1E6}\u{1F1F7}',
  Portugal: '\u{1F1F5}\u{1F1F9}',
  Greece: '\u{1F1EC}\u{1F1F7}',
  'South Africa': '\u{1F1FF}\u{1F1E6}',
  'New Zealand': '\u{1F1F3}\u{1F1FF}',
  Belgium: '\u{1F1E7}\u{1F1EA}',
  Denmark: '\u{1F1E9}\u{1F1F0}',
  Norway: '\u{1F1F3}\u{1F1F4}',
  Finland: '\u{1F1EB}\u{1F1EE}',
  Austria: '\u{1F1E6}\u{1F1F9}',
  Switzerland: '\u{1F1E8}\u{1F1ED}',
  Ireland: '\u{1F1EE}\u{1F1EA}',
  Poland: '\u{1F1F5}\u{1F1F1}',
  'South Korea': '\u{1F1F0}\u{1F1F7}',
  India: '\u{1F1EE}\u{1F1F3}',
  Russia: '\u{1F1F7}\u{1F1FA}',
  Turkey: '\u{1F1F9}\u{1F1F7}',
  Colombia: '\u{1F1E8}\u{1F1F4}',
  Chile: '\u{1F1E8}\u{1F1F1}',
  Philippines: '\u{1F1F5}\u{1F1ED}',
  Israel: '\u{1F1EE}\u{1F1F1}',
  Taiwan: '\u{1F1F9}\u{1F1FC}',
  Yugoslavia: '\u{1F3F3}\u{FE0F}',
  Czechoslovakia: '\u{1F3F3}\u{FE0F}',
  'Unknown Country': '\u{1F310}',
};

function getCountryDisplay(country: string): string {
  if (!country) return '\u{1F310}';
  return COUNTRY_FLAGS[country] ?? country;
}

function PressingListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-md px-3 py-2.5"
        >
          <Skeleton className="h-5 w-8" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24 hidden sm:block" />
          <Skeleton className="h-5 w-12 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function PressingList({ masterId, currentReleaseId }: PressingListProps) {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = trpc.album.getPressings.useQuery(
    { masterId: masterId!, page },
    { enabled: !!masterId },
  );

  if (!masterId) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Disc3 className="h-4 w-4" />
          Pressing Variants
          {data && (
            <Badge variant="secondary" className="ml-2 text-xs font-normal">
              {data.pagination.items.toLocaleString()} version{data.pagination.items !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <PressingListSkeleton />}

        {isError && (
          <p className="text-sm text-muted-foreground">
            Unable to load pressing variants.
          </p>
        )}

        {data && data.pressings.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No pressing variants found for this release.
          </p>
        )}

        {data && data.pressings.length > 0 && (
          <>
            {/* Column headers */}
            <div className="mb-1 flex items-center gap-3 border-b px-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span className="w-10">
                <Globe className="inline h-3 w-3" />
              </span>
              <span className="flex-1 min-w-0">Label / Cat#</span>
              <span className="hidden w-36 sm:block">Format</span>
              <span className="w-12 text-center">Year</span>
              <span className="hidden w-24 text-right md:block">Community</span>
            </div>

            {/* Pressing rows */}
            <div className="space-y-0.5">
              {data.pressings.map((pressing) => {
                const isCurrentRelease = pressing.id === currentReleaseId;
                return (
                  <Link
                    key={pressing.id}
                    href={`/album/release-${pressing.id}`}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/50 ${
                      isCurrentRelease
                        ? 'bg-primary/10 ring-1 ring-primary/20 font-medium'
                        : ''
                    }`}
                  >
                    {/* Country */}
                    <span className="w-10 shrink-0 text-center" title={pressing.country}>
                      {getCountryDisplay(pressing.country)}
                    </span>

                    {/* Label + Cat# */}
                    <span className="flex-1 min-w-0 truncate">
                      <span className="font-medium">{pressing.label || 'Unknown'}</span>
                      {pressing.catno && pressing.catno !== 'none' && (
                        <span className="ml-1.5 text-muted-foreground">
                          {pressing.catno}
                        </span>
                      )}
                    </span>

                    {/* Format */}
                    <span className="hidden w-36 shrink-0 truncate text-muted-foreground sm:block">
                      {pressing.format || '-'}
                    </span>

                    {/* Year */}
                    <span className="w-12 shrink-0 text-center text-muted-foreground">
                      {pressing.year || '-'}
                    </span>

                    {/* Community stats */}
                    <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground md:flex md:items-center md:justify-end md:gap-2">
                      <span className="inline-flex items-center gap-0.5" title="In collections">
                        <Users className="h-3 w-3" />
                        {pressing.inCollection.toLocaleString()}
                      </span>
                      <span className="inline-flex items-center gap-0.5" title="In wantlists">
                        <Heart className="h-3 w-3" />
                        {pressing.inWantlist.toLocaleString()}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {data.pagination.pages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-xs text-muted-foreground">
                  Page {data.pagination.page} of {data.pagination.pages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.pagination.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Previous page</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.pagination.page >= data.pagination.pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">Next page</span>
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
