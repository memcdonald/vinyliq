import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { aiSuggestions } from "@/server/db/schema";
import { getTasteProfile, topN } from "@/server/recommendation/taste-profile";
import { env } from "@/lib/env";

const BATCH_SIZE = 10;

interface SuggestionForExplanation {
  id: string;
  artistName: string;
  title: string;
  labelName: string | null;
  collectabilityScore: number | null;
  tasteScore: number | null;
  sourceName: string | null;
}

/**
 * Generate AI explanations for suggestions that don't have one yet.
 * Returns the number of suggestions explained.
 */
export async function batchExplain(userId: string): Promise<number> {
  // Get suggestions without explanations
  const unexplained = await db
    .select({
      id: aiSuggestions.id,
      artistName: aiSuggestions.artistName,
      title: aiSuggestions.title,
      labelName: aiSuggestions.labelName,
      collectabilityScore: aiSuggestions.collectabilityScore,
      tasteScore: aiSuggestions.tasteScore,
      sourceName: aiSuggestions.sourceName,
    })
    .from(aiSuggestions)
    .where(
      and(
        eq(aiSuggestions.userId, userId),
        isNull(aiSuggestions.aiExplanation),
        eq(aiSuggestions.status, "new"),
      ),
    )
    .limit(BATCH_SIZE);

  if (unexplained.length === 0) return 0;

  const profile = await getTasteProfile(userId);
  const topGenres = topN(profile.genreWeights, 5)
    .map(([g, w]) => `${g} (${(w * 100).toFixed(0)}%)`)
    .join(", ");
  const topArtists = topN(profile.artistWeights, 5)
    .map(([a]) => a)
    .join(", ");

  const explanations = await generateExplanations(
    unexplained,
    topGenres,
    topArtists,
  );

  let explained = 0;
  for (let i = 0; i < unexplained.length; i++) {
    const explanation = explanations[i];
    if (explanation) {
      await db
        .update(aiSuggestions)
        .set({ aiExplanation: explanation, updatedAt: new Date() })
        .where(eq(aiSuggestions.id, unexplained[i].id));
      explained++;
    }
  }

  return explained;
}

async function generateExplanations(
  suggestions: SuggestionForExplanation[],
  topGenres: string,
  topArtists: string,
): Promise<(string | null)[]> {
  const prompt = buildBatchPrompt(suggestions, topGenres, topArtists);

  // Try Claude first, fallback to OpenAI
  if (env.ANTHROPIC_API_KEY) {
    return callClaude(prompt, suggestions.length);
  }
  if (env.OPENAI_API_KEY) {
    return callOpenAI(prompt, suggestions.length);
  }

  // No AI configured — return null for all
  return suggestions.map(() => null);
}

function buildBatchPrompt(
  suggestions: SuggestionForExplanation[],
  topGenres: string,
  topArtists: string,
): string {
  const items = suggestions
    .map(
      (s, i) =>
        `${i + 1}. "${s.title}" by ${s.artistName}${s.labelName ? ` (${s.labelName})` : ""}${s.sourceName ? ` — found via ${s.sourceName}` : ""}` +
        `${s.collectabilityScore ? ` [collectability: ${s.collectabilityScore}/100]` : ""}` +
        `${s.tasteScore ? ` [taste match: ${(s.tasteScore * 100).toFixed(0)}%]` : ""}`,
    )
    .join("\n");

  return `You are a vinyl record expert advisor. A collector's taste profile shows:
- Top genres: ${topGenres || "Not enough data yet"}
- Favorite artists: ${topArtists || "Not enough data yet"}

For each suggested release below, write a brief (1-2 sentence) personalized explanation of why this collector might be interested, considering their taste and the release's collectability. Be specific and concise.

Releases:
${items}

Respond with ONLY valid JSON: an array of strings, one explanation per release, in the same order.
Example: ["This aligns with your love of jazz...", "A rare limited pressing from..."]`;
}

async function callClaude(
  prompt: string,
  count: number,
): Promise<(string | null)[]> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    console.error(`Claude API error: ${response.status}`);
    return Array(count).fill(null);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  return parseExplanations(text, count);
}

async function callOpenAI(
  prompt: string,
  count: number,
): Promise<(string | null)[]> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: "You are a vinyl record expert. Always respond with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    console.error(`OpenAI API error: ${response.status}`);
    return Array(count).fill(null);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  return parseExplanations(text, count);
}

function parseExplanations(
  text: string | undefined,
  count: number,
): (string | null)[] {
  if (!text) return Array(count).fill(null);

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return Array(count).fill(null);

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return Array(count).fill(null);

    // Pad with nulls if AI returned fewer than expected
    while (parsed.length < count) {
      parsed.push(null);
    }

    return parsed.slice(0, count).map((e: unknown) =>
      typeof e === "string" ? e : null,
    );
  } catch {
    return Array(count).fill(null);
  }
}
