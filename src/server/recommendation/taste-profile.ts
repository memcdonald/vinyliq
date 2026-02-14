import { db } from '@/server/db';
import { albums, collectionItems, userTasteProfiles, albumArtists, artists, labels as labelsTable } from '@/server/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';

// Weight types for taste vectors
export type WeightMap = Record<string, number>;

export interface TasteProfile {
  genreWeights: WeightMap;
  styleWeights: WeightMap;
  eraWeights: WeightMap;
  labelWeights: WeightMap;
  artistWeights: WeightMap;
}

/**
 * Compute a taste profile for a user based on their collection.
 *
 * Weights are calculated by frequency + recency + rating boost:
 * - Each album in the collection contributes to genre/style/era/label/artist weights
 * - Albums rated higher get a multiplier (rating/6, so a 10/10 = 1.67x, 6/10 = 1x)
 * - 'owned' albums get 1.5x weight vs 'wanted' (1.0x) or 'listened' (0.75x)
 * - Weights are normalized to sum to 1.0 per category
 *
 * @param userId - The user's ID
 * @returns The computed taste profile
 */
export async function computeTasteProfile(userId: string): Promise<TasteProfile> {
  // Fetch user's collection items with album data
  const items = await db
    .select({
      status: collectionItems.status,
      rating: collectionItems.rating,
      albumId: collectionItems.albumId,
      genres: albums.genres,
      styles: albums.styles,
      year: albums.year,
      title: albums.title,
    })
    .from(collectionItems)
    .innerJoin(albums, eq(collectionItems.albumId, albums.id))
    .where(eq(collectionItems.userId, userId));

  if (items.length === 0) {
    return {
      genreWeights: {},
      styleWeights: {},
      eraWeights: {},
      labelWeights: {},
      artistWeights: {},
    };
  }

  const genreWeights: WeightMap = {};
  const styleWeights: WeightMap = {};
  const eraWeights: WeightMap = {};
  const labelWeights: WeightMap = {};
  const artistWeights: WeightMap = {};

  // Status multipliers
  const statusMultiplier: Record<string, number> = {
    owned: 1.5,
    wanted: 1.0,
    listened: 0.75,
  };

  for (const item of items) {
    const baseWeight = statusMultiplier[item.status] ?? 1.0;
    const ratingBoost = item.rating ? item.rating / 6 : 1.0;
    const weight = baseWeight * ratingBoost;

    // Genre weights
    if (item.genres) {
      for (const genre of item.genres) {
        genreWeights[genre] = (genreWeights[genre] ?? 0) + weight;
      }
    }

    // Style weights
    if (item.styles) {
      for (const style of item.styles) {
        styleWeights[style] = (styleWeights[style] ?? 0) + weight;
      }
    }

    // Era weights (decade)
    if (item.year && item.year > 1900) {
      const decade = `${Math.floor(item.year / 10) * 10}s`;
      eraWeights[decade] = (eraWeights[decade] ?? 0) + weight;
    }
  }

  // Fetch artist associations for these albums
  const albumIds = items.map(i => i.albumId);
  if (albumIds.length > 0) {
    const artistAssociations = await db
      .select({
        artistName: artists.name,
        artistId: artists.id,
      })
      .from(albumArtists)
      .innerJoin(artists, eq(albumArtists.artistId, artists.id))
      .where(inArray(albumArtists.albumId, albumIds));

    for (const assoc of artistAssociations) {
      artistWeights[assoc.artistName] = (artistWeights[assoc.artistName] ?? 0) + 1;
    }
  }

  // Normalize all weight maps
  normalize(genreWeights);
  normalize(styleWeights);
  normalize(eraWeights);
  normalize(labelWeights);
  normalize(artistWeights);

  return { genreWeights, styleWeights, eraWeights, labelWeights, artistWeights };
}

/**
 * Compute and store the taste profile in the database.
 */
export async function updateTasteProfile(userId: string): Promise<TasteProfile> {
  const profile = await computeTasteProfile(userId);

  // Upsert into userTasteProfiles
  const existing = await db
    .select({ id: userTasteProfiles.id })
    .from(userTasteProfiles)
    .where(eq(userTasteProfiles.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(userTasteProfiles)
      .set({
        genreWeights: profile.genreWeights,
        styleWeights: profile.styleWeights,
        eraWeights: profile.eraWeights,
        labelWeights: profile.labelWeights,
        artistWeights: profile.artistWeights,
        computedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userTasteProfiles.userId, userId));
  } else {
    await db.insert(userTasteProfiles).values({
      userId,
      genreWeights: profile.genreWeights,
      styleWeights: profile.styleWeights,
      eraWeights: profile.eraWeights,
      labelWeights: profile.labelWeights,
      artistWeights: profile.artistWeights,
      computedAt: new Date(),
    });
  }

  return profile;
}

/**
 * Get the stored taste profile, or compute it if stale/missing.
 * A profile is considered stale after 24 hours.
 */
export async function getTasteProfile(userId: string): Promise<TasteProfile> {
  const [existing] = await db
    .select()
    .from(userTasteProfiles)
    .where(eq(userTasteProfiles.userId, userId))
    .limit(1);

  if (existing && existing.computedAt) {
    const age = Date.now() - existing.computedAt.getTime();
    const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours
    if (age < STALE_MS) {
      return {
        genreWeights: (existing.genreWeights as WeightMap) ?? {},
        styleWeights: (existing.styleWeights as WeightMap) ?? {},
        eraWeights: (existing.eraWeights as WeightMap) ?? {},
        labelWeights: (existing.labelWeights as WeightMap) ?? {},
        artistWeights: (existing.artistWeights as WeightMap) ?? {},
      };
    }
  }

  return updateTasteProfile(userId);
}

/** Normalize weights so they sum to 1.0 */
function normalize(weights: WeightMap): void {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (total === 0) return;
  for (const key of Object.keys(weights)) {
    weights[key] = weights[key] / total;
  }
}

/** Get top N entries from a weight map */
export function topN(weights: WeightMap, n: number): [string, number][] {
  return Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

/** Cosine similarity between two weight maps */
export function cosineSimilarity(a: WeightMap, b: WeightMap): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const key of keys) {
    const va = a[key] ?? 0;
    const vb = b[key] ?? 0;
    dotProduct += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}
