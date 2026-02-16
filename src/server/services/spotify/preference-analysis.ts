/**
 * AI-powered preference analysis.
 *
 * Gathers data from ALL available sources (Spotify, collection, wantlist,
 * chat history) and sends it to an AI provider for rich, human-readable
 * preference insights tailored to vinyl recommendations.
 */

import { db } from "@/server/db";
import { user, userTasteProfiles, collectionItems, albums, chatMessages, albumArtists, artists } from "@/server/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { spotifyClient } from "./client";
import { refreshSpotifyToken } from "./auth";
import type {
  SpotifyTimeRange,
  SpotifyPreferenceAnalysis,
} from "./types";
import { getAIProvider } from "@/server/services/ai";
import { getUserApiKeys } from "@/server/services/ai/keys";
import { topN, type WeightMap } from "@/server/recommendation/taste-profile";

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

interface ListeningData {
  artists: { name: string; genres: string[]; popularity: number; timeRange: SpotifyTimeRange }[];
  tracks: { name: string; artistNames: string[]; timeRange: SpotifyTimeRange }[];
}

interface CollectionProfile {
  topRatedAlbums: { title: string; artist: string; rating: number; genres: string[] }[];
  wantedAlbums: { title: string; artist: string }[];
  counts: { owned: number; wanted: number; listened: number };
  genreDistribution: [string, number][];
  styleDistribution: [string, number][];
  eraDistribution: [string, number][];
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
  const artistList: ListeningData["artists"] = [];
  const trackList: ListeningData["tracks"] = [];

  for (const range of timeRanges) {
    try {
      const artistPage = await spotifyClient.getUserTopArtists(token, range, 50);
      for (const a of artistPage.items) {
        artistList.push({
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
        trackList.push({
          name: t.name,
          artistNames: t.artists.map((a) => a.name),
          timeRange: range,
        });
      }
    } catch (err) {
      console.error(`[PreferenceAnalysis] Failed to fetch top tracks (${range}):`, err);
    }
  }

  if (artistList.length === 0 && trackList.length === 0) {
    return null;
  }

  return { artists: artistList, tracks: trackList };
}

/**
 * Fetch collection data for the user: top-rated albums, wantlist, counts, distributions.
 */
async function fetchCollectionProfile(userId: string): Promise<CollectionProfile | null> {
  const items = await db
    .select({
      status: collectionItems.status,
      rating: collectionItems.rating,
      albumId: collectionItems.albumId,
      title: albums.title,
      genres: albums.genres,
      styles: albums.styles,
      year: albums.year,
    })
    .from(collectionItems)
    .innerJoin(albums, eq(collectionItems.albumId, albums.id))
    .where(eq(collectionItems.userId, userId));

  if (items.length === 0) return null;

  // Get artist names for albums
  const albumIds = items.map((i) => i.albumId);
  const artistAssocs = albumIds.length > 0
    ? await db
        .select({
          albumId: albumArtists.albumId,
          artistName: artists.name,
        })
        .from(albumArtists)
        .innerJoin(artists, eq(albumArtists.artistId, artists.id))
        .where(inArray(albumArtists.albumId, albumIds))
    : [];

  const albumArtistMap: Record<string, string> = {};
  for (const a of artistAssocs) {
    if (!albumArtistMap[a.albumId]) {
      albumArtistMap[a.albumId] = a.artistName;
    }
  }

  const counts = { owned: 0, wanted: 0, listened: 0 };
  const genreWeights: WeightMap = {};
  const styleWeights: WeightMap = {};
  const eraWeights: WeightMap = {};

  for (const item of items) {
    if (item.status === "owned") counts.owned++;
    else if (item.status === "wanted") counts.wanted++;
    else if (item.status === "listened") counts.listened++;

    if (item.genres) {
      for (const g of item.genres) {
        genreWeights[g] = (genreWeights[g] ?? 0) + 1;
      }
    }
    if (item.styles) {
      for (const s of item.styles) {
        styleWeights[s] = (styleWeights[s] ?? 0) + 1;
      }
    }
    if (item.year && item.year > 1900) {
      const decade = `${Math.floor(item.year / 10) * 10}s`;
      eraWeights[decade] = (eraWeights[decade] ?? 0) + 1;
    }
  }

  const topRatedAlbums = items
    .filter((i) => i.rating && i.rating >= 8)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 15)
    .map((i) => ({
      title: i.title,
      artist: albumArtistMap[i.albumId] ?? "Unknown",
      rating: i.rating!,
      genres: Array.isArray(i.genres) ? i.genres : [],
    }));

  const wantedAlbums = items
    .filter((i) => i.status === "wanted")
    .slice(0, 10)
    .map((i) => ({
      title: i.title,
      artist: albumArtistMap[i.albumId] ?? "Unknown",
    }));

  return {
    topRatedAlbums,
    wantedAlbums,
    counts,
    genreDistribution: topN(genreWeights, 10),
    styleDistribution: topN(styleWeights, 10),
    eraDistribution: topN(eraWeights, 6),
  };
}

/**
 * Fetch last 10 user messages from chat history for conversational context.
 */
async function fetchRecentChatMessages(userId: string): Promise<string[]> {
  const messages = await db
    .select({ content: chatMessages.content, role: chatMessages.role })
    .from(chatMessages)
    .where(and(eq(chatMessages.userId, userId), eq(chatMessages.role, "user")))
    .orderBy(desc(chatMessages.createdAt))
    .limit(10);

  return messages.map((m) => m.content);
}

// ---------------------------------------------------------------------------
// AI analysis
// ---------------------------------------------------------------------------

const TIME_RANGE_LABELS: Record<SpotifyTimeRange, string> = {
  short_term: "Last 4 Weeks",
  medium_term: "Last 6 Months",
  long_term: "All Time",
};

function buildAnalysisPrompt(
  spotifyData: ListeningData | null,
  collectionProfile: CollectionProfile | null,
  chatHistory: string[],
): string {
  let prompt = `You are a music taste analyst specializing in vinyl record culture. Analyze ALL the following data sources and provide deep, personalized insights tailored to a vinyl collector.\n\n`;

  // Spotify sections (optional)
  if (spotifyData) {
    for (const range of ["short_term", "medium_term", "long_term"] as SpotifyTimeRange[]) {
      const rangeArtists = spotifyData.artists.filter((a) => a.timeRange === range);
      if (rangeArtists.length > 0) {
        prompt += `## Top Artists — ${TIME_RANGE_LABELS[range]}\n`;
        for (const a of rangeArtists.slice(0, 25)) {
          prompt += `- ${a.name} (genres: ${(a.genres ?? []).join(", ") || "none listed"})\n`;
        }
        prompt += "\n";
      }

      const rangeTracks = spotifyData.tracks.filter((t) => t.timeRange === range);
      if (rangeTracks.length > 0) {
        prompt += `## Top Tracks — ${TIME_RANGE_LABELS[range]}\n`;
        for (const t of rangeTracks.slice(0, 25)) {
          prompt += `- "${t.name}" by ${t.artistNames.join(", ")}\n`;
        }
        prompt += "\n";
      }
    }
  }

  // Collection profile section
  if (collectionProfile) {
    prompt += `## Collection Profile\n`;
    prompt += `Collection size: ${collectionProfile.counts.owned} owned, ${collectionProfile.counts.wanted} wanted, ${collectionProfile.counts.listened} listened\n\n`;

    if (collectionProfile.genreDistribution.length > 0) {
      prompt += `Genre distribution: ${collectionProfile.genreDistribution.map(([g, n]) => `${g} (${n})`).join(", ")}\n`;
    }
    if (collectionProfile.styleDistribution.length > 0) {
      prompt += `Style distribution: ${collectionProfile.styleDistribution.map(([s, n]) => `${s} (${n})`).join(", ")}\n`;
    }
    if (collectionProfile.eraDistribution.length > 0) {
      prompt += `Era distribution: ${collectionProfile.eraDistribution.map(([e, n]) => `${e} (${n})`).join(", ")}\n`;
    }
    prompt += "\n";

    if (collectionProfile.topRatedAlbums.length > 0) {
      prompt += `### Top Rated Albums (8+/10)\n`;
      for (const a of collectionProfile.topRatedAlbums) {
        prompt += `- ${a.artist} — ${a.title} (${a.rating}/10, ${(a.genres ?? []).join(", ") || "no genres"})\n`;
      }
      prompt += "\n";
    }

    if (collectionProfile.wantedAlbums.length > 0) {
      prompt += `### Wantlist (aspirational taste)\n`;
      for (const a of collectionProfile.wantedAlbums) {
        prompt += `- ${a.artist} — ${a.title}\n`;
      }
      prompt += "\n";
    }
  }

  // Chat history section
  if (chatHistory.length > 0) {
    prompt += `## Recent Conversations\nRecent things this user has discussed with their music AI assistant:\n`;
    for (const msg of chatHistory) {
      const truncated = msg.length > 200 ? msg.slice(0, 200) + "..." : msg;
      prompt += `- "${truncated}"\n`;
    }
    prompt += "\n";
  }

  prompt += `Based on ALL the data above, respond with a JSON object (no markdown code fences) matching this exact structure:
{
  "listeningPersonality": "A short archetype label, e.g. 'The Deep Crate Digger' or 'The Eclectic Audiophile'",
  "summary": "A 2-3 sentence personality summary of this listener's music taste, written in second person. Reference specific patterns from their collection and listening data.",
  "topGenres": ["top 5-8 dominant genres/subgenres"],
  "moods": ["3-5 dominant mood descriptors, e.g. 'melancholic', 'energetic', 'introspective'"],
  "eras": ["2-4 preferred musical eras, e.g. '1970s classic rock', '2010s indie'"],
  "keyInsights": ["3-5 notable patterns or observations about listening habits, correlating across data sources"],
  "collectionHighlights": ["3-5 notable patterns from their owned/rated albums, e.g. 'Strong affinity for Japanese pressings', 'Gravitates toward debut albums'"],
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
    listeningPersonality: String(parsed.listeningPersonality || ""),
    summary: String(parsed.summary || ""),
    topGenres: Array.isArray(parsed.topGenres) ? parsed.topGenres.map(String) : [],
    moods: Array.isArray(parsed.moods) ? parsed.moods.map(String) : [],
    eras: Array.isArray(parsed.eras) ? parsed.eras.map(String) : [],
    keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights.map(String) : [],
    collectionHighlights: Array.isArray(parsed.collectionHighlights) ? parsed.collectionHighlights.map(String) : [],
    vinylRecommendations: Array.isArray(parsed.vinylRecommendations)
      ? parsed.vinylRecommendations.map(String)
      : [],
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Orchestrate: fetch ALL data sources -> build prompt -> call AI -> store & return result.
 * Spotify data is optional — analysis works with collection data alone.
 */
export async function analyzePreferencesWithAI(
  userId: string,
): Promise<SpotifyPreferenceAnalysis> {
  // 1. Fetch all data sources in parallel
  const [spotifyData, collectionProfile, chatHistory] = await Promise.all([
    fetchSpotifyListeningData(userId),
    fetchCollectionProfile(userId),
    fetchRecentChatMessages(userId),
  ]);

  // Need at least some data to analyze
  if (!spotifyData && !collectionProfile) {
    throw new Error(
      "No data to analyze. Connect Spotify or add albums to your collection first.",
    );
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

  // 3. Build prompt and call AI
  const prompt = buildAnalysisPrompt(spotifyData, collectionProfile, chatHistory);
  const responseText = await callAI(userId, keys, u?.preferredAiProvider, prompt);

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

/**
 * Adjust an existing analysis based on user feedback.
 */
export async function adjustAnalysisWithAI(
  userId: string,
  currentAnalysis: SpotifyPreferenceAnalysis,
  adjustments: string,
): Promise<SpotifyPreferenceAnalysis> {
  const keys = await getUserApiKeys(userId);
  const [u] = await db
    .select({ preferredAiProvider: user.preferredAiProvider })
    .from(user)
    .where(eq(user.id, userId));

  const prompt = `You are a music taste analyst specializing in vinyl record culture. The user has an existing taste profile analysis and wants to adjust it based on their feedback.

## Current Analysis
${JSON.stringify(currentAnalysis, null, 2)}

## User's Adjustment Request
"${adjustments}"

Please update the analysis to incorporate the user's feedback. Keep any parts that are still accurate, modify what they've asked to change, and maintain the same quality and depth.

Respond with a JSON object (no markdown code fences) matching this exact structure:
{
  "listeningPersonality": "Updated archetype label",
  "summary": "Updated 2-3 sentence personality summary in second person",
  "topGenres": ["updated top 5-8 genres"],
  "moods": ["updated 3-5 mood descriptors"],
  "eras": ["updated 2-4 preferred eras"],
  "keyInsights": ["updated 3-5 notable patterns"],
  "collectionHighlights": ["updated 3-5 collection patterns"],
  "vinylRecommendations": ["updated 5-8 album recommendations as 'Artist - Album Title'"]
}`;

  const responseText = await callAI(userId, keys, u?.preferredAiProvider, prompt);
  const analysis = parseAnalysisResponse(responseText);

  // Store updated analysis
  await db
    .update(userTasteProfiles)
    .set({
      aiPreferenceAnalysis: analysis,
      updatedAt: new Date(),
    })
    .where(eq(userTasteProfiles.userId, userId));

  return analysis;
}

// ---------------------------------------------------------------------------
// Direct AI API calls (bypassing the evaluate() method which is album-specific)
// ---------------------------------------------------------------------------

async function callAI(
  userId: string,
  keys: { anthropicKey?: string | null; openaiKey?: string | null },
  preferredProvider: string | null | undefined,
  prompt: string,
): Promise<string> {
  const provider = preferredProvider ?? process.env.AI_PROVIDER;

  if (provider === "openai" && keys.openaiKey) {
    return callOpenAI(keys.openaiKey, prompt);
  } else if (keys.anthropicKey) {
    return callClaude(keys.anthropicKey, prompt);
  } else if (keys.openaiKey) {
    return callOpenAI(keys.openaiKey, prompt);
  }
  throw new Error("No AI API key available.");
}

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
      max_tokens: 2000,
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
      max_tokens: 2000,
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
