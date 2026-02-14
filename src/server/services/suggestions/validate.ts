import type { RawRelease } from "@/server/services/releases/types";
import { env } from "@/lib/env";

/**
 * Exclusion keywords — if any appear in title, artistName, or description,
 * the item is almost certainly not a vinyl album release.
 */
const EXCLUSION_KEYWORDS = [
  "review",
  "turntable",
  "cartridge",
  "stylus",
  "amplifier",
  "speaker",
  "headphone",
  "equipment",
  "accessory",
  "guide",
  "comparison",
  "roundup",
  "playlist",
  "podcast",
];

const EXCLUSION_RE = new RegExp(`\\b(${EXCLUSION_KEYWORDS.join("|")})\\b`, "i");

/**
 * Layer 1 — Fast heuristic pre-filter (no API cost).
 * Returns true if the release looks like an actual vinyl album.
 */
export function isLikelyAlbum(release: RawRelease): boolean {
  const text = [release.title, release.artistName, release.description ?? ""]
    .join(" ")
    .toLowerCase();
  return !EXCLUSION_RE.test(text);
}

/**
 * Layer 2 — AI batch validation.
 * Sends candidate releases to an LLM and asks which are actual vinyl album
 * releases. Returns only the confirmed albums.
 *
 * Falls back to returning all candidates if no AI key is configured.
 */
export async function validateAlbumsWithAI(
  releases: RawRelease[],
): Promise<RawRelease[]> {
  if (releases.length === 0) return [];

  // No AI key → fall back to heuristic-only
  if (!env.ANTHROPIC_API_KEY && !env.OPENAI_API_KEY) {
    return releases;
  }

  const numbered = releases.map(
    (r, i) =>
      `${i}. "${r.title}" by ${r.artistName}${r.description ? ` — ${r.description.slice(0, 120)}` : ""}`,
  );

  const prompt = `You are a vinyl record expert. Below is a list of items scraped from record-store websites and RSS feeds. Some are actual vinyl album releases; others are equipment reviews, accessories, playlists, guides, or other non-album content.

Return ONLY a JSON array of the numeric indices (0-based) of items that are actual vinyl album releases. If none qualify, return an empty array [].

Items:
${numbered.join("\n")}`;

  try {
    const indices = env.ANTHROPIC_API_KEY
      ? await callClaudeValidation(prompt)
      : await callOpenAIValidation(prompt);

    if (!indices) return releases; // API error → keep all

    return indices
      .filter((i) => i >= 0 && i < releases.length)
      .map((i) => releases[i]);
  } catch {
    console.error("AI album validation failed, keeping all candidates");
    return releases;
  }
}

/**
 * Orchestrator: heuristic filter → AI validation → filtered releases.
 */
export async function filterToAlbums(
  releases: RawRelease[],
): Promise<RawRelease[]> {
  // Layer 1: fast heuristic
  const heuristicPassed = releases.filter(isLikelyAlbum);
  if (heuristicPassed.length === 0) return [];

  // Layer 2: AI validation
  return validateAlbumsWithAI(heuristicPassed);
}

// ── AI helpers ──────────────────────────────────────────────────────────

async function callClaudeValidation(
  prompt: string,
): Promise<number[] | null> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    console.error(`Claude validation API error: ${response.status}`);
    return null;
  }

  const data = await response.json();
  const text: string | undefined = data.content?.[0]?.text;
  return parseIndices(text);
}

async function callOpenAIValidation(
  prompt: string,
): Promise<number[] | null> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content:
            "You are a vinyl record expert. Always respond with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    console.error(`OpenAI validation API error: ${response.status}`);
    return null;
  }

  const data = await response.json();
  const text: string | undefined = data.choices?.[0]?.message?.content;
  return parseIndices(text);
}

function parseIndices(text: string | undefined): number[] | null {
  if (!text) return null;
  try {
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return null;

    return parsed.filter((v): v is number => typeof v === "number");
  } catch {
    return null;
  }
}
