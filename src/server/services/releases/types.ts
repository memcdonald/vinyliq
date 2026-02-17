export interface RawRelease {
  title: string;
  artistName: string;
  labelName?: string;
  releaseDate?: Date;
  coverImage?: string;
  description?: string;
  orderUrl?: string;
  pressRun?: number;
  coloredVinyl?: boolean;
  numbered?: boolean;
  specialPackaging?: string;
  confidence?: number;
  vinylConfirmed?: boolean;
  communityWant?: number;
  communityHave?: number;
}

export interface SourceAdapter {
  fetch(url: string): Promise<RawRelease[]>;
}
