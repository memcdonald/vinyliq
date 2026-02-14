import { Redis } from "@upstash/redis";

// Lazy Redis connection - returns null if not configured
let _redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (_redis === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (url && token) {
      _redis = new Redis({ url, token });
    } else {
      _redis = null;
    }
  }
  return _redis;
}

// TTL presets in seconds
export const CacheTTL = {
  SHORT: 60 * 5,           // 5 minutes - search results
  MEDIUM: 60 * 60,         // 1 hour - album details
  LONG: 60 * 60 * 24,      // 24 hours - artist data, tags
  WEEK: 60 * 60 * 24 * 7,  // 7 days - rarely changing data
} as const;

/**
 * Cache-aside wrapper. Checks Redis first, falls back to fetcher function.
 * Gracefully degrades to no caching if Redis is unavailable.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CacheTTL.MEDIUM,
): Promise<T> {
  const redis = getRedis();

  if (redis) {
    try {
      const cached = await redis.get<T>(key);
      if (cached !== null && cached !== undefined) {
        return cached;
      }
    } catch {
      // Redis unavailable, fall through to fetcher
    }
  }

  const result = await fetcher();

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(result), { ex: ttl });
    } catch {
      // Redis unavailable, continue without caching
    }
  }

  return result;
}

/**
 * Invalidate a specific cache key.
 */
export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Invalidate all cache keys matching a pattern.
 * Uses SCAN to avoid blocking Redis.
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = Number(nextCursor);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== 0);
  } catch {
    // Ignore errors
  }
}

// Cache key builders for consistent naming
export const CacheKey = {
  discogsSearch: (query: string, page: number) => `discogs:search:${query}:${page}`,
  discogsMaster: (id: number) => `discogs:master:${id}`,
  discogsRelease: (id: number) => `discogs:release:${id}`,
  discogsArtist: (id: number) => `discogs:artist:${id}`,
  mbReleaseGroup: (id: string) => `mb:release-group:${id}`,
  mbRelease: (id: string) => `mb:release:${id}`,
  mbArtist: (id: string) => `mb:artist:${id}`,
  spotifyAlbum: (id: string) => `spotify:album:${id}`,
  spotifyArtist: (id: string) => `spotify:artist:${id}`,
  spotifySearch: (query: string) => `spotify:search:${query}`,
  albumEnriched: (id: string) => `album:enriched:${id}`,
} as const;
