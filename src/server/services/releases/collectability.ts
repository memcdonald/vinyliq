import type { UpcomingRelease } from "@/server/db/schema";

interface CollectabilityInput {
  pressRun?: number | null;
  coloredVinyl?: boolean | null;
  numbered?: boolean | null;
  specialPackaging?: string | null;
  communityWant?: number;
  communityHave?: number;
}

interface CollectabilityResult {
  score: number; // 0-100
  explanation: string;
}

/**
 * Compute a collectability score (0-100) based on weighted factors.
 *
 * Factors:
 * - Limited press run (25%): lower runs = higher score
 * - Colored vinyl (15%)
 * - Numbered edition (10%)
 * - Special packaging (10%)
 * - Want/have ratio (20%): higher demand vs supply
 * - Artist popularity proxy (10%): based on community interest
 * - Label reputation proxy (10%): based on community interest
 */
export function computeCollectability(input: CollectabilityInput): CollectabilityResult {
  let score = 0;
  const factors: string[] = [];

  // Limited press run (25 points max)
  if (input.pressRun && input.pressRun > 0) {
    if (input.pressRun <= 100) {
      score += 25;
      factors.push(`Ultra-limited pressing (${input.pressRun} copies)`);
    } else if (input.pressRun <= 300) {
      score += 22;
      factors.push(`Very limited pressing (${input.pressRun} copies)`);
    } else if (input.pressRun <= 500) {
      score += 18;
      factors.push(`Limited pressing (${input.pressRun} copies)`);
    } else if (input.pressRun <= 1000) {
      score += 12;
      factors.push(`Small pressing (${input.pressRun} copies)`);
    } else if (input.pressRun <= 3000) {
      score += 6;
      factors.push(`Moderate pressing (${input.pressRun} copies)`);
    }
  }

  // Colored vinyl (15 points)
  if (input.coloredVinyl) {
    score += 15;
    factors.push("Colored vinyl variant");
  }

  // Numbered edition (10 points)
  if (input.numbered) {
    score += 10;
    factors.push("Numbered edition");
  }

  // Special packaging (10 points)
  if (input.specialPackaging) {
    score += 10;
    factors.push(`Special packaging: ${input.specialPackaging}`);
  }

  // Want/have ratio (20 points max)
  if (input.communityWant && input.communityHave) {
    const ratio = input.communityWant / Math.max(input.communityHave, 1);
    if (ratio > 5) {
      score += 20;
      factors.push("Extremely high demand-to-supply ratio");
    } else if (ratio > 2) {
      score += 15;
      factors.push("High demand-to-supply ratio");
    } else if (ratio > 1) {
      score += 10;
      factors.push("Above-average demand");
    } else if (ratio > 0.5) {
      score += 5;
      factors.push("Moderate demand");
    }
  }

  // Artist/label popularity proxy (20 points combined, based on total community interest)
  const totalInterest = (input.communityWant ?? 0) + (input.communityHave ?? 0);
  if (totalInterest > 10000) {
    score += 20;
    factors.push("Major artist/label with large following");
  } else if (totalInterest > 1000) {
    score += 14;
    factors.push("Popular artist/label");
  } else if (totalInterest > 100) {
    score += 8;
    factors.push("Growing interest");
  }

  return {
    score: Math.min(100, score),
    explanation: factors.length > 0
      ? factors.join(". ") + "."
      : "No collectability indicators found.",
  };
}

export function computeCollectabilityForRelease(
  release: Pick<UpcomingRelease, "pressRun" | "coloredVinyl" | "numbered" | "specialPackaging">,
  communityData?: { want?: number; have?: number },
): CollectabilityResult {
  return computeCollectability({
    pressRun: release.pressRun,
    coloredVinyl: release.coloredVinyl,
    numbered: release.numbered,
    specialPackaging: release.specialPackaging,
    communityWant: communityData?.want,
    communityHave: communityData?.have,
  });
}
