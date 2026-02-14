import { db } from '@/server/db';
import { albums, collectionItems } from '@/server/db/schema';
import { discogsClient } from './client';
import type { DiscogsCollectionItem } from './types';

export interface ImportProgress {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  status: 'running' | 'completed' | 'error';
  message: string;
}

// In-memory progress tracker (one per user)
const progressMap = new Map<string, ImportProgress>();

export function getImportProgress(userId: string): ImportProgress | null {
  return progressMap.get(userId) ?? null;
}

/**
 * Import a user's Discogs collection into VinylIQ.
 * Runs asynchronously — call getImportProgress() to check status.
 */
export async function importDiscogsCollection(
  userId: string,
  username: string,
  accessToken: string,
  accessTokenSecret: string,
): Promise<void> {
  const progress: ImportProgress = {
    total: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
    status: 'running',
    message: 'Starting import...',
  };
  progressMap.set(userId, progress);

  try {
    // Get total count from folder 0 (all)
    const firstPage = await discogsClient.getUserCollectionItems(
      username,
      0,
      accessToken,
      accessTokenSecret,
      1,
      100,
    );
    progress.total = firstPage.pagination.items;
    progress.message = `Found ${progress.total} items to import`;

    // Process first page
    await processPage(userId, firstPage.releases, progress);

    // Process remaining pages
    const totalPages = firstPage.pagination.pages;
    for (let page = 2; page <= totalPages; page++) {
      progress.message = `Importing page ${page} of ${totalPages}...`;
      const pageData = await discogsClient.getUserCollectionItems(
        username,
        0,
        accessToken,
        accessTokenSecret,
        page,
        100,
      );
      await processPage(userId, pageData.releases, progress);
    }

    progress.status = 'completed';
    progress.message = `Import complete: ${progress.imported} imported, ${progress.skipped} already existed, ${progress.errors} errors`;
  } catch (err) {
    progress.status = 'error';
    progress.message = err instanceof Error ? err.message : 'Unknown error';
  }
}

async function processPage(
  userId: string,
  items: DiscogsCollectionItem[],
  progress: ImportProgress,
): Promise<void> {
  for (const item of items) {
    try {
      const info = item.basic_information;

      // Upsert album
      const [album] = await db
        .insert(albums)
        .values({
          discogsId: info.id,
          discogsMasterId: info.master_id || null,
          title: info.title,
          year: info.year > 0 ? info.year : null,
          thumb: info.thumb || null,
          coverImage: info.cover_image || null,
          genres: info.genres ?? [],
          styles: info.styles ?? [],
        })
        .onConflictDoUpdate({
          target: albums.discogsId,
          set: {
            title: info.title,
            discogsMasterId: info.master_id || null,
            thumb: info.thumb || null,
            coverImage: info.cover_image || null,
            year: info.year > 0 ? info.year : null,
            genres: info.genres ?? [],
            styles: info.styles ?? [],
          },
        })
        .returning({ id: albums.id });

      // Upsert collection item
      await db
        .insert(collectionItems)
        .values({
          userId,
          albumId: album.id,
          status: 'owned',
          rating: item.rating > 0 ? item.rating : null,
          discogsInstanceId: item.id,
        })
        .onConflictDoUpdate({
          target: [collectionItems.userId, collectionItems.albumId],
          set: {
            rating: item.rating > 0 ? item.rating : null,
            discogsInstanceId: item.id,
          },
        });

      progress.imported++;
    } catch (err) {
      progress.errors++;
      console.error(
        `[DiscogsImport] Failed to import item ${item.basic_information.title}:`,
        err,
      );
    }
  }
}
