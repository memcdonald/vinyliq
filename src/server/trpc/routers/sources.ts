import { z } from "zod";
import { eq, and, asc, sql } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db";
import { dataSources } from "@/server/db/schema";

export const sourcesRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(dataSources)
      .where(eq(dataSources.userId, ctx.userId))
      .orderBy(
        sql`CASE WHEN ${dataSources.priority} = 'core' THEN 0 ELSE 1 END`,
        asc(dataSources.sourceName),
      );
  }),

  bulkAddSources: protectedProcedure
    .input(
      z.object({
        sources: z
          .array(
            z.object({
              priority: z.string().min(1).max(200),
              sourceName: z.string().min(1).max(500),
              url: z.string().max(2000).optional(),
              category: z.string().max(500).optional(),
              pulseUse: z.string().max(2000).optional(),
              accessMethod: z.string().max(500).optional(),
              notes: z.string().max(2000).optional(),
            }),
          )
          .min(1)
          .max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const values = input.sources.map((s) => ({
        userId: ctx.userId,
        priority: s.priority,
        sourceName: s.sourceName,
        url: s.url ?? null,
        category: s.category ?? null,
        pulseUse: s.pulseUse ?? null,
        accessMethod: s.accessMethod ?? null,
        notes: s.notes ?? null,
      }));

      const inserted = await db
        .insert(dataSources)
        .values(values)
        .returning({ id: dataSources.id });

      return { count: inserted.length };
    }),

  updateSource: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        sourceName: z.string().min(1).max(500).optional(),
        url: z.string().max(2000).nullable().optional(),
        category: z.string().max(500).nullable().optional(),
        priority: z.string().min(1).max(200).optional(),
        pulseUse: z.string().max(2000).nullable().optional(),
        accessMethod: z.string().max(500).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const result = await db
        .update(dataSources)
        .set({ ...updates, updatedAt: new Date() })
        .where(
          and(eq(dataSources.id, id), eq(dataSources.userId, ctx.userId)),
        )
        .returning();
      return result[0] ?? null;
    }),

  removeSource: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await db
        .delete(dataSources)
        .where(
          and(eq(dataSources.id, input.id), eq(dataSources.userId, ctx.userId)),
        )
        .returning({ id: dataSources.id });

      return { success: deleted.length > 0 };
    }),
});
