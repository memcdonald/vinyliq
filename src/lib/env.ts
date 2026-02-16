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
  get DATABASE_URL() { return required("DATABASE_URL"); },
  get BETTER_AUTH_SECRET() { return required("BETTER_AUTH_SECRET"); },
  BETTER_AUTH_URL: optional("BETTER_AUTH_URL", "http://localhost:3000"),
  DISCOGS_CONSUMER_KEY: optional("DISCOGS_CONSUMER_KEY"),
  DISCOGS_CONSUMER_SECRET: optional("DISCOGS_CONSUMER_SECRET"),
  SPOTIFY_CLIENT_ID: optional("SPOTIFY_CLIENT_ID"),
  SPOTIFY_CLIENT_SECRET: optional("SPOTIFY_CLIENT_SECRET"),
  UPSTASH_REDIS_REST_URL: optional("UPSTASH_REDIS_REST_URL"),
  UPSTASH_REDIS_REST_TOKEN: optional("UPSTASH_REDIS_REST_TOKEN"),
  TOKEN_ENCRYPTION_KEY: optional("TOKEN_ENCRYPTION_KEY"),
  NODE_ENV: optional("NODE_ENV", "development"),
  ANTHROPIC_API_KEY: optional("ANTHROPIC_API_KEY"),
  OPENAI_API_KEY: optional("OPENAI_API_KEY"),
  AI_PROVIDER: optional("AI_PROVIDER", "claude"),
  NEXT_PUBLIC_BASE_URL: optional("NEXT_PUBLIC_BASE_URL", "http://localhost:3000"),
};
