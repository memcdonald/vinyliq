import { z } from "zod";
import { randomBytes } from "crypto";
import { eq, and, sql } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";
import { db } from "@/server/db";
import { sharedLinks, albums, collectionItems, user } from "@/server/db/schema";

export const shareRouter = createTRPCRouter({
  createLink: protectedProcedure
    .input(
      z.object({
        type: z.enum(["album", "wantlist"]),
        albumId: z.string().uuid().optional(),
        expiresInDays: z.number().int().min(1).max(365).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const token = randomBytes(16).toString("base64url");

      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      const [link] = await db
        .insert(sharedLinks)
        .values({
          userId: ctx.userId,
          token,
          type: input.type,
          albumId: input.albumId ?? null,
          expiresAt,
        })
        .returning();

      return {
        id: link.id,
        token: link.token,
        type: link.type,
      };
    }),

  getMyLinks: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: sharedLinks.id,
        token: sharedLinks.token,
        type: sharedLinks.type,
        albumId: sharedLinks.albumId,
        expiresAt: sharedLinks.expiresAt,
        viewCount: sharedLinks.viewCount,
        createdAt: sharedLinks.createdAt,
      })
      .from(sharedLinks)
      .where(eq(sharedLinks.userId, ctx.userId));
  }),

  revokeLink: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await db
        .delete(sharedLinks)
        .where(
          and(eq(sharedLinks.id, input.id), eq(sharedLinks.userId, ctx.userId)),
        )
        .returning({ id: sharedLinks.id });

      return { success: deleted.length > 0 };
    }),

  resolveLink: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const [link] = await db
        .select()
        .from(sharedLinks)
        .where(eq(sharedLinks.token, input.token))
        .limit(1);

      if (!link) {
        return { found: false as const };
      }

      // Check expiry
      if (link.expiresAt && link.expiresAt < new Date()) {
        return { found: false as const };
      }

      // Increment view count
      await db
        .update(sharedLinks)
        .set({ viewCount: sql`${sharedLinks.viewCount} + 1` })
        .where(eq(sharedLinks.id, link.id));

      // Get user name for display
      const [owner] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, link.userId))
        .limit(1);

      if (link.type === "album" && link.albumId) {
        const [album] = await db
          .select()
          .from(albums)
          .where(eq(albums.id, link.albumId))
          .limit(1);

        if (!album) return { found: false as const };

        return {
          found: true as const,
          type: "album" as const,
          ownerName: owner?.name ?? "A VinylIQ user",
          album: {
            id: album.id,
            title: album.title,
            year: album.year,
            thumb: album.thumb,
            coverImage: album.coverImage,
            genres: album.genres ?? [],
            styles: album.styles ?? [],
            communityHave: album.communityHave,
            communityWant: album.communityWant,
            communityRating: album.communityRating,
          },
        };
      }

      if (link.type === "wantlist") {
        const items = await db
          .select({
            id: collectionItems.id,
            title: albums.title,
            thumb: albums.thumb,
            coverImage: albums.coverImage,
            year: albums.year,
            genres: albums.genres,
            discogsId: albums.discogsId,
            discogsMasterId: albums.discogsMasterId,
          })
          .from(collectionItems)
          .innerJoin(albums, eq(collectionItems.albumId, albums.id))
          .where(
            and(
              eq(collectionItems.userId, link.userId),
              eq(collectionItems.status, "wanted"),
            ),
          );

        return {
          found: true as const,
          type: "wantlist" as const,
          ownerName: owner?.name ?? "A VinylIQ user",
          items: items.map((item) => ({
            id: item.id,
            title: item.title,
            thumb: item.thumb,
            coverImage: item.coverImage,
            year: item.year,
            genres: item.genres ?? [],
            discogsId: item.discogsId,
            discogsMasterId: item.discogsMasterId,
          })),
        };
      }

      return { found: false as const };
    }),
});
