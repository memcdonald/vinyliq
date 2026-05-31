import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  sendCoachMessage,
  getCoachHistory,
  clearCoachHistory,
} from "@/server/services/ai/mahjong";
import { isAIConfiguredWithKeys } from "@/server/services/ai";
import { getUserApiKeys } from "@/server/services/ai/keys";
import { parseHand, tileLabel, handToNotation } from "@/lib/mahjong/tiles";
import { analyzeHand } from "@/lib/mahjong/shanten";

export const mahjongRouter = createTRPCRouter({
  // Pure offline analysis — no API key required.
  analyze: protectedProcedure
    .input(z.object({ hand: z.string().min(1).max(60) }))
    .query(({ input }) => {
      let counts: number[];
      try {
        counts = parseHand(input.hand);
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            e instanceof Error
              ? e.message
              : "Could not parse that hand notation.",
        });
      }

      const analysis = analyzeHand(counts);
      return {
        normalized: handToNotation(counts),
        size: analysis.size,
        shanten: analysis.shanten,
        complete: analysis.complete,
        acceptance: analysis.acceptance
          ? {
              count: analysis.acceptance.count,
              tiles: analysis.acceptance.tiles.map((t) => ({
                index: t,
                label: tileLabel(t),
              })),
            }
          : null,
        discards:
          analysis.discards?.slice(0, 8).map((d) => ({
            tile: d.tile,
            label: d.tileLabel,
            shanten: d.shanten,
            ukeire: d.ukeire,
            acceptedTiles: d.acceptedTiles.map((t) => ({
              index: t,
              label: tileLabel(t),
            })),
          })) ?? null,
      };
    }),

  sendMessage: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1).max(4000),
        hand: z.string().max(60).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const keys = await getUserApiKeys(ctx.userId);
      if (!isAIConfiguredWithKeys(keys)) {
        return {
          content:
            "AI is not configured. Please add an API key on the Credentials page. (Hand analysis still works without a key.)",
        };
      }
      return sendCoachMessage(ctx.userId, input.message, input.hand ?? null);
    }),

  getHistory: protectedProcedure.query(async ({ ctx }) => {
    return getCoachHistory(ctx.userId);
  }),

  clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
    await clearCoachHistory(ctx.userId);
    return { success: true };
  }),
});
