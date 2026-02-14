import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { getOAuthTemp } from "@/server/auth/oauth-store";
import { exchangeSpotifyCode } from "@/server/services/spotify/auth";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

  try {
    // -----------------------------------------------------------------------
    // 1. Validate the session
    // -----------------------------------------------------------------------
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.redirect(
        `${baseUrl}/sign-in?callbackUrl=/settings`,
      );
    }

    // -----------------------------------------------------------------------
    // 2. Extract query params
    // -----------------------------------------------------------------------
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        `${baseUrl}/settings?spotify=error&reason=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${baseUrl}/settings?spotify=error&reason=missing_params`,
      );
    }

    // -----------------------------------------------------------------------
    // 3. Retrieve stored PKCE verifier
    // -----------------------------------------------------------------------
    const codeVerifier = getOAuthTemp(`spotify:${state}`);

    if (!codeVerifier) {
      return NextResponse.redirect(
        `${baseUrl}/settings?spotify=error&reason=expired_state`,
      );
    }

    // -----------------------------------------------------------------------
    // 4. Exchange code for tokens
    // -----------------------------------------------------------------------
    const tokenResponse = await exchangeSpotifyCode(code, codeVerifier);

    // -----------------------------------------------------------------------
    // 5. Store tokens in user record
    // -----------------------------------------------------------------------
    const expiresAt = new Date(
      Date.now() + tokenResponse.expires_in * 1000,
    );

    await db
      .update(user)
      .set({
        spotifyAccessToken: tokenResponse.access_token,
        spotifyRefreshToken: tokenResponse.refresh_token ?? null,
        spotifyTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id));

    return NextResponse.redirect(`${baseUrl}/settings?spotify=connected`);
  } catch (error) {
    console.error("Spotify OAuth callback error:", error);
    return NextResponse.redirect(
      `${baseUrl}/settings?spotify=error&reason=unknown`,
    );
  }
}
