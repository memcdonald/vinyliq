import { musicBrainzClient } from '@/server/services/musicbrainz';
import { spotifyClient } from '@/server/services/spotify';
import type { MBRelease, MBReleaseGroup } from '@/server/services/musicbrainz';
import type { SpotifySimpleAlbum } from '@/server/services/spotify';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ResolvedIds {
  musicbrainzReleaseGroupId: string | null;
  musicbrainzReleaseId: string | null;
  spotifyAlbumId: string | null;
}

export interface ResolveInput {
  title: string;
  artists: string[]; // artist names
  year?: number;
  barcode?: string | null;
  catno?: string | null;
  label?: string | null;
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * Resolves cross-API IDs for an album. Tries multiple matching strategies
 * in order of reliability:
 *
 * 1. Barcode/UPC match (gold standard)
 * 2. Catalog number + label match
 * 3. Fuzzy title + artist + year match on MusicBrainz
 * 4. Spotify search fallback
 *
 * Each strategy is tried independently. Failures in one strategy don't
 * block the others. Returns whatever IDs could be found.
 */
export async function resolveAlbumIds(input: ResolveInput): Promise<ResolvedIds> {
  const result: ResolvedIds = {
    musicbrainzReleaseGroupId: null,
    musicbrainzReleaseId: null,
    spotifyAlbumId: null,
  };

  console.log(
    `[Resolver] Resolving IDs for "${input.title}" by ${input.artists.join(', ')}`,
  );

  // Run MusicBrainz and Spotify resolution in parallel
  const [mbResult, spotifyResult] = await Promise.allSettled([
    resolveMusicBrainz(input),
    resolveSpotify(input),
  ]);

  if (mbResult.status === 'fulfilled' && mbResult.value) {
    result.musicbrainzReleaseGroupId = mbResult.value.releaseGroupId;
    result.musicbrainzReleaseId = mbResult.value.releaseId;
  } else if (mbResult.status === 'rejected') {
    console.log(
      `[Resolver] MusicBrainz resolution failed unexpectedly: ${mbResult.reason}`,
    );
  }

  if (spotifyResult.status === 'fulfilled' && spotifyResult.value) {
    result.spotifyAlbumId = spotifyResult.value;
  } else if (spotifyResult.status === 'rejected') {
    console.log(
      `[Resolver] Spotify resolution failed unexpectedly: ${spotifyResult.reason}`,
    );
  }

  console.log(`[Resolver] Resolved IDs:`, result);

  return result;
}

// ---------------------------------------------------------------------------
// MusicBrainz resolution
// ---------------------------------------------------------------------------

interface MBResolveResult {
  releaseGroupId: string | null;
  releaseId: string | null;
}

/**
 * Attempt to resolve MusicBrainz release and release-group IDs using
 * three strategies in order of reliability: barcode, catalog number,
 * then fuzzy title/artist search.
 */
async function resolveMusicBrainz(
  input: ResolveInput,
): Promise<MBResolveResult | null> {
  // Strategy 1: Barcode match (gold standard)
  if (input.barcode && input.barcode.trim().length > 0) {
    try {
      console.log(`[Resolver] MB strategy 1: barcode lookup "${input.barcode}"`);
      const response = await musicBrainzClient.searchByBarcode(input.barcode.trim());
      const releases = response.releases ?? [];

      if (releases.length > 0) {
        const release = releases[0]!;
        const result = extractMBIds(release);
        console.log(
          `[Resolver] MB barcode match found: release=${result.releaseId}, ` +
            `release-group=${result.releaseGroupId}`,
        );
        return result;
      }

      console.log(`[Resolver] MB barcode lookup returned no results`);
    } catch (err) {
      console.log(`[Resolver] MB barcode lookup failed: ${err}`);
    }
  }

  // Strategy 2: Catalog number + label match
  if (input.catno && input.catno.trim().length > 0) {
    try {
      const catno = input.catno.trim();
      const label = input.label?.trim() || undefined;
      console.log(
        `[Resolver] MB strategy 2: catno lookup "${catno}"` +
          (label ? ` + label "${label}"` : ''),
      );

      const response = await musicBrainzClient.searchByCatno(catno, label);
      const releases = response.releases ?? [];

      if (releases.length > 0) {
        const release = releases[0]!;
        const result = extractMBIds(release);
        console.log(
          `[Resolver] MB catno match found: release=${result.releaseId}, ` +
            `release-group=${result.releaseGroupId}`,
        );
        return result;
      }

      console.log(`[Resolver] MB catno lookup returned no results`);
    } catch (err) {
      console.log(`[Resolver] MB catno lookup failed: ${err}`);
    }
  }

  // Strategy 3: Fuzzy title + artist + year search
  try {
    let query = `release:"${input.title}" AND artist:"${input.artists[0]}"`;
    if (input.year) {
      query += ` AND date:${input.year}*`;
    }

    console.log(`[Resolver] MB strategy 3: fuzzy search "${query}"`);

    const response = await musicBrainzClient.searchReleaseGroups(query, 5);
    const releaseGroups = response['release-groups'] ?? [];

    if (releaseGroups.length === 0) {
      console.log(`[Resolver] MB fuzzy search returned no results`);
      return null;
    }

    // Score each result by comparing title and artist similarity
    let bestScore = 0;
    let bestMatch: MBReleaseGroup | null = null;

    for (const rg of releaseGroups) {
      const titleScore = similarity(input.title, rg.title);

      // Extract the primary artist name from the artist-credit array
      const mbArtistName =
        rg['artist-credit']?.[0]?.name ??
        rg['artist-credit']?.[0]?.artist?.name ??
        '';
      const artistScore = similarity(input.artists[0] ?? '', mbArtistName);

      // Combined score: title is weighted more heavily
      const score = titleScore * 0.6 + artistScore * 0.4;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = rg;
      }
    }

    if (bestMatch && bestScore > 0.7) {
      console.log(
        `[Resolver] MB fuzzy match found: "${bestMatch.title}" (score=${bestScore.toFixed(3)})`,
      );
      return {
        releaseGroupId: bestMatch.id,
        releaseId: null, // Release groups don't carry a specific release ID
      };
    }

    console.log(
      `[Resolver] MB fuzzy search best score ${bestScore.toFixed(3)} below threshold (0.7)`,
    );
  } catch (err) {
    console.log(`[Resolver] MB fuzzy search failed: ${err}`);
  }

  return null;
}

/**
 * Extract the release ID and release-group ID from a MusicBrainz release.
 */
function extractMBIds(release: MBRelease): MBResolveResult {
  return {
    releaseId: release.id,
    releaseGroupId: release['release-group']?.id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Spotify resolution
// ---------------------------------------------------------------------------

/**
 * Attempt to find a matching Spotify album via search. Returns the Spotify
 * album ID or null if no confident match is found.
 */
async function resolveSpotify(input: ResolveInput): Promise<string | null> {
  try {
    // Build search query using Spotify's field filters
    let query = `album:${input.title} artist:${input.artists[0]}`;
    if (input.year) {
      query += ` year:${input.year}`;
    }

    console.log(`[Resolver] Spotify search: "${query}"`);

    const response = await spotifyClient.searchAlbums(query, 5);
    const albums = response.items ?? [];

    if (albums.length === 0) {
      console.log(`[Resolver] Spotify search returned no results`);
      return null;
    }

    // Score each result
    let bestScore = 0;
    let bestMatch: SpotifySimpleAlbum | null = null;

    for (const album of albums) {
      const titleScore = similarity(input.title, album.name);

      // Compare against the first Spotify artist
      const spotifyArtistName = album.artists[0]?.name ?? '';
      const artistScore = similarity(input.artists[0] ?? '', spotifyArtistName);

      // Year proximity score
      let yearScore = 1.0;
      if (input.year && album.release_date) {
        const albumYear = parseInt(album.release_date.slice(0, 4), 10);
        if (!isNaN(albumYear)) {
          const diff = Math.abs(input.year - albumYear);
          // 0 diff = 1.0, 1 year = 0.9, 2 years = 0.7, 3+ years = 0.5
          yearScore = diff === 0 ? 1.0 : Math.max(0.5, 1.0 - diff * 0.15);
        }
      }

      // Combined score: title and artist matter most, year is a tiebreaker
      const score = titleScore * 0.45 + artistScore * 0.4 + yearScore * 0.15;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = album;
      }
    }

    if (bestMatch && bestScore > 0.6) {
      console.log(
        `[Resolver] Spotify match found: "${bestMatch.name}" by ` +
          `${bestMatch.artists.map((a) => a.name).join(', ')} ` +
          `(score=${bestScore.toFixed(3)})`,
      );
      return bestMatch.id;
    }

    console.log(
      `[Resolver] Spotify best score ${bestScore.toFixed(3)} below threshold (0.6)`,
    );
  } catch (err) {
    // Spotify may not be configured (missing credentials) -- that's fine
    console.log(`[Resolver] Spotify resolution failed: ${err}`);
  }

  return null;
}

// ---------------------------------------------------------------------------
// String similarity
// ---------------------------------------------------------------------------

/**
 * Simple string similarity function using token-based Jaccard similarity.
 *
 * 1. Normalize both strings: lowercase, strip punctuation, trim.
 * 2. If exact match after normalization: return 1.0.
 * 3. If one contains the other: return 0.8.
 * 4. Otherwise split into word tokens and compute Jaccard similarity
 *    (intersection / union).
 */
function similarity(a: string, b: string): number {
  const normA = normalize(a);
  const normB = normalize(b);

  // Exact match
  if (normA === normB) return 1.0;

  // Empty strings can't be compared meaningfully
  if (normA.length === 0 || normB.length === 0) return 0.0;

  // Containment check
  if (normA.includes(normB) || normB.includes(normA)) return 0.8;

  // Token-based Jaccard similarity
  const tokensA = new Set(normA.split(/\s+/).filter(Boolean));
  const tokensB = new Set(normB.split(/\s+/).filter(Boolean));

  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersectionSize = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionSize++;
    }
  }

  const unionSize = tokensA.size + tokensB.size - intersectionSize;

  return unionSize === 0 ? 0.0 : intersectionSize / unionSize;
}

/**
 * Normalize a string for comparison: lowercase, strip punctuation, collapse
 * whitespace, and trim.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // remove punctuation
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}
