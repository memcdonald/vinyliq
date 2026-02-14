/**
 * TypeScript interfaces for MusicBrainz API responses.
 *
 * @see https://musicbrainz.org/doc/MusicBrainz_API
 * @see https://musicbrainz.org/doc/MusicBrainz_API/Search
 */

export interface MBReleaseGroup {
  id: string; // UUID
  title: string;
  "primary-type": string | null; // "Album", "Single", "EP", etc.
  "secondary-types": string[];
  "first-release-date": string;
  disambiguation: string;
  "artist-credit": MBArtistCredit[];
  tags?: MBTag[];
  rating?: MBRating;
  releases?: MBRelease[];
}

export interface MBRelease {
  id: string;
  title: string;
  status: string;
  date: string;
  country: string;
  barcode: string | null;
  "release-group"?: { id: string; title: string; "primary-type": string };
  "label-info"?: MBLabelInfo[];
  media?: MBMedia[];
  "artist-credit"?: MBArtistCredit[];
  "text-representation"?: { language: string; script: string };
}

export interface MBArtistCredit {
  artist: MBArtist;
  name: string;
  joinphrase: string;
}

export interface MBArtist {
  id: string;
  name: string;
  "sort-name": string;
  type: string | null; // "Person", "Group", etc.
  disambiguation: string;
  country?: string;
  "life-span"?: { begin: string | null; end: string | null; ended: boolean };
  tags?: MBTag[];
  rating?: MBRating;
  relations?: MBRelation[];
}

export interface MBTag {
  name: string;
  count: number;
}

export interface MBRating {
  "votes-count": number;
  value: number | null;
}

export interface MBLabelInfo {
  "catalog-number": string | null;
  label: { id: string; name: string } | null;
}

export interface MBMedia {
  position: number;
  format: string;
  "track-count": number;
  tracks?: MBTrack[];
}

export interface MBTrack {
  id: string;
  number: string;
  title: string;
  length: number | null; // milliseconds
  position: number;
  recording: {
    id: string;
    title: string;
    length: number | null;
    isrcs?: string[];
  };
}

export interface MBRelation {
  type: string; // "member of band", "producer", "collaboration", etc.
  "type-id": string;
  direction: "forward" | "backward";
  "target-type": string;
  attributes: string[];
  begin: string | null;
  end: string | null;
  ended: boolean;
  artist?: MBArtist;
  "release-group"?: { id: string; title: string };
}

export interface MBSearchResponse<T> {
  created: string;
  count: number;
  offset: number;
  "release-groups"?: T[];
  releases?: T[];
  artists?: T[];
}

export interface MBBrowseResponse<T> {
  "release-group-count"?: number;
  "release-group-offset"?: number;
  "release-groups"?: T[];
  "release-count"?: number;
  "release-offset"?: number;
  releases?: T[];
}
