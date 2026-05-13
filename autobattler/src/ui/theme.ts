import type { HeroRole } from "@/core/types";

/**
 * Centralised look-and-feel constants for the fantasy UI.
 *
 * - `COLORS.*` are 0xRRGGBB ints (Phaser Graphics / tint).
 * - `HEX.*` are CSS strings (Text style.color, scene backgroundColor).
 * - `FONTS.*` are CSS font-family strings (with safe fallbacks if the
 *   Google Fonts in `index.html` fail to load).
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const COLORS = {
  // Backgrounds — dark parchment / inky brown.
  bgBlack: 0x0a0606,
  bgDark: 0x140e08,
  bgParchment: 0x231811,
  bgPanel: 0x33241a,
  bgPanelLight: 0x483320,
  bgPanelHover: 0x5a4128,

  // Gold accents.
  goldDeep: 0x8b6914,
  goldBright: 0xd4af37,
  goldGlow: 0xf4d76b,

  // Text.
  textBright: 0xf4e4a3,
  textNormal: 0xe6d3a3,
  textMuted: 0x8a7853,
  textDim: 0x5e4d33,
  textDark: 0x140e08,

  // Semantic accents.
  red: 0xc44d4d,
  redDeep: 0x7a2828,
  green: 0x5ec46c,
  greenDeep: 0x2a6e35,
  blue: 0x4d8cc4,
  purple: 0xa64dc4,
  orange: 0xc4793e,
} as const;

/** CSS string equivalents — Phaser Text and DOM backgrounds want strings. */
export const HEX = {
  bgBlack: "#0a0606",
  bgDark: "#140e08",
  bgParchment: "#231811",
  bgPanel: "#33241a",
  goldDeep: "#8b6914",
  goldBright: "#d4af37",
  goldGlow: "#f4d76b",
  textBright: "#f4e4a3",
  textNormal: "#e6d3a3",
  textMuted: "#8a7853",
  textDim: "#5e4d33",
  textDark: "#140e08",
  red: "#c44d4d",
  green: "#5ec46c",
  blue: "#4d8cc4",
  purple: "#a64dc4",
  orange: "#c4793e",
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/**
 * Font stacks — primary face is loaded in `index.html`; subsequent entries
 * are graceful fallbacks if the Google Font request fails.
 */
export const FONTS = {
  /** Fantasy serif — for hero names, scene titles, "VICTORY". */
  title: '"Cinzel", "Trajan Pro", Georgia, "Times New Roman", serif',
  /** Clean body sans — for descriptions, button labels. */
  body: '"Inter", system-ui, "Segoe UI", Roboto, sans-serif',
  /** Pixel-y monospace — for HP, gold, level numbers. */
  number: '"VT323", "Courier New", Consolas, monospace',
} as const;

/** Recommended font sizes (px). Override per-call when needed. */
export const FONT_SIZE = {
  micro: 12,
  small: 14,
  body: 18,
  medium: 22,
  large: 28,
  xlarge: 40,
  hero: 64,
  banner: 96,
} as const;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Logical viewport — kept in sync with `utils/constants.ts`. */
export const SCREEN = { width: 1280, height: 720 } as const;

/** Center point — used frequently for `.setOrigin(0.5)` layouts. */
export const CENTER = {
  x: SCREEN.width / 2,
  y: SCREEN.height / 2,
} as const;

// ---------------------------------------------------------------------------
// Role palette — colors used for hero portraits & role badges.
// ---------------------------------------------------------------------------

export const ROLE_COLOR: Record<HeroRole, number> = {
  Tank: 0x4d8cc4,
  Bruiser: 0xc4793e,
  Assassin: 0xa64dc4,
  Mage: 0xc44dc4,
  Marksman: 0x5ec46c,
  Support: 0xe8c468,
} as const;

export const ROLE_HEX: Record<HeroRole, string> = {
  Tank: "#4d8cc4",
  Bruiser: "#c4793e",
  Assassin: "#a64dc4",
  Mage: "#c44dc4",
  Marksman: "#5ec46c",
  Support: "#e8c468",
} as const;
