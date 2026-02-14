import { db } from '@/server/db';
import { albums, collectionItems, artists, albumArtists } from '@/server/db/schema';
import { eq, inArray, and, isNotNull } from 'drizzle-orm';
import { musicBrainzClient } from '@/server/services/musicbrainz';
import { cached, CacheTTL } from '@/lib/cache';
import type { TasteProfile } from '../taste-profile';

export interface ScoredRecommendation {
  albumId: string;
  score: number;
  explanation: string;
  strategy: 'graph';
}

/**
 * Graph traversal recommendation strategy.
 *
 * Finds albums by artists related to those in the user's collection via
 * MusicBrainz relationships (band members, collaborators, producers).
 *
 * Relationship types and their score weights:
 * - "member of band" / "is person": 1.0 (same band = high relevance)
 * - "collaboration": 0.8
 * - "producer": 0.7
 * - "remix": 0.5
 * - Other relationships: 0.3
 */
export async function graphRecommendations(
  userId: string,
  tasteProfile: TasteProfile,
  limit: number = 50,
): Promise<ScoredRecommendation[]> {
  // Get user's owned album IDs
  const owned = await db
    .select({ albumId: collectionItems.albumId })
    .from(collectionItems)
    .where(eq(collectionItems.userId, userId));
  const ownedIds = new Set(owned.map(o => o.albumId));

  // Get artists from user's collection that have MusicBrainz IDs
  const collectionArtists = await db
    .select({
      artistId: artists.id,
      artistName: artists.name,
      musicbrainzId: artists.musicbrainzId,
    })
    .from(albumArtists)
    .innerJoin(artists, eq(albumArtists.artistId, artists.id))
    .innerJoin(collectionItems, and(
      eq(albumArtists.albumId, collectionItems.albumId),
      eq(collectionItems.userId, userId),
    ))
    .where(isNotNull(artists.musicbrainzId));

  // Deduplicate
  const uniqueArtists = new Map<string, { name: string; mbId: string }>();
  for (const a of collectionArtists) {
    if (a.musicbrainzId && !uniqueArtists.has(a.musicbrainzId)) {
      uniqueArtists.set(a.musicbrainzId, { name: a.artistName, mbId: a.musicbrainzId });
    }
  }

  // Limit to top 10 artists to avoid too many API calls
  const artistsToQuery = Array.from(uniqueArtists.values()).slice(0, 10);

  // For each artist, fetch their MusicBrainz relationships
  const relatedArtistScores = new Map<string, { score: number; viaArtist: string; relationType: string }>();

  for (const artist of artistsToQuery) {
    try {
      const relations = await cached(
        `mb:artist-rels:${artist.mbId}`,
        () => musicBrainzClient.getArtistRelations(artist.mbId),
        CacheTTL.LONG,
      );

      for (const rel of relations) {
        if (!rel.artist || rel.artist.id === artist.mbId) continue;

        const relWeight = getRelationWeight(rel.type);
        const relatedMbId = rel.artist.id;
        const existing = relatedArtistScores.get(relatedMbId);

        if (!existing || existing.score < relWeight) {
          relatedArtistScores.set(relatedMbId, {
            score: relWeight,
            viaArtist: artist.name,
            relationType: rel.type,
          });
        }
      }
    } catch (err) {
      console.error(`[GraphRec] Failed to fetch relations for ${artist.name}:`, err);
    }
  }

  // Find albums in our DB by these related artists (via their MusicBrainz IDs)
  const relatedMbIds = Array.from(relatedArtistScores.keys());
  if (relatedMbIds.length === 0) return [];

  const relatedArtistsInDb = await db
    .select({
      artistId: artists.id,
      artistName: artists.name,
      musicbrainzId: artists.musicbrainzId,
    })
    .from(artists)
    .where(inArray(artists.musicbrainzId, relatedMbIds));

  if (relatedArtistsInDb.length === 0) return [];

  const relatedArtistIds = relatedArtistsInDb.map(a => a.artistId);

  // Get albums by these related artists
  const relatedAlbums = await db
    .select({
      albumId: albumArtists.albumId,
      artistId: albumArtists.artistId,
      artistName: artists.name,
      musicbrainzId: artists.musicbrainzId,
      albumTitle: albums.title,
    })
    .from(albumArtists)
    .innerJoin(artists, eq(albumArtists.artistId, artists.id))
    .innerJoin(albums, eq(albumArtists.albumId, albums.id))
    .where(inArray(albumArtists.artistId, relatedArtistIds));

  // Score and deduplicate
  const scored: ScoredRecommendation[] = [];
  const seen = new Set<string>();

  for (const album of relatedAlbums) {
    if (ownedIds.has(album.albumId) || seen.has(album.albumId)) continue;
    seen.add(album.albumId);

    const mbId = album.musicbrainzId;
    if (!mbId) continue;

    const relInfo = relatedArtistScores.get(mbId);
    if (!relInfo) continue;

    const explanation = generateGraphExplanation(
      album.artistName,
      relInfo.viaArtist,
      relInfo.relationType,
    );

    scored.push({
      albumId: album.albumId,
      score: relInfo.score,
      explanation,
      strategy: 'graph',
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

function getRelationWeight(relationType: string): number {
  const weights: Record<string, number> = {
    'member of band': 1.0,
    'is person': 1.0,
    'collaboration': 0.8,
    'conductor position': 0.7,
    'producer': 0.7,
    'composer': 0.7,
    'lyricist': 0.6,
    'remix': 0.5,
    'tribute': 0.4,
    'supporting musician': 0.5,
    'vocal': 0.5,
    'instrument': 0.5,
    'mix': 0.5,
    'recording': 0.4,
  };
  return weights[relationType] ?? 0.3;
}

function generateGraphExplanation(
  relatedArtistName: string,
  viaArtistName: string,
  relationType: string,
): string {
  const typeDescriptions: Record<string, string> = {
    'member of band': 'member of',
    'is person': 'also known as',
    'collaboration': 'collaborator with',
    'producer': 'produced by a collaborator of',
    'remix': 'remixed by someone connected to',
    'supporting musician': 'features a musician from',
    'vocal': 'features a vocalist connected to',
    'instrument': 'features a musician from',
  };

  const desc = typeDescriptions[relationType] ?? 'connected to';
  return `${relatedArtistName} is ${desc} ${viaArtistName}`;
}
