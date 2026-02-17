import type { RawRelease } from "./types";
import { musicBrainzClient } from "@/server/services/musicbrainz/client";
import { discogsClient } from "@/server/services/discogs/client";

/**
 * Enrich raw releases with MusicBrainz + Discogs data.
 *
 * For each release:
 *   - MusicBrainz: search by artist + title → confirm real release, get canonical date (+20 confidence)
 *   - Discogs: search by artist + title → check for vinyl format (+20 confidence, set vinylConfirmed)
 *
 * Enrichment is best-effort — individual failures don't block the pipeline.
 * Processes sequentially to respect API rate limits.
 */
export async function enrichReleases(
  releases: RawRelease[],
): Promise<RawRelease[]> {
  const enriched: RawRelease[] = [];

  for (const release of releases) {
    try {
      const result = await enrichSingle(release);
      enriched.push(result);
    } catch {
      // Individual enrichment failure — keep original release
      enriched.push(release);
    }
  }

  return enriched;
}

async function enrichSingle(release: RawRelease): Promise<RawRelease> {
  let confidence = release.confidence ?? 0;
  let vinylConfirmed = release.vinylConfirmed ?? false;
  let releaseDate = release.releaseDate;
  let labelName = release.labelName;

  // MusicBrainz lookup
  try {
    const mbResult = await lookupMusicBrainz(
      release.artistName,
      release.title,
    );
    if (mbResult) {
      confidence += 20;
      if (mbResult.releaseDate && !releaseDate) {
        releaseDate = mbResult.releaseDate;
      }
      if (mbResult.labelName && !labelName) {
        labelName = mbResult.labelName;
      }
    }
  } catch {
    // MusicBrainz failure is non-fatal
  }

  // Discogs lookup
  try {
    const discogsResult = await lookupDiscogs(
      release.artistName,
      release.title,
    );
    if (discogsResult) {
      confidence += 20;
      if (discogsResult.hasVinyl) {
        vinylConfirmed = true;
      }
      if (discogsResult.labelName && !labelName) {
        labelName = discogsResult.labelName;
      }
    }
  } catch {
    // Discogs failure is non-fatal
  }

  return {
    ...release,
    confidence,
    vinylConfirmed,
    releaseDate,
    labelName,
  };
}

interface MBResult {
  releaseDate?: Date;
  labelName?: string;
}

async function lookupMusicBrainz(
  artist: string,
  title: string,
): Promise<MBResult | null> {
  // Use Lucene query syntax: artist:"X" AND releasegroup:"Y"
  const query = `artist:"${escapeLucene(artist)}" AND releasegroup:"${escapeLucene(title)}"`;

  const response = await musicBrainzClient.searchReleaseGroups(query, 3);
  const groups = response["release-groups"];
  if (!groups || groups.length === 0) return null;

  // Find best match — check if artist/title roughly match
  const best = groups.find((rg) => {
    const rgArtist = rg["artist-credit"]?.[0]?.name ?? "";
    const rgTitle = rg.title ?? "";
    return (
      fuzzyMatch(rgArtist, artist) && fuzzyMatch(rgTitle, title)
    );
  });

  if (!best) return null;

  const releaseDate = best["first-release-date"]
    ? parseLooseDate(best["first-release-date"])
    : undefined;

  return { releaseDate };
}

interface DiscogsResult {
  hasVinyl: boolean;
  labelName?: string;
}

async function lookupDiscogs(
  artist: string,
  title: string,
): Promise<DiscogsResult | null> {
  const response = await discogsClient.search({
    q: `${artist} ${title}`,
    type: "master",
    per_page: 5,
  });

  if (!response.results || response.results.length === 0) return null;

  // Find best match
  const best = response.results.find((r) => {
    // Discogs titles are "Artist - Title"
    const parts = r.title.split(" - ");
    if (parts.length < 2) return false;
    const rArtist = parts[0].trim();
    const rTitle = parts.slice(1).join(" - ").trim();
    return fuzzyMatch(rArtist, artist) && fuzzyMatch(rTitle, title);
  });

  if (!best) return null;

  // Check if vinyl format exists
  const hasVinyl = best.format?.some(
    (f) => f.toLowerCase().includes("vinyl") || f.toLowerCase() === "lp",
  ) ?? false;

  const labelName = best.label?.[0] ?? undefined;

  return { hasVinyl, labelName };
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Fuzzy match two strings — case-insensitive, ignoring minor differences.
 */
function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  // One contains the other, or they're very similar
  return na.includes(nb) || nb.includes(na) || levenshteinRatio(na, nb) > 0.7;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) {
        matrix[0][j] = j;
      } else {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }
  }

  return 1 - matrix[a.length][b.length] / maxLen;
}

function escapeLucene(s: string): string {
  return s.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&");
}

/**
 * Parse a loose date string like "2025", "2025-03", or "2025-03-14".
 */
function parseLooseDate(s: string): Date | undefined {
  if (!s) return undefined;
  const parts = s.split("-").map(Number);
  if (parts.length === 1 && parts[0]) return new Date(parts[0], 0, 1);
  if (parts.length === 2 && parts[0] && parts[1])
    return new Date(parts[0], parts[1] - 1, 1);
  if (parts.length >= 3 && parts[0] && parts[1] && parts[2])
    return new Date(parts[0], parts[1] - 1, parts[2]);
  return undefined;
}
