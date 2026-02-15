import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { getSiteConfig } from "@/server/services/site-config";

export interface ResolvedKeys {
  anthropicKey: string;
  openaiKey: string;
}

/**
 * Resolve AI API keys for a user.
 *
 * Priority: user-provided key → site_settings → env var → empty string.
 */
export async function getUserApiKeys(userId: string): Promise<ResolvedKeys> {
  const [row] = await db
    .select({
      anthropicApiKey: user.anthropicApiKey,
      openaiApiKey: user.openaiApiKey,
    })
    .from(user)
    .where(eq(user.id, userId));

  const siteAnthropic = await getSiteConfig("anthropic_api_key");
  const siteOpenai = await getSiteConfig("openai_api_key");

  return {
    anthropicKey: row?.anthropicApiKey || siteAnthropic || "",
    openaiKey: row?.openaiApiKey || siteOpenai || "",
  };
}

/**
 * Mask an API key for display — show only last 4 characters.
 */
export function maskApiKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 4) return "****";
  return "****" + key.slice(-4);
}
