import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";
import { db } from "@/server/db";
import { aiEvaluations, albums, collectionItems, user } from "@/server/db/schema";
import { getAIProvider, isAIConfigured } from "@/server/services/ai";
import { getTasteProfile, topN } from "@/server/recommendation/taste-profile";
import type { AlbumEvaluationInput } from "@/server/services/ai";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const aiRouter = createTRPCRouter({
  isConfigured: publicProcedure.query(() => {
    return { configured: isAIConfigured() };
  }),

  evaluateAlbum: protectedProcedure
    .input(z.object({ albumId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check cache first
      const [cached] = await db
        .select()
        .from(aiEvaluations)
        .where(
          and(
            eq(aiEvaluations.userId, ctx.userId),
            eq(aiEvaluations.albumId, input.albumId),
          ),
        )
        .limit(1);

      if (cached) {
        const age = Date.now() - cached.createdAt.getTime();
        if (age < CACHE_TTL_MS) {
          return {
            evaluation: cached.evaluation,
            score: cached.score,
            highlights: cached.highlights as string[],
            concerns: cached.concerns as string[],
            cached: true,
          };
        }
      }

      // Get user's preferred provider
      const [userRow] = await db
        .select({ preferredAiProvider: user.preferredAiProvider })
        .from(user)
        .where(eq(user.id, ctx.userId));

      // Get AI provider
      const provider = getAIProvider(userRow?.preferredAiProvider);
      if (!provider) {
        throw new Error("No AI provider configured");
      }

      // Fetch album data
      const [album] = await db
        .select()
        .from(albums)
        .where(eq(albums.id, input.albumId))
        .limit(1);

      if (!album) {
        throw new Error("Album not found");
      }

      // Get user's taste profile
      const profile = await getTasteProfile(ctx.userId);

      // Get top-rated albums
      const topRated = await db
        .select({
          title: albums.title,
          rating: collectionItems.rating,
        })
        .from(collectionItems)
        .innerJoin(albums, eq(collectionItems.albumId, albums.id))
        .where(eq(collectionItems.userId, ctx.userId))
        .orderBy(desc(collectionItems.rating))
        .limit(5);

      // Get recently added albums
      const recent = await db
        .select({
          title: albums.title,
        })
        .from(collectionItems)
        .innerJoin(albums, eq(collectionItems.albumId, albums.id))
        .where(eq(collectionItems.userId, ctx.userId))
        .orderBy(desc(collectionItems.addedAt))
        .limit(5);

      const evaluationInput: AlbumEvaluationInput = {
        title: album.title,
        artistName: album.title, // We'll use title as fallback
        year: album.year,
        genres: album.genres ?? [],
        styles: album.styles ?? [],
        communityRating: album.communityRating,
        communityHave: album.communityHave,
        communityWant: album.communityWant,
        topRatedAlbums: topRated
          .filter((a) => a.rating !== null)
          .map((a) => ({ title: a.title, rating: a.rating! })),
        recentAlbums: recent.map((a) => ({ title: a.title })),
        tasteProfile: {
          topGenres: topN(profile.genreWeights, 5),
          topStyles: topN(profile.styleWeights, 5),
          topEras: topN(profile.eraWeights, 5),
        },
      };

      const result = await provider.evaluate(evaluationInput);

      // Determine provider name
      const providerName = process.env.AI_PROVIDER === "openai" ? "openai" : "claude";

      // Upsert cache
      if (cached) {
        await db
          .update(aiEvaluations)
          .set({
            provider: providerName,
            evaluation: result.evaluation,
            score: result.score,
            highlights: result.highlights,
            concerns: result.concerns,
            createdAt: new Date(),
          })
          .where(eq(aiEvaluations.id, cached.id));
      } else {
        await db.insert(aiEvaluations).values({
          userId: ctx.userId,
          albumId: input.albumId,
          provider: providerName,
          evaluation: result.evaluation,
          score: result.score,
          highlights: result.highlights,
          concerns: result.concerns,
        });
      }

      return {
        ...result,
        cached: false,
      };
    }),
});
