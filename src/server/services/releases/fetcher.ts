import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import { releaseSources, upcomingReleases } from "@/server/db/schema";
import type { ReleaseSource } from "@/server/db/schema";
import type { RawRelease } from "./types";
import { RssAdapter } from "./rss-adapter";
import { UrlAdapter } from "./url-adapter";
import { computeCollectabilityForRelease } from "./collectability";

const rssAdapter = new RssAdapter();
const urlAdapter = new UrlAdapter();

function getAdapter(type: string) {
  switch (type) {
    case "rss":
      return rssAdapter;
    case "url":
      return urlAdapter;
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
 * Fetch all enabled sources for a user.
 */
export async function fetchAllSources(userId: string): Promise<{ totalAdded: number }> {
  const sources = await db
    .select()
    .from(releaseSources)
    .where(
      and(
        eq(releaseSources.userId, userId),
        eq(releaseSources.enabled, true),
      ),
    );

  let totalAdded = 0;

  for (const source of sources) {
    try {
      const result = await fetchSource(source, userId);
      totalAdded += result.added;
    } catch {
      // Log but continue with other sources
      console.error(`Failed to fetch source ${source.name} (${source.id})`);
    }
  }

  return { totalAdded };
}
