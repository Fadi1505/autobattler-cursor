import type {
  Stats,
  UpgradeCategoryKey,
  UpgradeLevels,
} from "@/core/types";
import {
  UPGRADE_CATEGORIES,
  UPGRADE_CATEGORY_LIST,
  getUpgradeCategory,
} from "@/data/upgrades";

/**
 * Runtime helpers that operate on the upgrade data table.
 *
 * `data/upgrades.ts` is the single source of truth for *what* each upgrade
 * does and *how much* it costs. This module is a thin functional layer on
 * top that both `Player` and `ShopManager` consume — keep it pure and
 * side-effect-free.
 */

/** Build a fresh `UpgradeLevels` map with every category at 0. */
export function createEmptyUpgrades(): UpgradeLevels {
  const out = {} as UpgradeLevels;
  for (const cat of UPGRADE_CATEGORY_LIST) out[cat.key] = 0;
  return out;
}

/**
 * Gold cost to purchase the *next* level of `category`, given the player
 * is currently at `currentLevel`. Formula:
 *
 *   `floor(baseCost * costMultiplier ^ currentLevel)`
 *
 * Always returns at least 1 — even with aggressive deflation tuning, the
 * shop should never offer free upgrades.
 */
export function getUpgradeCost(
  category: UpgradeCategoryKey,
  currentLevel: number,
): number {
  const cat = getUpgradeCategory(category);
  const cost = Math.floor(cat.baseCost * Math.pow(cat.costMultiplier, currentLevel));
  return Math.max(1, cost);
}

/**
 * Return a brand-new `Stats` object equal to `base` plus the cumulative
 * bonuses from every upgrade category at its current level.
 *
 * Pure & side-effect-free: callers can use it to build a fresh `stats`
 * snapshot whenever upgrades change or a new round begins.
 */
export function computeEffectiveStats(
  base: Readonly<Stats>,
  upgrades: Readonly<UpgradeLevels>,
): Stats {
  const next: Stats = { ...base };
  for (const cat of Object.values(UPGRADE_CATEGORIES)) {
    const level = upgrades[cat.key];
    if (level <= 0) continue;
    next[cat.statAffected] += cat.bonusPerLevel * level;
  }
  return next;
}

/**
 * Compute the stat delta a single additional level in `category` would
 * produce. Handy for the shop's "preview" tooltip — equals
 * `bonusPerLevel` for the affected stat and `0` for every other field.
 */
export function computeUpgradeDelta(category: UpgradeCategoryKey): Partial<Stats> {
  const cat = getUpgradeCategory(category);
  return { [cat.statAffected]: cat.bonusPerLevel };
}
