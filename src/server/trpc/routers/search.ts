import { z } from 'zod';
import { ilike, or, sql } from 'drizzle-orm';
import { createTRPCRouter, publicProcedure } from '../init';
import { discogsClient } from '@/server/services/discogs';
import { db } from '@/server/db';
import { albums } from '@/server/db/schema';

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

  /**
   * Search local DB albums using ILIKE pattern matching.
   * Searches title field. Falls back gracefully if no local results found.
   */
  local: publicProcedure
    .input(
      z.object({
        q: z.string().min(1),
        limit: z.number().int().positive().max(50).optional().default(20),
      }),
    )
    .query(async ({ input }) => {
      const pattern = `%${input.q}%`;

      const results = await db
        .select({
          id: albums.id,
          discogsId: albums.discogsId,
          discogsMasterId: albums.discogsMasterId,
          title: albums.title,
          thumb: albums.thumb,
          coverImage: albums.coverImage,
          year: albums.year,
          genres: albums.genres,
          styles: albums.styles,
          country: albums.country,
        })
        .from(albums)
        .where(ilike(albums.title, pattern))
        .limit(input.limit);

      return results.map((album) => ({
        id: album.discogsId ?? 0,
        type: album.discogsMasterId ? 'master' : ('release' as string),
        title: album.title,
        thumb: album.thumb ?? '',
        coverImage: album.coverImage ?? '',
        year: album.year ? String(album.year) : '',
        country: album.country ?? '',
        genre: album.genres ?? [],
        style: album.styles ?? [],
        format: [] as string[],
        label: [] as string[],
        masterId: album.discogsMasterId ?? null,
      }));
    }),
});
