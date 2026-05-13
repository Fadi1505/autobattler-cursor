import type { Player } from "@/core/Player";
import type {
  Ability,
  CombatSide,
  Effect,
  EffectType,
  ElementType,
  HeroDefinition,
  Stats,
} from "@/core/types";
import { CombatLog } from "@/core/CombatLog";
import { getHero } from "@/data/heroes";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Internal simulation step (seconds). 20 Hz keeps DoT / cooldown math stable. */
const TICK_SIZE = 0.05;

/** Hard time cap; fights that don't resolve get scored by remaining HP. */
const DEFAULT_MAX_DURATION = 60;

/** Seconds between auto-attacks at zero slow. */
const BASE_ATTACK_INTERVAL = 1.0;

/** Mana regenerated per second of combat (in addition to per-hit `manaGain`). */
const BASE_MANA_REGEN_PER_SEC = 10;

/** Mana required to cast an ultimate. */
const ULTIMATE_MANA_COST = 100;

/** Multiplier applied to auto-attack damage on a critical hit. */
const CRIT_MULTIPLIER = 2.0;

/** DoT effects deal `value` damage every this many seconds. */
const DOT_TICK_INTERVAL = 1.0;

/** Default RNG seed used for fast (deterministic) simulations. */
const DEFAULT_FAST_SEED = 0xc0ffee;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CombatEngineOptions {
  /** True for live game-loop driven combat, false for instant simulation. */
  realTime?: boolean;
  /**
   * RNG seed. Defaults to a fixed deterministic value in fast mode and to
   * `Date.now()` in real-time mode (so each live fight is unique but still
   * fully reproducible if the seed is captured).
   */
  seed?: number;
  /** Maximum simulated time before the fight is force-ended. Default 60s. */
  maxDuration?: number;
}

/** Read-only snapshot of a fighter, suitable for UI rendering. */
export interface FighterSnapshot {
  side: CombatSide;
  heroKey: string;
  heroName: string;
  hp: number;
  maxHp: number;
  shield: number;
  mana: number;
  isAlive: boolean;
  isStunned: boolean;
  /** Types of effects currently active (DoT, slow, etc.) — for UI badges. */
  activeEffectTypes: EffectType[];
}

/** Final outcome of a fight. */
export interface CombatResult {
  winner: CombatSide | "draw";
  /** Reason the fight ended. */
  reason: "kill" | "timeout";
  /** Simulated time at which the fight ended, in seconds. */
  duration: number;
  leftHpRemaining: number;
  rightHpRemaining: number;
  totalEvents: number;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** A single status effect currently applied to a fighter. */
interface ActiveEffect {
  type: EffectType;
  /** Magnitude — same semantics as the source `Effect.value`. */
  value: number;
  /** Seconds remaining before this effect expires. */
  durationLeft: number;
  /** Used by DoT effects to time their per-second damage ticks. */
  tickTimer: number;
  element?: ElementType;
}

/** Mutable per-fighter state, owned entirely by the engine. */
interface FighterState {
  side: CombatSide;
  player: Player;
  hero: HeroDefinition;
  /** Snapshot of stats taken at fight start; never mutated. */
  stats: Readonly<Stats>;

  hp: number;
  maxHp: number;
  shield: number;
  mana: number;

  /** Seconds until next auto-attack. */
  attackTimer: number;
  /** Seconds until next interval-passive tick (for `interval` triggers only). */
  passiveTimer: number;
  /**
   * Combat time at which the on-hit passive last fired. Used to enforce a
   * cooldown on `onHit`/`onUltimate` passives that declare one.
   */
  passiveLastFiredAt: number;

  effects: ActiveEffect[];
  /** Sum of active `buff` magnitudes — currently treated as flat +attack. */
  bonusAttack: number;
  /** Damage dealt by the most recent auto-attack (used by lifesteal). */
  lastAttackDamage: number;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Two-fighter autobattler combat simulator.
 *
 * Two modes:
 *
 *   1. **Real-time** — feed the engine `dt` from the game loop via
 *      `step(dt)`. The engine advances in fixed `TICK_SIZE` increments
 *      internally, so animations stay smooth without sacrificing
 *      determinism.
 *
 *   2. **Fast / simulation** — call `runToCompletion()` (or pass
 *      `isRealTime=false` to `simulateFight`). The fight is resolved
 *      synchronously and `getResult()` returns the outcome.
 *
 * The same per-tick logic powers both modes, so AI predictions and the
 * animated combat scene always agree on outcomes given the same seed.
 *
 * The engine **never mutates the input `Player` objects**. It snapshots
 * their stats at construction time and operates entirely on internal state,
 * which makes it safe to run hypothetical / preview fights from anywhere.
 */
export class CombatEngine {
  // ------------------------- state ----------------------------------------
  private readonly left: FighterState;
  private readonly right: FighterState;
  private readonly _log: CombatLog = new CombatLog();
  private readonly rng: () => number;
  private readonly maxDuration: number;
  private readonly realTime: boolean;
  private readonly seed: number;

  /** Simulated time in seconds. */
  private time = 0;
  /** Carries leftover `dt` between `step()` calls so we always run whole ticks. */
  private tickAccumulator = 0;
  private finished = false;
  private result: CombatResult | null = null;

  // ------------------------- construction ---------------------------------

  constructor(
    leftPlayer: Player,
    rightPlayer: Player,
    options: CombatEngineOptions = {},
  ) {
    this.realTime = options.realTime ?? false;
    this.maxDuration = options.maxDuration ?? DEFAULT_MAX_DURATION;
    this.seed =
      options.seed ??
      (this.realTime ? Date.now() & 0xffffffff : DEFAULT_FAST_SEED);
    this.rng = mulberry32(this.seed);

    this.left = createFighter(leftPlayer, "left");
    this.right = createFighter(rightPlayer, "right");
  }

  /**
   * Main entry point. Builds a `CombatEngine` for the given pair of players
   * and either resolves the fight immediately (fast mode) or hands the
   * caller an engine they can drive frame-by-frame (real-time mode).
   *
   * Real-time usage:
   * ```
   * const eng = CombatEngine.simulateFight(p1, p2, true);
   * scene.events.on("update", (_, dtMs) => eng.step(dtMs / 1000));
   * if (eng.isFinished()) showResult(eng.getResult()!);
   * ```
   */
  public static simulateFight(
    leftPlayer: Player,
    rightPlayer: Player,
    isRealTime: boolean,
    options: Omit<CombatEngineOptions, "realTime"> = {},
  ): CombatEngine {
    const engine = new CombatEngine(leftPlayer, rightPlayer, {
      ...options,
      realTime: isRealTime,
    });
    if (!isRealTime) engine.runToCompletion();
    return engine;
  }

  // ------------------------- public step API ------------------------------

  /**
   * Advance the simulation by `dt` real-world seconds. Safe to call with any
   * `dt`; the engine internally subdivides into fixed `TICK_SIZE` steps.
   */
  public step(dt: number): void {
    if (this.finished) return;
    if (dt <= 0) return;
    this.tickAccumulator += dt;
    while (this.tickAccumulator >= TICK_SIZE && !this.finished) {
      this.tickAccumulator -= TICK_SIZE;
      this.tickStep();
    }
  }

  /** Resolve the entire fight synchronously. Returns the final result. */
  public runToCompletion(): CombatResult {
    while (!this.finished) this.tickStep();
    return this.result!;
  }

  // ------------------------- introspection --------------------------------

  public isFinished(): boolean {
    return this.finished;
  }

  public getResult(): CombatResult | null {
    return this.result;
  }

  public getLog(): CombatLog {
    return this._log;
  }

  public getElapsedTime(): number {
    return this.time;
  }

  /** Stable seed used by this engine — capture for replays. */
  public getSeed(): number {
    return this.seed;
  }

  public getFighter(side: CombatSide): FighterSnapshot {
    return snapshotFighter(side === "left" ? this.left : this.right);
  }

  public getLeft(): FighterSnapshot {
    return snapshotFighter(this.left);
  }

  public getRight(): FighterSnapshot {
    return snapshotFighter(this.right);
  }

  // ========================================================================
  // Per-tick simulation
  // ========================================================================

  /** Advance the simulation by exactly one `TICK_SIZE`. */
  private tickStep(): void {
    this.time += TICK_SIZE;

    // Fighters act in a fixed order. Ties (e.g. simultaneous deaths) are
    // resolved by giving `left` slight initiative — deterministic and small
    // enough to not affect balance materially.
    this.fighterTick(this.left, this.right);
    if (this.finished) return;
    this.fighterTick(this.right, this.left);
    if (this.finished) return;

    if (this.time >= this.maxDuration) this.finalizeOnTimeout();
  }

  /**
   * Run one tick of behavior for `self` against `foe`:
   *   1. Tick down active effects (DoT, slow, stun, buff expiry).
   *   2. Regenerate mana.
   *   3. Fire interval-trigger passive if its timer elapsed.
   *   4. Cast ultimate if mana is full.
   *   5. Auto-attack if attack timer elapsed (and not stunned).
   */
  private fighterTick(self: FighterState, foe: FighterState): void {
    if (!isAlive(self)) return;

    this.tickEffects(self);
    if (!isAlive(self)) {
      this.killIfDead(self);
      return;
    }

    // Mana regen runs every tick, even while stunned.
    self.mana = clamp(
      self.mana + BASE_MANA_REGEN_PER_SEC * TICK_SIZE,
      0,
      ULTIMATE_MANA_COST,
    );

    // Stun prevents all volitional actions but doesn't pause regen / DoTs.
    const stunned = isStunned(self);

    // Interval-trigger passive (fires on its own cadence regardless of stun? —
    // we gate on stun for fairness; a stunned unit isn't doing anything).
    if (!stunned) this.tryFireIntervalPassive(self, foe);
    if (this.finished) return;

    // Ultimate when mana is full.
    if (!stunned && self.mana >= ULTIMATE_MANA_COST) {
      this.castUltimate(self, foe);
      if (this.finished) return;
    }

    // Auto-attack on its own cadence.
    self.attackTimer -= TICK_SIZE;
    if (!stunned && self.attackTimer <= 0) {
      this.autoAttack(self, foe);
      const slowMul = totalSlowMultiplier(self);
      self.attackTimer = BASE_ATTACK_INTERVAL * slowMul;
      if (this.finished) return;
    }
  }

  // ========================================================================
  // Effects (DoT / stun / slow / buff lifecycle)
  // ========================================================================

  /**
   * Decrement durations and apply per-tick effect logic (DoT damage,
   * buff expiry, etc.). Effects whose duration runs out are removed and
   * any associated bookkeeping (e.g. unwinding a buff's bonus) is undone.
   */
  private tickEffects(self: FighterState): void {
    if (self.effects.length === 0) return;
    const survivors: ActiveEffect[] = [];

    for (const eff of self.effects) {
      eff.durationLeft -= TICK_SIZE;

      if (eff.type === "dot") {
        eff.tickTimer -= TICK_SIZE;
        if (eff.tickTimer <= 0) {
          // DoTs deal their `value` as a flat per-second damage tick. We
          // intentionally bypass evasion / crit / defense — DoT is a
          // post-application drain, not a fresh "hit".
          this.applyRawDamage(self, eff.value, {
            sourceSide: oppositeSide(self.side),
            effectTag: "dot",
            element: eff.element,
          });
          eff.tickTimer += DOT_TICK_INTERVAL;
          if (!isAlive(self)) {
            // Remaining effects don't matter for a dead fighter.
            this.killIfDead(self);
            return;
          }
        }
      }

      if (eff.durationLeft > 0) {
        survivors.push(eff);
      } else {
        // Reverse any side effects of the expiring buff.
        if (eff.type === "buff") self.bonusAttack -= eff.value;
      }
    }

    self.effects = survivors;
  }

  // ========================================================================
  // Auto-attacks
  // ========================================================================

  /**
   * Resolve a single auto-attack from `attacker` against `defender`:
   *
   *   1. Evasion roll (defender). Miss → log `evade`, stop.
   *   2. Crit roll (attacker).
   *   3. Defense reduction → shield absorption → HP damage.
   *   4. Log `attack` (or `crit`).
   *   5. Grant mana (`manaGain`) to the attacker.
   *   6. Trigger any `onHit` passive on the attacker.
   *   7. Death check on defender.
   */
  private autoAttack(attacker: FighterState, defender: FighterState): void {
    if (this.rng() < defender.stats.evasion) {
      this._log.log(this.time, "evade", attacker.side, defender.side);
      return;
    }

    const isCrit = this.rng() < attacker.stats.critChance;
    const baseDmg = effectiveAttack(attacker);
    const rawDmg = isCrit ? baseDmg * CRIT_MULTIPLIER : baseDmg;
    const dealt = this.applyMitigatedDamage(defender, rawDmg, {
      sourceSide: attacker.side,
      element: "physical",
    });

    this._log.log(
      this.time,
      isCrit ? "crit" : "attack",
      attacker.side,
      defender.side,
      { value: dealt, effectType: "physical" },
    );

    attacker.lastAttackDamage = dealt;

    // Gain mana from the swing (attacker contribution + base regen).
    attacker.mana = clamp(
      attacker.mana + attacker.stats.manaGain,
      0,
      ULTIMATE_MANA_COST,
    );

    if (isAlive(defender)) {
      this.tryFireOnHitPassive(attacker, defender);
    } else {
      this.killIfDead(defender);
    }
  }

  // ========================================================================
  // Abilities (passives + ultimates)
  // ========================================================================

  private tryFireIntervalPassive(self: FighterState, foe: FighterState): void {
    const passive = self.hero.passive;
    if (passive.trigger !== "interval") return;
    self.passiveTimer -= TICK_SIZE;
    if (self.passiveTimer > 0) return;
    self.passiveTimer = passive.cooldown ?? DOT_TICK_INTERVAL;
    self.passiveLastFiredAt = this.time;
    this.firePassive(self, foe, passive);
  }

  private tryFireOnHitPassive(self: FighterState, foe: FighterState): void {
    const passive = self.hero.passive;
    if (passive.trigger !== "onHit") return;
    if (!this.isPassiveOffCooldown(self, passive)) return;
    self.passiveLastFiredAt = this.time;
    this.firePassive(self, foe, passive);
  }

  private tryFireOnUltimatePassive(
    self: FighterState,
    foe: FighterState,
  ): void {
    const passive = self.hero.passive;
    if (passive.trigger !== "onUltimate") return;
    if (!this.isPassiveOffCooldown(self, passive)) return;
    self.passiveLastFiredAt = this.time;
    this.firePassive(self, foe, passive);
  }

  private isPassiveOffCooldown(
    self: FighterState,
    passive: Ability,
  ): boolean {
    if (passive.cooldown === undefined) return true;
    return this.time - self.passiveLastFiredAt >= passive.cooldown;
  }

  /** Common dispatch for "this passive just triggered, apply its effects". */
  private firePassive(
    self: FighterState,
    foe: FighterState,
    passive: Ability,
  ): void {
    this._log.log(this.time, "ability", self.side, self.side, {
      abilityName: passive.name,
    });
    for (const eff of passive.effects) {
      this.applyEffect(self, foe, eff, passive.name);
      if (this.finished) return;
    }
  }

  /** Spend mana and resolve the ultimate's effects. */
  private castUltimate(self: FighterState, foe: FighterState): void {
    const ult = self.hero.ultimate;
    self.mana -= ULTIMATE_MANA_COST;

    this._log.log(this.time, "ult", self.side, foe.side, {
      abilityName: ult.name,
    });

    for (const eff of ult.effects) {
      this.applyEffect(self, foe, eff, ult.name);
      if (this.finished) return;
    }

    // Onulti-triggered passives (none in current roster, but supported).
    this.tryFireOnUltimatePassive(self, foe);
  }

  // ========================================================================
  // Effect application (the dispatch from `Effect.type` → engine action)
  // ========================================================================

  /**
   * Apply a single `Effect` produced by an ability. Handles target
   * resolution (`self` vs `enemy`), default elements, and routes to the
   * appropriate sub-handler based on `effect.type`.
   */
  private applyEffect(
    caster: FighterState,
    foe: FighterState,
    effect: Effect,
    abilityName: string,
  ): void {
    const target = resolveTarget(effect, caster, foe);
    const element = effect.element;

    switch (effect.type) {
      case "damage": {
        const dealt = this.applyMitigatedDamage(target, effect.value, {
          sourceSide: caster.side,
          element,
        });
        this._log.log(this.time, "damage", caster.side, target.side, {
          value: dealt,
          abilityName,
          effectType: element ?? "ability",
        });
        if (!isAlive(target)) this.killIfDead(target);
        break;
      }

      case "heal": {
        const healed = applyHeal(target, effect.value);
        this._log.log(this.time, "heal", caster.side, target.side, {
          value: healed,
          abilityName,
          effectType: "heal",
        });
        break;
      }

      case "shield": {
        target.shield += effect.value;
        this._log.log(this.time, "heal", caster.side, target.side, {
          value: effect.value,
          abilityName,
          effectType: "shield",
        });
        break;
      }

      case "lifesteal": {
        // Convert a fraction of the most recent auto-attack damage into
        // healing for the caster. Common pattern for onHit passives.
        const heal = Math.max(0, effect.value * caster.lastAttackDamage);
        if (heal > 0) {
          const healed = applyHeal(caster, heal);
          this._log.log(this.time, "heal", caster.side, caster.side, {
            value: healed,
            abilityName,
            effectType: "lifesteal",
          });
        }
        break;
      }

      case "dot": {
        target.effects.push({
          type: "dot",
          value: effect.value,
          durationLeft: effect.duration ?? 1,
          tickTimer: DOT_TICK_INTERVAL,
          element,
        });
        this._log.log(this.time, "ability", caster.side, target.side, {
          value: effect.value,
          abilityName,
          effectType: `dot:${element ?? "untyped"}`,
        });
        break;
      }

      case "stun": {
        target.effects.push({
          type: "stun",
          value: effect.value,
          durationLeft: effect.duration ?? 1,
          tickTimer: 0,
          element,
        });
        this._log.log(this.time, "ability", caster.side, target.side, {
          abilityName,
          effectType: "stun",
        });
        break;
      }

      case "slow": {
        target.effects.push({
          type: "slow",
          value: clamp(effect.value, 0, 0.95),
          durationLeft: effect.duration ?? 1,
          tickTimer: 0,
          element,
        });
        this._log.log(this.time, "ability", caster.side, target.side, {
          value: effect.value,
          abilityName,
          effectType: "slow",
        });
        break;
      }

      case "buff": {
        // Buffs are interpreted as flat +attack for the duration. The
        // current `Effect` interface intentionally has no `stat` field;
        // when we need richer buffs (evasion, crit, etc.) we'll add one.
        target.bonusAttack += effect.value;
        target.effects.push({
          type: "buff",
          value: effect.value,
          durationLeft: effect.duration ?? 1,
          tickTimer: 0,
          element,
        });
        this._log.log(this.time, "ability", caster.side, target.side, {
          value: effect.value,
          abilityName,
          effectType: "buff",
        });
        break;
      }
    }
  }

  // ========================================================================
  // Damage primitives
  // ========================================================================

  /**
   * Apply `rawDmg` to `target` with full mitigation:
   *   defense subtraction → shield absorption → HP damage.
   *
   * Returns the post-mitigation damage actually dealt to `target`'s HP+shield.
   */
  private applyMitigatedDamage(
    target: FighterState,
    rawDmg: number,
    opts: { sourceSide: CombatSide; element?: ElementType },
  ): number {
    const afterDefense = Math.max(1, rawDmg - target.stats.defense);
    return this.applyRawDamage(target, afterDefense, {
      sourceSide: opts.sourceSide,
      effectTag: opts.element,
    });
  }

  /**
   * Apply raw, fully-resolved damage to `target` (no further mitigation).
   * Drains shield first, then HP. Returns the total damage dealt.
   */
  private applyRawDamage(
    target: FighterState,
    amount: number,
    opts: { sourceSide: CombatSide; effectTag?: string; element?: ElementType },
  ): number {
    if (amount <= 0 || !isAlive(target)) return 0;

    let remaining = amount;
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, remaining);
      target.shield -= absorbed;
      remaining -= absorbed;
    }
    if (remaining > 0) target.hp = Math.max(0, target.hp - remaining);

    // DoT ticks log themselves as `damage` so the UI can pulse the bar.
    if (opts.effectTag === "dot") {
      this._log.log(this.time, "damage", opts.sourceSide, target.side, {
        value: amount,
        effectType: opts.element ? `dot:${opts.element}` : "dot",
      });
    }

    if (!isAlive(target)) this.killIfDead(target);
    return amount;
  }

  // ========================================================================
  // Termination
  // ========================================================================

  /** Log a death and finalize the fight if anyone has fallen. */
  private killIfDead(target: FighterState): void {
    if (target.hp > 0 || this.finished) return;
    this._log.log(this.time, "death", target.side, target.side);

    const otherDead = !isAlive(this.left) && !isAlive(this.right);
    let winner: CombatSide | "draw";
    if (otherDead) winner = "draw";
    else winner = target.side === "left" ? "right" : "left";

    this.finalize({ winner, reason: "kill" });
  }

  /** Score a timed-out fight by remaining HP fraction. */
  private finalizeOnTimeout(): void {
    if (this.finished) return;
    const lFrac = this.left.hp / this.left.maxHp;
    const rFrac = this.right.hp / this.right.maxHp;
    let winner: CombatSide | "draw";
    if (lFrac > rFrac) winner = "left";
    else if (rFrac > lFrac) winner = "right";
    else winner = "draw";
    this.finalize({ winner, reason: "timeout" });
  }

  /** Common write-out path for both kill- and timeout-based endings. */
  private finalize(end: { winner: CombatSide | "draw"; reason: "kill" | "timeout" }): void {
    this.finished = true;
    this.result = {
      winner: end.winner,
      reason: end.reason,
      duration: this.time,
      leftHpRemaining: this.left.hp,
      rightHpRemaining: this.right.hp,
      totalEvents: this._log.size(),
    };
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (kept outside the class so they don't capture `this`)
// ---------------------------------------------------------------------------

function createFighter(player: Player, side: CombatSide): FighterState {
  const hero = getHero(player.heroKey);
  // We snapshot the *player's* current stats (which already include their
  // upgrades) so changes made elsewhere mid-fight can't affect the sim.
  const stats: Stats = { ...player.stats };
  return {
    side,
    player,
    hero,
    stats,
    hp: stats.hp,
    maxHp: stats.hp,
    shield: stats.shield,
    mana: 0,
    attackTimer: BASE_ATTACK_INTERVAL,
    passiveTimer: hero.passive.cooldown ?? BASE_ATTACK_INTERVAL,
    passiveLastFiredAt: -Infinity,
    effects: [],
    bonusAttack: 0,
    lastAttackDamage: 0,
  };
}

function snapshotFighter(f: FighterState): FighterSnapshot {
  return {
    side: f.side,
    heroKey: f.hero.key,
    heroName: f.hero.name,
    hp: f.hp,
    maxHp: f.maxHp,
    shield: f.shield,
    mana: f.mana,
    isAlive: isAlive(f),
    isStunned: isStunned(f),
    activeEffectTypes: f.effects.map((e) => e.type),
  };
}

function isAlive(f: FighterState): boolean {
  return f.hp > 0;
}

function isStunned(f: FighterState): boolean {
  for (const e of f.effects) {
    if (e.type === "stun" && e.durationLeft > 0) return true;
  }
  return false;
}

/** Sum of active slow magnitudes, capped to a sensible attack-speed minimum. */
function totalSlowMultiplier(f: FighterState): number {
  let slow = 0;
  for (const e of f.effects) if (e.type === "slow") slow += e.value;
  return 1 + clamp(slow, 0, 0.95);
}

function effectiveAttack(f: FighterState): number {
  return f.stats.attack + f.bonusAttack;
}

/** Apply a heal capped at maxHp. Returns the actual amount healed. */
function applyHeal(target: FighterState, amount: number): number {
  if (amount <= 0 || !isAlive(target)) return 0;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  return target.hp - before;
}

function resolveTarget(
  effect: Effect,
  caster: FighterState,
  foe: FighterState,
): FighterState {
  if (effect.target === "self") return caster;
  if (effect.target === "enemy") return foe;
  // Sensible defaults when the data omits `target`:
  switch (effect.type) {
    case "heal":
    case "shield":
    case "lifesteal":
    case "buff":
      return caster;
    default:
      return foe;
  }
}

function oppositeSide(side: CombatSide): CombatSide {
  return side === "left" ? "right" : "left";
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

// ---------------------------------------------------------------------------
// Mulberry32 — tiny seeded PRNG (~1ns/call). Deterministic and fast enough
// to be called thousands of times per fight without measurable overhead.
// https://en.wikipedia.org/wiki/Mulberry_(algorithm)
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
