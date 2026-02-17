import {
  getTasteProfile,
  type WeightMap,
} from "@/server/recommendation/taste-profile";
import type { RawRelease } from "@/server/services/releases/types";

/**
 * Score how well a list of releases match a user's taste profile.
 * Returns an array of scores (0-1) corresponding to each release.
 */
export async function scoreTasteMatch(
  userId: string,
  releases: RawRelease[],
): Promise<number[]> {
  const profile = await getTasteProfile(userId);

  return releases.map((release) => {
    let score = 0;
    let factors = 0;

    // Artist match (strongest signal)
    if (
      release.artistName &&
      profile.artistWeights[release.artistName]
    ) {
      score += profile.artistWeights[release.artistName] * 3;
      factors++;
    }

    // Label match
    if (
      release.labelName &&
      profile.labelWeights[release.labelName]
    ) {
      score += profile.labelWeights[release.labelName] * 2;
      factors++;
    }

    // If we have no direct matches, try fuzzy matching on artist name parts
    if (factors === 0 && release.artistName) {
      const artistParts = release.artistName.toLowerCase().split(/\s+/);
      for (const [name, weight] of Object.entries(profile.artistWeights)) {
        const nameParts = name.toLowerCase().split(/\s+/);
        if (artistParts.some((p) => nameParts.includes(p) && p.length > 2)) {
          score += weight * 1.5;
          factors++;
          break;
        }
      }
    }

    // Genre keyword match from description
    if (release.description && Object.keys(profile.genreWeights).length > 0) {
      const descLower = release.description.toLowerCase();
      for (const [genre, weight] of Object.entries(profile.genreWeights)) {
        if (descLower.includes(genre.toLowerCase())) {
          score += weight * 1.0;
          factors++;
          break;
        }
      }
    }

    // If still no matches, give a small base score based on profile richness
    if (factors === 0) {
      const profileSize =
        Object.keys(profile.genreWeights).length +
        Object.keys(profile.artistWeights).length;
      // Small exploration bonus for users with taste data
      if (profileSize > 0) {
        score = 0.1;
      }
    }

    // Normalize to 0-1 range
    return Math.min(1, Math.max(0, score));
  });
}

/**
 * Get a human-readable taste match summary for a suggestion.
 */
export function describeTasteMatch(
  artistName: string,
  labelName: string | null,
  tasteScore: number,
  artistWeights: WeightMap,
  labelWeights: WeightMap,
): string {
  const reasons: string[] = [];

  if (artistWeights[artistName]) {
    reasons.push(`You have ${artistName} in your collection`);
  }

  if (labelName && labelWeights[labelName]) {
    reasons.push(`You collect from ${labelName}`);
  }

  if (reasons.length === 0 && tasteScore > 0.3) {
    reasons.push("Matches your taste profile patterns");
  }

  if (reasons.length === 0) {
    return "New discovery outside your usual taste";
  }

  return reasons.join(". ") + ".";
}
