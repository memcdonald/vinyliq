import type { AIProvider } from "./types";
import { ClaudeProvider } from "./claude-provider";
import { OpenAIProvider } from "./openai-provider";
import { env } from "@/lib/env";
import type { ResolvedKeys } from "./keys";

export type { AlbumEvaluationInput, AlbumEvaluationResult, AIProvider } from "./types";

export function getAIProvider(
  preferredProvider?: string | null,
  keys?: ResolvedKeys,
): AIProvider | null {
  const provider = preferredProvider ?? env.AI_PROVIDER;
  const anthropicKey = keys?.anthropicKey || env.ANTHROPIC_API_KEY;
  const openaiKey = keys?.openaiKey || env.OPENAI_API_KEY;

  if (provider === "openai" && openaiKey) {
    return new OpenAIProvider(openaiKey);
  }

  if (anthropicKey) {
    return new ClaudeProvider(anthropicKey);
  }

  if (openaiKey) {
    return new OpenAIProvider(openaiKey);
  }

  return null;
}

export function isAIConfigured(): boolean {
  return !!(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY);
}

/**
 * Check if AI is configured for a specific user (including user DB keys).
 */
export function isAIConfiguredWithKeys(keys: ResolvedKeys): boolean {
  return !!(keys.anthropicKey || keys.openaiKey);
}
