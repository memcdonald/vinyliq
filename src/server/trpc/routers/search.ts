import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../init';
import { discogsClient } from '@/server/services/discogs';

export const searchRouter = createTRPCRouter({
  query: publicProcedure
    .input(
      z.object({
        q: z.string().min(1),
        type: z.enum(['release', 'master', 'artist']).optional(),
        page: z.number().int().positive().optional().default(1),
        perPage: z.number().int().positive().max(100).optional().default(25),
      }),
    )
    .query(async ({ input }) => {
      const response = await discogsClient.search({
        q: input.q,
        type: input.type,
        page: input.page,
        per_page: input.perPage,
      });

      return {
        pagination: {
          page: response.pagination.page,
          pages: response.pagination.pages,
          perPage: response.pagination.per_page,
          items: response.pagination.items,
        },
        results: response.results.map((result) => ({
          id: result.id,
          type: result.type,
          title: result.title,
          thumb: result.thumb,
          coverImage: result.cover_image,
          year: result.year,
          country: result.country,
          genre: result.genre ?? [],
          style: result.style ?? [],
          format: result.format ?? [],
          label: result.label ?? [],
          masterId: result.master_id ?? null,
        })),
      };
    }),
});
