import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { maskApiKey } from "@/server/services/ai/keys";
import { setOAuthTemp } from "@/server/auth/oauth-store";
import {
  generatePKCE,
  getSpotifyAuthUrl as buildSpotifyAuthUrl,
} from "@/server/services/spotify/auth";
import {
  importDiscogsCollection,
  getImportProgress,
} from "@/server/services/discogs/import";
import {
  importSpotifyLibrary as runSpotifyImport,
  getSpotifyImportProgress,
} from "@/server/services/spotify/import";

// ---------------------------------------------------------------------------
// Settings router
// ---------------------------------------------------------------------------

export const settingsRouter = createTRPCRouter({
  // -------------------------------------------------------------------------
  // Credentials status (which API keys / services are configured)
  // -------------------------------------------------------------------------
  getCredentialsStatus: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select({
        discogsAccessToken: user.discogsAccessToken,
        discogsUsername: user.discogsUsername,
        spotifyAccessToken: user.spotifyAccessToken,
        anthropicApiKey: user.anthropicApiKey,
        openaiApiKey: user.openaiApiKey,
      })
      .from(user)
      .where(eq(user.id, ctx.userId));

    const hasAnthropic = !!(row?.anthropicApiKey || process.env.ANTHROPIC_API_KEY);
    const hasOpenai = !!(row?.openaiApiKey || process.env.OPENAI_API_KEY);

    return {
      discogs: {
        consumerKey: !!process.env.DISCOGS_CONSUMER_KEY,
        connected: !!row?.discogsAccessToken,
        username: row?.discogsUsername ?? null,
      },
      spotify: {
        clientId: !!process.env.SPOTIFY_CLIENT_ID,
        connected: !!row?.spotifyAccessToken,
      },
      ai: {
        anthropic: hasAnthropic,
        openai: hasOpenai,
        provider: process.env.AI_PROVIDER ?? "claude",
        anthropicMasked: maskApiKey(row?.anthropicApiKey),
        openaiMasked: maskApiKey(row?.openaiApiKey),
        anthropicFromEnv: !!process.env.ANTHROPIC_API_KEY,
        openaiFromEnv: !!process.env.OPENAI_API_KEY,
      },
      cache: {
        redis: !!process.env.UPSTASH_REDIS_REST_URL,
      },
      auth: {
        secret: !!process.env.BETTER_AUTH_SECRET,
        url: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
      },
    };
  }),

  // -------------------------------------------------------------------------
  // Connected accounts status
  // -------------------------------------------------------------------------
  getConnectedAccounts: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select({
        discogsUsername: user.discogsUsername,
        discogsAccessToken: user.discogsAccessToken,
        spotifyAccessToken: user.spotifyAccessToken,
        spotifyTokenExpiresAt: user.spotifyTokenExpiresAt,
      })
      .from(user)
      .where(eq(user.id, ctx.userId));

    return {
      discogs: {
        connected: !!row?.discogsAccessToken,
        username: row?.discogsUsername ?? null,
      },
      spotify: {
        connected: !!row?.spotifyAccessToken,
        expiresAt: row?.spotifyTokenExpiresAt ?? null,
      },
    };
  }),

  // -------------------------------------------------------------------------
  // Disconnect Discogs
  // -------------------------------------------------------------------------
  disconnectDiscogs: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(user)
      .set({
        discogsUsername: null,
        discogsAccessToken: null,
        discogsAccessTokenSecret: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, ctx.userId));

    return { success: true };
  }),

  // -------------------------------------------------------------------------
  // Disconnect Spotify
  // -------------------------------------------------------------------------
  disconnectSpotify: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(user)
      .set({
        spotifyAccessToken: null,
        spotifyRefreshToken: null,
        spotifyTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, ctx.userId));

    return { success: true };
  }),

  // -------------------------------------------------------------------------
  // AI preferences
  // -------------------------------------------------------------------------
  getAiPreferences: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select({
        preferredAiProvider: user.preferredAiProvider,
        chatSystemPrompt: user.chatSystemPrompt,
        recommendationPrompt: user.recommendationPrompt,
      })
      .from(user)
      .where(eq(user.id, ctx.userId));

    return {
      provider: row?.preferredAiProvider ?? process.env.AI_PROVIDER ?? "claude",
      chatSystemPrompt: row?.chatSystemPrompt ?? null,
      recommendationPrompt: row?.recommendationPrompt ?? null,
    };
  }),

  updateAiPreferences: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["claude", "openai"]).optional(),
        chatSystemPrompt: z.string().max(4000).nullable().optional(),
        recommendationPrompt: z.string().max(4000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.provider !== undefined) {
        updates.preferredAiProvider = input.provider;
      }
      if (input.chatSystemPrompt !== undefined) {
        updates.chatSystemPrompt = input.chatSystemPrompt;
      }
      if (input.recommendationPrompt !== undefined) {
        updates.recommendationPrompt = input.recommendationPrompt;
      }
      await db
        .update(user)
        .set(updates)
        .where(eq(user.id, ctx.userId));

      return { success: true };
    }),

  // -------------------------------------------------------------------------
  // API Key management
  // -------------------------------------------------------------------------
  saveApiKey: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["anthropic", "openai"]),
        apiKey: z.string().min(1).max(256),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.provider === "anthropic") {
        updates.anthropicApiKey = input.apiKey.trim();
      } else {
        updates.openaiApiKey = input.apiKey.trim();
      }
      await db
        .update(user)
        .set(updates)
        .where(eq(user.id, ctx.userId));

      return { success: true };
    }),

  removeApiKey: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["anthropic", "openai"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.provider === "anthropic") {
        updates.anthropicApiKey = null;
      } else {
        updates.openaiApiKey = null;
      }
      await db
        .update(user)
        .set(updates)
        .where(eq(user.id, ctx.userId));

      return { success: true };
    }),

  // -------------------------------------------------------------------------
  // Discogs OAuth 1.0a — Request Token step
  // -------------------------------------------------------------------------
  getDiscogsAuthUrl: protectedProcedure.query(async () => {
    const consumerKey = process.env.DISCOGS_CONSUMER_KEY;
    const consumerSecret = process.env.DISCOGS_CONSUMER_SECRET;

    if (!consumerKey || !consumerSecret) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "DISCOGS_CONSUMER_KEY or DISCOGS_CONSUMER_SECRET is not set.",
      });
    }

    const callbackUrl = `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/api/discogs/callback`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(16).toString("hex");

    const response = await fetch(
      "https://api.discogs.com/oauth/request_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "VinylIQ/1.0",
          Authorization: [
            `OAuth oauth_consumer_key="${consumerKey}"`,
            `oauth_signature_method="PLAINTEXT"`,
            `oauth_signature="${encodeURIComponent(consumerSecret + "&")}"`,
            `oauth_timestamp="${timestamp}"`,
            `oauth_nonce="${nonce}"`,
            `oauth_callback="${encodeURIComponent(callbackUrl)}"`,
          ].join(", "),
        },
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Discogs request token failed: ${response.status} ${response.statusText}${body ? ` — ${body}` : ""}`,
      });
    }

    const text = await response.text();
    const params = new URLSearchParams(text);
    const oauthToken = params.get("oauth_token");
    const oauthTokenSecret = params.get("oauth_token_secret");

    if (!oauthToken || !oauthTokenSecret) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Discogs did not return oauth_token or oauth_token_secret.",
      });
    }

    // Store token secret temporarily (keyed by oauth_token)
    setOAuthTemp(`discogs:${oauthToken}`, oauthTokenSecret);

    return {
      url: `https://discogs.com/oauth/authorize?oauth_token=${oauthToken}`,
    };
  }),

  // -------------------------------------------------------------------------
  // Spotify OAuth 2.0 PKCE — Authorize URL
  // -------------------------------------------------------------------------
  getSpotifyAuthUrl: protectedProcedure.query(async () => {
    const { verifier, challenge } = generatePKCE();
    const state = randomBytes(16).toString("hex");

    // Store PKCE verifier temporarily (keyed by state)
    setOAuthTemp(`spotify:${state}`, verifier);

    const url = buildSpotifyAuthUrl(state, challenge);

    return { url };
  }),

  // -------------------------------------------------------------------------
  // Import — Discogs collection
  // -------------------------------------------------------------------------
  importDiscogsCollection: protectedProcedure.mutation(async ({ ctx }) => {
    // Get user's Discogs credentials
    const [row] = await db
      .select({
        discogsUsername: user.discogsUsername,
        discogsAccessToken: user.discogsAccessToken,
        discogsAccessTokenSecret: user.discogsAccessTokenSecret,
      })
      .from(user)
      .where(eq(user.id, ctx.userId));

    if (
      !row?.discogsAccessToken ||
      !row?.discogsAccessTokenSecret ||
      !row?.discogsUsername
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Discogs account not connected",
      });
    }

    // Start import asynchronously (fire and forget)
    importDiscogsCollection(
      ctx.userId,
      row.discogsUsername,
      row.discogsAccessToken,
      row.discogsAccessTokenSecret,
    ).catch(console.error);

    return { status: "started" as const, message: "Import started" };
  }),

  // -------------------------------------------------------------------------
  // Import — Spotify library
  // -------------------------------------------------------------------------
  importSpotifyLibrary: protectedProcedure.mutation(async ({ ctx }) => {
    const [row] = await db
      .select({
        spotifyAccessToken: user.spotifyAccessToken,
        spotifyRefreshToken: user.spotifyRefreshToken,
      })
      .from(user)
      .where(eq(user.id, ctx.userId));

    if (!row?.spotifyAccessToken || !row?.spotifyRefreshToken) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Spotify account not connected",
      });
    }

    // Start import asynchronously (fire and forget)
    runSpotifyImport(
      ctx.userId,
      row.spotifyAccessToken,
      row.spotifyRefreshToken,
    ).catch(console.error);

    return { status: "started" as const, message: "Import started" };
  }),

  // -------------------------------------------------------------------------
  // Import progress
  // -------------------------------------------------------------------------
  getImportProgress: protectedProcedure
    .input(z.object({ service: z.enum(["discogs", "spotify"]) }))
    .query(({ ctx, input }) => {
      if (input.service === "discogs") {
        return getImportProgress(ctx.userId);
      }
      if (input.service === "spotify") {
        return getSpotifyImportProgress(ctx.userId);
      }
      return null;
    }),
});
