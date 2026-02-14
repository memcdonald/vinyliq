import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { env } from "@/lib/env";

export interface ResolvedKeys {
  anthropicKey: string;
  openaiKey: string;
}

/**
 * Resolve AI API keys for a user.
 * User-provided keys (stored in DB) take priority over env vars.
 */
export async function getUserApiKeys(userId: string): Promise<ResolvedKeys> {
  const [row] = await db
    .select({
      anthropicApiKey: user.anthropicApiKey,
      openaiApiKey: user.openaiApiKey,
    })
    .from(user)
    .where(eq(user.id, userId));

  return {
    anthropicKey: row?.anthropicApiKey || env.ANTHROPIC_API_KEY,
    openaiKey: row?.openaiApiKey || env.OPENAI_API_KEY,
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
