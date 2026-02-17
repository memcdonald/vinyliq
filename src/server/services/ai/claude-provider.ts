import type { AIProvider, AlbumEvaluationInput, AlbumEvaluationResult } from "./types";
import { buildEvaluationPrompt } from "./prompt";

export class ClaudeProvider implements AIProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async evaluate(input: AlbumEvaluationInput): Promise<AlbumEvaluationResult> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const prompt = buildEvaluationPrompt(input);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${errorBody}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;

    if (!text) {
      throw new Error("Empty response from Claude");
    }

    return parseEvaluationResponse(text);
  }
}

function parseEvaluationResponse(text: string): AlbumEvaluationResult {
  // Extract JSON from response (handle potential markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse AI response as JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    evaluation: String(parsed.evaluation || ""),
    score: Math.max(1, Math.min(10, Number(parsed.score) || 5)),
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map(String) : [],
    concerns: Array.isArray(parsed.concerns) ? parsed.concerns.map(String) : [],
  };
}
