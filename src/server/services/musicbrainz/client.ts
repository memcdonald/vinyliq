import { rateLimiter, type MusicBrainzRateLimiter } from './rate-limiter';
import type {
  MBReleaseGroup,
  MBRelease,
  MBArtist,
  MBRelation,
  MBSearchResponse,
  MBBrowseResponse,
} from './types';

/**
 * MusicBrainz API client.
 *
 * Provides typed, rate-limited access to the MusicBrainz web service v2.
 * No authentication is required for read-only access, but a descriptive
 * User-Agent header is **mandatory** per MusicBrainz policy.
 *
 * @see https://musicbrainz.org/doc/MusicBrainz_API
 */
class MusicBrainzClient {
  private baseUrl: string = 'https://musicbrainz.org/ws/2';
  private userAgent: string = 'VinylIQ/1.0 (vinyliq@example.com)';
  private rateLimiter: MusicBrainzRateLimiter;

  constructor(rateLimiter: MusicBrainzRateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  // ---------- public API ----------

  /**
   * Look up a release group by its MusicBrainz UUID.
   *
   * Includes tags, ratings, and artist credits in the response.
   *
   * @see https://musicbrainz.org/doc/MusicBrainz_API#Release_Group
   */
  async getReleaseGroup(id: string): Promise<MBReleaseGroup> {
    return this.request<MBReleaseGroup>(`/release-group/${id}`, {
      inc: 'tags+ratings+artist-credits',
    });
  }

  /**
   * Look up a release by its MusicBrainz UUID.
   *
   * Includes recordings (track lists), label info, and artist credits.
   *
   * @see https://musicbrainz.org/doc/MusicBrainz_API#Release
   */
  async getRelease(id: string): Promise<MBRelease> {
    return this.request<MBRelease>(`/release/${id}`, {
      inc: 'recordings+labels+artist-credits',
    });
  }

  /**
   * Look up an artist by their MusicBrainz UUID.
   *
   * Includes tags, ratings, and relationships to other artists,
   * release groups, and URLs.
   *
   * @see https://musicbrainz.org/doc/MusicBrainz_API#Artist
   */
  async getArtist(id: string): Promise<MBArtist> {
    return this.request<MBArtist>(`/artist/${id}`, {
      inc: 'tags+ratings+release-group-rels+artist-rels+url-rels',
    });
  }

  /**
   * Search for release groups by a free-text query.
   *
   * Supports Lucene query syntax. Default limit is 25, max is 100.
   *
   * @see https://musicbrainz.org/doc/MusicBrainz_API/Search#Release_Group
   */
  async searchReleaseGroups(
    query: string,
    limit: number = 25,
    offset: number = 0,
  ): Promise<MBSearchResponse<MBReleaseGroup>> {
    return this.request<MBSearchResponse<MBReleaseGroup>>(
      '/release-group',
      {
        query,
        limit: String(limit),
        offset: String(offset),
      },
    );
  }

  /**
   * Search for releases matching a barcode.
   *
   * @see https://musicbrainz.org/doc/MusicBrainz_API/Search#Release
   */
  async searchByBarcode(
    barcode: string,
  ): Promise<MBSearchResponse<MBRelease>> {
    return this.request<MBSearchResponse<MBRelease>>('/release', {
      query: `barcode:${barcode}`,
    });
  }

  /**
   * Search for releases by catalog number, optionally filtered by label.
   *
   * @see https://musicbrainz.org/doc/MusicBrainz_API/Search#Release
   */
  async searchByCatno(
    catno: string,
    label?: string,
  ): Promise<MBSearchResponse<MBRelease>> {
    let query = `catno:"${catno}"`;
    if (label) {
      query += ` AND label:"${label}"`;
    }

    return this.request<MBSearchResponse<MBRelease>>('/release', {
      query,
    });
  }

  /**
   * Browse release groups by a specific artist.
   *
   * Returns all release groups credited to the given artist, paginated.
   *
   * @see https://musicbrainz.org/doc/MusicBrainz_API#Browse
   */
  async browseReleaseGroupsByArtist(
    artistId: string,
    limit: number = 25,
    offset: number = 0,
  ): Promise<MBBrowseResponse<MBReleaseGroup>> {
    return this.request<MBBrowseResponse<MBReleaseGroup>>(
      '/release-group',
      {
        artist: artistId,
        limit: String(limit),
        offset: String(offset),
      },
    );
  }

  /**
   * Get an artist's relationships (band members, collaborators, producers, etc.).
   *
   * Fetches the artist with `artist-rels` included and returns just the
   * relations array for convenience.
   */
  async getArtistRelations(artistId: string): Promise<MBRelation[]> {
    const artist = await this.request<MBArtist>(`/artist/${artistId}`, {
      inc: 'artist-rels',
    });

    return artist.relations ?? [];
  }

  // ---------- private ----------

  /**
   * Make a rate-limited request to the MusicBrainz API.
   *
   * Automatically appends `fmt=json`, sets the required User-Agent header,
   * and waits for the rate limiter before each request.
   */
  private async request<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<T> {
    await this.rateLimiter.waitForToken();

    const url = new URL(`${this.baseUrl}${path}`);

    // Always request JSON format
    url.searchParams.set('fmt', 'json');

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
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `MusicBrainz API error: ${response.status} ${response.statusText} — ${path}${body ? ` — ${body}` : ''}`,
      );
    }

    return (await response.json()) as T;
  }
}

/** Singleton MusicBrainz client instance for the application. */
export const musicBrainzClient = new MusicBrainzClient(rateLimiter);

export { MusicBrainzClient };
