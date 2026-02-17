import type { SourceAdapter, RawRelease } from "./types";
import {
  findHubConfig,
  genericHubConfig,
  type HubSourceConfig,
} from "./hub-sources";

// ── Album gate keywords ─────────────────────────────────────────────────

const KEEP_KEYWORDS = [
  "new album",
  "announces album",
  "out now",
  "\\bLP\\b",
  "\\bEP\\b",
  "tracklist",
  "release date",
  "pre-order",
  "preorder",
  "debut album",
  "reissue",
  "re-release",
  "stream .+ album",
  "listen .+ album",
  "album review",
  "album of the week",
];

const REJECT_KEYWORDS = [
  "\\btour\\b",
  "\\btickets\\b",
  "\\binterview\\b",
  "\\bpremiere\\b",
  "\\bvideo premiere\\b",
  "\\bfestival\\b",
  "\\blive\\b",
  "\\bsetlist\\b",
  "\\bconcert\\b",
  "\\bplaylist\\b",
  "\\bpodcast\\b",
  "\\bturntable\\b",
  "\\bcartridge\\b",
  "\\bstylus\\b",
  "\\bequipment\\b",
  "\\bheadphone\\b",
  "\\bspeaker\\b",
];

const KEEP_RE = new RegExp(`(${KEEP_KEYWORDS.join("|")})`, "i");
const REJECT_RE = new RegExp(`(${REJECT_KEYWORDS.join("|")})`, "i");

/**
 * Album gate: returns true if the text (title + description) looks like
 * album-related content rather than tour/interview/video/equipment noise.
 */
function passesAlbumGate(title: string, description: string): boolean {
  const text = `${title} ${description}`;

  // Reject first — if it looks like non-album content, skip
  if (REJECT_RE.test(text)) return false;

  // If it contains keep keywords, it's likely album content
  if (KEEP_RE.test(text)) return true;

  // Default: allow through (article parser will validate further)
  return true;
}

// ── HTML helpers ─────────────────────────────────────────────────────────

const FETCH_HEADERS = {
  "User-Agent": "VinylIQ/1.0 (Release Tracker)",
  Accept: "text/html,application/xhtml+xml",
};

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15_000),
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

/**
 * Extract links from HTML matching a CSS-style selector pattern.
 *
 * Since we're not using a DOM parser library, we use regex extraction
 * of href values and then filter by the config's linkPattern.
 */
function extractLinks(
  html: string,
  baseUrl: string,
  config: HubSourceConfig,
): string[] {
  const links: string[] = [];
  const seen = new Set<string>();

  // Extract all href values from anchor tags
  const hrefRe = /<a\s[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRe.exec(html)) !== null) {
    let href = match[1];
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;

    // Resolve relative URLs
    try {
      const resolved = new URL(href, baseUrl);
      href = resolved.href;
    } catch {
      continue;
    }

    // Apply link pattern filter if configured
    if (config.linkPattern && !config.linkPattern.test(href)) continue;

    // Apply link selector hint: if selector mentions a specific href pattern, filter
    if (config.linkSelector.includes('href*="')) {
      const selectorPattern = config.linkSelector.match(
        /href\*="([^"]+)"/,
      )?.[1];
      if (selectorPattern && !href.includes(selectorPattern)) continue;
    }

    // Dedupe
    if (seen.has(href)) continue;
    seen.add(href);

    links.push(href);
    if (links.length >= config.maxLinks) break;
  }

  return links;
}

// ── Article parsing ──────────────────────────────────────────────────────

interface ArticleData {
  artistName: string;
  albumTitle: string;
  releaseDate?: Date;
  labelName?: string;
  coverImage?: string;
  description?: string;
}

/**
 * Extract artist/album data from an article page.
 *
 * Extraction strategy (best to worst):
 * 1. JSON-LD MusicAlbum structured data
 * 2. Open Graph / meta tags
 * 3. Heading + content heuristics
 */
function parseArticle(html: string, url: string): ArticleData | null {
  // Strategy 1: JSON-LD
  const jsonLd = extractFromJsonLd(html);
  if (jsonLd) return jsonLd;

  // Strategy 2: Meta tags (og:title, music:musician, etc.)
  const meta = extractFromMeta(html);
  if (meta) return meta;

  // Strategy 3: Heading heuristics
  return extractFromHeadings(html, url);
}

function extractFromJsonLd(html: string): ArticleData | null {
  const jsonLdRe =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = jsonLdRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (item["@type"] === "MusicAlbum" || item["@type"] === "MusicRecording") {
          const artistName =
            item.byArtist?.name ??
            item.brand?.name ??
            item.creator?.name ??
            "";
          const albumTitle = item.name ?? "";

          if (!artistName || !albumTitle) continue;

          return {
            artistName,
            albumTitle,
            releaseDate: item.datePublished
              ? new Date(item.datePublished)
              : undefined,
            labelName:
              item.recordLabel?.name ?? item.publisher?.name ?? undefined,
            coverImage: typeof item.image === "string"
              ? item.image
              : item.image?.url ?? undefined,
            description: typeof item.description === "string"
              ? item.description.slice(0, 500)
              : undefined,
          };
        }
      }
    } catch {
      // Invalid JSON-LD, continue
    }
  }

  return null;
}

function extractMetaContent(html: string, name: string): string | undefined {
  // Match both property="..." and name="..."
  const re = new RegExp(
    `<meta\\s[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']` +
      `|<meta\\s[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`,
    "i",
  );
  const match = html.match(re);
  const raw = match?.[1] ?? match?.[2] ?? undefined;
  return raw ? decodeHtmlEntities(raw) : undefined;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractFromMeta(html: string): ArticleData | null {
  const ogTitle = extractMetaContent(html, "og:title");
  if (!ogTitle) return null;

  // Try to split "Artist - Album Title" or "Album Title by Artist" patterns
  let artistName = "";
  let albumTitle = "";

  // Check for music-specific meta tags
  const musicMusician = extractMetaContent(html, "music:musician");
  const musicAlbum = extractMetaContent(html, "music:album");

  if (musicMusician) {
    artistName = musicMusician;
    albumTitle = ogTitle;
  } else {
    // Try "Artist - Title" or "Artist: Title" split on og:title
    const dashParts = ogTitle.split(/\s[-–—]\s|:\s/);
    if (dashParts.length >= 2) {
      artistName = dashParts[0].trim();
      albumTitle = dashParts.slice(1).join(" - ").trim();
    } else {
      // Try "Title by Artist" pattern
      const byMatch = ogTitle.match(/^(.+?)\s+by\s+(.+)$/i);
      if (byMatch) {
        albumTitle = byMatch[1].trim();
        artistName = byMatch[2].trim();
      }
    }
  }

  // Handle AllMusic format: "Album - Artist | Album | AllMusic"
  const allMusicMatch = ogTitle.match(
    /^(.+?)\s+-\s+(.+?)\s*\|\s*Album\s*\|\s*AllMusic$/i,
  );
  if (allMusicMatch) {
    albumTitle = allMusicMatch[1].trim();
    artistName = allMusicMatch[2].trim();
  }

  // Handle Stereogum "Album Of The Week: Artist 'Title'" format
  const stereogumMatch = ogTitle.match(
    /^Album Of The Week:\s+(.+?)\s+['''""](.+?)['''""]?\s*$/i,
  );
  if (stereogumMatch) {
    artistName = stereogumMatch[1].trim();
    albumTitle = stereogumMatch[2].trim();
  }

  // Handle "Premature Evaluation: Artist Title" (Stereogum)
  const prematureMatch = ogTitle.match(
    /^Premature Evaluation:\s+(.+?)\s+['''""](.+?)['''""]?\s*$/i,
  );
  if (prematureMatch) {
    artistName = prematureMatch[1].trim();
    albumTitle = prematureMatch[2].trim();
  }

  // Clean up common suffixes like "| Pitchfork", "- Stereogum", "Review"
  albumTitle = albumTitle
    .replace(/\s*[|–—-]\s*(Pitchfork|Stereogum|AllMusic|Review).*$/i, "")
    .trim();

  if (!artistName || !albumTitle) return null;

  const ogImage = extractMetaContent(html, "og:image");
  const ogDescription = extractMetaContent(html, "og:description");

  // Clean boilerplate descriptions that would trigger exclusion keywords downstream.
  // These ARE album pages — the word "review" in context is not equipment/article noise.
  const cleanDescription = ogDescription
    ?.replace(/^Read\s.+?(?:'s|&#x27;s)\s+review\s+of\s+the\s+album\.?$/i, "")
    ?.replace(/Find album reviews,\s*track lists,\s*credits.*$/i, "")
    ?.replace(/\breview[s]?\b/gi, "")
    ?.trim() || undefined;

  return {
    artistName,
    albumTitle,
    coverImage: ogImage,
    description: cleanDescription?.slice(0, 500),
  };
}

function extractFromHeadings(html: string, _url: string): ArticleData | null {
  // Look for h1/h2 that might contain "Artist - Album" or "Artist: Album"
  const headingRe = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi;
  let match: RegExpExecArray | null;

  while ((match = headingRe.exec(html)) !== null) {
    const rawText = match[1].replace(/<[^>]+>/g, "").trim();
    if (!rawText || rawText.length < 5 || rawText.length > 200) continue;

    // Try "Artist - Title" or "Artist: Title" split
    const parts = rawText.split(/\s[-–—]\s|:\s/);
    if (parts.length >= 2) {
      const artistName = parts[0].trim();
      const albumTitle = parts.slice(1).join(" - ").trim();
      if (artistName && albumTitle && artistName.length > 1 && albumTitle.length > 1) {
        return { artistName, albumTitle };
      }
    }

    // Try "Title by Artist"
    const byMatch = rawText.match(/^(.+?)\s+by\s+(.+)$/i);
    if (byMatch) {
      const albumTitle = byMatch[1].trim();
      const artistName = byMatch[2].trim();
      if (artistName && albumTitle) {
        return { artistName, albumTitle };
      }
    }
  }

  return null;
}

// ── Hub adapter ──────────────────────────────────────────────────────────

/**
 * Hub-page collector adapter.
 *
 * Fetches a listing/hub page from a music publication, extracts candidate
 * article links, fetches each article, runs the album gate, and extracts
 * artist/title from the article content.
 */
export class HubAdapter implements SourceAdapter {
  async fetch(url: string): Promise<RawRelease[]> {
    // Find matching hub config or use generic
    const config = findHubConfig(url) ?? genericHubConfig(url);

    // Step 1: Fetch the hub/listing page
    let hubHtml: string;
    try {
      hubHtml = await fetchPage(url);
    } catch (err) {
      console.error(`[HubAdapter] Failed to fetch hub page ${url}:`, err);
      return [];
    }

    // Step 2: Extract candidate article links
    const links = extractLinks(hubHtml, url, config);
    if (links.length === 0) {
      console.warn(`[HubAdapter] No candidate links found on ${url}`);
      return [];
    }

    // Step 3: Fetch each article, run album gate, extract data
    const releases: RawRelease[] = [];
    const seen = new Set<string>();

    // Process articles concurrently in small batches to avoid overwhelming servers
    const BATCH_SIZE = 5;
    for (let i = 0; i < links.length; i += BATCH_SIZE) {
      const batch = links.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (articleUrl): Promise<RawRelease | null> => {
          try {
            const articleHtml = await fetchPage(articleUrl);

            // Get title + description for album gate
            const title =
              extractMetaContent(articleHtml, "og:title") ??
              extractTitleTag(articleHtml) ??
              "";
            const description =
              extractMetaContent(articleHtml, "og:description") ??
              extractMetaContent(articleHtml, "description") ??
              "";

            // Album gate filter
            if (!passesAlbumGate(title, description)) {
              return null;
            }

            // Extract artist/album data
            const data = parseArticle(articleHtml, articleUrl);
            if (!data || !data.artistName || !data.albumTitle) {
              return null;
            }

            // Dedupe within this batch
            const key = `${data.artistName.toLowerCase()}::${data.albumTitle.toLowerCase()}`;
            if (seen.has(key)) return null;
            seen.add(key);

            return {
              title: data.albumTitle,
              artistName: data.artistName,
              labelName: data.labelName,
              releaseDate: data.releaseDate,
              coverImage: data.coverImage,
              description: data.description,
              orderUrl: articleUrl,
            };
          } catch {
            // Individual article fetch failure is non-fatal
            return null;
          }
        }),
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          releases.push(result.value);
        }
      }
    }

    console.log(
      `[HubAdapter] ${url}: ${links.length} links → ${releases.length} releases`,
    );

    return releases;
  }
}

function extractTitleTag(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/<[^>]+>/g, "").trim() ?? null;
}
