export interface AlbumEvaluationInput {
  title: string;
  artistName: string;
  year?: number | null;
  genres: string[];
  styles: string[];
  communityRating?: number | null;
  communityHave?: number | null;
  communityWant?: number | null;
  // User context
  topRatedAlbums: { title: string; rating: number }[];
  recentAlbums: { title: string }[];
  tasteProfile: {
    topGenres: [string, number][];
    topStyles: [string, number][];
    topEras: [string, number][];
  };
}

export interface AlbumEvaluationResult {
  evaluation: string;
  score: number; // 1-10
  highlights: string[];
  concerns: string[];
}

export interface AIProvider {
  evaluate(input: AlbumEvaluationInput): Promise<AlbumEvaluationResult>;
}
