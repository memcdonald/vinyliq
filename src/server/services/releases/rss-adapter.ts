import type { SourceAdapter, RawRelease } from "./types";
import Parser from "rss-parser";

const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["enclosure", "enclosure"],
    ],
  },
});

export class RssAdapter implements SourceAdapter {
  async fetch(url: string): Promise<RawRelease[]> {
    const feed = await parser.parseURL(url);
    const releases: RawRelease[] = [];

    for (const item of feed.items) {
      if (!item.title) continue;

      const decodedTitle = decodeHtmlEntities(item.title);

      // Require "Artist - Title" format; skip blog articles without it
      const parts = decodedTitle.split(" - ");
      if (parts.length < 2) continue;

      const artistName = parts[0].trim();
      const title = parts.slice(1).join(" - ").trim();
      if (!artistName || !title) continue;

      // Extract image from various RSS fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = item as any;
      const coverImage =
        raw.mediaContent?.$?.url ??
        raw.mediaThumbnail?.$?.url ??
        raw.enclosure?.url ??
        extractImageFromHtml(item.content || raw["content:encoded"] || "") ??
        undefined;

      // Parse release date from content or pubDate
      const releaseDate = item.pubDate ? new Date(item.pubDate) : undefined;

      // Check for limited edition indicators in description
      const desc = (item.contentSnippet || item.content || "").toLowerCase();
      const coloredVinyl = /colou?red vinyl|splatter|marble|picture disc/i.test(desc);
      const numbered = /numbered|\/\d+/.test(desc);
      const pressRunMatch = desc.match(/limited to (\d+)/);
      const pressRun = pressRunMatch ? parseInt(pressRunMatch[1], 10) : undefined;

      const description = item.contentSnippet
        ? decodeHtmlEntities(item.contentSnippet).slice(0, 500)
        : undefined;

      releases.push({
        title,
        artistName,
        releaseDate,
        coverImage: typeof coverImage === "string" ? coverImage : undefined,
        description,
        orderUrl: item.link,
        coloredVinyl,
        numbered,
        pressRun,
      });
    }

    return releases;
  }
}

function extractImageFromHtml(html: string): string | null {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/);
  return match?.[1] ?? null;
}

const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (match) => HTML_ENTITY_MAP[match] ?? match);
}
