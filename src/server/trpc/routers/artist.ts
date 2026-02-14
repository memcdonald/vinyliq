import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../init';
import { discogsClient } from '@/server/services/discogs';
import { cached, CacheTTL } from '@/lib/cache';
import { musicBrainzClient } from '@/server/services/musicbrainz';

export const artistRouter = createTRPCRouter({
  getByDiscogsId: publicProcedure
    .input(z.object({ discogsId: z.number() }))
    .query(async ({ input }) => {
      const artist = await discogsClient.getArtist(input.discogsId);
      return {
        id: artist.id,
        name: artist.name,
        realName: artist.realname ?? null,
        profile: artist.profile ?? null,
        images: artist.images ?? [],
        urls: artist.urls ?? [],
        members: (artist.members ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          active: m.active,
        })),
        groups: (artist.groups ?? []).map((g) => ({
          id: g.id,
          name: g.name,
          active: g.active,
        })),
      };
    }),

  getReleases: publicProcedure
    .input(
      z.object({
        discogsId: z.number(),
        page: z.number().optional().default(1),
      }),
    )
    .query(async ({ input }) => {
      const data = await discogsClient.getArtistReleases(
        input.discogsId,
        input.page,
        50,
        'year',
        'desc',
      );

      return {
        pagination: {
          page: data.pagination.page,
          pages: data.pagination.pages,
          items: data.pagination.items,
        },
        releases: data.releases.map((r) => ({
          id: r.id,
          title: r.title,
          type: r.type,
          mainRelease: r.main_release ?? null,
          role: r.role,
          year: r.year,
          thumb: r.thumb,
          format: r.format ?? null,
          label: r.label ?? null,
        })),
      };
    }),

  getRelatedArtists: publicProcedure
    .input(z.object({ musicbrainzId: z.string() }))
    .query(async ({ input }) => {
      try {
        const relations = await cached(
          `mb:artist-rels:${input.musicbrainzId}`,
          () => musicBrainzClient.getArtistRelations(input.musicbrainzId),
          CacheTTL.LONG,
        );

        return relations
          .filter((r) => r.artist && r.artist.id !== input.musicbrainzId)
          .map((r) => ({
            name: r.artist?.name ?? 'Unknown',
            mbId: r.artist?.id ?? '',
            type: r.type,
            direction: r.direction ?? 'forward',
          }))
          .slice(0, 20);
      } catch {
        return [];
      }
    }),
});
