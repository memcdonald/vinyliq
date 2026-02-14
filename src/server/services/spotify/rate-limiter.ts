/**
 * Simple in-memory token bucket rate limiter for Spotify Web API.
 *
 * Spotify enforces a rolling-window rate limit of roughly 100 requests per
 * minute for most app tiers. This implementation uses a token bucket
 * algorithm: tokens are consumed on each request and refilled at a steady
 * rate (~1.67 tokens/sec to stay within 100/min).
 *
 * For development use only -- production should swap this out for a
 * Redis/Upstash-backed implementation to support multiple server instances.
 */

const MAX_TOKENS = 100;
const REFILL_INTERVAL_MS = 600; // ~1.67 tokens/sec -> 100 per minute

class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillIntervalMs: number;
  private lastRefillTimestamp: number;

  constructor(maxTokens: number = MAX_TOKENS, refillIntervalMs: number = REFILL_INTERVAL_MS) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillIntervalMs = refillIntervalMs;
    this.lastRefillTimestamp = Date.now();
  }

  /**
   * Refill tokens based on elapsed time since the last refill.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTimestamp;
    const tokensToAdd = Math.floor(elapsed / this.refillIntervalMs);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefillTimestamp += tokensToAdd * this.refillIntervalMs;
    }
  }

  /**
   * Try to consume a single token. Returns true if a token was available,
   * false otherwise.
   */
  private tryConsume(): boolean {
    this.refill();

    if (this.tokens > 0) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Wait until a token is available, then consume it.
   *
   * If a token is immediately available, resolves right away.
   * Otherwise polls at the refill interval until a token is freed.
   */
  async waitForToken(): Promise<void> {
    if (this.tryConsume()) {
      return;
    }

    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (this.tryConsume()) {
          clearInterval(interval);
          resolve();
        }
      }, this.refillIntervalMs);
    });
  }
}

/** Singleton rate limiter instance shared across all Spotify API calls. */
export const rateLimiter = new RateLimiter();

export { RateLimiter };
