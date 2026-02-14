import { db } from '@/server/db';
import { albums, collectionItems } from '@/server/db/schema';
import { eq, isNotNull } from 'drizzle-orm';
import { type TasteProfile, type WeightMap, cosineSimilarity, topN } from '../taste-profile';

export interface ScoredRecommendation {
  albumId: string;
  score: number;
  explanation: string;
  strategy: 'content';
}

/**
 * Content-based recommendation strategy.
 *
 * Scores candidate albums by cosine similarity against user's taste profile.
 * Considers genre weights (50%), style weights (30%), and era weights (20%).
 *
 * Returns top N scored albums not already in user's collection.
 */
export async function contentBasedRecommendations(
  userId: string,
  tasteProfile: TasteProfile,
  limit: number = 50,
): Promise<ScoredRecommendation[]> {
  // Get user's existing album IDs to exclude
  const owned = await db
    .select({ albumId: collectionItems.albumId })
    .from(collectionItems)
    .where(eq(collectionItems.userId, userId));
  const ownedIds = new Set(owned.map(o => o.albumId));

  // Fetch candidate albums (albums in our DB that user doesn't own)
  // Get albums that have at least some genre/style data
  const candidates = await db
    .select({
      id: albums.id,
      title: albums.title,
      genres: albums.genres,
      styles: albums.styles,
      year: albums.year,
      communityHave: albums.communityHave,
      communityWant: albums.communityWant,
    })
    .from(albums)
    .where(isNotNull(albums.genres))
    .limit(2000); // Cap candidates for performance

  // Score each candidate
  const scored: ScoredRecommendation[] = [];

  for (const candidate of candidates) {
    if (ownedIds.has(candidate.id)) continue;

    // Build candidate vectors
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

    const candidateEra: WeightMap = {};
    if (candidate.year && candidate.year > 1900) {
      const decade = `${Math.floor(candidate.year / 10) * 10}s`;
      candidateEra[decade] = 1;
    }

    // Weighted cosine similarity across dimensions
    const genreSim = cosineSimilarity(tasteProfile.genreWeights, candidateGenres);
    const styleSim = cosineSimilarity(tasteProfile.styleWeights, candidateStyles);
    const eraSim = cosineSimilarity(tasteProfile.eraWeights, candidateEra);

    const score = genreSim * 0.5 + styleSim * 0.3 + eraSim * 0.2;

    if (score > 0.05) { // Minimum threshold
      // Generate explanation
      const explanation = generateExplanation(tasteProfile, candidate, genreSim, styleSim, eraSim);
      scored.push({
        albumId: candidate.id,
        score,
        explanation,
        strategy: 'content',
      });
    }
  }

  // Sort by score descending and return top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

function generateExplanation(
  profile: TasteProfile,
  candidate: { genres: string[] | null; styles: string[] | null; year: number | null },
  genreSim: number,
  styleSim: number,
  eraSim: number,
): string {
  const parts: string[] = [];

  // Find matching genres from user's top genres
  const topGenres = topN(profile.genreWeights, 5).map(([g]) => g);
  const matchingGenres = (candidate.genres ?? []).filter(g => topGenres.includes(g));
  if (matchingGenres.length > 0) {
    parts.push(`Matches your taste for ${matchingGenres.join(', ')}`);
  }

  // Find matching styles
  const topStyles = topN(profile.styleWeights, 5).map(([s]) => s);
  const matchingStyles = (candidate.styles ?? []).filter(s => topStyles.includes(s));
  if (matchingStyles.length > 0 && parts.length === 0) {
    parts.push(`Similar style: ${matchingStyles.slice(0, 2).join(', ')}`);
  }

  // Era match
  if (eraSim > 0.5 && candidate.year && parts.length < 2) {
    const decade = `${Math.floor(candidate.year / 10) * 10}s`;
    parts.push(`From the ${decade}, one of your favorite eras`);
  }

  return parts.length > 0 ? parts.join('. ') : 'Based on your listening preferences';
}
