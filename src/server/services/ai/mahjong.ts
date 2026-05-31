import { eq, asc, desc } from "drizzle-orm";
import { db } from "@/server/db";
import { mahjongMessages, user } from "@/server/db/schema";
import { env } from "@/lib/env";
import { getUserApiKeys } from "./keys";
import { parseHand, tileLabel, handSize } from "@/lib/mahjong/tiles";
import { analyzeHand } from "@/lib/mahjong/shanten";

const MAX_HISTORY = 20;

interface CoachResponse {
  content: string;
}

const SYSTEM_PROMPT = `You are the VinylIQ Mahjong Coach, an expert teacher of Japanese Riichi mahjong. You help players of all levels improve: from learning the tiles to refining efficiency, reading discards, and choosing yaku.

Coaching style:
- Be warm, encouraging, and concise. Favor concrete advice over theory dumps.
- When a hand is provided, you are given an exact, engine-computed analysis (shanten distance, acceptance/ukeire, and ranked discards). TRUST these numbers — they are correct. Explain *why* the recommended discard is best in plain language (shape, wait quality, safety, yaku potential).
- Use standard notation when referring to tiles (e.g. 3p, 7s, East). Sequences like 234m, triplets like 555p.
- Teach the reasoning, not just the answer, so the player improves.
- If asked about rules, scoring, or yaku, give accurate Riichi (Japanese) mahjong information. If unsure, say so rather than inventing rules.

Keep replies focused and readable.`;

/**
 * Build a context block describing the current hand using the offline engine,
 * so the model reasons from exact numbers rather than guessing.
 */
export function buildHandContext(handNotation: string | null | undefined): string {
  if (!handNotation || !handNotation.trim()) {
    return "The player has not entered a hand yet. Offer to analyze one if relevant.";
  }

  let counts: number[];
  try {
    counts = parseHand(handNotation);
  } catch {
    return `The player entered a hand ("${handNotation}") but it could not be parsed. Gently ask them to re-enter it using notation like 123m456p789s11z.`;
  }

  const size = handSize(counts);
  const analysis = analyzeHand(counts);

  const lines: string[] = [];
  lines.push(`## Current hand (engine analysis)`);
  lines.push(`- Notation: ${handNotation}`);
  lines.push(`- Tiles in hand: ${size}`);
  lines.push(
    `- Shanten: ${analysis.shanten} ${
      analysis.shanten < 0
        ? "(complete!)"
        : analysis.shanten === 0
          ? "(tenpai — ready)"
          : `(${analysis.shanten} away from tenpai)`
    }`,
  );

  if (analysis.acceptance) {
    const tiles = analysis.acceptance.tiles.map(tileLabel).join(", ") || "none";
    lines.push(
      `- Acceptance (ukeire): ${analysis.acceptance.count} tiles that improve the hand → ${tiles}`,
    );
  }

  if (analysis.discards && analysis.discards.length > 0) {
    lines.push(`- Best discards (engine-ranked):`);
    for (const opt of analysis.discards.slice(0, 5)) {
      const accepts = opt.acceptedTiles.map(tileLabel).join(", ") || "none";
      lines.push(
        `  • discard ${opt.tileLabel} → shanten ${opt.shanten}, ukeire ${opt.ukeire} (${accepts})`,
      );
    }
  }

  return lines.join("\n");
}

/**
 * Send a coaching message (optionally about a specific hand) and persist the
 * exchange. Mirrors the vinyl chat service's provider-resolution logic.
 */
export async function sendCoachMessage(
  userId: string,
  message: string,
  hand?: string | null,
): Promise<CoachResponse> {
  await db.insert(mahjongMessages).values({
    userId,
    role: "user",
    content: message,
    hand: hand ?? null,
  });

  const [prefs] = await db
    .select({ preferredAiProvider: user.preferredAiProvider })
    .from(user)
    .where(eq(user.id, userId));

  const history = await db
    .select({ role: mahjongMessages.role, content: mahjongMessages.content })
    .from(mahjongMessages)
    .where(eq(mahjongMessages.userId, userId))
    .orderBy(desc(mahjongMessages.createdAt))
    .limit(MAX_HISTORY);
  history.reverse();

  const systemPrompt = `${SYSTEM_PROMPT}\n\n${buildHandContext(hand)}`;

  const keys = await getUserApiKeys(userId);
  const preferred = prefs?.preferredAiProvider ?? env.AI_PROVIDER;

  let responseText: string;
  if (preferred === "openai" && keys.openaiKey) {
    responseText = await callOpenAI(keys.openaiKey, systemPrompt, history);
  } else if (keys.anthropicKey) {
    responseText = await callClaude(keys.anthropicKey, systemPrompt, history);
  } else if (keys.openaiKey) {
    responseText = await callOpenAI(keys.openaiKey, systemPrompt, history);
  } else {
    responseText =
      "AI is not configured. Please add an API key on the Credentials page.";
  }

  await db.insert(mahjongMessages).values({
    userId,
    role: "assistant",
    content: responseText,
    hand: hand ?? null,
  });

  return { content: responseText };
}

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  history: { role: string; content: string }[],
): Promise<string> {
  const messages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

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
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? "I couldn't generate a response.";
}

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  history: { role: string; content: string }[],
): Promise<string> {
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  return (
    data.choices?.[0]?.message?.content ?? "I couldn't generate a response."
  );
}

export async function getCoachHistory(userId: string) {
  return db
    .select({
      id: mahjongMessages.id,
      role: mahjongMessages.role,
      content: mahjongMessages.content,
      hand: mahjongMessages.hand,
      createdAt: mahjongMessages.createdAt,
    })
    .from(mahjongMessages)
    .where(eq(mahjongMessages.userId, userId))
    .orderBy(asc(mahjongMessages.createdAt));
}

export async function clearCoachHistory(userId: string) {
  await db.delete(mahjongMessages).where(eq(mahjongMessages.userId, userId));
}
