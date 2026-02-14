import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../init';

const collectionStatus = z.enum(['owned', 'wanted', 'listened']);

export const collectionRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    // TODO: Query database for user's collection items
    const _userId = ctx.userId;
    return {
      items: [] as {
        id: string;
        albumId: string;
        title: string;
        artist: string;
        coverImage: string | null;
        status: 'owned' | 'wanted' | 'listened';
        rating: number | null;
        notes: string | null;
        addedAt: Date;
      }[],
    };
  }),

  add: protectedProcedure
    .input(
      z.object({
        albumId: z.string(),
        status: collectionStatus,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Insert into database
      const _userId = ctx.userId;
      return {
        id: crypto.randomUUID(),
        albumId: input.albumId,
        status: input.status,
        addedAt: new Date(),
      };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Delete from database, verify ownership
      const _userId = ctx.userId;
      return { success: true, id: input.id };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: collectionStatus,
        rating: z.number().int().min(1).max(5).optional(),
        notes: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Update in database, verify ownership
      const _userId = ctx.userId;
      return {
        id: input.id,
        status: input.status,
        rating: input.rating ?? null,
        notes: input.notes ?? null,
        updatedAt: new Date(),
      };
    }),
});
