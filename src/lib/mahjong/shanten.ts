// ---------------------------------------------------------------------------
// Shanten + acceptance (ukeire) engine for Riichi mahjong.
//
// "Shanten" is the number of tile swaps away from tenpai (a ready hand).
//   -1 = complete hand, 0 = tenpai, 1 = one away, etc.
//
// We compute the minimum shanten across the three winning shapes:
//   * standard  — 4 melds + 1 pair
//   * chiitoitsu — 7 distinct pairs
//   * kokushi    — thirteen orphans
//
// Everything works on a 34-length count array (see ./tiles).
// ---------------------------------------------------------------------------

import {
  TILE_COUNT,
  HONOR_BASE,
  TERMINALS_AND_HONORS,
  handSize,
  tileLabel,
} from "./tiles";

/** Standard form: 4 melds + 1 pair. */
function standardShanten(counts: number[]): number {
  const work = counts.slice();
  let best = 8;

  // The pair (head) is chosen explicitly here; the inner search then just
  // maximises melds + partial sets among the remaining tiles.
  const tryDecompose = (hasPair: boolean) => {
    const { melds, partials } = bestMeldsAndPartials(work);
    const blocks = melds + partials;
    const usablePartials = blocks > 4 ? 4 - melds : partials;
    const shanten = 8 - 2 * melds - usablePartials - (hasPair ? 1 : 0);
    if (shanten < best) best = shanten;
  };

  // No designated head.
  tryDecompose(false);

  // Each possible head.
  for (let i = 0; i < TILE_COUNT; i++) {
    if (work[i] >= 2) {
      work[i] -= 2;
      tryDecompose(true);
      work[i] += 2;
    }
  }

  return best;
}

/**
 * Find the decomposition that maximises (2 * melds + partials), where a meld
 * is a complete set of 3 and a partial is any 2-tile proto-set (pair or
 * proto-run). Caller is responsible for capping blocks at 4.
 */
function bestMeldsAndPartials(counts: number[]): {
  melds: number;
  partials: number;
} {
  let bestMelds = 0;
  let bestPartials = 0;
  let bestScore = -1;

  const search = (idx: number, melds: number, partials: number) => {
    let i = idx;
    while (i < TILE_COUNT && counts[i] === 0) i++;

    if (i === TILE_COUNT) {
      // Cap blocks at 4 when scoring so over-counting partials never wins.
      const usable = melds + partials > 4 ? 4 - melds : partials;
      const score = 2 * melds + usable;
      if (
        score > bestScore ||
        (score === bestScore && melds > bestMelds)
      ) {
        bestScore = score;
        bestMelds = melds;
        bestPartials = usable;
      }
      return;
    }

    const suited = i < HONOR_BASE;
    const rank = i % 9; // 0..8 for suited tiles

    // Triplet.
    if (counts[i] >= 3) {
      counts[i] -= 3;
      search(i, melds + 1, partials);
      counts[i] += 3;
    }

    // Sequence (suited only, not wrapping past 9).
    if (suited && rank <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0) {
      counts[i]--;
      counts[i + 1]--;
      counts[i + 2]--;
      search(i, melds + 1, partials);
      counts[i]++;
      counts[i + 1]++;
      counts[i + 2]++;
    }

    // Pair as a partial set (proto-triplet).
    if (counts[i] >= 2) {
      counts[i] -= 2;
      search(i, melds, partials + 1);
      counts[i] += 2;
    }

    // Ryanmen / penchan (i, i+1).
    if (suited && rank <= 7 && counts[i + 1] > 0) {
      counts[i]--;
      counts[i + 1]--;
      search(i, melds, partials + 1);
      counts[i]++;
      counts[i + 1]++;
    }

    // Kanchan (i, i+2).
    if (suited && rank <= 6 && counts[i + 2] > 0) {
      counts[i]--;
      counts[i + 2]--;
      search(i, melds, partials + 1);
      counts[i]++;
      counts[i + 2]++;
    }

    // Leave one tile of this type floating.
    counts[i]--;
    search(i, melds, partials);
    counts[i]++;
  };

  search(0, 0, 0);
  return { melds: bestMelds, partials: bestPartials };
}

/** Seven distinct pairs. */
function chiitoitsuShanten(counts: number[]): number {
  let pairs = 0;
  let kinds = 0;
  for (let i = 0; i < TILE_COUNT; i++) {
    if (counts[i] >= 1) kinds++;
    if (counts[i] >= 2) pairs++;
  }
  // Need 7 distinct pairs; a shortage of distinct tiles adds to the distance.
  return 6 - pairs + Math.max(0, 7 - kinds);
}

/** Thirteen orphans. */
function kokushiShanten(counts: number[]): number {
  let kinds = 0;
  let hasPair = false;
  for (const i of TERMINALS_AND_HONORS) {
    if (counts[i] >= 1) kinds++;
    if (counts[i] >= 2) hasPair = true;
  }
  return 13 - kinds - (hasPair ? 1 : 0);
}

/** Minimum shanten across all three winning shapes. */
export function shanten(counts: number[]): number {
  return Math.min(
    standardShanten(counts),
    chiitoitsuShanten(counts),
    kokushiShanten(counts),
  );
}

export interface UkeireResult {
  /** Tile indices that, when drawn, lower the hand's shanten. */
  tiles: number[];
  /** Total number of such tiles remaining (accounting for copies in hand). */
  count: number;
}

/**
 * For a hand that is 1 short of a multiple of 3 (e.g. 13 tiles), compute the
 * set of tiles that improve (lower) the shanten, and how many remain.
 */
export function ukeire(counts: number[]): UkeireResult {
  const current = shanten(counts);
  const tiles: number[] = [];
  let count = 0;

  const work = counts.slice();
  for (let i = 0; i < TILE_COUNT; i++) {
    if (work[i] >= 4) continue; // no copies left to draw
    work[i]++;
    if (shanten(work) < current) {
      tiles.push(i);
      count += 4 - counts[i];
    }
    work[i]--;
  }

  return { tiles, count };
}

export interface DiscardOption {
  tile: number;
  tileLabel: string;
  shanten: number;
  ukeire: number;
  acceptedTiles: number[];
}

/**
 * For a 14-tile (3n+2) hand, evaluate every possible discard and return them
 * sorted best-first (lowest resulting shanten, then widest acceptance).
 */
export function analyzeDiscards(counts: number[]): DiscardOption[] {
  const options: DiscardOption[] = [];
  const work = counts.slice();

  for (let i = 0; i < TILE_COUNT; i++) {
    if (work[i] === 0) continue;
    work[i]--;
    const sh = shanten(work);
    const accept = ukeire(work);
    options.push({
      tile: i,
      tileLabel: tileLabel(i),
      shanten: sh,
      ukeire: accept.count,
      acceptedTiles: accept.tiles,
    });
    work[i]++;
  }

  options.sort((a, b) => {
    if (a.shanten !== b.shanten) return a.shanten - b.shanten;
    return b.ukeire - a.ukeire;
  });

  return options;
}

export interface HandAnalysis {
  size: number;
  shanten: number;
  /** Present when the hand is ready (shanten === 0) or complete. */
  complete: boolean;
  /** For 3n+1 hands: tiles that improve the hand. */
  acceptance?: UkeireResult;
  /** For 3n+2 hands: ranked discard suggestions. */
  discards?: DiscardOption[];
}

/** Top-level analysis dispatched on hand size. */
export function analyzeHand(counts: number[]): HandAnalysis {
  const size = handSize(counts);
  const sh = shanten(counts);
  const base: HandAnalysis = {
    size,
    shanten: sh,
    complete: sh < 0,
  };

  if (size % 3 === 2) {
    base.discards = analyzeDiscards(counts);
  } else if (size % 3 === 1) {
    base.acceptance = ukeire(counts);
  }

  return base;
}
