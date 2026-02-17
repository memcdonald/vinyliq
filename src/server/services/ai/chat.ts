import { eq, asc, desc } from "drizzle-orm";
import { db } from "@/server/db";
import { chatMessages, collectionItems, albums, user } from "@/server/db/schema";
import { getTasteProfile, topN } from "@/server/recommendation/taste-profile";
import { env } from "@/lib/env";
import { getUserApiKeys } from "./keys";

const MAX_HISTORY = 20;

interface ChatResponse {
  content: string;
}

/**
 * Send a message and get an AI response in the context of the user's collection.
 */
export async function sendChatMessage(
  userId: string,
  message: string,
): Promise<ChatResponse> {
  // Store user message
  await db.insert(chatMessages).values({
    userId,
    role: "user",
    content: message,
  });

  // Get user preferences
  const [prefs] = await db
    .select({
      preferredAiProvider: user.preferredAiProvider,
      chatSystemPrompt: user.chatSystemPrompt,
    })
    .from(user)
    .where(eq(user.id, userId));

  // Get conversation history
  const history = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(MAX_HISTORY);

  // Reverse to chronological order
  history.reverse();

  // Build context about user's collection
  const context = await buildUserContext(userId, prefs?.chatSystemPrompt ?? null);

  // Resolve API keys (user DB → env fallback)
  const keys = await getUserApiKeys(userId);

  // Determine which provider to use
  const preferred = prefs?.preferredAiProvider ?? env.AI_PROVIDER;

  // Get AI response
  let responseText: string;
  if (preferred === "openai" && keys.openaiKey) {
    responseText = await callOpenAI(keys.openaiKey, context, history);
  } else if (keys.anthropicKey) {
    responseText = await callClaude(keys.anthropicKey, context, history);
  } else if (keys.openaiKey) {
    responseText = await callOpenAI(keys.openaiKey, context, history);
  } else {
    responseText =
      "AI is not configured. Please add an API key on the Credentials page.";
  }

  // Store assistant response
  await db.insert(chatMessages).values({
    userId,
    role: "assistant",
    content: responseText,
  });

  return { content: responseText };
}

async function buildUserContext(
  userId: string,
  customPrompt: string | null,
): Promise<string> {
  const profile = await getTasteProfile(userId);

  const topGenres = topN(profile.genreWeights, 5)
    .map(([g, w]) => `${g} (${(w * 100).toFixed(0)}%)`)
    .join(", ");
  const topStyles = topN(profile.styleWeights, 5)
    .map(([s, w]) => `${s} (${(w * 100).toFixed(0)}%)`)
    .join(", ");
  const topArtists = topN(profile.artistWeights, 8)
    .map(([a]) => a)
    .join(", ");
  const topEras = topN(profile.eraWeights, 3)
    .map(([e, w]) => `${e} (${(w * 100).toFixed(0)}%)`)
    .join(", ");

  // Get collection stats
  const collection = await db
    .select({
      status: collectionItems.status,
      title: albums.title,
      rating: collectionItems.rating,
    })
    .from(collectionItems)
    .innerJoin(albums, eq(collectionItems.albumId, albums.id))
    .where(eq(collectionItems.userId, userId))
    .orderBy(desc(collectionItems.rating))
    .limit(20);

  const owned = collection.filter((c) => c.status === "owned");
  const wanted = collection.filter((c) => c.status === "wanted");
  const topRated = collection
    .filter((c) => c.rating && c.rating >= 8)
    .slice(0, 5)
    .map((c) => `${c.title} (${c.rating}/10)`)
    .join(", ");

  const collectorProfile = `## Collector Profile
- Collection size: ${owned.length} owned, ${wanted.length} on wantlist
- Top genres: ${topGenres || "Not enough data"}
- Top styles: ${topStyles || "Not enough data"}
- Favorite artists: ${topArtists || "Not enough data"}
- Preferred eras: ${topEras || "Not enough data"}
- Top-rated albums: ${topRated || "None rated yet"}`;

  if (customPrompt) {
    return `${customPrompt}

${collectorProfile}`;
  }

  return `You are VinylIQ, a knowledgeable vinyl record advisor and music expert. You help collectors discover music, evaluate pressings, understand market trends, and build their collections.

${collectorProfile}

## Guidelines
- Be conversational and personalized based on the collector's taste profile
- When recommending albums, explain why they fit the collector's taste
- Share knowledge about pressings, labels, and collectability
- If asked about an album you're unsure about, say so rather than guessing
- Keep responses concise but informative`;
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

/**
 * Get chat history for a user.
 */
export async function getChatHistory(userId: string) {
  return db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(asc(chatMessages.createdAt));
}

/**
 * Clear all chat history for a user.
 */
export async function clearChatHistory(userId: string) {
  await db
    .delete(chatMessages)
    .where(eq(chatMessages.userId, userId));
}
