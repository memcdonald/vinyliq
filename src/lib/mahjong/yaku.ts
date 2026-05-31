// ---------------------------------------------------------------------------
// A compact reference of common Riichi yaku (scoring hands) used by the
// coach's "Yaku reference" panel. This is static teaching data, not scoring
// logic — the coach explains and the engine measures, but a player still
// needs at least one yaku to win.
// ---------------------------------------------------------------------------

export interface Yaku {
  name: string;
  japanese: string;
  /** Han value when closed (concealed). */
  han: number;
  /** Whether the value drops by one han when the hand is open. */
  openPenalty: boolean;
  description: string;
}

export const YAKU: Yaku[] = [
  {
    name: "Riichi",
    japanese: "立直",
    han: 1,
    openPenalty: false,
    description:
      "Declare a closed ready hand by betting 1000 points. The backbone of defensive-into-offensive play.",
  },
  {
    name: "Tsumo",
    japanese: "門前清自摸和",
    han: 1,
    openPenalty: false,
    description: "Win by self-draw with a fully concealed hand.",
  },
  {
    name: "Pinfu",
    japanese: "平和",
    han: 1,
    openPenalty: false,
    description:
      "All sequences, a non-yakuhai pair, and a two-sided wait. Rewards a flat, flexible shape.",
  },
  {
    name: "Tanyao",
    japanese: "断幺九",
    han: 1,
    openPenalty: false,
    description:
      "No terminals or honors — only 2–8 tiles. The most common everyday yaku.",
  },
  {
    name: "Iipeikou",
    japanese: "一盃口",
    han: 1,
    openPenalty: false,
    description: "Two identical sequences in the same suit (closed only).",
  },
  {
    name: "Yakuhai",
    japanese: "役牌",
    han: 1,
    openPenalty: false,
    description:
      "A triplet of dragons, the round wind, or your seat wind. The fastest open yaku.",
  },
  {
    name: "Sanshoku",
    japanese: "三色同順",
    han: 2,
    openPenalty: true,
    description: "The same sequence in all three suits, e.g. 234m 234p 234s.",
  },
  {
    name: "Ittsuu",
    japanese: "一気通貫",
    han: 2,
    openPenalty: true,
    description: "A full straight 1–9 in one suit (123 456 789).",
  },
  {
    name: "Chiitoitsu",
    japanese: "七対子",
    han: 2,
    openPenalty: false,
    description: "Seven distinct pairs. Always 25 fu, closed only.",
  },
  {
    name: "Toitoi",
    japanese: "対々和",
    han: 2,
    openPenalty: false,
    description: "All triplets (no sequences).",
  },
  {
    name: "Honitsu",
    japanese: "混一色",
    han: 3,
    openPenalty: true,
    description: "One suit plus honors only.",
  },
  {
    name: "Chinitsu",
    japanese: "清一色",
    han: 6,
    openPenalty: true,
    description: "A single suit, no honors. The premier flush hand.",
  },
];

export interface Lesson {
  title: string;
  body: string;
}

/** Bite-size strategy lessons surfaced as quick prompts in the coach. */
export const LESSONS: Lesson[] = [
  {
    title: "Count your shanten first",
    body: "Before every discard, know how far you are from tenpai. The shanten number tells you whether to push for speed or value.",
  },
  {
    title: "Maximize acceptance early",
    body: "In the first few turns, keep the discard that leaves the widest ukeire (the most tiles that advance your hand), even if it isn't the prettiest shape.",
  },
  {
    title: "Two-sided beats closed waits",
    body: "A ryanmen wait (e.g. 34 waiting 2/5) accepts 8 tiles; a kanchan (e.g. 13 waiting 2) only 4. Prefer open-ended shapes.",
  },
  {
    title: "You need a yaku to win",
    body: "A complete shape is worthless without at least one yaku. Riichi, tanyao, and yakuhai are your everyday routes.",
  },
  {
    title: "Fold when the board turns",
    body: "If an opponent declares riichi and your hand is far from tenpai, switching to safe discards (genbutsu) often beats chasing.",
  },
];
