/**
 * AI-powered collectability scoring.
 *
 * Uses AI knowledge of artists, labels, pressing history, and the vinyl
 * market to produce intelligent collectability assessments — rather than
 * relying solely on heuristic checks for press run / colored vinyl / etc.
 *
 * The heuristic score is used as a baseline; the AI can raise or lower it
 * based on deeper knowledge.
 */

import type { ResolvedKeys } from "@/server/services/ai/keys";

interface AICollectabilityInput {
  title: string;
  artistName: string;
  labelName?: string | null;
  year?: number | null;
  description?: string | null;
  pressRun?: number | null;
  coloredVinyl?: boolean | null;
  specialPackaging?: string | null;
  heuristicScore: number; // 0-100 from the basic heuristic
}

interface AICollectabilityResult {
  score: number; // 0-100
  explanation: string;
}

const PROMPT_TEMPLATE = `You are a vinyl record collectability expert with deep knowledge of the record market, pressing history, label reputation, and artist demand.

Evaluate the collectability of this vinyl release on a scale of 0-100:

Title: {title}
Artist: {artistName}
{labelLine}
{yearLine}
{descLine}
{pressLine}
{colorLine}
{packagingLine}

Consider these factors:
- Artist demand and cult following in the vinyl community
- Label reputation (e.g. Analog Productions, Mobile Fidelity, Third Man = premium)
- First pressings vs reissues, original vs remastered
- Genre collectability (jazz, funk, soul, psych, punk originals tend to be highly collectible)
- Limited edition indicators (colored vinyl, numbered, special packaging)
- Historical significance and critical acclaim
- Current market trends and demand
- Rarity signals

The heuristic system scored this {heuristicScore}/100 based on physical attributes only. Your score should reflect the FULL picture including cultural and market factors.

Respond with ONLY valid JSON:
{"score": <number 0-100>, "explanation": "<1-2 sentence explanation>"}`;

export async function scoreCollectabilityWithAI(
  input: AICollectabilityInput,
  keys: ResolvedKeys,
): Promise<AICollectabilityResult | null> {
  const anthropicKey = keys.anthropicKey;
  const openaiKey = keys.openaiKey;

  if (!anthropicKey && !openaiKey) {
    return null;
  }

  const prompt = PROMPT_TEMPLATE
    .replace("{title}", input.title)
    .replace("{artistName}", input.artistName)
    .replace("{labelLine}", input.labelName ? `Label: ${input.labelName}` : "")
    .replace("{yearLine}", input.year ? `Year: ${input.year}` : "")
    .replace(
      "{descLine}",
      input.description ? `Description: ${input.description.slice(0, 300)}` : "",
    )
    .replace(
      "{pressLine}",
      input.pressRun ? `Press run: ${input.pressRun} copies` : "",
    )
    .replace("{colorLine}", input.coloredVinyl ? "Colored vinyl: Yes" : "")
    .replace(
      "{packagingLine}",
      input.specialPackaging
        ? `Special packaging: ${input.specialPackaging}`
        : "",
    )
    .replace("{heuristicScore}", String(input.heuristicScore));

  try {
    if (anthropicKey) {
      return await callClaude(prompt, anthropicKey);
    }
    return await callOpenAI(prompt, openaiKey);
  } catch (err) {
    console.error("[AICollectability] Scoring failed:", err);
    return null;
  }
}

/**
 * Batch score multiple releases. Returns results in the same order as input.
 * Falls back to null for any that fail.
 */
export async function batchScoreCollectability(
  items: AICollectabilityInput[],
  keys: ResolvedKeys,
): Promise<(AICollectabilityResult | null)[]> {
  if (items.length === 0) return [];

  const anthropicKey = keys.anthropicKey;
  const openaiKey = keys.openaiKey;

  if (!anthropicKey && !openaiKey) {
    return items.map(() => null);
  }

  // Build a batch prompt for efficiency
  const numbered = items
    .map(
      (item, i) =>
        `${i + 1}. "${item.title}" by ${item.artistName}` +
        (item.labelName ? ` [${item.labelName}]` : "") +
        (item.year ? ` (${item.year})` : "") +
        (item.pressRun ? ` — ${item.pressRun} copies` : "") +
        (item.coloredVinyl ? " — colored vinyl" : "") +
        ` [heuristic: ${item.heuristicScore}/100]`,
    )
    .join("\n");

  const batchPrompt = `You are a vinyl record collectability expert. Score each release's collectability (0-100) considering artist demand, label reputation, genre collectability, rarity, historical significance, and market trends.

Releases:
${numbered}

Respond with ONLY a valid JSON array of objects, one per release in order:
[{"score": <0-100>, "explanation": "<1-2 sentences>"}, ...]`;

  try {
    const text = anthropicKey
      ? await callClaudeRaw(batchPrompt, anthropicKey)
      : await callOpenAIRaw(batchPrompt, openaiKey);

    if (!text) return items.map(() => null);

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return items.map(() => null);

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return items.map(() => null);

    return items.map((_, i) => {
      const entry = parsed[i];
      if (
        entry &&
        typeof entry.score === "number" &&
        typeof entry.explanation === "string"
      ) {
        return {
          score: Math.max(0, Math.min(100, Math.round(entry.score))),
          explanation: entry.explanation,
        };
      }
      return null;
    });
  } catch (err) {
    console.error("[AICollectability] Batch scoring failed:", err);
    return items.map(() => null);
  }
}

// ── API helpers ──────────────────────────────────────────────────────────

async function callClaude(
  prompt: string,
  apiKey: string,
): Promise<AICollectabilityResult | null> {
  const text = await callClaudeRaw(prompt, apiKey);
  return parseResult(text);
}

async function callOpenAI(
  prompt: string,
  apiKey: string,
): Promise<AICollectabilityResult | null> {
  const text = await callOpenAIRaw(prompt, apiKey);
  return parseResult(text);
}

async function callClaudeRaw(
  prompt: string,
  apiKey: string,
): Promise<string | null> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    console.error(`[AICollectability] Claude error: ${response.status}`);
    return null;
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? null;
}

async function callOpenAIRaw(
  prompt: string,
  apiKey: string,
): Promise<string | null> {
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
          content:
            "You are a vinyl record collectability expert. Always respond with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    console.error(`[AICollectability] OpenAI error: ${response.status}`);
    return null;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? null;
}

function parseResult(text: string | null): AICollectabilityResult | null {
  if (!text) return null;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.score === "number" && typeof parsed.explanation === "string") {
      return {
        score: Math.max(0, Math.min(100, Math.round(parsed.score))),
        explanation: parsed.explanation,
      };
    }
    return null;
  } catch {
    return null;
  }
}
