# Deploying VinylIQ to mcdocker

This is the no-Kong path: the app is published directly on a host port, so it
works even when Kong (or any reverse proxy) is down. The database stays on
Neon in the cloud — nothing about it depends on mcdocker or Kong.

## What you need on mcdocker

- Docker + Docker Compose
- This repo checked out to the feature branch:
  ```bash
  git fetch origin claude/mahjong-coach-NJuLr
  git checkout claude/mahjong-coach-NJuLr
  ```
- A `.env.local` file in the repo root (it is gitignored, so create it on the
  host). Minimum contents:
  ```env
  DATABASE_URL=postgresql://...           # your existing Neon database URL
  BETTER_AUTH_SECRET=<random secret>      # generate: openssl rand -hex 32
  BETTER_AUTH_URL=http://mcdocker:3000    # how you actually reach the app

  # Optional — only needed for the AI coach chat (hand analysis works without):
  ANTHROPIC_API_KEY=sk-ant-...
  # or
  OPENAI_API_KEY=sk-...
  ```
  > Use whatever hostname/IP you browse to for `BETTER_AUTH_URL` — it must match,
  > or sign-in will fail. If you reach it at `http://192.168.1.x:3000`, put that.

## Deploy

```bash
docker compose -f docker-compose.mcdocker.yml up -d --build
```

This will, in order:
1. Build the app image (`npm run build` — needs outbound internet for fonts).
2. Run the `migrate` one-shot, which applies any pending DB migrations,
   including the new `mahjong_messages` table.
3. Start the app, published on port **3000**.

Open **http://mcdocker:3000** (or your host's IP), sign up, and the **Mahjong**
tab is in the sidebar.

## Useful commands

```bash
# Logs
docker compose -f docker-compose.mcdocker.yml logs -f vinyliq

# Re-run just the migration (safe; already-applied migrations are skipped)
docker compose -f docker-compose.mcdocker.yml run --rm migrate

# Update after pulling new commits
git pull
docker compose -f docker-compose.mcdocker.yml up -d --build

# Stop
docker compose -f docker-compose.mcdocker.yml down
```

## When Kong comes back

The original `docker-compose.yml` (external `lab` network + `vinyliq.lab`) is
unchanged and still there for the proxied setup. This file is the direct-port
alternative; don't run both at once — they share the container name `vinyliq`.

## Notes / limitations

- The image build fetches Google Fonts at build time. mcdocker needs outbound
  internet for `npm run build` to succeed. (This is also why the build can't be
  produced inside Claude's sandbox, which blocks font requests.)
- Redis (Upstash) is optional — the app degrades gracefully to no caching if
  `UPSTASH_REDIS_REST_*` are unset.
