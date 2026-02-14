import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// albums - Unified album record (master release level)
// ---------------------------------------------------------------------------
export const albums = pgTable(
  "albums",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    discogsId: integer("discogs_id").unique(),
    discogsMasterId: integer("discogs_master_id"),
    musicbrainzId: text("musicbrainz_id"),
    spotifyId: text("spotify_id"),
    title: text("title").notNull(),
    year: integer("year"),
    thumb: text("thumb"),
    coverImage: text("cover_image"),
    genres: text("genres")
      .array()
      .default(sql`'{}'::text[]`),
    styles: text("styles")
      .array()
      .default(sql`'{}'::text[]`),
    country: text("country"),
    discogsUrl: text("discogs_url"),
    communityHave: integer("community_have").default(0),
    communityWant: integer("community_want").default(0),
    communityRating: real("community_rating"),
    mbTags: text("mb_tags")
      .array()
      .default(sql`'{}'::text[]`),
    barcode: text("barcode"),
    catalogNumber: text("catalog_number"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("albums_discogs_master_id_idx").on(table.discogsMasterId),
    index("albums_musicbrainz_id_idx").on(table.musicbrainzId),
    index("albums_spotify_id_idx").on(table.spotifyId),
    index("albums_title_idx").on(table.title),
  ],
);

// ---------------------------------------------------------------------------
// pressings - Individual vinyl pressings per album
// ---------------------------------------------------------------------------
export const pressings = pgTable(
  "pressings",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id),
    discogsReleaseId: integer("discogs_release_id").unique(),
    title: text("title").notNull(),
    label: text("label"),
    country: text("country"),
    year: integer("year"),
    format: text("format"),
    formatDetails: text("format_details").array(),
    catno: text("catno"),
    barcode: text("barcode"),
    thumb: text("thumb"),
    lowestPrice: real("lowest_price"),
    numForSale: integer("num_for_sale"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("pressings_album_id_idx").on(table.albumId),
  ],
);

// ---------------------------------------------------------------------------
// artists - Standalone artist entities
// ---------------------------------------------------------------------------
export const artists = pgTable(
  "artists",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    discogsId: integer("discogs_id").unique(),
    musicbrainzId: text("musicbrainz_id"),
    spotifyId: text("spotify_id"),
    name: text("name").notNull(),
    realName: text("real_name"),
    profile: text("profile"),
    thumb: text("thumb"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("artists_musicbrainz_id_idx").on(table.musicbrainzId),
    index("artists_spotify_id_idx").on(table.spotifyId),
    index("artists_name_idx").on(table.name),
  ],
);

// ---------------------------------------------------------------------------
// album_artists - Many-to-many junction table
// ---------------------------------------------------------------------------
export const albumArtists = pgTable(
  "album_artists",
  {
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id),
    role: text("role").notNull().default("primary"),
  },
  (table) => [
    primaryKey({ columns: [table.albumId, table.artistId, table.role] }),
    index("album_artists_artist_id_idx").on(table.artistId),
  ],
);

// ---------------------------------------------------------------------------
// labels - Record labels
// ---------------------------------------------------------------------------
export const labels = pgTable(
  "labels",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    discogsId: integer("discogs_id").unique(),
    musicbrainzId: text("musicbrainz_id"),
    name: text("name").notNull(),
    profile: text("profile"),
    thumb: text("thumb"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("labels_musicbrainz_id_idx").on(table.musicbrainzId),
    index("labels_name_idx").on(table.name),
  ],
);

// ---------------------------------------------------------------------------
// users - App users (Better Auth manages its own tables; extra fields here)
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  discogsUsername: text("discogs_username"),
  discogsAccessToken: text("discogs_access_token"),
  discogsAccessTokenSecret: text("discogs_access_token_secret"),
  spotifyAccessToken: text("spotify_access_token"),
  spotifyRefreshToken: text("spotify_refresh_token"),
  spotifyTokenExpiresAt: timestamp("spotify_token_expires_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ---------------------------------------------------------------------------
// collection_items - User's albums
// ---------------------------------------------------------------------------
export const collectionItems = pgTable(
  "collection_items",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id),
    status: text("status").notNull(), // 'owned' | 'wanted' | 'listened'
    rating: integer("rating"),
    notes: text("notes"),
    discogsInstanceId: integer("discogs_instance_id"),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("collection_items_user_album_idx").on(
      table.userId,
      table.albumId,
    ),
    index("collection_items_user_id_idx").on(table.userId),
    index("collection_items_album_id_idx").on(table.albumId),
  ],
);

// ---------------------------------------------------------------------------
// user_taste_profiles - Computed taste vectors
// ---------------------------------------------------------------------------
export const userTasteProfiles = pgTable(
  "user_taste_profiles",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id)
      .unique(),
    genreWeights: jsonb("genre_weights").default({}),
    styleWeights: jsonb("style_weights").default({}),
    eraWeights: jsonb("era_weights").default({}),
    labelWeights: jsonb("label_weights").default({}),
    artistWeights: jsonb("artist_weights").default({}),
    computedAt: timestamp("computed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("user_taste_profiles_user_id_idx").on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// recommendations - Precomputed recommendations
// ---------------------------------------------------------------------------
export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id),
    score: real("score").notNull(),
    strategy: text("strategy").notNull(), // 'content' | 'collaborative' | 'graph'
    explanation: text("explanation").notNull(),
    seen: boolean("seen").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("recommendations_user_album_strategy_idx").on(
      table.userId,
      table.albumId,
      table.strategy,
    ),
    index("recommendations_user_id_idx").on(table.userId),
    index("recommendations_album_id_idx").on(table.albumId),
  ],
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;

export type Pressing = typeof pressings.$inferSelect;
export type NewPressing = typeof pressings.$inferInsert;

export type Artist = typeof artists.$inferSelect;
export type NewArtist = typeof artists.$inferInsert;

export type AlbumArtist = typeof albumArtists.$inferSelect;
export type NewAlbumArtist = typeof albumArtists.$inferInsert;

export type Label = typeof labels.$inferSelect;
export type NewLabel = typeof labels.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type CollectionItem = typeof collectionItems.$inferSelect;
export type NewCollectionItem = typeof collectionItems.$inferInsert;

export type UserTasteProfile = typeof userTasteProfiles.$inferSelect;
export type NewUserTasteProfile = typeof userTasteProfiles.$inferInsert;

export type Recommendation = typeof recommendations.$inferSelect;
export type NewRecommendation = typeof recommendations.$inferInsert;
