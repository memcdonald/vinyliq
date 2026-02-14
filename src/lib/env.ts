function required(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, fallback: string = ""): string {
  return process.env[key]?.trim() || fallback;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: optional("BETTER_AUTH_URL", "http://localhost:3000"),
  DISCOGS_CONSUMER_KEY: required("DISCOGS_CONSUMER_KEY"),
  DISCOGS_CONSUMER_SECRET: required("DISCOGS_CONSUMER_SECRET"),
  SPOTIFY_CLIENT_ID: optional("SPOTIFY_CLIENT_ID"),
  SPOTIFY_CLIENT_SECRET: optional("SPOTIFY_CLIENT_SECRET"),
  UPSTASH_REDIS_REST_URL: optional("UPSTASH_REDIS_REST_URL"),
  UPSTASH_REDIS_REST_TOKEN: optional("UPSTASH_REDIS_REST_TOKEN"),
  TOKEN_ENCRYPTION_KEY: optional("TOKEN_ENCRYPTION_KEY"),
  NODE_ENV: optional("NODE_ENV", "development"),
} as const;
