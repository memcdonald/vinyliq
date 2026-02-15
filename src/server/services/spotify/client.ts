/**
 * Spotify Web API client for VinylIQ.
 *
 * Supports two authentication modes:
 *   1. **Client Credentials** (server-side, no user context) -- used for
 *      album lookups and search. The token is obtained and cached
 *      automatically.
 *   2. **User access token** (passed per-request) -- used for reading a
 *      user's saved albums via the `user-library-read` scope.
 *
 * Only endpoints that are still available for new apps are used here.
 * Deprecated endpoints (audio-features, audio-analysis, recommendations)
 * are intentionally omitted.
 *
 * @see https://developer.spotify.com/documentation/web-api
 */

import { rateLimiter, type RateLimiter } from './rate-limiter';
import type {
  SpotifyAlbum,
  SpotifyArtist,
  SpotifyPaging,
  SpotifySimpleAlbum,
  SpotifySavedAlbum,
  SpotifyTimeRange,
  SpotifyTokenResponse,
} from './types';

class SpotifyClient {
  private baseUrl = 'https://api.spotify.com/v1';
  private tokenUrl = 'https://accounts.spotify.com/api/token';
  private rateLimiter: RateLimiter;

  // Client credentials token cache
  private _accessToken: string | null = null;
  private _tokenExpiresAt: number = 0;

  /**
   * Credentials are resolved lazily on first use so the module can be
   * imported safely at build/startup time without requiring env vars to
   * be present immediately.
   */
  private _clientId: string | undefined;
  private _clientSecret: string | undefined;

  constructor(rateLimiter: RateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  // ---------- lazy credential getters ----------

  private get clientId(): string {
    if (!this._clientId) {
      const id = process.env.SPOTIFY_CLIENT_ID;
      if (!id) {
        throw new Error(
          'SPOTIFY_CLIENT_ID is not set. Please add it to your environment variables.',
        );
      }
      this._clientId = id;
    }
    return this._clientId;
  }

  private get clientSecret(): string {
    if (!this._clientSecret) {
      const secret = process.env.SPOTIFY_CLIENT_SECRET;
      if (!secret) {
        throw new Error(
          'SPOTIFY_CLIENT_SECRET is not set. Please add it to your environment variables.',
        );
      }
      this._clientSecret = secret;
    }
    return this._clientSecret;
  }

  // ---------- client credentials token management ----------

  /**
   * Obtain (or return cached) client credentials access token.
   *
   * The token is refreshed automatically 60 seconds before its expiry to
   * avoid mid-request failures.
   */
  private async getClientToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid (with 60-second buffer)
    if (this._accessToken && now < this._tokenExpiresAt - 60_000) {
      return this._accessToken;
    }

    const credentials = btoa(`${this.clientId}:${this.clientSecret}`);

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Spotify token request failed: ${response.status} ${response.statusText}${body ? ` — ${body}` : ''}`,
      );
    }

    const data = (await response.json()) as SpotifyTokenResponse;

    this._accessToken = data.access_token;
    this._tokenExpiresAt = now + data.expires_in * 1_000;

    return this._accessToken;
  }

  // ---------- public API (server-side, client credentials) ----------

  /**
   * Get a full album object by Spotify ID.
   *
   * @see https://developer.spotify.com/documentation/web-api/reference/get-an-album
   */
  async getAlbum(albumId: string): Promise<SpotifyAlbum> {
    return this.request<SpotifyAlbum>(`/albums/${albumId}`);
  }

  /**
   * Search for albums matching the given query string.
   *
   * @see https://developer.spotify.com/documentation/web-api/reference/search
   */
  async searchAlbums(
    query: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<SpotifyPaging<SpotifySimpleAlbum>> {
    const params: Record<string, string> = {
      q: query,
      type: 'album',
      limit: String(limit),
      offset: String(offset),
    };

    const data = await this.request<{ albums: SpotifyPaging<SpotifySimpleAlbum> }>(
      '/search',
      params,
    );

    return data.albums;
  }

  /**
   * Get a full artist object by Spotify ID.
   *
   * @see https://developer.spotify.com/documentation/web-api/reference/get-an-artist
   */
  async getArtist(artistId: string): Promise<SpotifyArtist> {
    return this.request<SpotifyArtist>(`/artists/${artistId}`);
  }

  // ---------- public API (user context, requires user access token) ----------

  /**
   * Get the current user's saved albums (requires `user-library-read` scope).
   *
   * @see https://developer.spotify.com/documentation/web-api/reference/get-users-saved-albums
   */
  async getUserSavedAlbums(
    accessToken: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<SpotifyPaging<SpotifySavedAlbum>> {
    const params: Record<string, string> = {
      limit: String(limit),
      offset: String(offset),
    };

    return this.request<SpotifyPaging<SpotifySavedAlbum>>('/me/albums', params, accessToken);
  }

  /**
   * Check if one or more albums are in the current user's library.
   *
   * Returns an array of booleans in the same order as the supplied IDs.
   * Maximum 20 IDs per request (Spotify API limit).
   *
   * @see https://developer.spotify.com/documentation/web-api/reference/check-users-saved-albums
   */
  async checkUserSavedAlbums(
    accessToken: string,
    albumIds: string[],
  ): Promise<boolean[]> {
    if (albumIds.length === 0) return [];
    if (albumIds.length > 20) {
      throw new Error('checkUserSavedAlbums supports a maximum of 20 album IDs per request.');
    }

    const params: Record<string, string> = {
      ids: albumIds.join(','),
    };

    return this.request<boolean[]>('/me/albums/contains', params, accessToken);
  }

  /**
   * Get the current user's top artists (requires `user-top-read` scope).
   *
   * @param timeRange  Over what time frame: short_term (~4 weeks),
   *                   medium_term (~6 months), long_term (all time).
   * @see https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks
   */
  async getUserTopArtists(
    accessToken: string,
    timeRange: SpotifyTimeRange = 'medium_term',
    limit: number = 50,
  ): Promise<SpotifyPaging<SpotifyArtist>> {
    const params: Record<string, string> = {
      time_range: timeRange,
      limit: String(limit),
    };

    return this.request<SpotifyPaging<SpotifyArtist>>('/me/top/artists', params, accessToken);
  }

  // ---------- private ----------

  /**
   * Make a rate-limited, authenticated request to the Spotify Web API.
   *
   * If `accessToken` is provided it is used directly (user context).
   * Otherwise a client credentials token is obtained/cached automatically.
   *
   * On a 401 response the client credentials token is refreshed and the
   * request retried once.
   */
  private async request<T>(
    path: string,
    params?: Record<string, string>,
    accessToken?: string,
  ): Promise<T> {
    await this.rateLimiter.waitForToken();

    const token = accessToken ?? (await this.getClientToken());

    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    let response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    // If we get a 401 with a client credentials token, it may have been
    // invalidated server-side. Refresh and retry once.
    if (response.status === 401 && !accessToken) {
      this._accessToken = null;
      this._tokenExpiresAt = 0;

      await this.rateLimiter.waitForToken();
      const freshToken = await this.getClientToken();

      response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${freshToken}`,
          Accept: 'application/json',
        },
      });
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Spotify API error: ${response.status} ${response.statusText} — ${path}${body ? ` — ${body}` : ''}`,
      );
    }

    return (await response.json()) as T;
  }
}

/** Singleton Spotify client instance for the application. */
export const spotifyClient = new SpotifyClient(rateLimiter);

export { SpotifyClient };
