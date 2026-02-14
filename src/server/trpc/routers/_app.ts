import { createTRPCRouter } from '../init';
import { albumRouter } from './album';
import { searchRouter } from './search';
import { collectionRouter } from './collection';
import { settingsRouter } from './settings';
import { recommendationRouter } from './recommendation';
import { artistRouter } from './artist';

export const appRouter = createTRPCRouter({
  album: albumRouter,
  search: searchRouter,
  collection: collectionRouter,
  settings: settingsRouter,
  recommendation: recommendationRouter,
  artist: artistRouter,
});

export type AppRouter = typeof appRouter;
