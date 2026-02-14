import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../init';
import { getRecommendationGroups, generateRecommendations } from '@/server/recommendation/engine';

export const recommendationRouter = createTRPCRouter({
  /**
   * Get recommendation groups for the current user.
   * Returns grouped recommendations with album metadata.
   * Generates on-the-fly if none exist.
   */
  getGroups: protectedProcedure.query(async ({ ctx }) => {
    return getRecommendationGroups(ctx.userId);
  }),

  /**
   * Force-refresh recommendations for the current user.
   * Recomputes taste profile and runs all strategies.
   */
  refresh: protectedProcedure.mutation(async ({ ctx }) => {
    const results = await generateRecommendations(ctx.userId);
    return {
      count: results.length,
      message: `Generated ${results.length} recommendations`,
    };
  }),
});
