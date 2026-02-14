import { db } from '@/server/db';
import { albums, collectionItems } from '@/server/db/schema';
import { eq, and, gt, isNotNull, sql, desc } from 'drizzle-orm';
import { type TasteProfile, type WeightMap, topN, cosineSimilarity } from '../taste-profile';

export interface ScoredRecommendation {
  albumId: string;
  score: number;
  explanation: string;
  strategy: 'collaborative';
}

/**
 * Collaborative recommendation strategy.
 *
 * Uses Discogs community data as a proxy for collaborative filtering:
 * - Albums with high communityHave in the user's preferred genres = "popular in your niche"
 * - Albums with high communityWant/communityHave ratio = "highly sought after"
 * - Combines community popularity with genre/style match to the user's profile
 *
 * Score = niche_match * 0.5 + community_popularity * 0.3 + demand_signal * 0.2
 */
export async function collaborativeRecommendations(
  userId: string,
  tasteProfile: TasteProfile,
  limit: number = 50,
): Promise<ScoredRecommendation[]> {
  // Get user's existing albums to exclude
  const owned = await db
    .select({ albumId: collectionItems.albumId })
    .from(collectionItems)
    .where(eq(collectionItems.userId, userId));
  const ownedIds = new Set(owned.map(o => o.albumId));

  // Get user's top genres and styles for the niche query
  const topGenres = topN(tasteProfile.genreWeights, 5).map(([g]) => g);
  const topStyles = topN(tasteProfile.styleWeights, 5).map(([s]) => s);

  if (topGenres.length === 0) return [];

  // Fetch popular albums from DB that have community data
  // We query albums with communityHave > 0 ordered by community engagement
  const candidates = await db
    .select({
      id: albums.id,
      title: albums.title,
      genres: albums.genres,
      styles: albums.styles,
      year: albums.year,
      communityHave: albums.communityHave,
      communityWant: albums.communityWant,
      communityRating: albums.communityRating,
    })
    .from(albums)
    .where(and(
      gt(albums.communityHave, 0),
      isNotNull(albums.genres),
    ))
    .orderBy(desc(albums.communityHave))
    .limit(2000);

  // Compute max community stats for normalization
  let maxHave = 1;
  let maxWant = 1;
  for (const c of candidates) {
    if ((c.communityHave ?? 0) > maxHave) maxHave = c.communityHave ?? 0;
    if ((c.communityWant ?? 0) > maxWant) maxWant = c.communityWant ?? 0;
  }

  const scored: ScoredRecommendation[] = [];

  for (const candidate of candidates) {
    if (ownedIds.has(candidate.id)) continue;

    // Build candidate genre/style vectors
    const candidateGenres: WeightMap = {};
    if (candidate.genres) {
      for (const g of candidate.genres) {
        candidateGenres[g] = 1 / candidate.genres.length;
      }
    }
    const candidateStyles: WeightMap = {};
    if (candidate.styles) {
      for (const s of candidate.styles) {
        candidateStyles[s] = 1 / candidate.styles.length;
      }
    }

    // Niche match: how well does this album fit user's taste?
    const genreMatch = cosineSimilarity(tasteProfile.genreWeights, candidateGenres);
    const styleMatch = cosineSimilarity(tasteProfile.styleWeights, candidateStyles);
    const nicheMatch = genreMatch * 0.6 + styleMatch * 0.4;

    if (nicheMatch < 0.1) continue; // Skip albums that don't match at all

    // Community popularity (normalized)
    const have = candidate.communityHave ?? 0;
    const want = candidate.communityWant ?? 0;
    const communityPopularity = have / maxHave;

    // Demand signal: want-to-have ratio (capped at 2.0 for normalization)
    const demandSignal = have > 0 ? Math.min(want / have, 2.0) / 2.0 : 0;

    // Combined score
    const score = nicheMatch * 0.5 + communityPopularity * 0.3 + demandSignal * 0.2;

    if (score > 0.05) {
      const explanation = generateCollaborativeExplanation(
        candidate, topGenres, have, want,
      );
      scored.push({
        albumId: candidate.id,
        score,
        explanation,
        strategy: 'collaborative',
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

function generateCollaborativeExplanation(
  candidate: { genres: string[] | null; styles: string[] | null; communityHave: number | null; communityWant: number | null },
  topGenres: string[],
  have: number,
  want: number,
): string {
  const parts: string[] = [];

  // Genre match explanation
  const matchingGenres = (candidate.genres ?? []).filter(g => topGenres.includes(g));
  if (matchingGenres.length > 0) {
    parts.push(`Popular in ${matchingGenres[0]}`);
  }

  // Community stats
  if (have > 1000) {
    parts.push(`owned by ${have.toLocaleString()} collectors`);
  } else if (have > 100) {
    parts.push(`in ${have.toLocaleString()} collections`);
  }

  // High demand signal
  if (want > have && have > 0) {
    parts.push('highly sought after');
  }

  return parts.length > 0 ? parts.join(', ') : 'Popular among collectors with similar taste';
}
