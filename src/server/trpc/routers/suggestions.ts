import { z } from "zod";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db";
import { aiSuggestions } from "@/server/db/schema";
import { probeAllSources } from "@/server/services/suggestions/probe";

export const suggestionsRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["new", "dismissed", "interested"]).optional(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        })
        .optional()
        .default({ limit: 50, offset: 0 }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(aiSuggestions.userId, ctx.userId)];
      if (input.status) {
        conditions.push(eq(aiSuggestions.status, input.status));
      }

      const items = await db
        .select()
        .from(aiSuggestions)
        .where(and(...conditions))
        .orderBy(desc(aiSuggestions.combinedScore))
        .limit(input.limit)
        .offset(input.offset);

      return items;
    }),

  dismiss: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await db
        .update(aiSuggestions)
        .set({ status: "dismissed", updatedAt: new Date() })
        .where(
          and(
            eq(aiSuggestions.id, input.id),
            eq(aiSuggestions.userId, ctx.userId),
          ),
        )
        .returning({ id: aiSuggestions.id });

      return { success: updated.length > 0 };
    }),

  markInterested: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await db
        .update(aiSuggestions)
        .set({ status: "interested", updatedAt: new Date() })
        .where(
          and(
            eq(aiSuggestions.id, input.id),
            eq(aiSuggestions.userId, ctx.userId),
          ),
        )
        .returning({ id: aiSuggestions.id });

      return { success: updated.length > 0 };
    }),

  probe: protectedProcedure.mutation(async ({ ctx }) => {
    return probeAllSources(ctx.userId);
  }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const stats = await db
      .select({
        status: aiSuggestions.status,
        count: count(),
      })
      .from(aiSuggestions)
      .where(eq(aiSuggestions.userId, ctx.userId))
      .groupBy(aiSuggestions.status);

    const result = { new: 0, dismissed: 0, interested: 0, total: 0 };
    for (const row of stats) {
      const key = row.status as keyof typeof result;
      if (key in result) {
        result[key] = row.count;
      }
      result.total += row.count;
    }

    return result;
  }),
});
