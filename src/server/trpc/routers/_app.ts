import { createTRPCRouter } from '../init';
import { albumRouter } from './album';
import { searchRouter } from './search';
import { collectionRouter } from './collection';
import { settingsRouter } from './settings';

export const appRouter = createTRPCRouter({
  album: albumRouter,
  search: searchRouter,
  collection: collectionRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
