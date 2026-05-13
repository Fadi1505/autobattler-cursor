import type {
  Ability,
  HeroDefinition,
  HeroRole,
  Stats,
  UpgradeCategoryKey,
  UpgradeLevels,
} from "@/core/types";
import {
  computeEffectiveStats,
  createEmptyUpgrades,
} from "@/core/upgrades";
import { getHero } from "@/data/heroes";

/**
 * Runtime instance of a hero on the board.
 *
 * Wraps the static `HeroDefinition` (loaded from `data/heroes.ts`) with the
 * mutable per-match state every fighting unit needs: an `upgrades` map and
 * a `currentStats` block derived from `baseStats + upgrades`.
 *
 * `currentStats` is intentionally writable — combat systems can apply
 * temporary debuffs / buffs to it during a round, and `resetForNewRound()`
 * rebuilds it cleanly from `baseStats + upgrades` at the start of the
 * next round, so transient combat state never leaks across rounds.
 */
export class Hero {
  /** Underlying designer data (immutable). */
  public readonly definition: HeroDefinition;

  /** Convenience pass-throughs to the definition. */
  public readonly key: string;
  public readonly name: string;
  public readonly role: HeroRole;

  /** Current upgrade level per category (0 = unupgraded). */
  public upgrades: UpgradeLevels;

  /**
   * Live stats used by the combat system. Equal to `baseStats + upgrades`
   * after `resetForNewRound()` / `applyUpgrade()`; may be temporarily
   * mutated mid-combat by buffs / debuffs.
   */
  public currentStats: Stats;

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  constructor(definition: HeroDefinition) {
    this.definition = definition;
    this.key = definition.key;
    this.name = definition.name;
    this.role = definition.role;
    this.upgrades = createEmptyUpgrades();
    // currentStats is set below by `resetForNewRound()`.
    this.currentStats = { ...definition.baseStats };
    this.resetForNewRound();
  }

  /** Build a `Hero` from its data-table key. Throws on unknown keys. */
  public static fromKey(key: string): Hero {
    return new Hero(getHero(key));
  }

  /**
   * Build a `Hero` from a key, pre-applying the given upgrade levels. Useful
   * when restoring a Player's Hero between rounds with their accumulated
   * progression already in place.
   */
  public static fromKeyWithUpgrades(
    key: string,
    upgrades: Readonly<UpgradeLevels>,
  ): Hero {
    const hero = Hero.fromKey(key);
    hero.upgrades = { ...upgrades };
    hero.resetForNewRound();
    return hero;
  }

  // -------------------------------------------------------------------------
  // Stat queries
  // -------------------------------------------------------------------------

  /**
   * Read the current value of a single stat. Equivalent to
   * `hero.currentStats[stat]`, but written this way so call sites read
   * naturally and we can swap in caching / derived stats later without
   * changing every reference.
   */
  public getCurrentStat<K extends keyof Stats>(stat: K): Stats[K] {
    return this.currentStats[stat];
  }

  /** Read the unmodified base value for a stat (before upgrades). */
  public getBaseStat<K extends keyof Stats>(stat: K): Stats[K] {
    return this.definition.baseStats[stat];
  }

  /** Hero's passive ability (always-on / triggered). */
  public getPassive(): Ability {
    return this.definition.passive;
  }

  /** Hero's ultimate ability (mana-gated activation). */
  public getUltimate(): Ability {
    return this.definition.ultimate;
  }

  // -------------------------------------------------------------------------
  // Upgrades
  // -------------------------------------------------------------------------

  /** Increase the upgrade level for `category` by 1, then refresh stats. */
  public applyUpgrade(category: UpgradeCategoryKey): void {
    this.upgrades[category] += 1;
    this.refreshFromUpgrades();
  }

  /** Set the upgrade level for `category` directly. Useful for save/load. */
  public setUpgradeLevel(
    category: UpgradeCategoryKey,
    level: number,
  ): void {
    this.upgrades[category] = Math.max(0, Math.floor(level));
    this.refreshFromUpgrades();
  }

  // -------------------------------------------------------------------------
  // Round lifecycle
  // -------------------------------------------------------------------------

  /**
   * Rebuild `currentStats` from `baseStats + upgrades`.
   *
   * Call at the start of every new round to clear any transient combat
   * modifications (debuffs, buffs, broken shields, etc.) while keeping
   * the player's accumulated upgrade progression intact.
   */
  public resetForNewRound(): void {
    this.refreshFromUpgrades();
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * Recompute `currentStats` from the immutable base stats plus the
   * current upgrade levels. Shared between `applyUpgrade()`,
   * `setUpgradeLevel()`, and `resetForNewRound()`.
   */
  private refreshFromUpgrades(): void {
    this.currentStats = computeEffectiveStats(
      this.definition.baseStats,
      this.upgrades,
    );
  }
}
