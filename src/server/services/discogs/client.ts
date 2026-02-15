import { rateLimiter, type RateLimiter } from './rate-limiter';
import type {
  DiscogsSearchResponse,
  DiscogsMaster,
  DiscogsRelease,
  DiscogsArtist,
  DiscogsMasterVersionsResponse,
  DiscogsCollectionFoldersResponse,
  DiscogsCollectionItemsResponse,
  DiscogsArtistReleasesResponse,
} from './types';
import { cached, CacheTTL, CacheKey } from '@/lib/cache';
import { getSiteConfig } from '@/server/services/site-config';

class DiscogsClient {
  private userAgent: string = 'VinylIQ/1.0';
  private baseUrl: string = 'https://api.discogs.com';
  private rateLimiter: RateLimiter;

  /**
   * Credentials are resolved lazily on first use. Resolution order:
   *   1. site_settings DB table (set via admin UI)
   *   2. Environment variable
   */
  private _consumerKey: string | undefined;
  private _consumerSecret: string | undefined;

  constructor(rateLimiter: RateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  // ---------- lazy credential resolvers ----------

  private async resolveConsumerKey(): Promise<string> {
    if (!this._consumerKey) {
      const key =
        (await getSiteConfig('discogs_consumer_key')) ??
        process.env.DISCOGS_CONSUMER_KEY?.trim();
      if (!key) {
        throw new Error(
          'Discogs Consumer Key is not configured. Add it via Credentials page or DISCOGS_CONSUMER_KEY env var.',
        );
      }
      this._consumerKey = key;
    }
    return this._consumerKey;
  }

  private async resolveConsumerSecret(): Promise<string> {
    if (!this._consumerSecret) {
      const secret =
        (await getSiteConfig('discogs_consumer_secret')) ??
        process.env.DISCOGS_CONSUMER_SECRET?.trim();
      if (!secret) {
        throw new Error(
          'Discogs Consumer Secret is not configured. Add it via Credentials page or DISCOGS_CONSUMER_SECRET env var.',
        );
      }
      this._consumerSecret = secret;
    }
    return this._consumerSecret;
  }

  /** Clear cached credentials (call after site_settings change). */
  clearCredentialCache(): void {
    this._consumerKey = undefined;
    this._consumerSecret = undefined;
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

  /**
   * Get an artist's releases.
   *
   * @see https://www.discogs.com/developers#page:database,header:database-artist-releases
   */
  async getArtistReleases(
    artistId: number,
    page: number = 1,
    perPage: number = 50,
    sort: string = 'year',
    sortOrder: string = 'desc',
  ): Promise<DiscogsArtistReleasesResponse> {
    return cached(
      `discogs:artist-releases:${artistId}:${page}`,
      () =>
        this.request<DiscogsArtistReleasesResponse>(
          `/artists/${artistId}/releases`,
          {
            page: String(page),
            per_page: String(perPage),
            sort,
            sort_order: sortOrder,
          },
        ),
      CacheTTL.MEDIUM,
    );
  }

  // ---------- user collection API (OAuth) ----------

  /**
   * Get a user's collection folders.
   * Requires OAuth user token.
   */
  async getUserCollectionFolders(
    username: string,
    accessToken: string,
    accessTokenSecret: string,
  ): Promise<DiscogsCollectionFoldersResponse> {
    return this.authenticatedRequest<DiscogsCollectionFoldersResponse>(
      `/users/${username}/collection/folders`,
      accessToken,
      accessTokenSecret,
    );
  }

  /**
   * Get items from a user's collection folder.
   * Folder 0 = "All" (everything across all folders).
   * Requires OAuth user token.
   */
  async getUserCollectionItems(
    username: string,
    folderId: number,
    accessToken: string,
    accessTokenSecret: string,
    page?: number,
    perPage?: number,
  ): Promise<DiscogsCollectionItemsResponse> {
    const params: Record<string, string> = {};
    if (page !== undefined) params.page = String(page);
    if (perPage !== undefined) params.per_page = String(perPage);
    return this.authenticatedRequest<DiscogsCollectionItemsResponse>(
      `/users/${username}/collection/folders/${folderId}/releases`,
      accessToken,
      accessTokenSecret,
      params,
    );
  }

  // ---------- private ----------

  /**
   * Make a rate-limited request using OAuth 1.0a user tokens.
   * Uses PLAINTEXT signature method (same as our auth flow).
   */
  private async authenticatedRequest<T>(
    path: string,
    accessToken: string,
    accessTokenSecret: string,
    params?: Record<string, string>,
  ): Promise<T> {
    await this.rateLimiter.waitForToken();

    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const consumerKey = await this.resolveConsumerKey();
    const consumerSecret = await this.resolveConsumerSecret();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/vnd.discogs.v2.discogs+json',
        Authorization: `OAuth oauth_consumer_key="${consumerKey}", oauth_token="${accessToken}", oauth_signature_method="PLAINTEXT", oauth_signature="${consumerSecret}&${accessTokenSecret}", oauth_timestamp="${timestamp}", oauth_nonce="${nonce}"`,
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
    const consumerKey = await this.resolveConsumerKey();
    const consumerSecret = await this.resolveConsumerSecret();
    url.searchParams.set('key', consumerKey);
    url.searchParams.set('secret', consumerSecret);

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
