import { rateLimiter, type RateLimiter } from './rate-limiter';
import type {
  DiscogsSearchResponse,
  DiscogsMaster,
  DiscogsRelease,
  DiscogsArtist,
  DiscogsMasterVersionsResponse,
} from './types';
import { cached, CacheTTL, CacheKey } from '@/lib/cache';

class DiscogsClient {
  private userAgent: string = 'VinylIQ/1.0';
  private baseUrl: string = 'https://api.discogs.com';
  private rateLimiter: RateLimiter;

  /**
   * Credentials are resolved lazily on first use so the module can be
   * imported safely at build/startup time without requiring env vars to
   * be present immediately.
   */
  private _consumerKey: string | undefined;
  private _consumerSecret: string | undefined;

  constructor(rateLimiter: RateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  // ---------- lazy credential getters ----------

  private get consumerKey(): string {
    if (!this._consumerKey) {
      const key = process.env.DISCOGS_CONSUMER_KEY;
      if (!key) {
        throw new Error(
          'DISCOGS_CONSUMER_KEY is not set. Please add it to your environment variables.',
        );
      }
      this._consumerKey = key;
    }
    return this._consumerKey;
  }

  private get consumerSecret(): string {
    if (!this._consumerSecret) {
      const secret = process.env.DISCOGS_CONSUMER_SECRET;
      if (!secret) {
        throw new Error(
          'DISCOGS_CONSUMER_SECRET is not set. Please add it to your environment variables.',
        );
      }
      this._consumerSecret = secret;
    }
    return this._consumerSecret;
  }

  // ---------- public API ----------

  /**
   * Search the Discogs database.
   *
   * @see https://www.discogs.com/developers#page:database,header:database-search
   */
  async search(params: {
    q: string;
    type?: string;
    page?: number;
    per_page?: number;
  }): Promise<DiscogsSearchResponse> {
    const queryParams: Record<string, string> = { q: params.q };
    if (params.type) queryParams.type = params.type;
    if (params.page !== undefined) queryParams.page = String(params.page);
    if (params.per_page !== undefined) queryParams.per_page = String(params.per_page);

    return cached(
      CacheKey.discogsSearch(params.q, params.page ?? 1),
      () => this.request<DiscogsSearchResponse>('/database/search', queryParams),
      CacheTTL.SHORT,
    );
  }

  /**
   * Get a master release by ID.
   *
   * @see https://www.discogs.com/developers#page:database,header:database-master-release
   */
  async getMaster(masterId: number): Promise<DiscogsMaster> {
    return cached(
      CacheKey.discogsMaster(masterId),
      () => this.request<DiscogsMaster>(`/masters/${masterId}`),
      CacheTTL.MEDIUM,
    );
  }

  /**
   * Get a release by ID.
   *
   * @see https://www.discogs.com/developers#page:database,header:database-release
   */
  async getRelease(releaseId: number): Promise<DiscogsRelease> {
    return cached(
      CacheKey.discogsRelease(releaseId),
      () => this.request<DiscogsRelease>(`/releases/${releaseId}`),
      CacheTTL.MEDIUM,
    );
  }

  /**
   * Get an artist by ID.
   *
   * @see https://www.discogs.com/developers#page:database,header:database-artist
   */
  async getArtist(artistId: number): Promise<DiscogsArtist> {
    return cached(
      CacheKey.discogsArtist(artistId),
      () => this.request<DiscogsArtist>(`/artists/${artistId}`),
      CacheTTL.LONG,
    );
  }

  /**
   * Get versions (pressings) of a master release.
   *
   * @see https://www.discogs.com/developers#page:database,header:database-master-release-versions
   */
  async getMasterVersions(
    masterId: number,
    page?: number,
  ): Promise<DiscogsMasterVersionsResponse> {
    const params: Record<string, string> = {};
    if (page !== undefined) params.page = String(page);

    return this.request<DiscogsMasterVersionsResponse>(
      `/masters/${masterId}/versions`,
      params,
    );
  }

  // ---------- private ----------

  /**
   * Make an authenticated, rate-limited request to the Discogs API.
   *
   * Authentication uses the "Consumer Key / Consumer Secret" query-param
   * approach (suitable for server-side unauthenticated/app-level access).
   */
  private async request<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<T> {
    await this.rateLimiter.waitForToken();

    const url = new URL(`${this.baseUrl}${path}`);

    // Auth params
    url.searchParams.set('key', this.consumerKey);
    url.searchParams.set('secret', this.consumerSecret);

    // Additional query params
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/vnd.discogs.v2.discogs+json',
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Discogs API error: ${response.status} ${response.statusText} — ${path}${body ? ` — ${body}` : ''}`,
      );
    }

    return (await response.json()) as T;
  }
}

/** Singleton Discogs client instance for the application. */
export const discogsClient = new DiscogsClient(rateLimiter);

export { DiscogsClient };
