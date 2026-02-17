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
}

export interface SourceAdapter {
  fetch(url: string): Promise<RawRelease[]>;
}
