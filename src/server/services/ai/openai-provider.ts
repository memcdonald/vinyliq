import type { AIProvider, AlbumEvaluationInput, AlbumEvaluationResult } from "./types";
import { buildEvaluationPrompt } from "./prompt";

export class OpenAIProvider implements AIProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async evaluate(input: AlbumEvaluationInput): Promise<AlbumEvaluationResult> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const prompt = buildEvaluationPrompt(input);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content: "You are a vinyl record expert. Always respond with valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorBody}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error("Empty response from OpenAI");
    }

    return parseEvaluationResponse(text);
  }
}

function parseEvaluationResponse(text: string): AlbumEvaluationResult {
  const parsed = JSON.parse(text);

  return {
    evaluation: String(parsed.evaluation || ""),
    score: Math.max(1, Math.min(10, Number(parsed.score) || 5)),
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map(String) : [],
    concerns: Array.isArray(parsed.concerns) ? parsed.concerns.map(String) : [],
  };
}
