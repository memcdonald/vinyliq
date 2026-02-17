import { eq, desc, sql, and, notInArray } from "drizzle-orm";
import { db } from "@/server/db";
import { albums, collectionItems, user } from "@/server/db/schema";
import { getTasteProfile, topN } from "./taste-profile";
import { getUserApiKeys } from "@/server/services/ai/keys";
import { env } from "@/lib/env";

interface AIRecommendation {
  albumId: string;
  score: number;
  explanation: string;
}

const DEFAULT_RECOMMENDATION_PROMPT = `You are a vinyl record expert and curator. Based on the collector's taste profile below, recommend albums they would love. Consider genre alignment, era preferences, artist connections, and collectability.

Focus on:
- Albums that match their style but also introduce slight variety
- Pressings that are collectible or noteworthy
- Hidden gems they might not know about
- Classic albums that fit their taste

Be specific about WHY each album fits this collector.`;

/**
 * Use AI to generate personalized album recommendations.
 * Returns albums from the local DB that the AI identifies as good fits.
 */
export async function aiRecommendations(
  userId: string,
  limit: number = 20,
): Promise<AIRecommendation[]> {
  const keys = await getUserApiKeys(userId);
  if (!keys.anthropicKey && !keys.openaiKey) return [];

  // Get user's taste profile
  const profile = await getTasteProfile(userId);
  const topGenres = topN(profile.genreWeights, 8)
    .map(([g, w]) => `${g} (${(w * 100).toFixed(0)}%)`)
    .join(", ");
  const topStyles = topN(profile.styleWeights, 8)
    .map(([s, w]) => `${s} (${(w * 100).toFixed(0)}%)`)
    .join(", ");
  const topArtists = topN(profile.artistWeights, 10)
    .map(([a]) => a)
    .join(", ");
  const topEras = topN(profile.eraWeights, 5)
    .map(([e, w]) => `${e} (${(w * 100).toFixed(0)}%)`)
    .join(", ");

  if (!topGenres && !topArtists) return []; // Not enough data

  // Get user's custom prompt
  const [prefs] = await db
    .select({ recommendationPrompt: user.recommendationPrompt, preferredAiProvider: user.preferredAiProvider })
    .from(user)
    .where(eq(user.id, userId));

  // Get user's existing collection album IDs to exclude
  const ownedIds = await db
    .select({ albumId: collectionItems.albumId })
    .from(collectionItems)
    .where(eq(collectionItems.userId, userId));
  const excludeIds = ownedIds.map((r) => r.albumId);

  // Get a pool of candidate albums from DB for the AI to choose from
  const candidates = await db
    .select({
      id: albums.id,
      title: albums.title,
      year: albums.year,
      genres: albums.genres,
      styles: albums.styles,
      communityRating: albums.communityRating,
      communityHave: albums.communityHave,
      communityWant: albums.communityWant,
    })
    .from(albums)
    .where(
      excludeIds.length > 0
        ? notInArray(albums.id, excludeIds)
        : sql`1=1`,
    )
    .orderBy(desc(albums.communityRating))
    .limit(200);

  if (candidates.length === 0) return [];

  // Build candidate list for the prompt
  const candidateList = candidates
    .map(
      (a, i) =>
        `${i}. "${a.title}" (${a.year ?? "?"}) — genres: ${(a.genres ?? []).join(", ") || "unknown"}, styles: ${(a.styles ?? []).join(", ") || "unknown"}${a.communityRating ? `, rating: ${a.communityRating}/5` : ""}`,
    )
    .join("\n");

  const customPrompt = prefs?.recommendationPrompt || DEFAULT_RECOMMENDATION_PROMPT;
  const preferred = prefs?.preferredAiProvider ?? env.AI_PROVIDER;

  const prompt = `${customPrompt}

## Collector's Taste Profile
- Top genres: ${topGenres || "Not enough data"}
- Top styles: ${topStyles || "Not enough data"}
- Favorite artists: ${topArtists || "Not enough data"}
- Preferred eras: ${topEras || "Not enough data"}

## Available Albums (pick the best ${limit} for this collector)
${candidateList}

Respond with ONLY valid JSON: an array of objects with "index" (0-based from the list above), "score" (1-10, how well it fits), and "explanation" (1-2 sentences why).
Example: [{"index": 0, "score": 9, "explanation": "Perfect match for your jazz collection..."}]`;

  try {
    let text: string | null = null;

    if (preferred === "openai" && keys.openaiKey) {
      text = await callOpenAI(keys.openaiKey, prompt);
    } else if (keys.anthropicKey) {
      text = await callClaude(keys.anthropicKey, prompt);
    } else if (keys.openaiKey) {
      text = await callOpenAI(keys.openaiKey, prompt);
    }

    if (!text) return [];

    return parseAIRecommendations(text, candidates);
  } catch (err) {
    console.error("[AIRecommend] AI recommendation failed:", err);
    return [];
  }
}

async function callClaude(apiKey: string, prompt: string): Promise<string | null> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    console.error(`[AIRecommend] Claude API error: ${response.status}`);
    return null;
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? null;
}

async function callOpenAI(apiKey: string, prompt: string): Promise<string | null> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      max_tokens: 2048,
      messages: [
        { role: "system", content: "You are a vinyl record expert curator. Always respond with valid JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    console.error(`[AIRecommend] OpenAI API error: ${response.status}`);
    return null;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? null;
}

function parseAIRecommendations(
  text: string,
  candidates: { id: string }[],
): AIRecommendation[] {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item: unknown): item is Record<string, unknown> => {
        if (typeof item !== "object" || item === null) return false;
        const rec = item as Record<string, unknown>;
        return (
          typeof rec.index === "number" &&
          rec.index >= 0 &&
          rec.index < candidates.length
        );
      })
      .map((item) => ({
        albumId: candidates[item.index as number].id,
        score: Math.max(0, Math.min(1, (Number(item.score) || 5) / 10)),
        explanation: String(item.explanation || "AI recommended"),
      }));
  } catch {
    return [];
  }
}
