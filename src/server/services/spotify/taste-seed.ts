/**
 * Spotify taste seeding.
 *
 * After a user connects Spotify, we pull their top artists (across multiple
 * time ranges) to build an immediate, rich taste profile — rather than
 * waiting for them to rate albums one by one.
 *
 * Artist-level genres from Spotify are the most reliable genre signal
 * (album-level genres are often empty).
 */

import { db } from "@/server/db";
import { user, userTasteProfiles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { spotifyClient } from "./client";
import { refreshSpotifyToken } from "./auth";
import type { SpotifyArtist, SpotifyTimeRange } from "./types";

interface SpotifyTasteSeed {
  topArtists: string[];
  genreWeights: Record<string, number>;
  artistWeights: Record<string, number>;
}

/**
 * Fetch the user's top artists from Spotify and extract genre/artist signals.
 *
 * Combines short-term (recent obsessions), medium-term (steady rotation),
 * and long-term (all-time favorites) with different weights.
 */
export async function fetchSpotifyTasteSeed(
  userId: string,
): Promise<SpotifyTasteSeed | null> {
  // Get the user's Spotify tokens
  const [u] = await db
    .select({
      spotifyAccessToken: user.spotifyAccessToken,
      spotifyRefreshToken: user.spotifyRefreshToken,
      spotifyTokenExpiresAt: user.spotifyTokenExpiresAt,
    })
    .from(user)
    .where(eq(user.id, userId));

  if (!u?.spotifyAccessToken || !u?.spotifyRefreshToken) {
    return null;
  }

  let token = u.spotifyAccessToken;

  // Refresh token if expired
  if (u.spotifyTokenExpiresAt && u.spotifyTokenExpiresAt < new Date()) {
    try {
      const newTokens = await refreshSpotifyToken(u.spotifyRefreshToken);
      token = newTokens.access_token;

      await db
        .update(user)
        .set({
          spotifyAccessToken: newTokens.access_token,
          spotifyRefreshToken: newTokens.refresh_token ?? u.spotifyRefreshToken,
          spotifyTokenExpiresAt: new Date(
            Date.now() + newTokens.expires_in * 1000,
          ),
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));
    } catch {
      console.error("[SpotifyTaste] Token refresh failed");
      return null;
    }
  }

  // Fetch top artists across all three time ranges
  const timeWeights: [SpotifyTimeRange, number][] = [
    ["short_term", 1.5], // Recent obsessions get a boost
    ["medium_term", 1.0], // Steady rotation
    ["long_term", 0.7], // All-time classics
  ];

  const allArtists: { artist: SpotifyArtist; weight: number }[] = [];

  for (const [range, weight] of timeWeights) {
    try {
      const page = await spotifyClient.getUserTopArtists(token, range, 50);
      // Position-weighted: #1 artist gets full weight, #50 gets ~2% weight
      for (let i = 0; i < page.items.length; i++) {
        const positionWeight = 1 - i / page.items.length;
        allArtists.push({
          artist: page.items[i],
          weight: weight * positionWeight,
        });
      }
    } catch (err) {
      console.error(
        `[SpotifyTaste] Failed to fetch top artists (${range}):`,
        err,
      );
    }
  }

  if (allArtists.length === 0) {
    return null;
  }

  // Aggregate genre weights from all artists
  const genreWeights: Record<string, number> = {};
  const artistWeights: Record<string, number> = {};
  const topArtistNames: string[] = [];

  for (const { artist, weight } of allArtists) {
    // Artist weight (deduplicate across time ranges by taking max)
    artistWeights[artist.name] = Math.max(
      artistWeights[artist.name] ?? 0,
      weight,
    );

    // Genre weights (each genre from the artist gets the artist's weight)
    for (const genre of artist.genres) {
      genreWeights[genre] = (genreWeights[genre] ?? 0) + weight;
    }
  }

  // Normalize genre weights to sum to 1.0
  const genreTotal = Object.values(genreWeights).reduce((s, w) => s + w, 0);
  if (genreTotal > 0) {
    for (const key of Object.keys(genreWeights)) {
      genreWeights[key] = genreWeights[key] / genreTotal;
    }
  }

  // Normalize artist weights
  const artistTotal = Object.values(artistWeights).reduce((s, w) => s + w, 0);
  if (artistTotal > 0) {
    for (const key of Object.keys(artistWeights)) {
      artistWeights[key] = artistWeights[key] / artistTotal;
    }
  }

  // Top 20 artists for display
  const sorted = Object.entries(artistWeights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  for (const [name] of sorted) {
    topArtistNames.push(name);
  }

  return { topArtists: topArtistNames, genreWeights, artistWeights };
}

/**
 * Seed or enrich the user's taste profile using Spotify listening data.
 *
 * If the user already has a taste profile from their collection, the Spotify
 * signals are blended in (50/50). If they have NO collection, Spotify data
 * becomes the entire profile — instant taste intelligence from day one.
 */
export async function seedTasteFromSpotify(userId: string): Promise<void> {
  const seed = await fetchSpotifyTasteSeed(userId);
  if (!seed) return;

  const [existing] = await db
    .select()
    .from(userTasteProfiles)
    .where(eq(userTasteProfiles.userId, userId))
    .limit(1);

  if (existing) {
    // Blend: 50% existing collection profile + 50% Spotify listening data
    const blendedGenres = blendWeights(
      (existing.genreWeights as Record<string, number>) ?? {},
      seed.genreWeights,
      0.5,
    );
    const blendedArtists = blendWeights(
      (existing.artistWeights as Record<string, number>) ?? {},
      seed.artistWeights,
      0.5,
    );

    await db
      .update(userTasteProfiles)
      .set({
        genreWeights: blendedGenres,
        artistWeights: blendedArtists,
        computedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userTasteProfiles.userId, userId));
  } else {
    // No existing profile — Spotify data IS the profile
    await db.insert(userTasteProfiles).values({
      userId,
      genreWeights: seed.genreWeights,
      styleWeights: {},
      eraWeights: {},
      labelWeights: {},
      artistWeights: seed.artistWeights,
      computedAt: new Date(),
    });
  }
}

/** Blend two weight maps: result = existingWeight * (1-spotifyFraction) + spotifyWeight * spotifyFraction */
function blendWeights(
  existing: Record<string, number>,
  spotify: Record<string, number>,
  spotifyFraction: number,
): Record<string, number> {
  const result: Record<string, number> = {};
  const allKeys = new Set([
    ...Object.keys(existing),
    ...Object.keys(spotify),
  ]);

  for (const key of allKeys) {
    const e = existing[key] ?? 0;
    const s = spotify[key] ?? 0;
    result[key] = e * (1 - spotifyFraction) + s * spotifyFraction;
  }

  // Normalize
  const total = Object.values(result).reduce((sum, w) => sum + w, 0);
  if (total > 0) {
    for (const key of Object.keys(result)) {
      result[key] = result[key] / total;
    }
  }

  return result;
}
