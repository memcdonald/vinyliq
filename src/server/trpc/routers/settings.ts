import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
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
  // Connected accounts status
  // -------------------------------------------------------------------------
  getConnectedAccounts: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db
      .select({
        discogsUsername: users.discogsUsername,
        discogsAccessToken: users.discogsAccessToken,
        spotifyAccessToken: users.spotifyAccessToken,
        spotifyTokenExpiresAt: users.spotifyTokenExpiresAt,
      })
      .from(users)
      .where(eq(users.id, ctx.userId));

    return {
      discogs: {
        connected: !!user?.discogsAccessToken,
        username: user?.discogsUsername ?? null,
      },
      spotify: {
        connected: !!user?.spotifyAccessToken,
        expiresAt: user?.spotifyTokenExpiresAt ?? null,
      },
    };
  }),

  // -------------------------------------------------------------------------
  // Disconnect Discogs
  // -------------------------------------------------------------------------
  disconnectDiscogs: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(users)
      .set({
        discogsUsername: null,
        discogsAccessToken: null,
        discogsAccessTokenSecret: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, ctx.userId));

    return { success: true };
  }),

  // -------------------------------------------------------------------------
  // Disconnect Spotify
  // -------------------------------------------------------------------------
  disconnectSpotify: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(users)
      .set({
        spotifyAccessToken: null,
        spotifyRefreshToken: null,
        spotifyTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, ctx.userId));

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
    const [user] = await db
      .select({
        discogsUsername: users.discogsUsername,
        discogsAccessToken: users.discogsAccessToken,
        discogsAccessTokenSecret: users.discogsAccessTokenSecret,
      })
      .from(users)
      .where(eq(users.id, ctx.userId));

    if (
      !user?.discogsAccessToken ||
      !user?.discogsAccessTokenSecret ||
      !user?.discogsUsername
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Discogs account not connected",
      });
    }

    // Start import asynchronously (fire and forget)
    importDiscogsCollection(
      ctx.userId,
      user.discogsUsername,
      user.discogsAccessToken,
      user.discogsAccessTokenSecret,
    ).catch(console.error);

    return { status: "started" as const, message: "Import started" };
  }),

  // -------------------------------------------------------------------------
  // Import — Spotify library
  // -------------------------------------------------------------------------
  importSpotifyLibrary: protectedProcedure.mutation(async ({ ctx }) => {
    const [user] = await db
      .select({
        spotifyAccessToken: users.spotifyAccessToken,
        spotifyRefreshToken: users.spotifyRefreshToken,
      })
      .from(users)
      .where(eq(users.id, ctx.userId));

    if (!user?.spotifyAccessToken || !user?.spotifyRefreshToken) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Spotify account not connected",
      });
    }

    // Start import asynchronously (fire and forget)
    runSpotifyImport(
      ctx.userId,
      user.spotifyAccessToken,
      user.spotifyRefreshToken,
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
