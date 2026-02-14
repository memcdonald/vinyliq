import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../init';
import { discogsClient } from '@/server/services/discogs';

export const albumRouter = createTRPCRouter({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      // TODO: Look up album by internal DB ID, then fetch from Discogs/MusicBrainz
      return {
        id: input.id,
        title: 'Placeholder Album',
        artist: 'Placeholder Artist',
        year: 2024,
        genres: [] as string[],
        styles: [] as string[],
        coverImage: null as string | null,
        discogsId: null as number | null,
        tracklist: [] as { position: string; title: string; duration: string }[],
      };
    }),

  getByDiscogsId: publicProcedure
    .input(
      z.object({
        discogsId: z.number(),
        type: z.enum(['master', 'release']).optional().default('release'),
      }),
    )
    .query(async ({ input }) => {
      if (input.type === 'master') {
        const master = await discogsClient.getMaster(input.discogsId);
        return {
          type: 'master' as const,
          id: master.id,
          title: master.title,
          artists: master.artists.map((a) => ({
            id: a.id,
            name: a.name,
            join: a.join,
          })),
          year: master.year,
          genres: master.genres ?? [],
          styles: master.styles ?? [],
          images: master.images ?? [],
          tracklist: (master.tracklist ?? []).map((t) => ({
            position: t.position,
            title: t.title,
            duration: t.duration,
            type: t.type_,
          })),
          videos: master.videos ?? [],
          mainRelease: master.main_release,
          numForSale: master.num_for_sale,
          lowestPrice: master.lowest_price,
          dataQuality: master.data_quality,
          // Fields not available on masters
          country: null as string | null,
          released: null as string | null,
          notes: null as string | null,
          labels: [] as { id: number; name: string; catno: string }[],
          formats: [] as { name: string; qty: string; descriptions: string[] }[],
          community: null as {
            have: number;
            want: number;
            rating: { count: number; average: number };
          } | null,
        };
      }

      const release = await discogsClient.getRelease(input.discogsId);
      return {
        type: 'release' as const,
        id: release.id,
        title: release.title,
        artists: release.artists.map((a) => ({
          id: a.id,
          name: a.name,
          join: a.join,
        })),
        year: release.year,
        genres: release.genres ?? [],
        styles: release.styles ?? [],
        images: release.images ?? [],
        tracklist: (release.tracklist ?? []).map((t) => ({
          position: t.position,
          title: t.title,
          duration: t.duration,
          type: t.type_,
        })),
        videos: release.videos ?? [],
        country: release.country ?? null,
        released: release.released ?? null,
        notes: release.notes ?? null,
        labels: (release.labels ?? []).map((l) => ({
          id: l.id,
          name: l.name,
          catno: l.catno,
        })),
        formats: (release.formats ?? []).map((f) => ({
          name: f.name,
          qty: f.qty,
          descriptions: f.descriptions ?? [],
        })),
        community: release.community
          ? {
              have: release.community.have,
              want: release.community.want,
              rating: {
                count: release.community.rating.count,
                average: release.community.rating.average,
              },
            }
          : null,
        mainRelease: null as number | null,
        numForSale: release.num_for_sale,
        lowestPrice: release.lowest_price,
        dataQuality: null as string | null,
      };
    }),
});
