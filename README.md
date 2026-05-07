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

## MCP Servers (for Claude Code development)

`.mcp.json` configures MCP servers that give Claude Code live access to the same APIs and infrastructure the app uses, which is helpful when debugging rate limits, pressing variants, query plans, or enrichment data.

### Required env vars

Set these in your shell before starting Claude Code (only the ones for servers you actually want):

```
# Discogs MCP — https://www.discogs.com/settings/developers
export DISCOGS_PERSONAL_ACCESS_TOKEN=...

# Spotify MCP — https://developer.spotify.com/dashboard
export SPOTIFY_CLIENT_ID=...

# Neon MCP — https://console.neon.tech/app/settings/api-keys
export NEON_API_KEY=...

# Snowflake MCP — credentials for your Snowflake account
export SNOWFLAKE_ACCOUNT=...
export SNOWFLAKE_USER=...
export SNOWFLAKE_PASSWORD=...
export SNOWFLAKE_ROLE=...
export SNOWFLAKE_WAREHOUSE=...

# Notion MCP — https://www.notion.so/profile/integrations
export NOTION_TOKEN=...
```

### Servers in `.mcp.json`

| Server | Repo | Purpose |
|---|---|---|
| `discogs` | [cswkim/discogs-mcp-server](https://github.com/cswkim/discogs-mcp-server) | Wraps the Discogs API |
| `spotify` | [gupta-kush/spotify-mcp](https://github.com/gupta-kush/spotify-mcp) | 93-tool Spotify server with PKCE OAuth (requires [uv](https://docs.astral.sh/uv/)) |
| `playwright` | [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | Browser automation for end-to-end UI testing |
| `agent-scraper` | [aparajithn/agent-scraper-mcp](https://github.com/aparajithn/agent-scraper-mcp) | Generic web scraping + Google search (hosted, 50 req/IP/day free) |
| `neon` | [neondatabase/mcp-server-neon](https://github.com/neondatabase/mcp-server-neon) | Inspect/query the live Neon Postgres |
| `snowflake` | [Snowflake-Labs/mcp](https://github.com/Snowflake-Labs/mcp) | Cortex Agents, SQL, semantic views. Config in `snowflake-tools-config.yaml` (read-only by default) |
| `notion` | [n24q02m/better-notion-mcp](https://github.com/n24q02m/better-notion-mcp) | Markdown-first Notion access for collection notes |

### Optional servers (manual personal setup)

These aren't committed to `.mcp.json` because they need a per-user local path, a forked self-hosted instance, or an LLM API key. Add them to your personal `~/.claude/settings.local.json`.

- **[khglynn/spotify-bulk-actions-mcp](https://github.com/khglynn/spotify-bulk-actions-mcp)** — Bulk Spotify ops. Useful reference for the Spotify import flow. Requires local checkout + venv + `python setup_auth.py`.
- **[YangLiangwei/PersonalizationMCP](https://github.com/YangLiangwei/PersonalizationMCP)** — Aggregates Spotify + Reddit + YouTube + others into one server (90+ tools). Direct fit for the recommendations engine. Requires `git clone` + `uv sync` + `personalhub onboarding` + an absolute path to `server.py`.
- **[bitbonsai/mcp-obsidian](https://github.com/bitbonsai/mcp-obsidian)** — Obsidian vault read/write. Run `claude mcp add obsidian --scope user npx @bitbonsai/mcpvault /path/to/your/vault`.
- **[getsentry/sentry-mcp](https://github.com/getsentry/sentry-mcp)** — Production error tracking. Easiest path: `claude plugin marketplace add getsentry/sentry-mcp && claude plugin install sentry-mcp@sentry-mcp`. The stdio form requires an additional LLM API key.
- **[aparajithn/agent-deploy-dashboard-mcp](https://github.com/aparajithn/agent-deploy-dashboard-mcp)** — Vercel/Render/Railway/Fly deploy dashboard. The hosted URL is shared and won't carry your Vercel token, so fork the repo and self-host with `VERCEL_TOKEN` set as an env var on your fork.

## License

MIT
