import { createTRPCRouter } from '../init';
import { albumRouter } from './album';
import { searchRouter } from './search';
import { collectionRouter } from './collection';
import { settingsRouter } from './settings';
import { recommendationRouter } from './recommendation';
import { artistRouter } from './artist';
import { releasesRouter } from './releases';
import { shareRouter } from './share';
import { aiRouter } from './ai';

export const appRouter = createTRPCRouter({
  album: albumRouter,
  search: searchRouter,
  collection: collectionRouter,
  settings: settingsRouter,
  recommendation: recommendationRouter,
  artist: artistRouter,
  releases: releasesRouter,
  share: shareRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
