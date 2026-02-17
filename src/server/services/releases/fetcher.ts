import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import { releaseSources, upcomingReleases, dataSources } from "@/server/db/schema";
import type { ReleaseSource, DataSource } from "@/server/db/schema";
import type { RawRelease } from "./types";
import { RssAdapter } from "./rss-adapter";
import { UrlAdapter } from "./url-adapter";
import { HubAdapter } from "./hub-adapter";
import { computeCollectabilityForRelease } from "./collectability";
import { batchScoreCollectability } from "./ai-collectability";
import { getUserApiKeys } from "@/server/services/ai/keys";

const rssAdapter = new RssAdapter();
const urlAdapter = new UrlAdapter();
const hubAdapter = new HubAdapter();

function getAdapter(type: string) {
  switch (type) {
    case "rss":
      return rssAdapter;
    case "url":
      return urlAdapter;
    case "hub":
      return hubAdapter;
    default:
      return null;
  }
}

/**
 * Fetch releases from a single source, deduplicate, and insert new ones.
 */
export async function fetchSource(
  source: ReleaseSource,
  userId: string,
): Promise<{ added: number; total: number }> {
  if (!source.url || source.type === "manual") {
    return { added: 0, total: 0 };
  }

  const adapter = getAdapter(source.type);
  if (!adapter) {
    return { added: 0, total: 0 };
  }

  const rawReleases = await adapter.fetch(source.url);
  let added = 0;

  // Get existing releases for this source to deduplicate
  const existing = await db
    .select({ title: upcomingReleases.title, artistName: upcomingReleases.artistName })
    .from(upcomingReleases)
    .where(
      and(
        eq(upcomingReleases.userId, userId),
        eq(upcomingReleases.sourceId, source.id),
      ),
    );

  const existingKeys = new Set(
    existing.map((e) => `${e.artistName.toLowerCase()}::${e.title.toLowerCase()}`),
  );

  for (const raw of rawReleases) {
    const key = `${raw.artistName.toLowerCase()}::${raw.title.toLowerCase()}`;
    if (existingKeys.has(key)) continue;

    const collectability = computeCollectabilityForRelease({
      pressRun: raw.pressRun ?? null,
      coloredVinyl: raw.coloredVinyl ?? null,
      numbered: raw.numbered ?? null,
      specialPackaging: raw.specialPackaging ?? null,
    });

    await db.insert(upcomingReleases).values({
      userId,
      sourceId: source.id,
      title: raw.title,
      artistName: raw.artistName,
      labelName: raw.labelName ?? null,
      releaseDate: raw.releaseDate ?? null,
      coverImage: raw.coverImage ?? null,
      description: raw.description ?? null,
      orderUrl: raw.orderUrl ?? null,
      pressRun: raw.pressRun ?? null,
      coloredVinyl: raw.coloredVinyl ?? false,
      numbered: raw.numbered ?? false,
      specialPackaging: raw.specialPackaging ?? null,
      collectabilityScore: collectability.score,
      collectabilityExplanation: collectability.explanation,
      status: "upcoming",
    });

    added++;
    existingKeys.add(key);
  }

  // Update lastFetchedAt
  await db
    .update(releaseSources)
    .set({ lastFetchedAt: new Date(), updatedAt: new Date() })
    .where(eq(releaseSources.id, source.id));

  return { added, total: rawReleases.length };
}

/**
 * Fetch releases from a single data source (from the /sources page).
 * Determines adapter from accessMethod or URL pattern.
 */
async function fetchDataSource(
  source: DataSource,
  userId: string,
): Promise<{ added: number; total: number }> {
  if (!source.url) {
    return { added: 0, total: 0 };
  }

  const isHub = source.accessMethod?.toLowerCase().includes("hub");
  const isRss =
    !isHub &&
    (source.accessMethod?.toLowerCase().includes("rss") ||
      source.url.includes("/feed") ||
      source.url.endsWith(".xml"));

  const adapter = isHub ? hubAdapter : isRss ? rssAdapter : urlAdapter;

  let rawReleases: RawRelease[];
  try {
    rawReleases = await adapter.fetch(source.url);
  } catch {
    console.error(`Failed to fetch data source ${source.sourceName}`);
    return { added: 0, total: 0 };
  }

  if (rawReleases.length === 0) {
    return { added: 0, total: 0 };
  }

  // Deduplicate against all existing releases for this user
  const existing = await db
    .select({ title: upcomingReleases.title, artistName: upcomingReleases.artistName })
    .from(upcomingReleases)
    .where(eq(upcomingReleases.userId, userId));

  const existingKeys = new Set(
    existing.map((e) => `${e.artistName.toLowerCase()}::${e.title.toLowerCase()}`),
  );

  let added = 0;

  for (const raw of rawReleases) {
    const key = `${raw.artistName.toLowerCase()}::${raw.title.toLowerCase()}`;
    if (existingKeys.has(key)) continue;

    const collectability = computeCollectabilityForRelease({
      pressRun: raw.pressRun ?? null,
      coloredVinyl: raw.coloredVinyl ?? null,
      numbered: raw.numbered ?? null,
      specialPackaging: raw.specialPackaging ?? null,
    });

    await db.insert(upcomingReleases).values({
      userId,
      sourceId: null, // no releaseSource; came from a dataSource
      title: raw.title,
      artistName: raw.artistName,
      labelName: raw.labelName ?? null,
      releaseDate: raw.releaseDate ?? null,
      coverImage: raw.coverImage ?? null,
      description: raw.description ?? null,
      orderUrl: raw.orderUrl ?? null,
      pressRun: raw.pressRun ?? null,
      coloredVinyl: raw.coloredVinyl ?? false,
      numbered: raw.numbered ?? false,
      specialPackaging: raw.specialPackaging ?? null,
      collectabilityScore: collectability.score,
      collectabilityExplanation: collectability.explanation,
      status: "upcoming",
    });

    added++;
    existingKeys.add(key);
  }

  return { added, total: rawReleases.length };
}

/**
 * Fetch all enabled release sources AND data sources for a user.
 */
export async function fetchAllSources(userId: string): Promise<{ totalAdded: number }> {
  let totalAdded = 0;

  // 1. Fetch from release sources (RSS feeds / URLs configured on releases page)
  const rSources = await db
    .select()
    .from(releaseSources)
    .where(
      and(
        eq(releaseSources.userId, userId),
        eq(releaseSources.enabled, true),
      ),
    );

  for (const source of rSources) {
    try {
      const result = await fetchSource(source, userId);
      totalAdded += result.added;
    } catch {
      console.error(`Failed to fetch release source ${source.name} (${source.id})`);
    }
  }

  // 2. Fetch from data sources (research sources configured on /sources page)
  const dSources = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.userId, userId));

  const probeableSources = dSources.filter((s) => s.url);

  for (const source of probeableSources) {
    try {
      const result = await fetchDataSource(source, userId);
      totalAdded += result.added;
    } catch {
      console.error(`Failed to fetch data source ${source.sourceName} (${source.id})`);
    }
  }

  // 3. AI collectability scoring for any releases that only have heuristic scores
  if (totalAdded > 0) {
    try {
      const keys = await getUserApiKeys(userId);
      if (keys.anthropicKey || keys.openaiKey) {
        // Get recently added releases without AI-quality scores
        const recent = await db
          .select({
            id: upcomingReleases.id,
            title: upcomingReleases.title,
            artistName: upcomingReleases.artistName,
            labelName: upcomingReleases.labelName,
            description: upcomingReleases.description,
            pressRun: upcomingReleases.pressRun,
            coloredVinyl: upcomingReleases.coloredVinyl,
            specialPackaging: upcomingReleases.specialPackaging,
            collectabilityScore: upcomingReleases.collectabilityScore,
          })
          .from(upcomingReleases)
          .where(eq(upcomingReleases.userId, userId))
          .orderBy(upcomingReleases.createdAt)
          .limit(20); // Score the 20 most recent

        const toScore = recent.map((r) => ({
          title: r.title,
          artistName: r.artistName,
          labelName: r.labelName,
          description: r.description,
          pressRun: r.pressRun,
          coloredVinyl: r.coloredVinyl,
          specialPackaging: r.specialPackaging,
          heuristicScore: r.collectabilityScore ?? 0,
        }));

        const aiResults = await batchScoreCollectability(toScore, keys);

        for (let i = 0; i < recent.length; i++) {
          const aiResult = aiResults[i];
          if (aiResult) {
            await db
              .update(upcomingReleases)
              .set({
                collectabilityScore: aiResult.score,
                collectabilityExplanation: aiResult.explanation,
                updatedAt: new Date(),
              })
              .where(eq(upcomingReleases.id, recent[i].id));
          }
        }
      }
    } catch (err) {
      console.error("AI collectability scoring failed:", err);
    }
  }

  return { totalAdded };
}
