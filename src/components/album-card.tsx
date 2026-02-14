'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface AlbumCardProps {
  id: number;
  type: string;
  title: string;
  thumb: string;
  year: string;
  genre: string[];
  style: string[];
  format: string[];
  label: string[];
  masterId: number | null;
}

export function AlbumCard({
  id,
  type,
  title,
  thumb,
  year,
  genre,
  format,
  label,
  masterId,
}: AlbumCardProps) {
  const href =
    masterId && type !== 'artist'
      ? `/album/master-${masterId}`
      : `/album/${type}-${id}`;

  const formatText = format.length > 0 ? format.join(', ') : null;
  const firstLabel = label.length > 0 ? label[0] : null;

  return (
    <Link href={href} className="group block">
      <Card className="h-full overflow-hidden py-0 transition-shadow hover:shadow-md">
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {thumb ? (
            <Image
              src={thumb}
              alt={title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
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
            {title}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {year && <span>{year}</span>}
            {year && firstLabel && <span>-</span>}
            {firstLabel && (
              <span className="truncate">{firstLabel}</span>
            )}
          </div>
          {formatText && (
            <p className="truncate text-xs text-muted-foreground">
              {formatText}
            </p>
          )}
          {genre.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {genre.slice(0, 2).map((g) => (
                <Badge
                  key={g}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0"
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
}
