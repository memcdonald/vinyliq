# VinylIQ

A full-featured web app for vinyl record collectors to research albums, track their collection, and discover new music through personalized recommendations. Data is sourced from Discogs, MusicBrainz, and Spotify.

## Features

- **Search** - Browse the Discogs database for vinyl records, albums, and artists
- **Album Detail** - View comprehensive album info with tracklists, pressing variants, marketplace pricing, community stats, and enriched data from MusicBrainz and Spotify
- **Artist Pages** - Explore artist profiles with full discography, band members/groups, and external links
- **Collection Management** - Track albums as owned, wanted, or listened with personal ratings
- **Collection Stats** - Dashboard with genre distribution, decade breakdown, and aggregate stats
- **Wantlist** - Manage albums you're looking for
- **Discover** - Personalized recommendations powered by three strategies:
  - Content-based (genre/style/era cosine similarity)
  - Graph traversal (MusicBrainz artist relationships)
  - Collaborative (Discogs community co-ownership)
- **Import** - Sync your existing Discogs collection and Spotify library
- **Connected Accounts** - OAuth integration with Discogs (OAuth 1.0a) and Spotify (OAuth 2.0 PKCE)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| ORM | Drizzle ORM |
| Database | PostgreSQL (Neon) |
| Cache | Upstash Redis |
| Auth | Better Auth |
| API Layer | tRPC v11 |
| Hosting | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) PostgreSQL database
- [Discogs API](https://www.discogs.com/developers) credentials
- [Spotify API](https://developer.spotify.com/dashboard) credentials
- [Upstash Redis](https://upstash.com) instance

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/memcdonald/vinyliq.git
   cd vinyliq
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment template and fill in your credentials:
   ```bash
   cp .env.local.example .env.local
   ```

   Required environment variables:
   ```
   DATABASE_URL=postgresql://...
   BETTER_AUTH_SECRET=<random-secret>
   BETTER_AUTH_URL=http://localhost:3000
   DISCOGS_CONSUMER_KEY=<your-key>
   DISCOGS_CONSUMER_SECRET=<your-secret>
   SPOTIFY_CLIENT_ID=<your-id>
   SPOTIFY_CLIENT_SECRET=<your-secret>
   UPSTASH_REDIS_REST_URL=<your-url>
   UPSTASH_REDIS_REST_TOKEN=<your-token>
   TOKEN_ENCRYPTION_KEY=<64-char-hex-string>
   ```

4. Push the database schema:
   ```bash
   npx drizzle-kit push
   ```

5. Start the dev server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Sign-in, sign-up
│   ├── (app)/                    # Authenticated routes
│   │   ├── search/               # Search records
│   │   ├── album/[id]/           # Album detail
│   │   ├── artist/[id]/          # Artist detail
│   │   ├── collection/           # User collection + stats
│   │   ├── wantlist/             # User wantlist
│   │   ├── discover/             # Recommendations
│   │   └── settings/             # Connected accounts
│   └── api/                      # tRPC + auth + OAuth callbacks
├── server/
│   ├── db/schema.ts              # Drizzle schema (9 tables)
│   ├── auth/                     # Better Auth config
│   ├── trpc/routers/             # album, artist, search, collection, recommendation, settings
│   ├── services/
│   │   ├── discogs/              # Discogs API client + rate limiter
│   │   ├── musicbrainz/          # MusicBrainz API client
│   │   ├── spotify/              # Spotify API client
│   │   └── unified/              # Cross-API resolver + enricher
│   └── recommendation/           # Taste profiles + 3 strategies + engine
├── components/                   # React components
└── lib/                          # Cache, tRPC client, utils
```

## API Integrations

- **Discogs** - Primary data source for vinyl-specific data (releases, pressings, marketplace pricing, community stats). Rate limited to 60 req/min.
- **MusicBrainz** - Rich metadata enrichment (community tags, ratings, artist relationships). Rate limited to 1 req/sec.
- **Spotify** - Album matching, popularity scores, and library import. Uses client credentials + user OAuth tokens.

## License

MIT
