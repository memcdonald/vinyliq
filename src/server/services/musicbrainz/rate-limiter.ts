/**
 * Simple time-based rate limiter for MusicBrainz API.
 *
 * MusicBrainz enforces a strict limit of **1 request per second**. Exceeding
 * this will result in a 503 Service Unavailable response and may lead to your
 * IP being temporarily blocked.
 *
 * Unlike the Discogs token-bucket approach, this limiter uses a simpler
 * strategy: it tracks the timestamp of the last request and ensures at least
 * 1 000 ms have elapsed before allowing the next one. This is appropriate
 * because MusicBrainz has a hard 1 req/s ceiling with no burst allowance.
 *
 * For development use only — production should swap this out for a
 * Redis/Upstash-backed implementation to support multiple server instances.
 */

const MIN_INTERVAL_MS = 1_000; // 1 request per second

class MusicBrainzRateLimiter {
  private lastRequestTime: number = 0;
  private minIntervalMs: number;

  constructor(minIntervalMs: number = MIN_INTERVAL_MS) {
    this.minIntervalMs = minIntervalMs;
  }

  /**
   * Wait until enough time has elapsed since the last request, then mark the
   * current timestamp. If the minimum interval has already passed, resolves
   * immediately.
   */
  async waitForToken(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const remaining = this.minIntervalMs - elapsed;

    if (remaining > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, remaining));
    }

    this.lastRequestTime = Date.now();
  }
}

/** Singleton rate limiter instance shared across all MusicBrainz API calls. */
export const rateLimiter = new MusicBrainzRateLimiter();

export { MusicBrainzRateLimiter };
