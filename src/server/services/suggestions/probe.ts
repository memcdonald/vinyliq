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
import { batchScoreCollectability } from "@/server/services/releases/ai-collectability";
import { getUserApiKeys, type ResolvedKeys } from "@/server/services/ai/keys";
import { scoreTasteMatch } from "./taste-match";
import { batchExplain } from "./ai-explain";
import { filterToAlbums } from "./validate";

const rssAdapter = new RssAdapter();
const urlAdapter = new UrlAdapter();

export interface ProbeProgress {
  total: number;
  completed: number;
  currentSource: string;
  discovered: number;
  status: "running" | "completed" | "error";
  message: string;
}

const probeProgressMap = new Map<string, ProbeProgress>();

export function getProbeProgress(userId: string): ProbeProgress | null {
  return probeProgressMap.get(userId) ?? null;
}

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
  keys?: ResolvedKeys,
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

  // Filter to actual album releases (heuristic + AI validation)
  rawReleases = await filterToAlbums(rawReleases, keys);

  // Reject releases missing artist or title
  rawReleases = rawReleases.filter(r => r.artistName?.trim() && r.title?.trim());

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

    const rawTaste = tasteScores[i] ?? 0;
    // Normalize to 1-10 scale
    const tasteScore = Math.max(1, Math.min(10, Math.round(rawTaste * 10)));
    const collectabilityScore = collectability.score; // already 1-10 from computeCollectability
    const combinedScore = Math.max(1, Math.min(10, Math.round(tasteScore * 0.4 + collectabilityScore * 0.6)));

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
      collectabilityScore,
      tasteScore,
      combinedScore,
      status: "new",
    });

    existingKeys.add(key);
  }

  // Batch insert
  if (newSuggestions.length > 0) {
    const inserted = await db
      .insert(aiSuggestions)
      .values(newSuggestions)
      .returning({ id: aiSuggestions.id });

    // AI collectability scoring (replaces heuristic-only scores)
    if (keys && (keys.anthropicKey || keys.openaiKey)) {
      try {
        const toScore = newSuggestions.map((s) => ({
          title: s.title,
          artistName: s.artistName,
          labelName: s.labelName,
          description: s.description,
          heuristicScore: s.collectabilityScore,
        }));

        const aiScores = await batchScoreCollectability(toScore, keys);

        for (let i = 0; i < inserted.length; i++) {
          const aiResult = aiScores[i];
          if (aiResult) {
            // AI scores are already 1-10
            const aiCollectability = aiResult.score;
            const newCombined = Math.max(1, Math.min(10, Math.round(
              newSuggestions[i].tasteScore * 0.4 + aiCollectability * 0.6,
            )));

            await db
              .update(aiSuggestions)
              .set({
                collectabilityScore: aiCollectability,
                combinedScore: newCombined,
                updatedAt: new Date(),
              })
              .where(eq(aiSuggestions.id, inserted[i].id));
          }
        }
      } catch (err) {
        console.error("[Probe] AI collectability scoring failed:", err);
      }
    }
  }

  // Generate AI explanations for new suggestions
  let explained = 0;
  if (newSuggestions.length > 0) {
    explained = await batchExplain(userId, keys);
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
  const keys = await getUserApiKeys(userId);

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

  const progress: ProbeProgress = {
    total: probeable.length,
    completed: 0,
    currentSource: "",
    discovered: 0,
    status: "running",
    message: `Probing ${probeable.length} source${probeable.length === 1 ? "" : "s"}...`,
  };
  probeProgressMap.set(userId, progress);

  const results: ProbeResult[] = [];
  let totalDiscovered = 0;

  try {
    for (const source of probeable) {
      progress.currentSource = source.sourceName;
      progress.message = `Probing ${source.sourceName}...`;

      try {
        const result = await Promise.race([
          probeSource(source, userId, keys),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 60_000),
          ),
        ]);
        results.push(result);
        totalDiscovered += result.discovered;
        progress.discovered = totalDiscovered;
      } catch (err) {
        const reason = err instanceof Error && err.message === "timeout"
          ? "timed out" : "failed";
        console.error(`Probe source ${source.sourceName} ${reason}`);
        results.push({
          sourceName: source.sourceName,
          discovered: 0,
          explained: 0,
        });
      }

      progress.completed++;
    }

    progress.status = "completed";
    progress.currentSource = "";
    progress.message = `Done: ${totalDiscovered} new suggestion${totalDiscovered === 1 ? "" : "s"} found`;
  } catch (err) {
    progress.status = "error";
    progress.message = err instanceof Error ? err.message : "Probe failed";
  }

  return { results, totalDiscovered };
}
