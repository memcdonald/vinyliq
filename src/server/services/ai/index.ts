import type { AIProvider } from "./types";
import { ClaudeProvider } from "./claude-provider";
import { OpenAIProvider } from "./openai-provider";
import { env } from "@/lib/env";

export type { AlbumEvaluationInput, AlbumEvaluationResult, AIProvider } from "./types";

export function getAIProvider(): AIProvider | null {
  const provider = env.AI_PROVIDER;

  if (provider === "openai" && env.OPENAI_API_KEY) {
    return new OpenAIProvider();
  }

  if (env.ANTHROPIC_API_KEY) {
    return new ClaudeProvider();
  }

  if (env.OPENAI_API_KEY) {
    return new OpenAIProvider();
  }

  return null;
}

export function isAIConfigured(): boolean {
  return !!(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY);
}
