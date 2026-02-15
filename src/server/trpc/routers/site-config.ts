import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  getSiteConfigStatus,
  setSiteConfig,
  removeSiteConfig,
} from "@/server/services/site-config";
import { discogsClient } from "@/server/services/discogs/client";
import { spotifyClient } from "@/server/services/spotify/client";

const configKeySchema = z.enum([
  "anthropic_api_key",
  "openai_api_key",
  "discogs_consumer_key",
  "discogs_consumer_secret",
  "spotify_client_id",
  "spotify_client_secret",
]);

/** Clear cached credentials in service clients so they re-resolve from DB. */
function clearClientCredentialCaches(key: string) {
  if (key.startsWith("discogs_")) discogsClient.clearCredentialCache();
  if (key.startsWith("spotify_")) spotifyClient.clearCredentialCache();
}

export const siteConfigRouter = createTRPCRouter({
  getStatus: protectedProcedure.query(async () => {
    return getSiteConfigStatus();
  }),

  saveKey: protectedProcedure
    .input(
      z.object({
        key: configKeySchema,
        value: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ input }) => {
      await setSiteConfig(input.key, input.value);
      clearClientCredentialCaches(input.key);
      return { success: true };
    }),

  removeKey: protectedProcedure
    .input(z.object({ key: configKeySchema }))
    .mutation(async ({ input }) => {
      await removeSiteConfig(input.key);
      clearClientCredentialCaches(input.key);
      return { success: true };
    }),
});
