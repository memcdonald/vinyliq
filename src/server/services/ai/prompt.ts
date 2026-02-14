import type { AlbumEvaluationInput } from "./types";

export function buildEvaluationPrompt(input: AlbumEvaluationInput): string {
  const topGenres = input.tasteProfile.topGenres
    .slice(0, 5)
    .map(([g, w]) => `${g} (${(w * 100).toFixed(0)}%)`)
    .join(", ");

  const topStyles = input.tasteProfile.topStyles
    .slice(0, 5)
    .map(([s, w]) => `${s} (${(w * 100).toFixed(0)}%)`)
    .join(", ");

  const topEras = input.tasteProfile.topEras
    .slice(0, 5)
    .map(([e, w]) => `${e} (${(w * 100).toFixed(0)}%)`)
    .join(", ");

  const topRated = input.topRatedAlbums
    .slice(0, 5)
    .map((a) => `${a.title} (${a.rating}/10)`)
    .join(", ");

  const recent = input.recentAlbums
    .slice(0, 5)
    .map((a) => a.title)
    .join(", ");

  return `You are a vinyl record expert and music critic. Evaluate how well this album fits a collector's taste and provide collecting advice.

## Album Under Evaluation
- Title: ${input.title}
- Artist: ${input.artistName}
${input.year ? `- Year: ${input.year}` : ""}
- Genres: ${input.genres.join(", ") || "Unknown"}
- Styles: ${input.styles.join(", ") || "Unknown"}
${input.communityRating ? `- Community Rating: ${input.communityRating}/5` : ""}
${input.communityHave ? `- Community Have: ${input.communityHave.toLocaleString()}` : ""}
${input.communityWant ? `- Community Want: ${input.communityWant.toLocaleString()}` : ""}

## Collector's Taste Profile
- Preferred Genres: ${topGenres || "Not enough data"}
- Preferred Styles: ${topStyles || "Not enough data"}
- Preferred Eras: ${topEras || "Not enough data"}
- Top Rated Albums: ${topRated || "None rated yet"}
- Recently Added: ${recent || "None yet"}

## Instructions
Provide a personalized evaluation of this album for this specific collector. Consider:
1. How well does it align with their genre/style preferences?
2. Is this a good addition to their collection based on their taste?
3. Any notable aspects about this pressing/release for collectors?
4. Potential value trajectory.

Respond with ONLY valid JSON in this exact format:
{
  "evaluation": "A 2-3 sentence personalized analysis",
  "score": <number 1-10, where 10 = perfect match for this collector>,
  "highlights": ["strength 1", "strength 2", "strength 3"],
  "concerns": ["concern 1", "concern 2"]
}`;
}
