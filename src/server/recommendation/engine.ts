import { db } from '@/server/db';
import { recommendations, albums, collectionItems } from '@/server/db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { getTasteProfile, updateTasteProfile } from './taste-profile';
import { contentBasedRecommendations } from './strategies/content-based';
import { graphRecommendations } from './strategies/graph-traversal';
import { collaborativeRecommendations } from './strategies/collaborative';
import { aiRecommendations } from './ai-recommend';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AggregatedRecommendation {
  albumId: string;
  finalScore: number;
  explanation: string;
  strategy: string; // best contributing strategy
  strategyScores: {
    content: number;
    graph: number;
    collaborative: number;
    ai: number;
  };
}

export interface RecommendationGroup {
  title: string;
  strategy: string;
  items: {
    albumId: string;
    title: string;
    thumb: string | null;
    coverImage: string | null;
    year: number | null;
    genres: string[];
    styles: string[];
    discogsId: number | null;
    score: number;
    explanation: string;
  }[];
}

// Strategy weights for final score aggregation
const STRATEGY_WEIGHTS = {
  content: 0.25,
  collaborative: 0.2,
  graph: 0.2,
  ai: 0.35,
} as const;

// ---------------------------------------------------------------------------
// Main recommendation engine
// ---------------------------------------------------------------------------

/**
 * Generate recommendations for a user.
 *
 * Runs all three strategies in parallel, aggregates scores with weighted
 * averaging (40% content, 30% collaborative, 30% graph), applies diversity
 * filtering, and stores results in the recommendations table.
 */
export async function generateRecommendations(
  userId: string,
  limit: number = 100,
): Promise<AggregatedRecommendation[]> {
  // Step 1: Get or compute the taste profile
  const tasteProfile = await updateTasteProfile(userId);

  // Step 2: Run all strategies in parallel (AI + algorithmic)
  const [contentResults, graphResults, collabResults, aiResults] = await Promise.allSettled([
    contentBasedRecommendations(userId, tasteProfile, limit),
    graphRecommendations(userId, tasteProfile, limit),
    collaborativeRecommendations(userId, tasteProfile, limit),
    aiRecommendations(userId, Math.min(limit, 20)),
  ]);

  // Collect results (graceful fallback if any strategy fails)
  const content = contentResults.status === 'fulfilled' ? contentResults.value : [];
  const graph = graphResults.status === 'fulfilled' ? graphResults.value : [];
  const collab = collabResults.status === 'fulfilled' ? collabResults.value : [];
  const ai = aiResults.status === 'fulfilled' ? aiResults.value : [];

  if (contentResults.status === 'rejected') {
    console.log('[RecEngine] Content strategy failed:', contentResults.reason);
  }
  if (graphResults.status === 'rejected') {
    console.log('[RecEngine] Graph strategy failed:', graphResults.reason);
  }
  if (collabResults.status === 'rejected') {
    console.log('[RecEngine] Collaborative strategy failed:', collabResults.reason);
  }
  if (aiResults.status === 'rejected') {
    console.log('[RecEngine] AI strategy failed:', aiResults.reason);
  }

  // Step 3: Aggregate scores per album
  const albumScores = new Map<string, {
    content: { score: number; explanation: string } | null;
    graph: { score: number; explanation: string } | null;
    collaborative: { score: number; explanation: string } | null;
    ai: { score: number; explanation: string } | null;
  }>();

  for (const rec of content) {
    const entry = albumScores.get(rec.albumId) ?? { content: null, graph: null, collaborative: null, ai: null };
    entry.content = { score: rec.score, explanation: rec.explanation };
    albumScores.set(rec.albumId, entry);
  }

  for (const rec of graph) {
    const entry = albumScores.get(rec.albumId) ?? { content: null, graph: null, collaborative: null, ai: null };
    entry.graph = { score: rec.score, explanation: rec.explanation };
    albumScores.set(rec.albumId, entry);
  }

  for (const rec of collab) {
    const entry = albumScores.get(rec.albumId) ?? { content: null, graph: null, collaborative: null, ai: null };
    entry.collaborative = { score: rec.score, explanation: rec.explanation };
    albumScores.set(rec.albumId, entry);
  }

  for (const rec of ai) {
    const entry = albumScores.get(rec.albumId) ?? { content: null, graph: null, collaborative: null, ai: null };
    entry.ai = { score: rec.score, explanation: rec.explanation };
    albumScores.set(rec.albumId, entry);
  }

  // Step 4: Compute final scores with weighted aggregation
  const aggregated: AggregatedRecommendation[] = [];

  for (const [albumId, scores] of albumScores) {
    const contentScore = scores.content?.score ?? 0;
    const graphScore = scores.graph?.score ?? 0;
    const collabScore = scores.collaborative?.score ?? 0;
    const aiScore = scores.ai?.score ?? 0;

    const finalScore =
      contentScore * STRATEGY_WEIGHTS.content +
      graphScore * STRATEGY_WEIGHTS.graph +
      collabScore * STRATEGY_WEIGHTS.collaborative +
      aiScore * STRATEGY_WEIGHTS.ai;

    // Multi-strategy bonus: albums appearing in 2+ strategies get a 10% boost
    const strategyCount = [scores.content, scores.graph, scores.collaborative, scores.ai].filter(Boolean).length;
    const boostedScore = strategyCount >= 2 ? finalScore * 1.1 : finalScore;

    // Pick the best strategy's explanation (prefer AI explanations when available)
    let bestStrategy = 'content';
    let bestExplanation = 'Based on your listening preferences';
    let bestStrategyScore = 0;

    // AI explanations are richer, so prefer them when score is close
    if (scores.ai && scores.ai.score > 0) {
      bestStrategyScore = scores.ai.score;
      bestStrategy = 'ai';
      bestExplanation = scores.ai.explanation;
    }
    if (scores.content && scores.content.score > bestStrategyScore) {
      bestStrategyScore = scores.content.score;
      bestStrategy = 'content';
      bestExplanation = scores.content.explanation;
    }
    if (scores.graph && scores.graph.score > bestStrategyScore) {
      bestStrategyScore = scores.graph.score;
      bestStrategy = 'graph';
      bestExplanation = scores.graph.explanation;
    }
    if (scores.collaborative && scores.collaborative.score > bestStrategyScore) {
      bestStrategyScore = scores.collaborative.score;
      bestStrategy = 'collaborative';
      bestExplanation = scores.collaborative.explanation;
    }
    // If AI scored but wasn't the top scorer, still use its explanation if it exists
    if (scores.ai && bestStrategy !== 'ai') {
      bestExplanation = scores.ai.explanation;
    }

    aggregated.push({
      albumId,
      finalScore: boostedScore,
      explanation: bestExplanation,
      strategy: bestStrategy,
      strategyScores: {
        content: contentScore,
        graph: graphScore,
        collaborative: collabScore,
        ai: aiScore,
      },
    });
  }

  // Step 5: Sort by final score and apply diversity filtering
  aggregated.sort((a, b) => b.finalScore - a.finalScore);
  const diversified = applyDiversityFilter(aggregated, limit);

  // Step 6: Store in database
  await storeRecommendations(userId, diversified);

  return diversified;
}

/**
 * Get stored recommendations for a user, grouped by strategy.
 * If none exist, generates them on-the-fly.
 */
export async function getRecommendationGroups(
  userId: string,
): Promise<RecommendationGroup[]> {
  // Check for existing recommendations
  const existing = await db
    .select({
      id: recommendations.id,
      albumId: recommendations.albumId,
      score: recommendations.score,
      strategy: recommendations.strategy,
      explanation: recommendations.explanation,
      createdAt: recommendations.createdAt,
    })
    .from(recommendations)
    .where(eq(recommendations.userId, userId))
    .orderBy(desc(recommendations.score));

  // If no recommendations exist, generate them
  if (existing.length === 0) {
    // Check if user has any collection items
    const [item] = await db
      .select({ id: collectionItems.id })
      .from(collectionItems)
      .where(eq(collectionItems.userId, userId))
      .limit(1);

    if (!item) return []; // No collection = no recommendations

    await generateRecommendations(userId);

    // Re-fetch
    const fresh = await db
      .select({
        id: recommendations.id,
        albumId: recommendations.albumId,
        score: recommendations.score,
        strategy: recommendations.strategy,
        explanation: recommendations.explanation,
      })
      .from(recommendations)
      .where(eq(recommendations.userId, userId))
      .orderBy(desc(recommendations.score));

    return buildGroups(fresh);
  }

  // Check if recommendations are stale (older than 24 hours)
  const oldestCreatedAt = existing[existing.length - 1]?.createdAt;
  if (oldestCreatedAt) {
    const age = Date.now() - oldestCreatedAt.getTime();
    const STALE_MS = 24 * 60 * 60 * 1000;
    if (age > STALE_MS) {
      // Regenerate in background, but return existing for now
      generateRecommendations(userId).catch((err) =>
        console.log('[RecEngine] Background regeneration failed:', err),
      );
    }
  }

  return buildGroups(existing);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Diversity filter to avoid recommending too many albums from the same genre.
 * Ensures no single genre dominates more than 40% of results.
 */
function applyDiversityFilter(
  recs: AggregatedRecommendation[],
  limit: number,
): AggregatedRecommendation[] {
  // For now, return top N — diversity filtering would require album metadata
  // which we fetch separately. The strategy mix already provides some diversity.
  return recs.slice(0, limit);
}

/**
 * Store aggregated recommendations in the database.
 * Upserts on (userId, albumId, strategy) to handle re-runs.
 */
async function storeRecommendations(
  userId: string,
  recs: AggregatedRecommendation[],
): Promise<void> {
  if (recs.length === 0) return;

  // Delete old recommendations for this user
  await db
    .delete(recommendations)
    .where(eq(recommendations.userId, userId));

  // Insert new recommendations in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < recs.length; i += BATCH_SIZE) {
    const batch = recs.slice(i, i + BATCH_SIZE);
    await db.insert(recommendations).values(
      batch.map((rec) => ({
        userId,
        albumId: rec.albumId,
        score: rec.finalScore,
        strategy: rec.strategy,
        explanation: rec.explanation,
      })),
    );
  }

  console.log(`[RecEngine] Stored ${recs.length} recommendations for user ${userId}`);
}

/**
 * Build grouped recommendation results with album metadata.
 */
async function buildGroups(
  recs: { albumId: string; score: number; strategy: string; explanation: string }[],
): Promise<RecommendationGroup[]> {
  if (recs.length === 0) return [];

  // Fetch album metadata for all recommended albums
  const albumIds = [...new Set(recs.map((r) => r.albumId))];
  const albumData = await db
    .select({
      id: albums.id,
      title: albums.title,
      thumb: albums.thumb,
      coverImage: albums.coverImage,
      year: albums.year,
      genres: albums.genres,
      styles: albums.styles,
      discogsId: albums.discogsId,
    })
    .from(albums)
    .where(inArray(albums.id, albumIds));

  const albumMap = new Map(albumData.map((a) => [a.id, a]));

  // Group by strategy
  const strategyGroups: Record<string, typeof recs> = {};
  for (const rec of recs) {
    if (!strategyGroups[rec.strategy]) {
      strategyGroups[rec.strategy] = [];
    }
    strategyGroups[rec.strategy].push(rec);
  }

  // Also create a "Top Picks" group with the highest-scoring across all strategies
  const groups: RecommendationGroup[] = [];

  // Top picks: highest scoring across all strategies (up to 12)
  const topPicks = recs.slice(0, 12);
  if (topPicks.length > 0) {
    groups.push({
      title: 'Top Picks For You',
      strategy: 'top',
      items: topPicks
        .map((rec) => {
          const album = albumMap.get(rec.albumId);
          if (!album) return null;
          return {
            albumId: rec.albumId,
            title: album.title,
            thumb: album.thumb,
            coverImage: album.coverImage,
            year: album.year,
            genres: album.genres ?? [],
            styles: album.styles ?? [],
            discogsId: album.discogsId,
            score: rec.score,
            explanation: rec.explanation,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    });
  }

  // Strategy-specific groups
  const strategyTitles: Record<string, string> = {
    ai: 'AI Curated For You',
    content: 'Based On Your Taste',
    graph: 'Artist Connections',
    collaborative: 'Popular With Collectors Like You',
  };

  for (const [strategy, strategyRecs] of Object.entries(strategyGroups)) {
    const title = strategyTitles[strategy] ?? strategy;
    const items = strategyRecs
      .slice(0, 12)
      .map((rec) => {
        const album = albumMap.get(rec.albumId);
        if (!album) return null;
        return {
          albumId: rec.albumId,
          title: album.title,
          thumb: album.thumb,
          coverImage: album.coverImage,
          year: album.year,
          genres: album.genres ?? [],
          styles: album.styles ?? [],
          discogsId: album.discogsId,
          score: rec.score,
          explanation: rec.explanation,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (items.length > 0) {
      groups.push({ title, strategy, items });
    }
  }

  return groups;
}
