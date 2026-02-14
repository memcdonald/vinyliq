export interface DiscogsSearchResult {
  id: number;
  type: 'release' | 'master' | 'artist' | 'label';
  title: string;
  thumb: string;
  cover_image: string;
  year: string;
  country: string;
  genre: string[];
  style: string[];
  format: string[];
  label: string[];
  catno: string;
  barcode: string[];
  uri: string;
  resource_url: string;
  master_id?: number;
  master_url?: string;
  community?: {
    have: number;
    want: number;
  };
}

export interface DiscogsSearchResponse {
  pagination: {
    page: number;
    pages: number;
    per_page: number;
    items: number;
    urls: {
      first?: string;
      prev?: string;
      next?: string;
      last?: string;
    };
  };
  results: DiscogsSearchResult[];
}

export interface DiscogsMaster {
  id: number;
  title: string;
  main_release: number;
  main_release_url: string;
  year: number;
  uri: string;
  resource_url: string;
  versions_url: string;
  artists: DiscogsArtistCredit[];
  genres: string[];
  styles: string[];
  images: DiscogsImage[];
  tracklist: DiscogsTrack[];
  videos?: DiscogsVideo[];
  num_for_sale: number;
  lowest_price: number;
  data_quality: string;
}

export interface DiscogsRelease {
  id: number;
  title: string;
  year: number;
  uri: string;
  resource_url: string;
  master_id?: number;
  master_url?: string;
  artists: DiscogsArtistCredit[];
  artists_sort: string;
  labels: DiscogsLabelCredit[];
  formats: DiscogsFormat[];
  genres: string[];
  styles: string[];
  country: string;
  released: string;
  notes: string;
  images: DiscogsImage[];
  tracklist: DiscogsTrack[];
  identifiers: DiscogsIdentifier[];
  videos?: DiscogsVideo[];
  community: {
    have: number;
    want: number;
    rating: {
      count: number;
      average: number;
    };
    status: string;
    data_quality: string;
  };
  estimated_weight: number;
  num_for_sale: number;
  lowest_price: number;
}

export interface DiscogsArtistCredit {
  id: number;
  name: string;
  anv: string;
  join: string;
  role: string;
  tracks: string;
  resource_url: string;
  thumbnail_url: string;
}

export interface DiscogsLabelCredit {
  id: number;
  name: string;
  catno: string;
  entity_type: string;
  entity_type_name: string;
  resource_url: string;
}

export interface DiscogsFormat {
  name: string;
  qty: string;
  text: string;
  descriptions: string[];
}

export interface DiscogsImage {
  type: 'primary' | 'secondary';
  uri: string;
  uri150: string;
  resource_url: string;
  width: number;
  height: number;
}

export interface DiscogsTrack {
  position: string;
  type_: string;
  title: string;
  duration: string;
  extraartists?: DiscogsArtistCredit[];
}

export interface DiscogsIdentifier {
  type: string;
  value: string;
  description?: string;
}

export interface DiscogsVideo {
  uri: string;
  title: string;
  description: string;
  duration: number;
  embed: boolean;
}

export interface DiscogsArtist {
  id: number;
  name: string;
  realname: string;
  profile: string;
  uri: string;
  resource_url: string;
  releases_url: string;
  images: DiscogsImage[];
  urls: string[];
  namevariations: string[];
  members?: { id: number; name: string; active: boolean; resource_url: string }[];
  groups?: { id: number; name: string; active: boolean; resource_url: string }[];
  data_quality: string;
}

export interface DiscogsMasterVersionsResponse {
  pagination: {
    page: number;
    pages: number;
    per_page: number;
    items: number;
  };
  versions: DiscogsMasterVersion[];
}

export interface DiscogsMasterVersion {
  id: number;
  title: string;
  label: string;
  catno: string;
  country: string;
  year: string;
  format: string;
  resource_url: string;
  thumb: string;
  major_formats: string[];
  status: string;
  stats: {
    community: { in_collection: number; in_wantlist: number };
  };
}

// ---------------------------------------------------------------------------
// Collection types
// ---------------------------------------------------------------------------

export interface DiscogsCollectionFolder {
  id: number;
  name: string;
  count: number;
  resource_url: string;
}

export interface DiscogsCollectionFoldersResponse {
  folders: DiscogsCollectionFolder[];
}

export interface DiscogsCollectionItem {
  id: number; // instance_id
  rating: number;
  basic_information: {
    id: number; // release_id
    master_id: number;
    master_url: string | null;
    title: string;
    year: number;
    thumb: string;
    cover_image: string;
    artists: DiscogsArtistCredit[];
    labels: DiscogsLabelCredit[];
    formats: DiscogsFormat[];
    genres: string[];
    styles: string[];
  };
  date_added: string;
  notes?: { field_id: number; value: string }[];
}

export interface DiscogsCollectionItemsResponse {
  pagination: {
    page: number;
    pages: number;
    per_page: number;
    items: number;
  };
  releases: DiscogsCollectionItem[];
}
