import { createTRPCRouter } from '../init';
import { albumRouter } from './album';
import { searchRouter } from './search';
import { collectionRouter } from './collection';

export const appRouter = createTRPCRouter({
  album: albumRouter,
  search: searchRouter,
  collection: collectionRouter,
});

export type AppRouter = typeof appRouter;
