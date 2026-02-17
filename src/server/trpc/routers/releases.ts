import { z } from "zod";
import { eq, ne, and, desc, asc } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db";
import { releaseSources, upcomingReleases } from "@/server/db/schema";
import { fetchSource as fetchSourceService, fetchAllSources as fetchAllSourcesService } from "@/server/services/releases";
import { computeCollectabilityForRelease } from "@/server/services/releases";
import { scoreCollectabilityWithAI } from "@/server/services/releases/ai-collectability";
import { getUserApiKeys } from "@/server/services/ai/keys";

const sourceType = z.enum(["url", "rss", "manual"]);
const releaseStatus = z.enum(["upcoming", "released", "archived"]);

export const releasesRouter = createTRPCRouter({
  getSources: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(releaseSources)
      .where(eq(releaseSources.userId, ctx.userId))
      .orderBy(desc(releaseSources.createdAt));
  }),

  addSource: protectedProcedure
    .input(
      z.object({
        type: sourceType,
        name: z.string().min(1).max(200),
        url: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [source] = await db
        .insert(releaseSources)
        .values({
          userId: ctx.userId,
          type: input.type,
          name: input.name,
          url: input.url ?? null,
        })
        .returning();
      return source;
    }),

  updateSource: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        url: z.string().url().optional(),
        enabled: z.boolean().optional(),
        fetchIntervalHours: z.number().int().min(1).max(168).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.url !== undefined) updateData.url = input.url;
      if (input.enabled !== undefined) updateData.enabled = input.enabled;
      if (input.fetchIntervalHours !== undefined) updateData.fetchIntervalHours = input.fetchIntervalHours;

      const [updated] = await db
        .update(releaseSources)
        .set(updateData)
        .where(
          and(eq(releaseSources.id, input.id), eq(releaseSources.userId, ctx.userId)),
        )
        .returning();
      return updated;
    }),

  removeSource: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Delete associated releases first
      await db
        .delete(upcomingReleases)
        .where(
          and(
            eq(upcomingReleases.sourceId, input.id),
            eq(upcomingReleases.userId, ctx.userId),
          ),
        );

      const deleted = await db
        .delete(releaseSources)
        .where(
          and(eq(releaseSources.id, input.id), eq(releaseSources.userId, ctx.userId)),
        )
        .returning({ id: releaseSources.id });

      return { success: deleted.length > 0 };
    }),

  getUpcoming: protectedProcedure
    .input(
      z
        .object({
          status: releaseStatus.optional(),
          sortBy: z.enum(["date", "collectability", "title", "artist"]).optional(),
          sortOrder: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(upcomingReleases.userId, ctx.userId),
        ne(upcomingReleases.artistName, "Unknown Artist"),
      ];
      if (input?.status) {
        conditions.push(eq(upcomingReleases.status, input.status));
      }

      let orderBy;
      const sortOrder = input?.sortOrder === "asc" ? asc : desc;
      switch (input?.sortBy) {
        case "collectability":
          orderBy = sortOrder(upcomingReleases.collectabilityScore);
          break;
        case "title":
          orderBy = sortOrder(upcomingReleases.title);
          break;
        case "artist":
          orderBy = sortOrder(upcomingReleases.artistName);
          break;
        default:
          orderBy = desc(upcomingReleases.releaseDate);
      }

      const rows = await db
        .select({
          id: upcomingReleases.id,
          title: upcomingReleases.title,
          artistName: upcomingReleases.artistName,
          labelName: upcomingReleases.labelName,
          releaseDate: upcomingReleases.releaseDate,
          coverImage: upcomingReleases.coverImage,
          description: upcomingReleases.description,
          orderUrl: upcomingReleases.orderUrl,
          pressRun: upcomingReleases.pressRun,
          coloredVinyl: upcomingReleases.coloredVinyl,
          numbered: upcomingReleases.numbered,
          specialPackaging: upcomingReleases.specialPackaging,
          collectabilityScore: upcomingReleases.collectabilityScore,
          collectabilityExplanation: upcomingReleases.collectabilityExplanation,
          status: upcomingReleases.status,
          createdAt: upcomingReleases.createdAt,
          sourceName: releaseSources.name,
          sourceType: releaseSources.type,
        })
        .from(upcomingReleases)
        .leftJoin(releaseSources, eq(upcomingReleases.sourceId, releaseSources.id))
        .where(and(...conditions))
        .orderBy(orderBy);

      return { items: rows };
    }),

  addManualRelease: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        artistName: z.string().min(1).max(500),
        labelName: z.string().max(500).optional(),
        releaseDate: z.date().optional(),
        coverImage: z.string().url().optional(),
        description: z.string().max(2000).optional(),
        orderUrl: z.string().url().optional(),
        pressRun: z.number().int().min(1).optional(),
        coloredVinyl: z.boolean().optional(),
        numbered: z.boolean().optional(),
        specialPackaging: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const collectability = computeCollectabilityForRelease({
        pressRun: input.pressRun ?? null,
        coloredVinyl: input.coloredVinyl ?? false,
        numbered: input.numbered ?? false,
        specialPackaging: input.specialPackaging ?? null,
      });

      const [release] = await db
        .insert(upcomingReleases)
        .values({
          userId: ctx.userId,
          title: input.title,
          artistName: input.artistName,
          labelName: input.labelName ?? null,
          releaseDate: input.releaseDate ?? null,
          coverImage: input.coverImage ?? null,
          description: input.description ?? null,
          orderUrl: input.orderUrl ?? null,
          pressRun: input.pressRun ?? null,
          coloredVinyl: input.coloredVinyl ?? false,
          numbered: input.numbered ?? false,
          specialPackaging: input.specialPackaging ?? null,
          collectabilityScore: collectability.score,
          collectabilityExplanation: collectability.explanation,
          status: "upcoming",
        })
        .returning();

      return release;
    }),

  updateRelease: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        artistName: z.string().min(1).max(500).optional(),
        labelName: z.string().max(500).optional(),
        releaseDate: z.date().optional(),
        status: releaseStatus.optional(),
        orderUrl: z.string().url().optional(),
        pressRun: z.number().int().min(1).optional(),
        coloredVinyl: z.boolean().optional(),
        numbered: z.boolean().optional(),
        specialPackaging: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) updateData[key] = value;
      }

      const [updated] = await db
        .update(upcomingReleases)
        .set(updateData)
        .where(
          and(eq(upcomingReleases.id, id), eq(upcomingReleases.userId, ctx.userId)),
        )
        .returning();

      return updated;
    }),

  removeRelease: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await db
        .delete(upcomingReleases)
        .where(
          and(eq(upcomingReleases.id, input.id), eq(upcomingReleases.userId, ctx.userId)),
        )
        .returning({ id: upcomingReleases.id });

      return { success: deleted.length > 0 };
    }),

  fetchSource: protectedProcedure
    .input(z.object({ sourceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [source] = await db
        .select()
        .from(releaseSources)
        .where(
          and(eq(releaseSources.id, input.sourceId), eq(releaseSources.userId, ctx.userId)),
        )
        .limit(1);

      if (!source) {
        throw new Error("Source not found");
      }

      return fetchSourceService(source, ctx.userId);
    }),

  fetchAllSources: protectedProcedure.mutation(async ({ ctx }) => {
    return fetchAllSourcesService(ctx.userId);
  }),

  bulkAddReleases: protectedProcedure
    .input(
      z.object({
        releases: z
          .array(
            z.object({
              title: z.string().min(1).max(500),
              artistName: z.string().min(1).max(500),
              labelName: z.string().max(500).optional(),
              releaseDate: z.date().optional(),
              orderUrl: z.string().url().optional(),
              pressRun: z.number().int().min(1).optional(),
              coloredVinyl: z.boolean().optional(),
              numbered: z.boolean().optional(),
              specialPackaging: z.string().max(500).optional(),
            }),
          )
          .min(1)
          .max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const values = input.releases.map((r) => {
        const collectability = computeCollectabilityForRelease({
          pressRun: r.pressRun ?? null,
          coloredVinyl: r.coloredVinyl ?? false,
          numbered: r.numbered ?? false,
          specialPackaging: r.specialPackaging ?? null,
        });

        return {
          userId: ctx.userId,
          title: r.title,
          artistName: r.artistName,
          labelName: r.labelName ?? null,
          releaseDate: r.releaseDate ?? null,
          coverImage: null,
          description: null,
          orderUrl: r.orderUrl ?? null,
          pressRun: r.pressRun ?? null,
          coloredVinyl: r.coloredVinyl ?? false,
          numbered: r.numbered ?? false,
          specialPackaging: r.specialPackaging ?? null,
          collectabilityScore: collectability.score,
          collectabilityExplanation: collectability.explanation,
          status: "upcoming" as const,
        };
      });

      const inserted = await db
        .insert(upcomingReleases)
        .values(values)
        .returning({ id: upcomingReleases.id });

      return { count: inserted.length };
    }),

  getCollectability: protectedProcedure
    .input(z.object({ releaseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [release] = await db
        .select()
        .from(upcomingReleases)
        .where(
          and(
            eq(upcomingReleases.id, input.releaseId),
            eq(upcomingReleases.userId, ctx.userId),
          ),
        )
        .limit(1);

      if (!release) return null;

      const result = computeCollectabilityForRelease(release);

      // Update stored score
      await db
        .update(upcomingReleases)
        .set({
          collectabilityScore: result.score,
          collectabilityExplanation: result.explanation,
          updatedAt: new Date(),
        })
        .where(eq(upcomingReleases.id, input.releaseId));

      return result;
    }),

  aiScoreRelease: protectedProcedure
    .input(z.object({ releaseId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [release] = await db
        .select()
        .from(upcomingReleases)
        .where(
          and(
            eq(upcomingReleases.id, input.releaseId),
            eq(upcomingReleases.userId, ctx.userId),
          ),
        )
        .limit(1);

      if (!release) throw new Error("Release not found");

      const keys = await getUserApiKeys(ctx.userId);
      const heuristic = computeCollectabilityForRelease(release);

      const aiResult = await scoreCollectabilityWithAI(
        {
          title: release.title,
          artistName: release.artistName,
          labelName: release.labelName,
          description: release.description,
          pressRun: release.pressRun,
          coloredVinyl: release.coloredVinyl,
          specialPackaging: release.specialPackaging,
          heuristicScore: heuristic.score,
        },
        keys,
      );

      if (!aiResult) {
        throw new Error("AI scoring failed. Check your API keys on the Credentials page.");
      }

      await db
        .update(upcomingReleases)
        .set({
          collectabilityScore: aiResult.score,
          collectabilityExplanation: aiResult.explanation,
          updatedAt: new Date(),
        })
        .where(eq(upcomingReleases.id, input.releaseId));

      return aiResult;
    }),
});
