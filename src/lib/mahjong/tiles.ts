// ---------------------------------------------------------------------------
// Mahjong tile model (Riichi / Japanese mahjong)
//
// Tiles are represented internally as an index 0–33 into a 34-length count
// array. This is the standard representation used by shanten / efficiency
// engines and keeps the math fast and allocation-free.
//
//   0–8   man (characters)   1m … 9m
//   9–17  pin (circles)      1p … 9p
//   18–26 sou (bamboo)       1s … 9s
//   27–33 honors            E, S, W, N, White, Green, Red
// ---------------------------------------------------------------------------

export type Suit = "m" | "p" | "s" | "z";

export const TILE_COUNT = 34;
export const MAN_BASE = 0;
export const PIN_BASE = 9;
export const SOU_BASE = 18;
export const HONOR_BASE = 27;

/** Honor tiles in index order (27–33). */
export const HONOR_NAMES = [
  "East",
  "South",
  "West",
  "North",
  "White",
  "Green",
  "Red",
] as const;

/** Empty 34-length count array. */
export function emptyHand(): number[] {
  return new Array<number>(TILE_COUNT).fill(0);
}

/** Total number of tiles in a hand (sum of counts). */
export function handSize(counts: number[]): number {
  return counts.reduce((a, b) => a + b, 0);
}

export function isSuited(index: number): boolean {
  return index < HONOR_BASE;
}

export function isHonor(index: number): boolean {
  return index >= HONOR_BASE;
}

export function isTerminalOrHonor(index: number): boolean {
  if (isHonor(index)) return true;
  const rank = index % 9; // 0 = "1", 8 = "9"
  return rank === 0 || rank === 8;
}

/** The 13 terminal/honor tile indices (used for thirteen-orphans). */
export const TERMINALS_AND_HONORS: number[] = [
  MAN_BASE, MAN_BASE + 8,
  PIN_BASE, PIN_BASE + 8,
  SOU_BASE, SOU_BASE + 8,
  HONOR_BASE, HONOR_BASE + 1, HONOR_BASE + 2, HONOR_BASE + 3,
  HONOR_BASE + 4, HONOR_BASE + 5, HONOR_BASE + 6,
];

/** Parse compact notation like "123m456p789s11z" into a count array. */
export function parseHand(notation: string): number[] {
  const counts = emptyHand();
  const cleaned = notation.replace(/\s+/g, "").toLowerCase();
  let pending: number[] = [];

  for (const ch of cleaned) {
    if (ch >= "1" && ch <= "9") {
      pending.push(Number(ch));
      continue;
    }
    const suit = ch as Suit;
    if (suit !== "m" && suit !== "p" && suit !== "s" && suit !== "z") {
      throw new Error(`Unexpected character "${ch}" in hand notation`);
    }
    for (const digit of pending) {
      const index = digitToIndex(digit, suit);
      if (index === -1) {
        throw new Error(`Invalid tile "${digit}${suit}"`);
      }
      counts[index] += 1;
    }
    pending = [];
  }

  if (pending.length > 0) {
    throw new Error("Hand notation ended without a suit letter");
  }

  return counts;
}

function digitToIndex(digit: number, suit: Suit): number {
  if (suit === "z") {
    // 1z..7z → E,S,W,N,White,Green,Red
    if (digit < 1 || digit > 7) return -1;
    return HONOR_BASE + (digit - 1);
  }
  if (digit < 1 || digit > 9) return -1;
  const base = suit === "m" ? MAN_BASE : suit === "p" ? PIN_BASE : SOU_BASE;
  return base + (digit - 1);
}

/** Serialize a count array back to compact notation. */
export function handToNotation(counts: number[]): string {
  const parts: string[] = [];
  const suits: { suit: Suit; base: number; length: number }[] = [
    { suit: "m", base: MAN_BASE, length: 9 },
    { suit: "p", base: PIN_BASE, length: 9 },
    { suit: "s", base: SOU_BASE, length: 9 },
    { suit: "z", base: HONOR_BASE, length: 7 },
  ];

  for (const { suit, base, length } of suits) {
    let digits = "";
    for (let r = 0; r < length; r++) {
      const n = counts[base + r];
      for (let k = 0; k < n; k++) digits += String(r + 1);
    }
    if (digits) parts.push(digits + suit);
  }

  return parts.join("");
}

/** Human-readable label for a single tile index, e.g. "3p" or "Red". */
export function tileLabel(index: number): string {
  if (isHonor(index)) return HONOR_NAMES[index - HONOR_BASE];
  const rank = (index % 9) + 1;
  const suit = index < PIN_BASE ? "m" : index < SOU_BASE ? "p" : "s";
  return `${rank}${suit}`;
}

// Unicode mahjong tile glyphs (U+1F000 block).
const HONOR_GLYPHS: Record<number, string> = {
  0: "🀀", // East
  1: "🀁", // South
  2: "🀂", // West
  3: "🀃", // North
  4: "🀆", // White (haku)
  5: "🀅", // Green (hatsu)
  6: "🀄", // Red (chun)
};

/** Unicode glyph for a tile index, suitable for rendering in the UI. */
export function tileGlyph(index: number): string {
  if (isHonor(index)) return HONOR_GLYPHS[index - HONOR_BASE];
  const rank = index % 9; // 0..8
  if (index < PIN_BASE) return String.fromCodePoint(0x1f007 + rank); // man
  if (index < SOU_BASE) return String.fromCodePoint(0x1f019 + rank); // pin
  return String.fromCodePoint(0x1f010 + rank); // sou
}

/** Expand a count array into a sorted list of individual tile indices. */
export function handToTiles(counts: number[]): number[] {
  const tiles: number[] = [];
  for (let i = 0; i < TILE_COUNT; i++) {
    for (let k = 0; k < counts[i]; k++) tiles.push(i);
  }
  return tiles;
}
