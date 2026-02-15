/**
 * Site-wide configuration.
 *
 * Resolution order for each key:
 *   1. site_settings DB table (set via admin UI)
 *   2. Environment variable
 *   3. null
 *
 * All keys stored in site_settings. Users can override AI keys per-user
 * via their user row (handled separately in ai/keys.ts).
 */

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { siteSettings } from "@/server/db/schema";

// Known config keys and their corresponding env var names
const KEY_ENV_MAP: Record<string, string> = {
  anthropic_api_key: "ANTHROPIC_API_KEY",
  openai_api_key: "OPENAI_API_KEY",
  discogs_consumer_key: "DISCOGS_CONSUMER_KEY",
  discogs_consumer_secret: "DISCOGS_CONSUMER_SECRET",
  spotify_client_id: "SPOTIFY_CLIENT_ID",
  spotify_client_secret: "SPOTIFY_CLIENT_SECRET",
};

/** Cache to avoid hitting DB on every request */
let cache: Map<string, string> | null = null;
let cacheAge = 0;
const CACHE_TTL = 60_000; // 1 minute

async function loadCache(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cache && now - cacheAge < CACHE_TTL) return cache;

  const rows = await db.select().from(siteSettings);
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.key, row.value);
  }
  cache = map;
  cacheAge = now;
  return map;
}

/** Invalidate the cache (call after writes) */
export function invalidateSiteConfigCache(): void {
  cache = null;
}

/**
 * Get a site config value. Checks site_settings DB, then env var.
 */
export async function getSiteConfig(key: string): Promise<string | null> {
  const settings = await loadCache();
  const dbVal = settings.get(key);
  if (dbVal) return dbVal;

  const envKey = KEY_ENV_MAP[key];
  if (envKey && process.env[envKey]) return process.env[envKey]!;

  return null;
}

/**
 * Set a site config value in the DB.
 */
export async function setSiteConfig(
  key: string,
  value: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: siteSettings.id })
    .from(siteSettings)
    .where(eq(siteSettings.key, key))
    .limit(1);

  if (existing) {
    await db
      .update(siteSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(siteSettings.id, existing.id));
  } else {
    await db.insert(siteSettings).values({ key, value });
  }

  invalidateSiteConfigCache();
}

/**
 * Remove a site config value from the DB (will fall back to env var).
 */
export async function removeSiteConfig(key: string): Promise<void> {
  await db.delete(siteSettings).where(eq(siteSettings.key, key));
  invalidateSiteConfigCache();
}

/**
 * Get all site config keys with their status (has DB override, has env var, masked value).
 */
export async function getSiteConfigStatus(): Promise<
  Record<
    string,
    {
      configured: boolean;
      fromDb: boolean;
      fromEnv: boolean;
      masked: string | null;
    }
  >
> {
  const settings = await loadCache();
  const result: Record<
    string,
    { configured: boolean; fromDb: boolean; fromEnv: boolean; masked: string | null }
  > = {};

  for (const key of Object.keys(KEY_ENV_MAP)) {
    const dbVal = settings.get(key);
    const envKey = KEY_ENV_MAP[key];
    const envVal = envKey ? process.env[envKey] : undefined;

    const value = dbVal || envVal || null;

    result[key] = {
      configured: !!value,
      fromDb: !!dbVal,
      fromEnv: !!envVal && !dbVal,
      masked: value ? maskKey(value) : null,
    };
  }

  return result;
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}
