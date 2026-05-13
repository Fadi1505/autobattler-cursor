import type { Player } from "@/core/Player";
import type {
  RerollResult,
  RoundIncome,
  ShopBuyResult,
  Stats,
  UpgradeCategory,
  UpgradeCategoryKey,
  UpgradePreview,
} from "@/core/types";
import { getUpgradeCost } from "@/core/upgrades";
import {
  UPGRADE_CATEGORIES,
  UPGRADE_CATEGORY_LIST,
  tryGetUpgradeCategory,
} from "@/data/upgrades";

// ---------------------------------------------------------------------------
// Economy tunables — single place to retune the round-end gold rules.
// ---------------------------------------------------------------------------

/** Gold awarded to a player who won their round. */
const ROUND_WIN_GOLD = 40;

/** Gold awarded to a player who lost their round. */
const ROUND_LOSE_GOLD = 20;

/** TFT-style interest: +1 gold per `INTEREST_PER` held this round end. */
const INTEREST_PER = 10;

/** Maximum interest applied each round end. */
const INTEREST_CAP = 5;

/** Default cost to reroll the (future) special-card section of the shop. */
const DEFAULT_REROLL_COST = 2;

// ---------------------------------------------------------------------------
// Per-category offering, designed to back a one-row shop UI cleanly.
// ---------------------------------------------------------------------------

/** A single row of the shop UI: the category + everything the UI needs. */
export interface ShopOffering {
  category: UpgradeCategory;
  currentLevel: number;
  nextLevel: number;
  cost: number;
  canAfford: boolean;
}

// ---------------------------------------------------------------------------
// ShopManager — owns the per-round upgrade economy.
// ---------------------------------------------------------------------------

export interface ShopManagerOptions {
  /** Gold cost for `reroll()`. Defaults to 2. */
  rerollCost?: number;
}

/**
 * Per-match shop. Stateless with respect to *which* player is shopping
 * (every method that touches gold/upgrades accepts the `Player` it should
 * operate on), so the same instance can be used for both the human and
 * bot decisions during round-end resolution.
 *
 * The class is intentionally not a singleton: `GameState` constructs one
 * per match in `startNewMatch()` and exposes it as `currentShop`. Tests
 * and AI scratch code can freely construct their own.
 */
export class ShopManager {
  private readonly rerollCost: number;
  /** Number of rerolls used this match — for stats/UI. */
  private rerollsUsed = 0;

  constructor(options: ShopManagerOptions = {}) {
    this.rerollCost = options.rerollCost ?? DEFAULT_REROLL_COST;
  }

  // -------------------------------------------------------------------------
  // Catalogue helpers
  // -------------------------------------------------------------------------

  /** All six categories in canonical UI order. */
  public getCategories(): readonly UpgradeCategory[] {
    return UPGRADE_CATEGORY_LIST;
  }

  /** Strict lookup for a category by key. */
  public getCategory(key: UpgradeCategoryKey): UpgradeCategory {
    return UPGRADE_CATEGORIES[key];
  }

  // -------------------------------------------------------------------------
  // Per-player views
  // -------------------------------------------------------------------------

  /**
   * Build the full row-set for a shop UI: one `ShopOffering` per category,
   * each pre-populated with the player's current level and whether they
   * can afford the next step. Cheap enough to call every frame.
   */
  public getOfferings(player: Player): ShopOffering[] {
    return UPGRADE_CATEGORY_LIST.map((cat) => this.buildOffering(cat, player));
  }

  /** Single-category version of `getOfferings()`. */
  public getOffering(
    category: UpgradeCategoryKey,
    player: Player,
  ): ShopOffering {
    return this.buildOffering(this.getCategory(category), player);
  }

  /** Gold cost of buying the next level of `category` for this player. */
  public getUpgradeCost(
    category: UpgradeCategoryKey,
    player: Player,
  ): number {
    return getUpgradeCost(category, player.upgrades[category]);
  }

  /** Whether the player has enough gold to buy the next level of `category`. */
  public canAfford(category: UpgradeCategoryKey, player: Player): boolean {
    return player.gold >= this.getUpgradeCost(category, player);
  }

  // -------------------------------------------------------------------------
  // Preview — non-mutating "what would my stats become?" helper
  // -------------------------------------------------------------------------

  /**
   * Return what the player's stats would look like *after* buying one more
   * level of `category`, without mutating anything. Returns `null` if
   * `category` isn't a known upgrade key (e.g. a stale UI button).
   *
   * The `delta` field is just the single-stat change; the UI can format it
   * as e.g. `Attack +5` without re-deriving anything.
   */
  public previewUpgrade(
    category: string,
    player: Player,
  ): UpgradePreview | null {
    const cat = tryGetUpgradeCategory(category);
    if (!cat) return null;

    const currentLevel = player.upgrades[cat.key];
    const cost = getUpgradeCost(cat.key, currentLevel);
    const beforeStats: Stats = { ...player.stats };
    const afterStats: Stats = { ...beforeStats };
    afterStats[cat.statAffected] += cat.bonusPerLevel;

    return {
      category: cat.key,
      currentLevel,
      nextLevel: currentLevel + 1,
      cost,
      canAfford: player.gold >= cost,
      beforeStats,
      afterStats,
      delta: { [cat.statAffected]: cat.bonusPerLevel },
    };
  }

  // -------------------------------------------------------------------------
  // Buying
  // -------------------------------------------------------------------------

  /**
   * Attempt to buy one level of `category` for `player`. Returns a result
   * object describing success or failure plus a fresh stats snapshot so
   * the UI can update without having to re-read `player.stats`.
   *
   * Never throws — even an unknown category key returns a failure result.
   */
  public buyUpgrade(category: string, player: Player): ShopBuyResult {
    const cat = tryGetUpgradeCategory(category);
    if (!cat) {
      return { success: false, reason: "invalid_category" };
    }

    const currentLevel = player.upgrades[cat.key];
    const cost = getUpgradeCost(cat.key, currentLevel);
    if (player.gold < cost) {
      return {
        success: false,
        reason: "insufficient_gold",
        category: cat.key,
        cost,
      };
    }

    // Delegate the actual deduction + level bump + stat recompute to the
    // `Player` so its own invariants stay enforced. The cost check above
    // guarantees this won't fail with `false`.
    player.buyUpgrade(cat.key);

    return {
      success: true,
      category: cat.key,
      newLevel: currentLevel + 1,
      newStats: { ...player.stats },
      cost,
    };
  }

  // -------------------------------------------------------------------------
  // Reroll (placeholder for the future special-cards section)
  // -------------------------------------------------------------------------

  public getRerollCost(): number {
    return this.rerollCost;
  }

  public getRerollsUsed(): number {
    return this.rerollsUsed;
  }

  /**
   * Spend `rerollCost` gold to reroll the (currently nonexistent) special
   * cards section of the shop. The deduction is real; the visible effect
   * will land when that section is implemented. For now the method just
   * enforces the economy so we can wire up the button in UI right away.
   */
  public reroll(player: Player): RerollResult {
    if (player.gold < this.rerollCost) {
      return {
        success: false,
        reason: "insufficient_gold",
        cost: this.rerollCost,
      };
    }
    player.spendGold(this.rerollCost);
    this.rerollsUsed += 1;
    return { success: true, cost: this.rerollCost };
  }

  // -------------------------------------------------------------------------
  // Round-end economy
  // -------------------------------------------------------------------------

  /**
   * Compute the gold a player should receive when their round ends:
   * a flat base (40 win / 20 lose) plus TFT-style interest (+1 per 10 gold
   * currently held, capped at +5).
   *
   * Pure / static so AI code can probe income without instantiating a shop.
   */
  public static computeRoundIncome(
    wasWin: boolean,
    currentGold: number,
  ): RoundIncome {
    const baseGold = wasWin ? ROUND_WIN_GOLD : ROUND_LOSE_GOLD;
    const interest = Math.min(
      INTEREST_CAP,
      Math.max(0, Math.floor(currentGold / INTEREST_PER)),
    );
    return {
      wasWin,
      baseGold,
      interest,
      total: baseGold + interest,
    };
  }

  /**
   * Apply round-end gold to `player`, returning the breakdown so the UI
   * can show "+40 win, +3 interest" style toasts.
   */
  public awardRoundIncome(player: Player, wasWin: boolean): RoundIncome {
    const income = ShopManager.computeRoundIncome(wasWin, player.gold);
    player.addGold(income.total);
    return income;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private buildOffering(
    category: UpgradeCategory,
    player: Player,
  ): ShopOffering {
    const currentLevel = player.upgrades[category.key];
    const cost = getUpgradeCost(category.key, currentLevel);
    return {
      category,
      currentLevel,
      nextLevel: currentLevel + 1,
      cost,
      canAfford: player.gold >= cost,
    };
  }
}
