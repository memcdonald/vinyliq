import type { SourceAdapter, RawRelease } from "./types";

export class UrlAdapter implements SourceAdapter {
  async fetch(url: string): Promise<RawRelease[]> {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "VinylIQ/1.0 (Release Tracker)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const html = await response.text();
    return extractReleasesFromHtml(html, url);
  }
}

function extractReleasesFromHtml(html: string, baseUrl: string): RawRelease[] {
  const releases: RawRelease[] = [];

  // Extract structured data (JSON-LD) if available
  const jsonLdMatches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);
      if (data["@type"] === "MusicAlbum" || data["@type"] === "Product") {
        releases.push({
          title: data.name || "",
          artistName: data.byArtist?.name || data.brand?.name || "Unknown Artist",
          releaseDate: data.datePublished ? new Date(data.datePublished) : undefined,
          coverImage: data.image,
          description: data.description?.slice(0, 500),
          orderUrl: data.url || baseUrl,
        });
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  }

  if (releases.length > 0) return releases;

  // Fallback: heuristic extraction from HTML
  // Look for common patterns in record store pages
  const titleMatches = html.matchAll(
    /<h[1-4][^>]*class=["'][^"']*(?:product|release|album|title)[^"']*["'][^>]*>([\s\S]*?)<\/h[1-4]>/gi
  );

  for (const match of titleMatches) {
    const rawTitle = match[1].replace(/<[^>]+>/g, "").trim();
    if (!rawTitle || rawTitle.length < 3) continue;

    const parts = rawTitle.split(" - ");
    let artistName = "Unknown Artist";
    let title = rawTitle;

    if (parts.length >= 2) {
      artistName = parts[0].trim();
      title = parts.slice(1).join(" - ").trim();
    }

    releases.push({
      title,
      artistName,
      orderUrl: baseUrl,
    });
  }

  return releases.slice(0, 50); // Limit results
}
