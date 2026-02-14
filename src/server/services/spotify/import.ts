/**
 * Spotify library import service for VinylIQ.
 *
 * Imports a user's Spotify saved albums into the VinylIQ database. Albums are
 * stored with `status: 'listened'` since we can only confirm the user has
 * listened to them, not that they own the vinyl.
 *
 * Runs asynchronously with in-memory progress tracking so the frontend can
 * poll for status.
 */

import { db } from '@/server/db';
import { albums, artists, albumArtists, collectionItems, user } from '@/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { spotifyClient } from './client';
import { refreshSpotifyToken } from './auth';
import type { SpotifySavedAlbum } from './types';

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------

export interface SpotifyImportProgress {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  status: 'running' | 'completed' | 'error';
  message: string;
}

const progressMap = new Map<string, SpotifyImportProgress>();

export function getSpotifyImportProgress(userId: string): SpotifyImportProgress | null {
  return progressMap.get(userId) ?? null;
}

export function clearSpotifyImportProgress(userId: string): void {
  progressMap.delete(userId);
}

// ---------------------------------------------------------------------------
// Main import function
// ---------------------------------------------------------------------------

/**
 * Import a user's Spotify saved albums into VinylIQ.
 *
 * Albums are marked as `listened` status in the collection. If the user
 * already has the album in their collection (e.g., from a Discogs import
 * with status `owned`), we do NOT overwrite it.
 *
 * Runs asynchronously -- call `getSpotifyImportProgress()` to poll status.
 */
export async function importSpotifyLibrary(
  userId: string,
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const progress: SpotifyImportProgress = {
    total: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
    status: 'running',
    message: 'Starting Spotify import...',
  };
  progressMap.set(userId, progress);

  let token = accessToken;

  try {
    // Fetch first page to learn the total count
    const firstPage = await spotifyClient.getUserSavedAlbums(token, 50, 0);
    progress.total = firstPage.total;
    progress.message = `Found ${progress.total} saved albums`;

    // Process first page
    await processSpotifyPage(userId, firstPage.items, progress);

    // Process remaining pages
    let offset = 50;
    while (offset < firstPage.total) {
      progress.message = `Importing albums ${offset + 1}-${Math.min(offset + 50, firstPage.total)} of ${firstPage.total}...`;

      try {
        const page = await spotifyClient.getUserSavedAlbums(token, 50, offset);
        await processSpotifyPage(userId, page.items, progress);
      } catch (err: unknown) {
        // If the token expired mid-import, refresh and retry
        if (err instanceof Error && err.message.includes('401')) {
          try {
            const newTokens = await refreshSpotifyToken(refreshToken);
            token = newTokens.access_token;

            // Persist the refreshed tokens for future use
            await db
              .update(user)
              .set({
                spotifyAccessToken: newTokens.access_token,
                spotifyRefreshToken: newTokens.refresh_token ?? refreshToken,
                spotifyTokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
                updatedAt: new Date(),
              })
              .where(eq(user.id, userId));

            // Retry this page with the fresh token
            const page = await spotifyClient.getUserSavedAlbums(token, 50, offset);
            await processSpotifyPage(userId, page.items, progress);
          } catch (retryErr) {
            progress.errors++;
            console.error('[SpotifyImport] Token refresh retry failed:', retryErr);
          }
        } else {
          progress.errors++;
          console.error('[SpotifyImport] Page fetch error:', err);
        }
      }

      offset += 50;
    }

    progress.status = 'completed';
    progress.message =
      `Import complete: ${progress.imported} imported, ` +
      `${progress.skipped} already existed, ${progress.errors} errors`;
  } catch (err) {
    progress.status = 'error';
    progress.message = err instanceof Error ? err.message : 'Unknown error during import';
    console.error('[SpotifyImport] Fatal import error:', err);
  }
}

// ---------------------------------------------------------------------------
// Page processor
// ---------------------------------------------------------------------------

async function processSpotifyPage(
  userId: string,
  items: SpotifySavedAlbum[],
  progress: SpotifyImportProgress,
): Promise<void> {
  for (const item of items) {
    try {
      const spotifyAlbum = item.album;

      // Extract data from the Spotify album object
      const title = spotifyAlbum.name;
      const artistNames = spotifyAlbum.artists.map((a) => a.name);
      const year = spotifyAlbum.release_date
        ? parseInt(spotifyAlbum.release_date.substring(0, 4), 10)
        : null;
      const thumb =
        spotifyAlbum.images.find((img) => img.width && img.width <= 300)?.url ??
        spotifyAlbum.images[0]?.url ??
        null;
      const coverImage = spotifyAlbum.images[0]?.url ?? null;
      const upc = spotifyAlbum.external_ids?.upc ?? null;

      // -----------------------------------------------------------------
      // Upsert album
      //
      // The `albums.spotifyId` column has an index but NOT a unique
      // constraint, so we cannot use `onConflictDoUpdate`. Instead we
      // do a select-then-insert/update.
      // -----------------------------------------------------------------
      let albumId: string;

      const existingAlbums = await db
        .select({ id: albums.id })
        .from(albums)
        .where(eq(albums.spotifyId, spotifyAlbum.id))
        .limit(1);

      if (existingAlbums.length > 0) {
        // Album already exists -- update it with latest Spotify data
        albumId = existingAlbums[0]!.id;
        await db
          .update(albums)
          .set({
            title,
            year: year && year > 0 ? year : null,
            thumb,
            coverImage,
            genres: spotifyAlbum.genres ?? [],
            barcode: upc,
            updatedAt: new Date(),
          })
          .where(eq(albums.id, albumId));
      } else {
        // Insert new album record
        const [newAlbum] = await db
          .insert(albums)
          .values({
            spotifyId: spotifyAlbum.id,
            title,
            year: year && year > 0 ? year : null,
            thumb,
            coverImage,
            genres: spotifyAlbum.genres ?? [],
            barcode: upc,
          })
          .returning({ id: albums.id });

        albumId = newAlbum!.id;
      }

      // -----------------------------------------------------------------
      // Upsert artists and album_artists junction rows
      // -----------------------------------------------------------------
      for (const spotifyArtist of spotifyAlbum.artists) {
        let artistId: string;

        const existingArtists = await db
          .select({ id: artists.id })
          .from(artists)
          .where(eq(artists.spotifyId, spotifyArtist.id))
          .limit(1);

        if (existingArtists.length > 0) {
          artistId = existingArtists[0]!.id;
        } else {
          const [newArtist] = await db
            .insert(artists)
            .values({
              spotifyId: spotifyArtist.id,
              name: spotifyArtist.name,
            })
            .returning({ id: artists.id });

          artistId = newArtist!.id;
        }

        // Link artist to album (composite PK: albumId + artistId + role)
        const existingLink = await db
          .select({ albumId: albumArtists.albumId })
          .from(albumArtists)
          .where(
            and(
              eq(albumArtists.albumId, albumId),
              eq(albumArtists.artistId, artistId),
              eq(albumArtists.role, 'primary'),
            ),
          )
          .limit(1);

        if (existingLink.length === 0) {
          await db.insert(albumArtists).values({
            albumId,
            artistId,
            role: 'primary',
          });
        }
      }

      // -----------------------------------------------------------------
      // Upsert collection item as 'listened'
      //
      // The `collection_items` table has a uniqueIndex on (userId, albumId).
      // If the user already has this album in their collection (e.g., as
      // 'owned' from a Discogs import), we skip rather than overwrite.
      // -----------------------------------------------------------------
      const existingCollectionItem = await db
        .select({ id: collectionItems.id })
        .from(collectionItems)
        .where(
          and(
            eq(collectionItems.userId, userId),
            eq(collectionItems.albumId, albumId),
          ),
        )
        .limit(1);

      if (existingCollectionItem.length > 0) {
        progress.skipped++;
      } else {
        await db.insert(collectionItems).values({
          userId,
          albumId,
          status: 'listened',
        });
        progress.imported++;
      }
    } catch (err) {
      progress.errors++;
      console.error(`[SpotifyImport] Failed to import: ${item.album.name}`, err);
    }
  }
}
