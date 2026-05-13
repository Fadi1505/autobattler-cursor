import type {
  HeroDefinition,
  PlayerData,
  Stats,
  UpgradeCategoryKey,
  UpgradeLevels,
} from "@/core/types";
import {
  computeEffectiveStats,
  createEmptyUpgrades,
  getUpgradeCost,
} from "@/core/upgrades";

/** Default starting values shared by every newly created `Player`. */
const STARTING_TOURNAMENT_HP = 100;
const STARTING_GOLD = 0;
const MAX_TOURNAMENT_HP = 100;

/**
 * A single competitor in the tournament.
 *
 * Owns its hero choice, its persistent tournament HP, its per-match gold
 * pool, and its progression in each of the six upgrade tracks. Effective
 * stats are derived from `baseStats + upgrades` and refreshed every time
 * an upgrade is purchased.
 */
export class Player implements PlayerData {
  public readonly id: number;
  public heroKey: string;
  public stats: Stats;
  public upgrades: UpgradeLevels;
  public tournamentHP: number;
  public gold: number;
  public isHuman: boolean;

  /** Snapshot of the hero's base stats; never mutated after construction. */
  private readonly baseStats: Readonly<Stats>;

  constructor(
    id: number,
    heroKey: string,
    baseStats: Stats,
    options: { isHuman?: boolean; gold?: number; tournamentHP?: number } = {},
  ) {
    this.id = id;
    this.heroKey = heroKey;
    this.baseStats = { ...baseStats };
    this.upgrades = createEmptyUpgrades();
    this.stats = { ...baseStats };
    this.tournamentHP = options.tournamentHP ?? STARTING_TOURNAMENT_HP;
    this.gold = options.gold ?? STARTING_GOLD;
    this.isHuman = options.isHuman ?? false;
  }

  /** Convenience factory: build a Player directly from a `HeroDefinition`. */
  public static fromHero(
    id: number,
    hero: HeroDefinition,
    options: { isHuman?: boolean; gold?: number; tournamentHP?: number } = {},
  ): Player {
    return new Player(id, hero.key, hero.baseStats, options);
  }

  // -------------------------------------------------------------------------
  // Upgrades
  // -------------------------------------------------------------------------

  /** How much gold the next level of `category` costs. */
  public getUpgradeCost(category: UpgradeCategoryKey): number {
    return getUpgradeCost(category, this.upgrades[category]);
  }

  /**
   * Increase the player's level in `category` by 1, recompute stats, and
   * return `true`. No-op + `false` if the player can't afford it.
   *
   * Pass `{ free: true }` to bypass the gold check (e.g. for round rewards).
   */
  public buyUpgrade(
    category: UpgradeCategoryKey,
    options: { free?: boolean } = {},
  ): boolean {
    if (!options.free) {
      const cost = this.getUpgradeCost(category);
      if (this.gold < cost) return false;
      this.gold -= cost;
    }
    this.upgrades[category] += 1;
    this.recomputeStats();
    return true;
  }

  /** Set the level of `category` directly. Useful for save/load and tests. */
  public setUpgradeLevel(category: UpgradeCategoryKey, level: number): void {
    this.upgrades[category] = Math.max(0, Math.floor(level));
    this.recomputeStats();
  }

  /** Recalculate `stats` from `baseStats` and the current `upgrades` map. */
  public recomputeStats(): void {
    this.stats = computeEffectiveStats(this.baseStats, this.upgrades);
  }

  // -------------------------------------------------------------------------
  // Economy / health
  // -------------------------------------------------------------------------

  public addGold(amount: number): void {
    if (amount <= 0) return;
    this.gold += amount;
  }

  public spendGold(amount: number): boolean {
    if (amount <= 0) return true;
    if (this.gold < amount) return false;
    this.gold -= amount;
    return true;
  }

  public takeTournamentDamage(amount: number): void {
    if (amount <= 0) return;
    this.tournamentHP = Math.max(0, this.tournamentHP - amount);
  }

  public healTournament(amount: number): void {
    if (amount <= 0) return;
    this.tournamentHP = Math.min(MAX_TOURNAMENT_HP, this.tournamentHP + amount);
  }

  public isEliminated(): boolean {
    return this.tournamentHP <= 0;
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  /** Plain-object snapshot for saving / network transport. */
  public toJSON(): PlayerData {
    return {
      id: this.id,
      heroKey: this.heroKey,
      stats: { ...this.stats },
      upgrades: { ...this.upgrades },
      tournamentHP: this.tournamentHP,
      gold: this.gold,
      isHuman: this.isHuman,
    };
  }
}
