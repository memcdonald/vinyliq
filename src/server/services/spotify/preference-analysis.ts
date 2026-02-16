/**
 * AI-powered Spotify preference analysis.
 *
 * Fetches a user's top artists and tracks across all three time ranges,
 * then sends the data to an AI provider for rich, human-readable preference
 * insights tailored to vinyl recommendations.
 */

import { db } from "@/server/db";
import { user, userTasteProfiles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { spotifyClient } from "./client";
import { refreshSpotifyToken } from "./auth";
import type {
  SpotifyArtist,
  SpotifyTrack,
  SpotifyTimeRange,
  SpotifyPreferenceAnalysis,
} from "./types";
import { getAIProvider } from "@/server/services/ai";
import { getUserApiKeys } from "@/server/services/ai/keys";

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

interface ListeningData {
  artists: { name: string; genres: string[]; popularity: number; timeRange: SpotifyTimeRange }[];
  tracks: { name: string; artistNames: string[]; timeRange: SpotifyTimeRange }[];
}

/**
 * Fetch the user's top artists and tracks from Spotify across all 3 time ranges.
 */
export async function fetchSpotifyListeningData(
  userId: string,
): Promise<ListeningData | null> {
  const [u] = await db
    .select({
      spotifyAccessToken: user.spotifyAccessToken,
      spotifyRefreshToken: user.spotifyRefreshToken,
      spotifyTokenExpiresAt: user.spotifyTokenExpiresAt,
    })
    .from(user)
    .where(eq(user.id, userId));

  if (!u?.spotifyAccessToken || !u?.spotifyRefreshToken) {
    return null;
  }

  let token = u.spotifyAccessToken;

  // Refresh token if expired
  if (u.spotifyTokenExpiresAt && u.spotifyTokenExpiresAt < new Date()) {
    try {
      const newTokens = await refreshSpotifyToken(u.spotifyRefreshToken);
      token = newTokens.access_token;

      await db
        .update(user)
        .set({
          spotifyAccessToken: newTokens.access_token,
          spotifyRefreshToken: newTokens.refresh_token ?? u.spotifyRefreshToken,
          spotifyTokenExpiresAt: new Date(
            Date.now() + newTokens.expires_in * 1000,
          ),
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));
    } catch {
      console.error("[PreferenceAnalysis] Token refresh failed");
      return null;
    }
  }

  const timeRanges: SpotifyTimeRange[] = ["short_term", "medium_term", "long_term"];
  const artists: ListeningData["artists"] = [];
  const tracks: ListeningData["tracks"] = [];

  for (const range of timeRanges) {
    try {
      const artistPage = await spotifyClient.getUserTopArtists(token, range, 50);
      for (const a of artistPage.items) {
        artists.push({
          name: a.name,
          genres: a.genres,
          popularity: a.popularity,
          timeRange: range,
        });
      }
    } catch (err) {
      console.error(`[PreferenceAnalysis] Failed to fetch top artists (${range}):`, err);
    }

    try {
      const trackPage = await spotifyClient.getUserTopTracks(token, range, 50);
      for (const t of trackPage.items) {
        tracks.push({
          name: t.name,
          artistNames: t.artists.map((a) => a.name),
          timeRange: range,
        });
      }
    } catch (err) {
      console.error(`[PreferenceAnalysis] Failed to fetch top tracks (${range}):`, err);
    }
  }

  if (artists.length === 0 && tracks.length === 0) {
    return null;
  }

  return { artists, tracks };
}

// ---------------------------------------------------------------------------
// AI analysis
// ---------------------------------------------------------------------------

const TIME_RANGE_LABELS: Record<SpotifyTimeRange, string> = {
  short_term: "Last 4 Weeks",
  medium_term: "Last 6 Months",
  long_term: "All Time",
};

function buildAnalysisPrompt(data: ListeningData): string {
  let prompt = `You are a music taste analyst specializing in vinyl record culture. Analyze the following Spotify listening data and provide insights tailored to a vinyl collector.\n\n`;

  // Group artists by time range
  for (const range of ["short_term", "medium_term", "long_term"] as SpotifyTimeRange[]) {
    const rangeArtists = data.artists.filter((a) => a.timeRange === range);
    if (rangeArtists.length > 0) {
      prompt += `## Top Artists — ${TIME_RANGE_LABELS[range]}\n`;
      for (const a of rangeArtists.slice(0, 25)) {
        prompt += `- ${a.name} (genres: ${a.genres.join(", ") || "none listed"})\n`;
      }
      prompt += "\n";
    }

    const rangeTracks = data.tracks.filter((t) => t.timeRange === range);
    if (rangeTracks.length > 0) {
      prompt += `## Top Tracks — ${TIME_RANGE_LABELS[range]}\n`;
      for (const t of rangeTracks.slice(0, 25)) {
        prompt += `- "${t.name}" by ${t.artistNames.join(", ")}\n`;
      }
      prompt += "\n";
    }
  }

  prompt += `Based on this listening data, respond with a JSON object (no markdown code fences) matching this exact structure:
{
  "summary": "A 2-3 sentence personality summary of this listener's music taste, written in second person",
  "topGenres": ["top 5-8 dominant genres/subgenres"],
  "moods": ["3-5 dominant mood descriptors, e.g. 'melancholic', 'energetic', 'introspective'"],
  "eras": ["2-4 preferred musical eras, e.g. '1970s classic rock', '2010s indie'"],
  "keyInsights": ["3-5 notable patterns or observations about listening habits"],
  "vinylRecommendations": ["5-8 specific album recommendations that would be great vinyl purchases, formatted as 'Artist - Album Title'"]
}`;

  return prompt;
}

function parseAnalysisResponse(text: string): SpotifyPreferenceAnalysis {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse AI preference analysis response as JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    summary: String(parsed.summary || ""),
    topGenres: Array.isArray(parsed.topGenres) ? parsed.topGenres.map(String) : [],
    moods: Array.isArray(parsed.moods) ? parsed.moods.map(String) : [],
    eras: Array.isArray(parsed.eras) ? parsed.eras.map(String) : [],
    keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights.map(String) : [],
    vinylRecommendations: Array.isArray(parsed.vinylRecommendations)
      ? parsed.vinylRecommendations.map(String)
      : [],
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Orchestrate: fetch Spotify data -> build prompt -> call AI -> store & return result.
 */
export async function analyzePreferencesWithAI(
  userId: string,
): Promise<SpotifyPreferenceAnalysis> {
  // 1. Fetch listening data
  const data = await fetchSpotifyListeningData(userId);
  if (!data) {
    throw new Error("Could not fetch Spotify listening data. Is your Spotify account connected?");
  }

  // 2. Resolve AI provider
  const [u] = await db
    .select({ preferredAiProvider: user.preferredAiProvider })
    .from(user)
    .where(eq(user.id, userId));

  const keys = await getUserApiKeys(userId);
  const provider = getAIProvider(u?.preferredAiProvider, keys);
  if (!provider) {
    throw new Error("No AI provider configured. Add an API key in Settings.");
  }

  // 3. Build prompt and call AI directly (the provider.evaluate is album-specific,
  //    so we call the underlying API directly using the resolved keys)
  const prompt = buildAnalysisPrompt(data);
  const anthropicKey = keys.anthropicKey;
  const openaiKey = keys.openaiKey;
  const preferredProvider = u?.preferredAiProvider ?? process.env.AI_PROVIDER;

  let responseText: string;

  if (preferredProvider === "openai" && openaiKey) {
    responseText = await callOpenAI(openaiKey, prompt);
  } else if (anthropicKey) {
    responseText = await callClaude(anthropicKey, prompt);
  } else if (openaiKey) {
    responseText = await callOpenAI(openaiKey, prompt);
  } else {
    throw new Error("No AI API key available.");
  }

  // 4. Parse response
  const analysis = parseAnalysisResponse(responseText);

  // 5. Store in DB
  const [existing] = await db
    .select({ id: userTasteProfiles.id })
    .from(userTasteProfiles)
    .where(eq(userTasteProfiles.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(userTasteProfiles)
      .set({
        aiPreferenceAnalysis: analysis,
        updatedAt: new Date(),
      })
      .where(eq(userTasteProfiles.userId, userId));
  } else {
    await db.insert(userTasteProfiles).values({
      userId,
      genreWeights: {},
      styleWeights: {},
      eraWeights: {},
      labelWeights: {},
      artistWeights: {},
      aiPreferenceAnalysis: analysis,
      computedAt: new Date(),
    });
  }

  return analysis;
}

// ---------------------------------------------------------------------------
// Direct AI API calls (bypassing the evaluate() method which is album-specific)
// ---------------------------------------------------------------------------

async function callClaude(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${body}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error("Empty response from Claude");
  return text;
}

async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${body}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from OpenAI");
  return text;
}
