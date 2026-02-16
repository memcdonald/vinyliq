import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { getOAuthTemp } from "@/server/auth/oauth-store";
import { getSiteConfig } from "@/server/services/site-config";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

  try {
    // -----------------------------------------------------------------------
    // 1. Validate the session
    // -----------------------------------------------------------------------
    const session = await auth().api.getSession({
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
    const oauthToken = searchParams.get("oauth_token");
    const oauthVerifier = searchParams.get("oauth_verifier");

    if (!oauthToken || !oauthVerifier) {
      return NextResponse.redirect(
        `${baseUrl}/settings?discogs=error&reason=missing_params`,
      );
    }

    // -----------------------------------------------------------------------
    // 3. Retrieve stored token secret
    // -----------------------------------------------------------------------
    const tokenSecret = getOAuthTemp(`discogs:${oauthToken}`);

    if (!tokenSecret) {
      return NextResponse.redirect(
        `${baseUrl}/settings?discogs=error&reason=expired_token`,
      );
    }

    // -----------------------------------------------------------------------
    // 4. Exchange for permanent access token
    // -----------------------------------------------------------------------
    const consumerKey = (await getSiteConfig("discogs_consumer_key")) ?? process.env.DISCOGS_CONSUMER_KEY;
    const consumerSecret = (await getSiteConfig("discogs_consumer_secret")) ?? process.env.DISCOGS_CONSUMER_SECRET;

    if (!consumerKey || !consumerSecret) {
      return NextResponse.redirect(
        `${baseUrl}/settings?discogs=error&reason=missing_credentials`,
      );
    }
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(16).toString("hex");

    const accessResponse = await fetch(
      "https://api.discogs.com/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "VinylIQ/1.0",
          Authorization: [
            `OAuth oauth_consumer_key="${consumerKey}"`,
            `oauth_token="${oauthToken}"`,
            `oauth_verifier="${oauthVerifier}"`,
            `oauth_signature_method="PLAINTEXT"`,
            `oauth_signature="${encodeURIComponent(consumerSecret + "&" + tokenSecret)}"`,
            `oauth_timestamp="${timestamp}"`,
            `oauth_nonce="${nonce}"`,
          ].join(", "),
        },
      },
    );

    if (!accessResponse.ok) {
      console.error(
        "Discogs access token exchange failed:",
        accessResponse.status,
        await accessResponse.text().catch(() => ""),
      );
      return NextResponse.redirect(
        `${baseUrl}/settings?discogs=error&reason=exchange_failed`,
      );
    }

    const accessText = await accessResponse.text();
    const accessParams = new URLSearchParams(accessText);
    const accessToken = accessParams.get("oauth_token");
    const accessTokenSecret = accessParams.get("oauth_token_secret");

    if (!accessToken || !accessTokenSecret) {
      return NextResponse.redirect(
        `${baseUrl}/settings?discogs=error&reason=invalid_response`,
      );
    }

    // -----------------------------------------------------------------------
    // 5. Get Discogs identity (username)
    // -----------------------------------------------------------------------
    const identityTimestamp = Math.floor(Date.now() / 1000).toString();
    const identityNonce = randomBytes(16).toString("hex");

    const identityResponse = await fetch(
      "https://api.discogs.com/oauth/identity",
      {
        headers: {
          "User-Agent": "VinylIQ/1.0",
          Authorization: [
            `OAuth oauth_consumer_key="${consumerKey}"`,
            `oauth_token="${accessToken}"`,
            `oauth_signature_method="PLAINTEXT"`,
            `oauth_signature="${encodeURIComponent(consumerSecret + "&" + accessTokenSecret)}"`,
            `oauth_timestamp="${identityTimestamp}"`,
            `oauth_nonce="${identityNonce}"`,
          ].join(", "),
        },
      },
    );

    let discogsUsername: string | null = null;
    if (identityResponse.ok) {
      const identity = (await identityResponse.json()) as {
        username: string;
        id: number;
      };
      discogsUsername = identity.username;
    }

    // -----------------------------------------------------------------------
    // 6. Store tokens in user record
    // -----------------------------------------------------------------------
    await db
      .update(user)
      .set({
        discogsUsername,
        discogsAccessToken: accessToken,
        discogsAccessTokenSecret: accessTokenSecret,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id));

    return NextResponse.redirect(`${baseUrl}/settings?discogs=connected`);
  } catch (error) {
    console.error("Discogs OAuth callback error:", error);
    return NextResponse.redirect(
      `${baseUrl}/settings?discogs=error&reason=unknown`,
    );
  }
}
