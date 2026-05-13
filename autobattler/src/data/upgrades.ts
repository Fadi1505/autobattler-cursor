import type { UpgradeCategory, UpgradeCategoryKey } from "@/core/types";

/**
 * The six upgrade tracks players can buy from the shop. This is the single
 * source of truth for both the **stat growth** (`statAffected`,
 * `bonusPerLevel`) and the **gold economy** (`baseCost`, `costMultiplier`),
 * so re-balancing the entire progression system is a one-file change.
 *
 * Typing as `Record<UpgradeCategoryKey, UpgradeCategory>` gives us
 * exhaustiveness: if a new key is added to `UpgradeCategoryKey`, this file
 * fails to compile until the corresponding row is added below.
 *
 * Iteration order matches the declaration order below, which is also the
 * order they appear in the shop UI.
 */
export const UPGRADE_CATEGORIES: Record<UpgradeCategoryKey, UpgradeCategory> = {
  Attack: {
    key: "Attack",
    name: "Attack",
    description: "Increases the damage of your auto-attacks.",
    baseCost: 3,
    costMultiplier: 1.4,
    statAffected: "attack",
    bonusPerLevel: 5,
  },

  Mana: {
    key: "Mana",
    name: "Mana",
    description:
      "Generates more mana per hit so your ultimate fires more often.",
    baseCost: 2,
    costMultiplier: 1.35,
    statAffected: "manaGain",
    bonusPerLevel: 1,
  },

  Defense: {
    key: "Defense",
    name: "Defense",
    description: "Reduces flat damage taken from enemy auto-attacks.",
    baseCost: 3,
    costMultiplier: 1.4,
    statAffected: "defense",
    bonusPerLevel: 3,
  },

  Evasion: {
    key: "Evasion",
    name: "Evasion",
    description: "Chance to completely dodge an incoming auto-attack.",
    baseCost: 4,
    costMultiplier: 1.5,
    statAffected: "evasion",
    bonusPerLevel: 0.02,
  },

  Critical: {
    key: "Critical",
    name: "Critical Strike",
    description: "Chance for your auto-attacks to deal double damage.",
    baseCost: 4,
    costMultiplier: 1.5,
    statAffected: "critChance",
    bonusPerLevel: 0.03,
  },

  Shield: {
    key: "Shield",
    name: "Shield",
    description: "Adds a flat shield pool that absorbs damage before HP.",
    baseCost: 3,
    costMultiplier: 1.45,
    statAffected: "shield",
    bonusPerLevel: 25,
  },
};

/** Canonical, ordered list of all upgrade categories (UI order). */
export const UPGRADE_CATEGORY_LIST: readonly UpgradeCategory[] = Object.values(
  UPGRADE_CATEGORIES,
);

/** All upgrade category keys, in canonical order. */
export const UPGRADE_CATEGORY_KEYS: readonly UpgradeCategoryKey[] =
  UPGRADE_CATEGORY_LIST.map((c) => c.key);

/**
 * Throw-on-miss lookup. Use when you have a typed `UpgradeCategoryKey`.
 * For UI-supplied strings prefer `tryGetUpgradeCategory()`.
 */
export function getUpgradeCategory(key: UpgradeCategoryKey): UpgradeCategory {
  return UPGRADE_CATEGORIES[key];
}

/** Safe lookup that returns `undefined` if `key` is not a known category. */
export function tryGetUpgradeCategory(
  key: string,
): UpgradeCategory | undefined {
  return (UPGRADE_CATEGORIES as Record<string, UpgradeCategory | undefined>)[
    key
  ];
}

/** Type guard: `true` if `key` is one of the known category keys. */
export function isUpgradeCategoryKey(key: string): key is UpgradeCategoryKey {
  return Object.prototype.hasOwnProperty.call(UPGRADE_CATEGORIES, key);
}
