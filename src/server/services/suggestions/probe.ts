import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import {
  dataSources,
  aiSuggestions,
  type DataSource,
} from "@/server/db/schema";
import { RssAdapter } from "@/server/services/releases/rss-adapter";
import { UrlAdapter } from "@/server/services/releases/url-adapter";
import { computeCollectability } from "@/server/services/releases/collectability";
import { scoreTasteMatch } from "./taste-match";
import { batchExplain } from "./ai-explain";

const rssAdapter = new RssAdapter();
const urlAdapter = new UrlAdapter();

interface ProbeResult {
  sourceName: string;
  discovered: number;
  explained: number;
}

/**
 * Probe a single data source for new suggestions.
 * Uses existing RSS/URL adapters to fetch releases, then scores and explains them.
 */
async function probeSource(
  source: DataSource,
  userId: string,
): Promise<ProbeResult> {
  if (!source.url) {
    return { sourceName: source.sourceName, discovered: 0, explained: 0 };
  }

  // Pick adapter based on access method or URL pattern
  const isRss =
    source.accessMethod?.toLowerCase().includes("rss") ||
    source.url.includes("/feed") ||
    source.url.endsWith(".xml");

  const adapter = isRss ? rssAdapter : urlAdapter;

  let rawReleases;
  try {
    rawReleases = await adapter.fetch(source.url);
  } catch {
    console.error(`Failed to probe source ${source.sourceName}: fetch error`);
    return { sourceName: source.sourceName, discovered: 0, explained: 0 };
  }

  if (rawReleases.length === 0) {
    return { sourceName: source.sourceName, discovered: 0, explained: 0 };
  }

  // Get existing suggestions for dedup
  const existing = await db
    .select({
      artistName: aiSuggestions.artistName,
      title: aiSuggestions.title,
    })
    .from(aiSuggestions)
    .where(eq(aiSuggestions.userId, userId));

  const existingKeys = new Set(
    existing.map(
      (e) => `${e.artistName.toLowerCase()}::${e.title.toLowerCase()}`,
    ),
  );

  // Get taste profile for scoring
  const tasteScores = await scoreTasteMatch(userId, rawReleases);

  const newSuggestions: {
    userId: string;
    artistName: string;
    title: string;
    labelName: string | null;
    releaseDate: Date | null;
    coverImage: string | null;
    description: string | null;
    orderUrl: string | null;
    sourceId: string;
    sourceName: string;
    collectabilityScore: number;
    tasteScore: number;
    combinedScore: number;
    status: string;
  }[] = [];

  for (let i = 0; i < rawReleases.length; i++) {
    const raw = rawReleases[i];
    const key = `${raw.artistName.toLowerCase()}::${raw.title.toLowerCase()}`;
    if (existingKeys.has(key)) continue;

    const collectability = computeCollectability({
      pressRun: raw.pressRun ?? null,
      coloredVinyl: raw.coloredVinyl ?? null,
      numbered: raw.numbered ?? null,
      specialPackaging: raw.specialPackaging ?? null,
    });

    const tasteScore = tasteScores[i] ?? 0;
    // Combined: 40% taste, 60% collectability (normalized to 0-1)
    const combinedScore = tasteScore * 0.4 + (collectability.score / 100) * 0.6;

    newSuggestions.push({
      userId,
      artistName: raw.artistName,
      title: raw.title,
      labelName: raw.labelName ?? null,
      releaseDate: raw.releaseDate ?? null,
      coverImage: raw.coverImage ?? null,
      description: raw.description ?? null,
      orderUrl: raw.orderUrl ?? null,
      sourceId: source.id,
      sourceName: source.sourceName,
      collectabilityScore: collectability.score,
      tasteScore,
      combinedScore,
      status: "new",
    });

    existingKeys.add(key);
  }

  // Batch insert
  if (newSuggestions.length > 0) {
    await db.insert(aiSuggestions).values(newSuggestions);
  }

  // Generate AI explanations for new suggestions
  let explained = 0;
  if (newSuggestions.length > 0) {
    explained = await batchExplain(userId);
  }

  return {
    sourceName: source.sourceName,
    discovered: newSuggestions.length,
    explained,
  };
}

/**
 * Probe all enabled data sources for a user and generate suggestions.
 */
export async function probeAllSources(
  userId: string,
): Promise<{ results: ProbeResult[]; totalDiscovered: number }> {
  const sources = await db
    .select()
    .from(dataSources)
    .where(
      and(
        eq(dataSources.userId, userId),
      ),
    );

  // Only probe sources that have a URL
  const probeable = sources.filter((s) => s.url);

  const results: ProbeResult[] = [];
  let totalDiscovered = 0;

  for (const source of probeable) {
    try {
      const result = await probeSource(source, userId);
      results.push(result);
      totalDiscovered += result.discovered;
    } catch {
      console.error(`Failed to probe source ${source.sourceName}`);
      results.push({
        sourceName: source.sourceName,
        discovered: 0,
        explained: 0,
      });
    }
  }

  return { results, totalDiscovered };
}
