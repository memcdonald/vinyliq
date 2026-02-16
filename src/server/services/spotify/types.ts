/**
 * TypeScript interfaces for Spotify Web API responses.
 *
 * Only the subset of the API that VinylIQ actually uses is modelled here:
 * album lookup, album search, and user library reads. Deprecated endpoints
 * (audio-features, audio-analysis, recommendations) are intentionally omitted.
 *
 * @see https://developer.spotify.com/documentation/web-api/reference
 */

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

export interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: 'album' | 'single' | 'compilation';
  total_tracks: number;
  release_date: string;
  release_date_precision: 'year' | 'month' | 'day';
  external_urls: { spotify: string };
  href: string;
  uri: string;
  images: SpotifyImage[];
  artists: SpotifySimpleArtist[];
  tracks?: SpotifyPaging<SpotifyTrack>;
  genres: string[];
  label: string;
  popularity: number;
  copyrights: { text: string; type: string }[];
  external_ids: { upc?: string; isrc?: string; ean?: string };
}

export interface SpotifySimpleAlbum {
  id: string;
  name: string;
  album_type: string;
  total_tracks: number;
  release_date: string;
  release_date_precision: string;
  external_urls: { spotify: string };
  images: SpotifyImage[];
  artists: SpotifySimpleArtist[];
}

export interface SpotifyArtist {
  id: string;
  name: string;
  external_urls: { spotify: string };
  href: string;
  uri: string;
  images: SpotifyImage[];
  genres: string[];
  popularity: number;
  followers: { total: number };
}

export interface SpotifySimpleArtist {
  id: string;
  name: string;
  external_urls: { spotify: string };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  track_number: number;
  disc_number: number;
  duration_ms: number;
  explicit: boolean;
  external_urls: { spotify: string };
  uri: string;
  artists: SpotifySimpleArtist[];
  external_ids?: { isrc?: string };
}

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface SpotifyPaging<T> {
  href: string;
  items: T[];
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
}

// ---------------------------------------------------------------------------
// Composite responses
// ---------------------------------------------------------------------------

export interface SpotifySearchResponse {
  albums?: SpotifyPaging<SpotifySimpleAlbum>;
  artists?: SpotifyPaging<SpotifyArtist>;
  tracks?: SpotifyPaging<SpotifyTrack>;
}

export interface SpotifySavedAlbum {
  added_at: string;
  album: SpotifyAlbum;
}

// ---------------------------------------------------------------------------
// Top Items
// ---------------------------------------------------------------------------

export type SpotifyTimeRange = 'short_term' | 'medium_term' | 'long_term';

// ---------------------------------------------------------------------------
// AI Preference Analysis
// ---------------------------------------------------------------------------

export interface SpotifyPreferenceAnalysis {
  summary: string;
  topGenres: string[];
  moods: string[];
  eras: string[];
  keyInsights: string[];
  vinylRecommendations: string[];
  collectionHighlights: string[];
  listeningPersonality: string;
  analyzedAt: string; // ISO date string
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}
