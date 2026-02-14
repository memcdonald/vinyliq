import { z } from "zod";
import { eq, and, sql, count } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db";
import { albums, collectionItems } from "@/server/db/schema";

const collectionStatus = z.enum(["owned", "wanted", "listened"]);

export const collectionRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(
      z
        .object({
          status: collectionStatus.optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;

      const conditions = [eq(collectionItems.userId, userId)];
      if (input?.status) {
        conditions.push(eq(collectionItems.status, input.status));
      }

      const rows = await db
        .select({
          id: collectionItems.id,
          albumId: collectionItems.albumId,
          status: collectionItems.status,
          rating: collectionItems.rating,
          notes: collectionItems.notes,
          addedAt: collectionItems.addedAt,
          title: albums.title,
          thumb: albums.thumb,
          coverImage: albums.coverImage,
          year: albums.year,
          genres: albums.genres,
          styles: albums.styles,
          discogsId: albums.discogsId,
          discogsMasterId: albums.discogsMasterId,
        })
        .from(collectionItems)
        .innerJoin(albums, eq(collectionItems.albumId, albums.id))
        .where(and(...conditions));

      return {
        items: rows.map((row) => ({
          id: row.id,
          albumId: row.albumId,
          title: row.title,
          thumb: row.thumb,
          coverImage: row.coverImage,
          year: row.year,
          genres: row.genres ?? [],
          styles: row.styles ?? [],
          status: row.status as "owned" | "wanted" | "listened",
          rating: row.rating,
          notes: row.notes,
          addedAt: row.addedAt,
          discogsId: row.discogsId,
          discogsMasterId: row.discogsMasterId,
        })),
      };
    }),

  add: protectedProcedure
    .input(
      z.object({
        discogsId: z.number(),
        discogsMasterId: z.number().optional(),
        title: z.string(),
        thumb: z.string().optional(),
        year: z.number().optional(),
        genres: z.array(z.string()).optional(),
        styles: z.array(z.string()).optional(),
        coverImage: z.string().optional(),
        status: collectionStatus,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;

      // Upsert the album record so it exists in our DB
      const [album] = await db
        .insert(albums)
        .values({
          discogsId: input.discogsId,
          discogsMasterId: input.discogsMasterId ?? null,
          title: input.title,
          thumb: input.thumb ?? null,
          year: input.year ?? null,
          genres: input.genres ?? [],
          styles: input.styles ?? [],
          coverImage: input.coverImage ?? null,
        })
        .onConflictDoUpdate({
          target: albums.discogsId,
          set: {
            title: input.title,
            thumb: input.thumb ?? null,
            year: input.year ?? null,
            genres: input.genres ?? [],
            styles: input.styles ?? [],
            coverImage: input.coverImage ?? null,
            discogsMasterId: input.discogsMasterId ?? null,
          },
        })
        .returning({ id: albums.id });

      // Upsert the collection item (conflict on userId+albumId)
      const [item] = await db
        .insert(collectionItems)
        .values({
          userId,
          albumId: album.id,
          status: input.status,
        })
        .onConflictDoUpdate({
          target: [collectionItems.userId, collectionItems.albumId],
          set: {
            status: input.status,
          },
        })
        .returning();

      return {
        id: item.id,
        albumId: item.albumId,
        status: item.status,
        addedAt: item.addedAt,
      };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;

      const deleted = await db
        .delete(collectionItems)
        .where(
          and(eq(collectionItems.id, input.id), eq(collectionItems.userId, userId)),
        )
        .returning({ id: collectionItems.id });

      return {
        success: deleted.length > 0,
        id: input.id,
      };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: collectionStatus.optional(),
        rating: z.number().int().min(1).max(5).optional(),
        notes: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;

      const updateData: Record<string, unknown> = {};
      if (input.status !== undefined) updateData.status = input.status;
      if (input.rating !== undefined) updateData.rating = input.rating;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const [updated] = await db
        .update(collectionItems)
        .set(updateData)
        .where(
          and(eq(collectionItems.id, input.id), eq(collectionItems.userId, userId)),
        )
        .returning();

      return {
        id: updated.id,
        status: updated.status,
        rating: updated.rating,
        notes: updated.notes,
      };
    }),

  getItemByAlbumId: protectedProcedure
    .input(z.object({ albumId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;

      const [item] = await db
        .select()
        .from(collectionItems)
        .where(
          and(
            eq(collectionItems.userId, userId),
            eq(collectionItems.albumId, input.albumId),
          ),
        )
        .limit(1);

      return item ?? null;
    }),

  /**
   * Get aggregate collection statistics.
   */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId;

    // Get all collection items with album data
    const items = await db
      .select({
        status: collectionItems.status,
        rating: collectionItems.rating,
        genres: albums.genres,
        styles: albums.styles,
        year: albums.year,
      })
      .from(collectionItems)
      .innerJoin(albums, eq(collectionItems.albumId, albums.id))
      .where(eq(collectionItems.userId, userId));

    const totalAlbums = items.length;
    const owned = items.filter((i) => i.status === 'owned').length;
    const wanted = items.filter((i) => i.status === 'wanted').length;
    const listened = items.filter((i) => i.status === 'listened').length;

    // Ratings
    const rated = items.filter((i) => i.rating !== null);
    const avgRating = rated.length > 0
      ? rated.reduce((sum, i) => sum + (i.rating ?? 0), 0) / rated.length
      : null;

    // Genre distribution
    const genreCounts: Record<string, number> = {};
    for (const item of items) {
      for (const genre of item.genres ?? []) {
        genreCounts[genre] = (genreCounts[genre] ?? 0) + 1;
      }
    }
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([genre, count]) => ({ genre, count }));

    // Decade distribution
    const decadeCounts: Record<string, number> = {};
    for (const item of items) {
      if (item.year && item.year > 1900) {
        const decade = `${Math.floor(item.year / 10) * 10}s`;
        decadeCounts[decade] = (decadeCounts[decade] ?? 0) + 1;
      }
    }
    const topDecades = Object.entries(decadeCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([decade, count]) => ({ decade, count }));

    // Style distribution
    const styleCounts: Record<string, number> = {};
    for (const item of items) {
      for (const style of item.styles ?? []) {
        styleCounts[style] = (styleCounts[style] ?? 0) + 1;
      }
    }
    const topStyles = Object.entries(styleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([style, count]) => ({ style, count }));

    return {
      totalAlbums,
      owned,
      wanted,
      listened,
      rated: rated.length,
      avgRating,
      topGenres,
      topDecades,
      topStyles,
    };
  }),
});
