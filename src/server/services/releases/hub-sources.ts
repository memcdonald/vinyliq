/**
 * Hub source configurations for the hub-page collector pipeline.
 *
 * Each config describes how to extract candidate article links from a
 * music publication's listing/hub page.
 */

export interface HubSourceConfig {
  name: string;
  hubUrl: string;
  /** CSS-style selector pattern to identify article links in page HTML */
  linkSelector: string;
  /** Optional URL pattern filter — only links matching this regex are kept */
  linkPattern?: RegExp;
  /** Per-source hint for artist extraction (e.g. a meta tag name) */
  artistExtraction?: string;
  /** Max candidate links to process per fetch (default 20) */
  maxLinks: number;
}

export const HUB_SOURCES: HubSourceConfig[] = [
  {
    name: "Pitchfork",
    hubUrl: "https://pitchfork.com/reviews/albums/",
    linkSelector: 'a[href*="/reviews/albums/"]',
    linkPattern: /\/reviews\/albums\/[^/]+/,
    maxLinks: 20,
  },
  {
    name: "AllMusic",
    hubUrl: "https://www.allmusic.com/newreleases",
    linkSelector: 'a[href*="/album/"]',
    linkPattern: /\/album\//,
    artistExtraction: "og:title",
    maxLinks: 20,
  },
  {
    name: "Bandcamp",
    hubUrl: "https://bandcamp.com/discover",
    linkSelector: 'a[href*=".bandcamp.com/album/"]',
    linkPattern: /\.bandcamp\.com\/album\//,
    maxLinks: 20,
  },
  {
    name: "Stereogum",
    hubUrl: "https://www.stereogum.com/category/album-of-the-week/",
    linkSelector: 'a[href*="/album-of-the-week"]',
    linkPattern: /\/\d+\/album-of-the-week/,
    maxLinks: 20,
  },
];

/**
 * Look up a hub source config by matching the source name (case-insensitive).
 * Returns undefined if no matching config exists.
 */
export function findHubConfig(sourceName: string): HubSourceConfig | undefined {
  const lower = sourceName.toLowerCase();
  return HUB_SOURCES.find((c) => lower.includes(c.name.toLowerCase()));
}

/**
 * Build a HubSourceConfig from a raw URL when no named config matches.
 * Uses generic link extraction patterns.
 */
export function genericHubConfig(url: string): HubSourceConfig {
  return {
    name: "Generic",
    hubUrl: url,
    linkSelector: "a[href]",
    maxLinks: 20,
  };
}
