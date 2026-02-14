import 'server-only';
import { createCallerFactory, createTRPCContext } from '@/server/trpc/init';
import { appRouter } from '@/server/trpc/routers/_app';

/**
 * Server-side caller for use in React Server Components.
 *
 * Usage:
 *   const api = await createCaller();
 *   const album = await api.album.getById({ id: '123' });
 */
const createCaller = createCallerFactory(appRouter);

export async function api() {
  const context = await createTRPCContext();
  return createCaller(context);
}
