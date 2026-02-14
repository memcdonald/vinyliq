'use client';

import { useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlbumCard } from '@/components/album-card';

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page') ?? '1');

  const [inputValue, setInputValue] = useState(q);

  const { data, isLoading, isError, error } = trpc.search.query.useQuery(
    { q, page, perPage: 24 },
    { enabled: q.length > 0 },
  );

  const updateSearch = useCallback(
    (query: string, newPage: number = 1) => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (newPage > 1) params.set('page', String(newPage));
      router.push(`/search?${params.toString()}`);
    },
    [router],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed) {
      updateSearch(trimmed);
    }
  };

  const handlePageChange = (newPage: number) => {
    updateSearch(q, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Search header */}
      <div className="mb-8">
        <h1 className="mb-4 text-3xl font-bold tracking-tight font-sans-display">
          Search Records
        </h1>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for albums, artists, labels..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </div>

      {/* Empty state - no query */}
      {!q && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Search className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h2 className="mb-2 text-xl font-semibold text-muted-foreground">
            Find your next record
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Search the Discogs database for vinyl records, albums, and artists.
            Enter a search term above to get started.
          </p>
        </div>
      )}

      {/* Loading state */}
      {q && isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {q && isError && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h2 className="mb-2 text-xl font-semibold text-destructive">
            Something went wrong
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {error?.message ?? 'Failed to fetch search results. Please try again.'}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => updateSearch(q, page)}
          >
            Retry
          </Button>
        </div>
      )}

      {/* No results */}
      {q && !isLoading && !isError && data && data.results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h2 className="mb-2 text-xl font-semibold text-muted-foreground">
            No results found
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            No records found for &quot;{q}&quot;. Try a different search term.
          </p>
        </div>
      )}

      {/* Results grid */}
      {q && !isLoading && !isError && data && data.results.length > 0 && (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            Showing page {data.pagination.page} of {data.pagination.pages}
            {' '}({data.pagination.items.toLocaleString()} total results)
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {data.results.map((result) => (
              <AlbumCard key={`${result.type}-${result.id}`} {...result} />
            ))}
          </div>

          {/* Pagination */}
          {data.pagination.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={data.pagination.page <= 1}
                onClick={() => handlePageChange(data.pagination.page - 1)}
              >
                Previous
              </Button>

              {generatePageNumbers(data.pagination.page, data.pagination.pages).map(
                (pageNum, i) =>
                  pageNum === null ? (
                    <span
                      key={`ellipsis-${i}`}
                      className="px-1 text-muted-foreground"
                    >
                      ...
                    </span>
                  ) : (
                    <Button
                      key={pageNum}
                      variant={pageNum === data.pagination.page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  ),
              )}

              <Button
                variant="outline"
                size="sm"
                disabled={data.pagination.page >= data.pagination.pages}
                onClick={() => handlePageChange(data.pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Generate an array of page numbers to display in pagination.
 * Returns null for ellipsis positions.
 */
function generatePageNumbers(
  current: number,
  total: number,
): (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | null)[] = [];

  // Always show first page
  pages.push(1);

  if (current > 3) {
    pages.push(null); // ellipsis
  }

  // Show pages around current
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push(null); // ellipsis
  }

  // Always show last page
  pages.push(total);

  return pages;
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Skeleton className="mb-4 h-10 w-64" />
          <Skeleton className="mb-8 h-9 w-full" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
