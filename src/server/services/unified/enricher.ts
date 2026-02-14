import { db } from '@/server/db';
import { albums } from '@/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { musicBrainzClient } from '@/server/services/musicbrainz';
import { spotifyClient } from '@/server/services/spotify';
import { cached, CacheTTL, CacheKey } from '@/lib/cache';
import type { MBReleaseGroup, MBTag } from '@/server/services/musicbrainz';
import type { SpotifyAlbum } from '@/server/services/spotify';
import { resolveAlbumIds, type ResolveInput } from './resolver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrichmentResult {
  musicbrainz: {
    releaseGroupId: string | null;
    tags: string[];
    rating: number | null;
    ratingCount: number;
  } | null;
  spotify: {
    albumId: string | null;
    popularity: number | null;
    spotifyUrl: string | null;
    highResImage: string | null;
  } | null;
}

export interface DiscogsIdentifiers {
  barcodes: string[];
  catno: string | null;
  label: string | null;
  title: string;
  artists: string[];
  year: number | null;
}

export interface FullEnrichmentResult extends EnrichmentResult {
  resolvedIds: {
    musicbrainzReleaseGroupId: string | null;
    spotifyAlbumId: string | null;
  };
}

// ---------------------------------------------------------------------------
// Main enrichment function
// ---------------------------------------------------------------------------

/**
 * Enrich an album with data from MusicBrainz and Spotify.
 *
 * Takes cross-API IDs (from the resolver) and fetches additional metadata.
 * Updates the album record in the database with the enriched data.
 * Returns the enrichment result for immediate use.
 *
 * This function is designed to be called:
 * 1. On-demand when viewing an album detail page
 * 2. As a background job for bulk enrichment
 */
export async function enrichAlbum(
  albumId: string, // Internal UUID
  musicbrainzReleaseGroupId: string | null,
  spotifyAlbumId: string | null,
): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    musicbrainz: null,
    spotify: null,
  };

  // Fetch from MusicBrainz and Spotify in parallel
  const [mbResult, spotifyResult] = await Promise.allSettled([
    musicbrainzReleaseGroupId
      ? enrichFromMusicBrainz(musicbrainzReleaseGroupId)
      : Promise.resolve(null),
    spotifyAlbumId
      ? enrichFromSpotify(spotifyAlbumId)
      : Promise.resolve(null),
  ]);

  if (mbResult.status === 'fulfilled' && mbResult.value) {
    result.musicbrainz = mbResult.value;
  } else if (mbResult.status === 'rejected') {
    console.log(
      `[Enricher] MusicBrainz enrichment failed for album ${albumId}:`,
      mbResult.reason,
    );
  }

  if (spotifyResult.status === 'fulfilled' && spotifyResult.value) {
    result.spotify = spotifyResult.value;
  } else if (spotifyResult.status === 'rejected') {
    console.log(
      `[Enricher] Spotify enrichment failed for album ${albumId}:`,
      spotifyResult.reason,
    );
  }

  // Update the album record in the database with enriched data
  await updateAlbumWithEnrichment(albumId, musicbrainzReleaseGroupId, spotifyAlbumId, result);

  return result;
}

// ---------------------------------------------------------------------------
// Higher-level convenience function — starts from Discogs data
// ---------------------------------------------------------------------------

/**
 * Enrich an album starting from Discogs identifiers.
 *
 * This is a higher-level function that first resolves cross-API IDs using
 * the resolver, then enriches the album with data from MusicBrainz and
 * Spotify. Intended for use during Discogs collection import flows.
 */
export async function enrichAlbumFromDiscogs(
  albumId: string,
  discogsData: DiscogsIdentifiers,
): Promise<FullEnrichmentResult> {
  let musicbrainzReleaseGroupId: string | null = null;
  let spotifyAlbumId: string | null = null;

  // Step 1: Map Discogs identifiers to the resolver's input format
  // The resolver expects a single barcode string; we use the first available barcode
  const resolveInput: ResolveInput = {
    title: discogsData.title,
    artists: discogsData.artists,
    year: discogsData.year ?? undefined,
    barcode: discogsData.barcodes.length > 0 ? discogsData.barcodes[0] : null,
    catno: discogsData.catno,
    label: discogsData.label,
  };

  // Step 2: Resolve cross-API IDs from Discogs identifiers
  try {
    const resolved = await resolveAlbumIds(resolveInput);
    musicbrainzReleaseGroupId = resolved.musicbrainzReleaseGroupId;
    spotifyAlbumId = resolved.spotifyAlbumId;
    console.log(
      `[Enricher] Resolved IDs for "${discogsData.title}": MB=${musicbrainzReleaseGroupId}, Spotify=${spotifyAlbumId}`,
    );
  } catch (error) {
    console.log(
      `[Enricher] ID resolution failed for "${discogsData.title}":`,
      error,
    );
  }

  // Step 3: Enrich with the resolved IDs
  const enrichment = await enrichAlbum(albumId, musicbrainzReleaseGroupId, spotifyAlbumId);

  return {
    ...enrichment,
    resolvedIds: {
      musicbrainzReleaseGroupId,
      spotifyAlbumId,
    },
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Fetch and extract enrichment data from MusicBrainz.
 *
 * Retrieves the release group by ID (with caching) and extracts:
 * - Tags: filtered by vote count >= 1, sorted by popularity, top 20
 * - Rating: community rating value and vote count
 */
async function enrichFromMusicBrainz(
  releaseGroupId: string,
): Promise<EnrichmentResult['musicbrainz']> {
  try {
    const releaseGroup = await cached<MBReleaseGroup>(
      CacheKey.mbReleaseGroup(releaseGroupId),
      () => musicBrainzClient.getReleaseGroup(releaseGroupId),
      CacheTTL.LONG,
    );

    // Extract tags: filter by count >= 1, sort descending by count, take top 20
    const tags: string[] = (releaseGroup.tags ?? [])
      .filter((tag: MBTag) => tag.count >= 1)
      .sort((a: MBTag, b: MBTag) => b.count - a.count)
      .slice(0, 20)
      .map((tag: MBTag) => tag.name);

    // Extract rating if available
    const rating = releaseGroup.rating?.value ?? null;
    const ratingCount = releaseGroup.rating?.['votes-count'] ?? 0;

    console.log(
      `[Enricher] MusicBrainz data for ${releaseGroupId}: ${tags.length} tags, rating=${rating}`,
    );

    return {
      releaseGroupId,
      tags,
      rating,
      ratingCount,
    };
  } catch (error) {
    console.log(`[Enricher] MusicBrainz fetch failed for ${releaseGroupId}:`, error);
    return null;
  }
}

/**
 * Fetch and extract enrichment data from Spotify.
 *
 * Retrieves the album by Spotify ID (with caching) and extracts:
 * - Popularity score (0-100)
 * - Spotify external URL for linking
 * - Highest resolution image URL (first image is typically largest)
 */
async function enrichFromSpotify(
  spotifyAlbumId: string,
): Promise<EnrichmentResult['spotify']> {
  try {
    const album = await cached<SpotifyAlbum>(
      CacheKey.spotifyAlbum(spotifyAlbumId),
      () => spotifyClient.getAlbum(spotifyAlbumId),
      CacheTTL.MEDIUM,
    );

    // Extract popularity
    const popularity = album.popularity ?? null;

    // Extract Spotify URL
    const spotifyUrl = album.external_urls?.spotify ?? null;

    // Extract highest resolution image (Spotify returns images sorted largest first)
    const highResImage = album.images?.length > 0
      ? album.images.reduce((best, img) => {
          const bestSize = (best.width ?? 0) * (best.height ?? 0);
          const imgSize = (img.width ?? 0) * (img.height ?? 0);
          return imgSize > bestSize ? img : best;
        }).url
      : null;

    console.log(
      `[Enricher] Spotify data for ${spotifyAlbumId}: popularity=${popularity}, image=${highResImage ? 'yes' : 'no'}`,
    );

    return {
      albumId: spotifyAlbumId,
      popularity,
      spotifyUrl,
      highResImage,
    };
  } catch (error) {
    console.log(`[Enricher] Spotify fetch failed for ${spotifyAlbumId}:`, error);
    return null;
  }
}

/**
 * Update the album record in the database with enriched data.
 *
 * Only includes fields that have non-null values in the update, making
 * this operation idempotent — re-running enrichment will not overwrite
 * existing data with nulls.
 */
async function updateAlbumWithEnrichment(
  albumId: string,
  musicbrainzId: string | null,
  spotifyId: string | null,
  result: EnrichmentResult,
): Promise<void> {
  try {
    // Build update object, only including fields with actual values
    const updateData: Record<string, unknown> = {};

    if (musicbrainzId !== null) {
      updateData.musicbrainzId = musicbrainzId;
    }

    if (spotifyId !== null) {
      updateData.spotifyId = spotifyId;
    }

    if (result.musicbrainz?.tags && result.musicbrainz.tags.length > 0) {
      updateData.mbTags = result.musicbrainz.tags;
    }

    if (result.musicbrainz?.rating !== null && result.musicbrainz?.rating !== undefined) {
      updateData.communityRating = result.musicbrainz.rating;
    }

    // Spotify often has higher-resolution images than Discogs
    if (result.spotify?.highResImage !== null && result.spotify?.highResImage !== undefined) {
      updateData.coverImage = result.spotify.highResImage;
    }

    // Always mark the updated timestamp
    updateData.updatedAt = sql`now()`;

    // Only run the update if there is meaningful data beyond just the timestamp
    const meaningfulKeys = Object.keys(updateData).filter((k) => k !== 'updatedAt');
    if (meaningfulKeys.length === 0) {
      console.log(`[Enricher] No enrichment data to write for album ${albumId}`);
      return;
    }

    await db.update(albums).set(updateData).where(eq(albums.id, albumId));

    console.log(
      `[Enricher] Updated album ${albumId} with fields: ${meaningfulKeys.join(', ')}`,
    );
  } catch (error) {
    console.log(`[Enricher] Database update failed for album ${albumId}:`, error);
  }
}
