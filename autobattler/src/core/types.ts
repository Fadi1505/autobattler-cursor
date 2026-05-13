/**
 * Shared TypeScript types for the autobattler core.
 *
 * Keep this file free of runtime logic / heavy imports — it should be cheap
 * to import from anywhere (data tables, scenes, UI, save/load, etc.).
 */

// ---------------------------------------------------------------------------
// Heroes — designer data
// ---------------------------------------------------------------------------

/** High-level archetype of a hero. Used for matchmaking, UI badges, etc. */
export type HeroRole =
  | "Tank"
  | "Bruiser"
  | "Assassin"
  | "Mage"
  | "Marksman"
  | "Support";

/**
 * Combat stat block. Used for both hero base stats and the per-player
 * effective stats after upgrades have been applied.
 *
 * - `hp`         : maximum hit points in a round
 * - `attack`     : flat damage per auto-attack
 * - `defense`    : flat damage reduction
 * - `manaGain`   : mana generated per second of combat (drives ultimates)
 * - `evasion`    : 0..1 probability of dodging an attack
 * - `critChance` : 0..1 probability of a critical hit
 * - `shield`     : flat shield pool absorbed before HP is reduced
 */
export interface Stats {
  hp: number;
  attack: number;
  defense: number;
  manaGain: number;
  evasion: number;
  critChance: number;
  shield: number;
}

// ---------------------------------------------------------------------------
// Abilities & effects
// ---------------------------------------------------------------------------

/** Element used to tag damage / status effects for resists & visuals. */
export type ElementType =
  | "fire"
  | "ice"
  | "poison"
  | "lightning"
  | "physical";

/** Who an `Effect` is applied to. */
export type EffectTarget = "self" | "enemy";

/** Kind of effect produced by an ability. */
export type EffectType =
  | "damage"
  | "heal"
  | "shield"
  | "dot"
  | "stun"
  | "buff"
  | "slow"
  | "lifesteal";

/**
 * A single discrete thing an ability does. Abilities are arrays of these,
 * applied in order, so a single `Ability` can both damage and apply a DoT
 * (for example) by listing two `Effect`s.
 *
 * Semantics by `type`:
 * - `damage`     : instant `value` damage
 * - `heal`       : instant `value` healing
 * - `shield`     : grant a shield of size `value` for `duration?`s
 * - `dot`        : `value` damage per second for `duration` seconds
 * - `stun`       : prevent target from acting for `duration` seconds
 *                  (`value` is reserved for severity / break-resistance)
 * - `buff`       : flat boost (semantics depend on ability description)
 * - `slow`       : reduce target attack/move rate by `value` (0..1) for
 *                  `duration` seconds
 * - `lifesteal`  : convert `value` (0..1) of dealt damage into healing
 */
export interface Effect {
  type: EffectType;
  /** Magnitude — meaning depends on `type` (see above). */
  value: number;
  /** Duration in seconds (only applies to time-based effects). */
  duration?: number;
  /** Element flag for resists & visuals. Defaults to `physical` if omitted. */
  element?: ElementType;
  /** Target side. Defaults to `enemy` for offensive effects. */
  target?: EffectTarget;
}

/** When (and how often) a passive `Ability` fires automatically. */
export type AbilityTrigger = "interval" | "onHit" | "onUltimate";

/**
 * An ability owned by a hero — used for both passives and ultimates.
 *
 * - Passives generally set `trigger`. If `trigger === "interval"` the
 *   ability fires every `cooldown` seconds.
 * - Ultimates generally set `cooldown` only and are activated when the
 *   caster's mana fills up; `trigger` is omitted.
 */
export interface Ability {
  name: string;
  description: string;
  /** Cooldown in seconds (between activations / interval ticks). */
  cooldown?: number;
  /** What causes this ability to fire. Omit for activated ultimates. */
  trigger?: AbilityTrigger;
  /** Ordered list of effects produced when the ability fires. */
  effects: Effect[];
}

/**
 * Static, designer-authored data for a single hero. Renamed from `Hero` so
 * the runtime class in `core/Hero.ts` can own that name without collision.
 */
export interface HeroDefinition {
  /** Stable, machine-readable id (e.g. `"infernoDrake"`). */
  key: string;
  /** Display name (e.g. `"Inferno Drake"`). */
  name: string;
  role: HeroRole;
  description: string;
  baseStats: Stats;
  passive: Ability;
  ultimate: Ability;
}

// ---------------------------------------------------------------------------
// Upgrades
// ---------------------------------------------------------------------------

/**
 * Stable id of one of the six per-player progression tracks. A `Player`
 * (or runtime `Hero`) has a level (>= 0) in each. The metadata for each
 * track — including the cost curve and which `Stats` field it boosts —
 * lives in `data/upgrades.ts` (`UPGRADE_CATEGORIES`).
 */
export type UpgradeCategoryKey =
  | "Attack"
  | "Mana"
  | "Defense"
  | "Evasion"
  | "Critical"
  | "Shield";

/**
 * Designer-authored metadata for a single upgrade track. The values here
 * drive `core/upgrades.ts` (`computeEffectiveStats`, `getUpgradeCost`)
 * and `core/ShopManager.ts`, so tuning the economy and stat growth is
 * a single-table change.
 *
 * `statAffected` is narrowed to `keyof Stats` so it can't refer to a
 * stat that doesn't exist. Bonuses are linear (`bonusPerLevel * level`);
 * cost is `floor(baseCost * costMultiplier ^ currentLevel)`.
 */
export interface UpgradeCategory {
  key: UpgradeCategoryKey;
  /** Display name shown in the shop UI. */
  name: string;
  /** Optional UI icon key (sprite atlas frame). Wired up later. */
  icon?: string;
  description: string;
  /** Gold cost of the very first level (0 → 1). */
  baseCost: number;
  /** Geometric cost growth per level (1.0 = flat, 1.5 = +50% per step). */
  costMultiplier: number;
  /** Which `Stats` field this upgrade modifies. */
  statAffected: keyof Stats;
  /** How much `statAffected` increases per upgrade level. */
  bonusPerLevel: number;
}

/** Map of upgrade category → current level (0 = unupgraded). */
export type UpgradeLevels = Record<UpgradeCategoryKey, number>;

/**
 * What the shop will show / produce when previewing or completing an
 * upgrade purchase. Used by `ShopManager.previewUpgrade()` and
 * `ShopManager.buyUpgrade()`.
 */
export interface UpgradePreview {
  category: UpgradeCategoryKey;
  currentLevel: number;
  nextLevel: number;
  cost: number;
  canAfford: boolean;
  /** Effective stats before the purchase (snapshot). */
  beforeStats: Stats;
  /** Effective stats after the purchase (hypothetical). */
  afterStats: Stats;
  /** Just the changed fields, for UI deltas / tooltips. */
  delta: Partial<Stats>;
}

/** Outcome of `ShopManager.buyUpgrade()`. */
export interface ShopBuyResult {
  success: boolean;
  /** Why the purchase failed (only set when `success` is `false`). */
  reason?: "insufficient_gold" | "invalid_category";
  category?: UpgradeCategoryKey;
  /** New upgrade level after the purchase. */
  newLevel?: number;
  /** Snapshot of the player's stats *after* the purchase. */
  newStats?: Stats;
  cost?: number;
}

/** Outcome of `ShopManager.reroll()`. */
export interface RerollResult {
  success: boolean;
  reason?: "insufficient_gold";
  cost?: number;
}

/**
 * Gold breakdown produced by `ShopManager.computeRoundIncome()` and used
 * by `GameState.endRound()` so the UI can show a satisfying "+40 win, +3
 * interest" pop.
 */
export interface RoundIncome {
  wasWin: boolean;
  /** Flat per-round payout (win or lose). */
  baseGold: number;
  /** TFT-style interest, +1 per 10 held, capped. */
  interest: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

/**
 * Plain-data shape of a `Player`. The `Player` class implements this
 * interface, which makes it trivial to serialize to JSON for save files
 * and to reason about player snapshots in tests.
 */
export interface PlayerData {
  id: number;
  heroKey: string;
  /** Effective stats for this round (base + upgrades). */
  stats: Stats;
  upgrades: UpgradeLevels;
  /** Tournament-level HP pool; eliminated when this hits 0. */
  tournamentHP: number;
  /** Per-match gold used for buying units / shop rerolls. */
  gold: number;
  /** Whether the player is human-controlled. Bots otherwise. */
  isHuman: boolean;
}

// ---------------------------------------------------------------------------
// Match history
// ---------------------------------------------------------------------------

/** Result of a single round between two players. */
export interface RoundResult {
  round: number;
  /** ID of the player who won the round, or null on a draw. */
  winnerId: number | null;
  loserId: number | null;
  /** HP damage dealt to the loser's tournament HP pool. */
  damageDealt: number;
}

/** Fully-played match record, suitable for stats screens and save files. */
export interface MatchRecord {
  matchId: string;
  startedAt: number;
  endedAt: number | null;
  /** Heroes picked, indexed by player id. */
  heroesByPlayerId: Record<number, string>;
  rounds: RoundResult[];
  /** Player ids ordered by final placement (1st, 2nd, ...). */
  finalStandings: number[];
}

// ---------------------------------------------------------------------------
// Combat — events emitted by the CombatEngine for the log / UI to consume.
// ---------------------------------------------------------------------------

/** Which side of the arena a fighter is on. */
export type CombatSide = "left" | "right";

/**
 * Type of a `CombatEvent` entry.
 *
 * - `attack` : auto-attack landed (non-crit)
 * - `crit`   : auto-attack landed as a critical hit
 * - `evade`  : auto-attack was dodged (no damage)
 * - `ability`: a passive ability fired (interval / onHit / onUltimate)
 * - `ult`    : an ultimate ability was cast
 * - `damage` : non-auto-attack damage was applied (DoT tick, ability dmg)
 * - `heal`   : healing was applied
 * - `death`  : a fighter's HP reached 0
 */
export type CombatEventType =
  | "attack"
  | "ability"
  | "damage"
  | "heal"
  | "crit"
  | "evade"
  | "ult"
  | "death";

/**
 * A single beat in a combat log. Designed to be cheap to produce, easy
 * to serialize, and rich enough that an animation layer can replay an
 * entire fight from these events alone.
 */
export interface CombatEvent {
  /** Simulated combat time when the event happened, in seconds. */
  time: number;
  type: CombatEventType;
  /** Side that caused the event (attacker, caster, healer, etc.). */
  source: CombatSide;
  /** Side that received the event (defender, healed unit, etc.). */
  target: CombatSide;
  /** Numeric payload — damage, heal, shield amount, etc. (when relevant). */
  value?: number;
  /** Display name of the ability that fired (for `ability` / `ult`). */
  abilityName?: string;
  /** Tag for nested causes — e.g. `"dot"`, `"fire"`, `"lifesteal"`. */
  effectType?: string;
}
