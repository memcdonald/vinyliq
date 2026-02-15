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
// user - Better Auth user table + custom fields
// ---------------------------------------------------------------------------
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  discogsUsername: text("discogs_username"),
  discogsAccessToken: text("discogs_access_token"),
  discogsAccessTokenSecret: text("discogs_access_token_secret"),
  spotifyAccessToken: text("spotify_access_token"),
  spotifyRefreshToken: text("spotify_refresh_token"),
  spotifyTokenExpiresAt: timestamp("spotify_token_expires_at", {
    withTimezone: true,
  }),
  preferredAiProvider: text("preferred_ai_provider"), // 'claude' | 'openai' | null (use env default)
  chatSystemPrompt: text("chat_system_prompt"), // custom system prompt override
  anthropicApiKey: text("anthropic_api_key"), // user-provided API key (overrides env)
  openaiApiKey: text("openai_api_key"), // user-provided API key (overrides env)
  discogsConsumerKey: text("discogs_consumer_key"), // user-provided (overrides env)
  discogsConsumerSecret: text("discogs_consumer_secret"),
  spotifyClientId: text("spotify_client_id"), // user-provided (overrides env)
  spotifyClientSecret: text("spotify_client_secret"),
  recommendationPrompt: text("recommendation_prompt"), // custom prompt for AI recommendations
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ---------------------------------------------------------------------------
// session - Better Auth session table
// ---------------------------------------------------------------------------
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ---------------------------------------------------------------------------
// account - Better Auth account table
// ---------------------------------------------------------------------------
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ---------------------------------------------------------------------------
// verification - Better Auth verification table
// ---------------------------------------------------------------------------
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
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
      .references(() => user.id),
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
      .references(() => user.id)
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
      .references(() => user.id),
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
// release_sources - User-configured sources for upcoming releases
// ---------------------------------------------------------------------------
export const releaseSources = pgTable(
  "release_sources",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    type: text("type").notNull(), // 'url' | 'rss' | 'manual'
    name: text("name").notNull(),
    url: text("url"),
    enabled: boolean("enabled").notNull().default(true),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    fetchIntervalHours: integer("fetch_interval_hours").notNull().default(24),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("release_sources_user_id_idx").on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// upcoming_releases - Discovered/entered upcoming releases
// ---------------------------------------------------------------------------
export const upcomingReleases = pgTable(
  "upcoming_releases",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    sourceId: uuid("source_id").references(() => releaseSources.id),
    title: text("title").notNull(),
    artistName: text("artist_name").notNull(),
    labelName: text("label_name"),
    releaseDate: timestamp("release_date", { withTimezone: true }),
    coverImage: text("cover_image"),
    description: text("description"),
    orderUrl: text("order_url"),
    // Limited edition fields
    pressRun: integer("press_run"),
    coloredVinyl: boolean("colored_vinyl").default(false),
    numbered: boolean("numbered").default(false),
    specialPackaging: text("special_packaging"),
    // Scoring
    collectabilityScore: real("collectability_score"),
    collectabilityExplanation: text("collectability_explanation"),
    // Cross-references
    discogsId: integer("discogs_id"),
    albumId: uuid("album_id").references(() => albums.id),
    // Status
    status: text("status").notNull().default("upcoming"), // 'upcoming' | 'released' | 'archived'
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("upcoming_releases_user_id_idx").on(table.userId),
    index("upcoming_releases_source_id_idx").on(table.sourceId),
    index("upcoming_releases_release_date_idx").on(table.releaseDate),
  ],
);

// ---------------------------------------------------------------------------
// shared_links - Public shareable links
// ---------------------------------------------------------------------------
export const sharedLinks = pgTable(
  "shared_links",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    token: text("token").notNull().unique(),
    type: text("type").notNull(), // 'album' | 'wantlist'
    albumId: uuid("album_id").references(() => albums.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("shared_links_user_id_idx").on(table.userId),
    index("shared_links_token_idx").on(table.token),
  ],
);

// ---------------------------------------------------------------------------
// ai_evaluations - Cached AI assessments
// ---------------------------------------------------------------------------
export const aiEvaluations = pgTable(
  "ai_evaluations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id),
    provider: text("provider").notNull(), // 'claude' | 'openai'
    evaluation: text("evaluation").notNull(),
    score: real("score").notNull(), // 1-10
    highlights: jsonb("highlights").default([]),
    concerns: jsonb("concerns").default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("ai_evaluations_user_album_idx").on(
      table.userId,
      table.albumId,
    ),
    index("ai_evaluations_user_id_idx").on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// data_sources - Reference directory of vinyl research websites/services
// ---------------------------------------------------------------------------
export const dataSources = pgTable(
  "data_sources",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    priority: text("priority").notNull(), // 'core' | 'supporting'
    sourceName: text("source_name").notNull(),
    url: text("url"),
    category: text("category"),
    pulseUse: text("pulse_use"),
    accessMethod: text("access_method"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("data_sources_user_id_idx").on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// ai_suggestions - AI-powered suggestions from probed sources
// ---------------------------------------------------------------------------
export const aiSuggestions = pgTable(
  "ai_suggestions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    artistName: text("artist_name").notNull(),
    title: text("title").notNull(),
    labelName: text("label_name"),
    releaseDate: timestamp("release_date", { withTimezone: true }),
    coverImage: text("cover_image"),
    description: text("description"),
    orderUrl: text("order_url"),
    sourceId: uuid("source_id").references(() => dataSources.id),
    sourceName: text("source_name"),
    // Scoring
    collectabilityScore: real("collectability_score"),
    tasteScore: real("taste_score"),
    combinedScore: real("combined_score"),
    // AI explanation
    aiExplanation: text("ai_explanation"),
    // Status
    status: text("status").notNull().default("new"), // 'new' | 'dismissed' | 'interested'
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("ai_suggestions_user_artist_title_idx").on(
      table.userId,
      table.artistName,
      table.title,
    ),
    index("ai_suggestions_user_id_idx").on(table.userId),
    index("ai_suggestions_combined_score_idx").on(table.combinedScore),
    index("ai_suggestions_status_idx").on(table.status),
  ],
);

// ---------------------------------------------------------------------------
// chat_messages - Multi-turn AI chat history
// ---------------------------------------------------------------------------
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    role: text("role").notNull(), // 'user' | 'assistant'
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("chat_messages_user_id_idx").on(table.userId),
    index("chat_messages_created_at_idx").on(table.createdAt),
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

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type CollectionItem = typeof collectionItems.$inferSelect;
export type NewCollectionItem = typeof collectionItems.$inferInsert;

export type UserTasteProfile = typeof userTasteProfiles.$inferSelect;
export type NewUserTasteProfile = typeof userTasteProfiles.$inferInsert;

export type Recommendation = typeof recommendations.$inferSelect;
export type NewRecommendation = typeof recommendations.$inferInsert;

export type ReleaseSource = typeof releaseSources.$inferSelect;
export type NewReleaseSource = typeof releaseSources.$inferInsert;

export type UpcomingRelease = typeof upcomingReleases.$inferSelect;
export type NewUpcomingRelease = typeof upcomingReleases.$inferInsert;

export type SharedLink = typeof sharedLinks.$inferSelect;
export type NewSharedLink = typeof sharedLinks.$inferInsert;

export type AiEvaluation = typeof aiEvaluations.$inferSelect;
export type NewAiEvaluation = typeof aiEvaluations.$inferInsert;

export type DataSource = typeof dataSources.$inferSelect;
export type NewDataSource = typeof dataSources.$inferInsert;

export type AiSuggestion = typeof aiSuggestions.$inferSelect;
export type NewAiSuggestion = typeof aiSuggestions.$inferInsert;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

// ---------------------------------------------------------------------------
// site_settings - Global configuration (API keys, service credentials)
// ---------------------------------------------------------------------------
export const siteSettings = pgTable("site_settings", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
