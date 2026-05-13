import Phaser from "phaser";
import { CombatEngine } from "@/core/CombatEngine";
import type { CombatResult } from "@/core/CombatEngine";
import { GameState } from "@/core/GameState";
import type { Player } from "@/core/Player";
import type {
  CombatEvent,
  CombatSide,
  ElementType,
} from "@/core/types";
import { getHero } from "@/data/heroes";
import {
  ParticleManager,
  type ParticleStyle,
} from "@/effects/ParticleManager";
import {
  FighterView,
  elementColor,
  parseElementFromEffectType,
} from "@/ui/FighterView";
import { Button } from "@/ui/Button";
import { drawDivider, drawPanel, ensureSparkTexture } from "@/ui/Panel";
import {
  CENTER,
  COLORS,
  FONTS,
  FONT_SIZE,
  HEX,
  SCREEN,
} from "@/ui/theme";
import type { ResultsSceneInitData } from "@/scenes/ResultsScene";

/** Payload provided by the caller (typically `GameState.startCombat`). */
export interface CombatSceneInitData {
  humanPlayerId: number;
  opponentPlayerId: number;
  roundNumber: number;
}

/** Default payload used when the scene boots without one (dev convenience). */
const DEFAULT_PAYLOAD: CombatSceneInitData = {
  humanPlayerId: 0,
  opponentPlayerId: 1,
  roundNumber: 1,
};

/** Tournament HP damage the loser takes per loss; mirrors prior ShopScene logic. */
const TOURNAMENT_DAMAGE_PER_LOSS = 25;
/** Tournament HP damage bot losers take from coin-flip resolution. */
const BOT_TOURNAMENT_DAMAGE = 20;

/** Hero positions in the arena. */
const HERO_LEFT_X = 380;
const HERO_RIGHT_X = 900;
const HERO_Y = 380;

/** Delay before transitioning out after a regular end. */
const END_AUTO_TRANSITION_MS = 2000;
/** Shorter delay when skipping. */
const SKIP_END_HOLD_MS = 600;

/**
 * Side-view animated combat scene.
 *
 * Wraps a real-time `CombatEngine` and renders its state via two
 * `FighterView`s. Each frame we step the engine, push fighter snapshots
 * into the views (which lerp toward them), and drain new log events to
 * trigger reactive animations: attack lunges, ability flares, particle
 * bursts, floating damage numbers, and death fades.
 *
 * Provides speed control (×1 / ×2) and a SKIP button that fast-forwards
 * the simulation to its end. When combat resolves, the scene applies all
 * the round-end bookkeeping (tournament damage, bot coin-flips, gold
 * income) and hands a fully-typed payload to `ResultsScene`.
 */
export class CombatScene extends Phaser.Scene {
  public static readonly KEY = "CombatScene";

  private payload: CombatSceneInitData = DEFAULT_PAYLOAD;

  // Combatants & engine state.
  private human!: Player;
  private opponent!: Player;
  private engine!: CombatEngine;
  private humanView!: FighterView;
  private opponentView!: FighterView;
  private particles!: ParticleManager;

  // UI references kept around so they can be re-styled / hidden.
  private speedButtons: Button[] = [];
  private skipButton!: Button;
  private endOverlay?: Phaser.GameObjects.Container;

  // Playback state.
  private timeScale: 1 | 2 = 1;
  private skipping = false;
  private endShown = false;
  private outcomeApplied = false;
  /** Number of events already dispatched to the view layer. */
  private lastEventCursor = 0;

  constructor() {
    super({ key: CombatScene.KEY });
  }

  public init(data?: Partial<CombatSceneInitData>): void {
    this.payload = { ...DEFAULT_PAYLOAD, ...(data ?? {}) };
    this.timeScale = 1;
    this.skipping = false;
    this.endShown = false;
    this.outcomeApplied = false;
    this.lastEventCursor = 0;
    this.speedButtons = [];
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  public create(): void {
    this.cameras.main.setBackgroundColor(HEX.bgDark);
    ensureSparkTexture(this);
    // Clean up overlay container if the scene is shut down mid-transition.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.onShutdown());

    const gs = GameState.instance;
    const human = gs.getPlayer(this.payload.humanPlayerId);
    const opponent = gs.getPlayer(this.payload.opponentPlayerId);
    if (!human || !opponent) {
      // Defensive bail-out — surface as a clear message and bounce back to draft.
      this.add
        .text(CENTER.x, CENTER.y, "No active match — returning to draft.", {
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZE.medium}px`,
          color: HEX.red,
        })
        .setOrigin(0.5);
      this.time.delayedCall(1500, () => this.scene.start("DraftScene"));
      return;
    }
    this.human = human;
    this.opponent = opponent;
    this.particles = new ParticleManager(this);

    this.drawStage();
    this.drawTopBar();
    this.drawBottomBar();

    // Real-time engine — we step it every frame from `update()`.
    this.engine = CombatEngine.simulateFight(this.human, this.opponent, true);
    const leftSnap = this.engine.getLeft();
    const rightSnap = this.engine.getRight();

    this.humanView = new FighterView({
      scene: this,
      x: HERO_LEFT_X,
      y: HERO_Y,
      side: "left",
      hero: getHero(this.human.heroKey),
      maxHp: leftSnap.maxHp,
    });
    this.opponentView = new FighterView({
      scene: this,
      x: HERO_RIGHT_X,
      y: HERO_Y,
      side: "right",
      hero: getHero(this.opponent.heroKey),
      maxHp: rightSnap.maxHp,
    });
    this.humanView.setSnapshot(leftSnap);
    this.opponentView.setSnapshot(rightSnap);
    // (`HeroSprite` mirrors the right-side art container itself — the
    // outer view stays unscaled so bars/labels render naturally.)
  }

  /**
   * Per-frame loop. Drives engine simulation, pumps snapshots into the
   * views, and drains the combat log for visual events.
   */
  public override update(_time: number, deltaMs: number): void {
    if (!this.engine) return;

    const dtSec = deltaMs / 1000;

    if (!this.skipping && !this.engine.isFinished()) {
      this.engine.step(dtSec * this.timeScale);
    }

    // Always pull latest fighter state so bars lerp toward truth even at
    // ×1 with no events firing.
    this.humanView.setSnapshot(this.engine.getLeft());
    this.opponentView.setSnapshot(this.engine.getRight());

    this.humanView.update(dtSec);
    this.opponentView.update(dtSec);

    if (!this.skipping) this.drainEvents();

    if (this.engine.isFinished() && !this.endShown) this.showEndOverlay();
  }

  // -------------------------------------------------------------------------
  // Stage / UI layout
  // -------------------------------------------------------------------------

  /**
   * Layered arena background. Cheap to draw and cheap to skin: replace
   * any layer with a real image without touching the rest.
   *
   * Vertical layout, top→bottom:
   *   - distant wall (lighter shade behind the fighters)
   *   - faint vertical seams on the wall (stone joints)
   *   - decorative pillars at the screen edges
   *   - floor band (warmer brown) with horizontal plank lines
   *   - drop-shadow ellipses under each fighter
   *   - "VS" badge anchoring the eye
   *
   * Two flame "torches" on top of the pillars use the `ParticleManager`'s
   * continuous trail emitter for ambient flicker.
   */
  private drawStage(): void {
    const wallTop = 100;
    const floorTop = HERO_Y + 60;
    const pillarXs = [120, SCREEN.width - 120];
    const pillarTop = wallTop;
    const pillarBottom = HERO_Y + 90;
    const pillarHalfW = 32;

    const g = this.add.graphics();

    // Far wall — a touch lighter than the bgDark so the foreground reads.
    g.fillStyle(0x1f1610, 1);
    g.fillRect(0, wallTop, SCREEN.width, floorTop - wallTop);

    // Faint vertical "stone joints" on the wall.
    g.lineStyle(1, 0x100a05, 0.6);
    for (let x = 180; x < SCREEN.width - 180; x += 90) {
      g.lineBetween(x, wallTop + 12, x, floorTop - 8);
    }

    // Floor — warmer brown, with subtle plank lines.
    g.fillStyle(0x281a10, 1);
    g.fillRect(0, floorTop, SCREEN.width, SCREEN.height - floorTop);
    g.lineStyle(1, 0x140a06, 0.7);
    for (let y = floorTop + 22; y < SCREEN.height - 60; y += 28) {
      g.lineBetween(60, y, SCREEN.width - 60, y);
    }
    // Gold horizon trim — separates wall from floor.
    g.lineStyle(2, COLORS.goldDeep, 0.45);
    g.lineBetween(0, floorTop, SCREEN.width, floorTop);
    g.lineStyle(1, COLORS.goldGlow, 0.18);
    g.lineBetween(0, floorTop + 2, SCREEN.width, floorTop + 2);

    // Pillars — vertical bars at the edges with a tiny capital + base.
    for (const px of pillarXs) {
      // Shadow.
      g.fillStyle(0x0d0805, 0.6);
      g.fillRect(
        px - pillarHalfW - 2,
        pillarTop + 4,
        pillarHalfW * 2 + 4,
        pillarBottom - pillarTop,
      );
      // Pillar body.
      g.fillStyle(0x2c1f14, 1);
      g.fillRect(
        px - pillarHalfW,
        pillarTop,
        pillarHalfW * 2,
        pillarBottom - pillarTop,
      );
      // Vertical highlight stripe.
      g.fillStyle(0x3d2b1c, 0.6);
      g.fillRect(px - pillarHalfW + 6, pillarTop, 4, pillarBottom - pillarTop);
      // Capital + base — wider rectangles flanking the column.
      g.fillStyle(0x4a3422, 1);
      g.fillRect(px - pillarHalfW - 6, pillarTop - 10, pillarHalfW * 2 + 12, 16);
      g.fillRect(px - pillarHalfW - 6, pillarBottom - 14, pillarHalfW * 2 + 12, 16);
      // Gold trim on capital + base.
      g.lineStyle(1, COLORS.goldDeep, 0.7);
      g.strokeRect(px - pillarHalfW - 6, pillarTop - 10, pillarHalfW * 2 + 12, 16);
      g.strokeRect(px - pillarHalfW - 6, pillarBottom - 14, pillarHalfW * 2 + 12, 16);
    }

    // Drop-shadows under each fighter — sells the "standing on the floor" feel.
    for (const x of [HERO_LEFT_X, HERO_RIGHT_X]) {
      const spot = this.add.graphics();
      spot.fillStyle(0x000000, 0.55);
      spot.fillEllipse(x, HERO_Y + 90, 180, 38);
    }

    // Center "VS" badge — pure decoration but anchors the eye.
    this.add
      .text(CENTER.x, HERO_Y, "VS", {
        fontFamily: FONTS.title,
        fontSize: `${FONT_SIZE.xlarge}px`,
        color: HEX.goldDeep,
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setAlpha(0.55);

    // Torches above the pillars. Trail emitters give a believable, cheap
    // flicker without a sprite atlas.
    for (const px of pillarXs) {
      // Torch base — small gold disc.
      const baseY = pillarTop - 18;
      const torch = this.add.graphics();
      torch.fillStyle(0x2a1b10, 1);
      torch.fillCircle(px, baseY, 8);
      torch.lineStyle(1, COLORS.goldDeep, 1);
      torch.strokeCircle(px, baseY, 8);
      // Flame particles.
      this.particles.burst(px, baseY - 4, "fire", 1);
    }
  }

  private drawTopBar(): void {
    // Round indicator (center). It never changes during a fight, so we
    // don't keep a handle on it.
    this.add
      .text(CENTER.x, 38, `ROUND ${this.payload.roundNumber}`, {
        fontFamily: FONTS.title,
        fontSize: `${FONT_SIZE.large}px`,
        color: HEX.goldGlow,
        fontStyle: "700",
      })
      .setOrigin(0.5);
    this.add
      .text(CENTER.x, 16, "TOURNAMENT", {
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZE.micro}px`,
        color: HEX.textMuted,
        fontStyle: "700",
      })
      .setOrigin(0.5);

    // Speed buttons + skip (top-right).
    const x1 = new Button(this, SCREEN.width - 290, 38, {
      label: "×1",
      width: 60,
      height: 40,
      variant: "primary",
      fontSize: FONT_SIZE.body,
      fontFamily: FONTS.title,
      onClick: () => this.setTimeScale(1),
    });
    const x2 = new Button(this, SCREEN.width - 220, 38, {
      label: "×2",
      width: 60,
      height: 40,
      variant: "secondary",
      fontSize: FONT_SIZE.body,
      fontFamily: FONTS.title,
      onClick: () => this.setTimeScale(2),
    });
    this.speedButtons = [x1, x2];

    this.skipButton = new Button(this, SCREEN.width - 120, 38, {
      label: "SKIP ⏭",
      width: 120,
      height: 40,
      variant: "danger",
      fontSize: FONT_SIZE.small,
      fontFamily: FONTS.body,
      onClick: () => this.onSkip(),
    });

    drawDivider(this, 60, 80, SCREEN.width - 120);
  }

  private drawBottomBar(): void {
    drawDivider(this, 60, HERO_Y + 220, SCREEN.width - 120);

    const humanHero = getHero(this.human.heroKey);
    const oppHero = getHero(this.opponent.heroKey);

    // Left name (human).
    this.add
      .text(60, SCREEN.height - 56, "YOU", {
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZE.micro}px`,
        color: HEX.goldGlow,
        fontStyle: "700",
      })
      .setOrigin(0, 1);
    this.add
      .text(60, SCREEN.height - 28, humanHero.name.toUpperCase(), {
        fontFamily: FONTS.title,
        fontSize: `${FONT_SIZE.large}px`,
        color: HEX.textBright,
        fontStyle: "700",
      })
      .setOrigin(0, 1);

    // Right name (opponent).
    this.add
      .text(SCREEN.width - 60, SCREEN.height - 56, "OPPONENT", {
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZE.micro}px`,
        color: HEX.red,
        fontStyle: "700",
      })
      .setOrigin(1, 1);
    this.add
      .text(SCREEN.width - 60, SCREEN.height - 28, oppHero.name.toUpperCase(), {
        fontFamily: FONTS.title,
        fontSize: `${FONT_SIZE.large}px`,
        color: HEX.textBright,
        fontStyle: "700",
      })
      .setOrigin(1, 1);
  }

  // -------------------------------------------------------------------------
  // Speed / skip controls
  // -------------------------------------------------------------------------

  private setTimeScale(scale: 1 | 2): void {
    this.timeScale = scale;
    // Visual feedback — the active button is primary, the other secondary.
    this.speedButtons[0]?.setVariant(scale === 1 ? "primary" : "secondary");
    this.speedButtons[1]?.setVariant(scale === 2 ? "primary" : "secondary");
  }

  private onSkip(): void {
    if (this.skipping || this.engine.isFinished()) return;
    this.skipping = true;
    this.skipButton.setEnabled(false);
    this.speedButtons.forEach((b) => b.setEnabled(false));

    // Drain the entire simulation in one go, then snap the views to the
    // final state so the user immediately sees the outcome.
    this.engine.runToCompletion();
    this.humanView.snapToFinalSnapshot(this.engine.getLeft());
    this.opponentView.snapToFinalSnapshot(this.engine.getRight());
    this.lastEventCursor = this.engine.getLog().events.length;

    this.showEndOverlay(SKIP_END_HOLD_MS);
  }

  // -------------------------------------------------------------------------
  // Event dispatch — turns engine events into reactive animations.
  // -------------------------------------------------------------------------

  private drainEvents(): void {
    const events = this.engine.getLog().events;
    for (let i = this.lastEventCursor; i < events.length; i++) {
      this.handleEvent(events[i]!);
    }
    this.lastEventCursor = events.length;
  }

  private handleEvent(ev: CombatEvent): void {
    const source = this.viewForSide(ev.source);
    const target = this.viewForSide(ev.target);

    switch (ev.type) {
      case "attack": {
        source.playAttack();
        if (ev.value !== undefined && ev.value > 0) {
          target.spawnDamageNumber(ev.value, "damage");
          target.playHit();
          // Tiny physical scatter on every connecting attack — adds weight.
          this.particles.burst(
            target.getCenterX(),
            target.getCenterY(),
            "physical",
            1,
          );
        }
        break;
      }
      case "crit": {
        source.playAttack();
        if (ev.value !== undefined) target.spawnDamageNumber(ev.value, "crit");
        target.playHit();
        this.particles.burst(
          target.getCenterX(),
          target.getCenterY(),
          "lightning",
          2,
        );
        // Crits get a small screen kick — much subtler than ults.
        this.particles.screenShake(120, 0.005);
        break;
      }
      case "evade": {
        target.spawnDamageNumber(0, "miss");
        this.particles.burst(
          target.getCenterX(),
          target.getCenterY() - 20,
          "miss",
          1,
        );
        break;
      }
      case "ability": {
        const color = this.colorForEvent(ev);
        const style = this.styleForEvent(ev);
        source.playAbility(ev.abilityName ?? "ABILITY", color, false);
        // Burst at the caster (self-buff / heal / shield) or the target (DoT,
        // damage, slow, stun, etc.) depending on where the effect lands.
        const burstTarget = ev.source === ev.target ? source : target;
        this.particles.burst(
          burstTarget.getCenterX(),
          burstTarget.getCenterY(),
          style,
          1,
        );
        if (ev.effectType?.startsWith("dot:")) {
          // Initial DoT application — flag a number so the player knows
          // something's bleeding before the first tick lands.
          target.spawnDamageNumber(ev.value ?? 0, "damage");
        }
        break;
      }
      case "ult": {
        const color = this.colorForEvent(ev);
        const style = this.styleForEvent(ev);
        source.playAbility(ev.abilityName ?? "ULTIMATE", color, true);
        // Heavier bursts on both sides + screen shake — sells the impact.
        this.particles.burst(source.getCenterX(), source.getCenterY(), style, 3);
        this.particles.burst(target.getCenterX(), target.getCenterY(), style, 3);
        this.particles.screenShake(260, 0.014);
        break;
      }
      case "damage": {
        if (ev.value !== undefined && ev.value > 0) {
          target.spawnDamageNumber(ev.value, "damage");
          target.playHit();
          // Smaller burst for non-attack damage (DoT ticks, ability damage).
          const style = this.styleForEvent(ev);
          this.particles.burst(
            target.getCenterX(),
            target.getCenterY(),
            style,
            1,
          );
        }
        break;
      }
      case "heal": {
        if (ev.value !== undefined && ev.value > 0) {
          const kind = ev.effectType === "shield" ? "shield" : "heal";
          target.spawnDamageNumber(ev.value, kind);
          this.particles.burst(
            target.getCenterX(),
            target.getCenterY(),
            kind === "shield" ? "shield" : "heal",
            1,
          );
        }
        break;
      }
      case "death": {
        target.playDeath();
        break;
      }
    }
  }

  private viewForSide(side: CombatSide): FighterView {
    return side === "left" ? this.humanView : this.opponentView;
  }

  /**
   * Pick a color for an event's flare based on its element / effect tag.
   * Falls back to gold for untyped / generic abilities.
   */
  private colorForEvent(ev: CombatEvent): number {
    const fromEffect = parseElementFromEffectType(ev.effectType);
    if (fromEffect) return elementColor(fromEffect);
    // Special-case effect tags that aren't elements per se.
    switch (ev.effectType) {
      case "heal":
      case "buff":
      case "lifesteal":
        return COLORS.green;
      case "shield":
        return 0xf4d76b;
      case "stun":
        return COLORS.purple;
      case "slow":
        return 0x6bb6ff;
    }
    return COLORS.goldBright;
  }

  /**
   * Particle-style counterpart to `colorForEvent`. Resolves the right
   * `ParticleStyle` based on element tag or effect kind so the
   * `ParticleManager` produces visually-consistent bursts.
   */
  private styleForEvent(ev: CombatEvent): ParticleStyle {
    const element = parseElementFromEffectType(ev.effectType);
    if (element) return element;
    switch (ev.effectType) {
      case "heal":
      case "lifesteal":
        return "heal";
      case "shield":
        return "shield";
      case "buff":
        return "heal";
      case "stun":
        return "stun";
      case "slow":
        return "slow";
    }
    return "physical";
  }

  // -------------------------------------------------------------------------
  // End-of-combat
  // -------------------------------------------------------------------------

  /**
   * Show the VICTORY / DEFEAT / DRAW overlay. Schedules the round-outcome
   * bookkeeping + transition after `holdMs` milliseconds.
   */
  private showEndOverlay(holdMs: number = END_AUTO_TRANSITION_MS): void {
    if (this.endShown) return;
    this.endShown = true;

    const result = this.engine.getResult();
    if (!result) return;

    const label = this.endLabel(result);
    const color = this.endColor(result);

    const overlay = this.add.container(CENTER.x, CENTER.y).setDepth(50);

    // Dimmed full-screen backdrop.
    const dim = this.add
      .rectangle(0, 0, SCREEN.width, SCREEN.height, 0x000000, 0)
      .setOrigin(0.5);
    overlay.add(dim);
    this.tweens.add({ targets: dim, alpha: 0.45, duration: 280 });

    // Panel + banner text.
    const panelW = 680;
    const panelH = 240;
    const panel = drawPanel(
      this,
      -panelW / 2,
      -panelH / 2,
      panelW,
      panelH,
      { fill: COLORS.bgPanel, radius: 14, highlighted: true },
    );
    overlay.add(panel);

    // Drop-shadow for the banner.
    const shadow = this.add
      .text(4, 4, label, {
        fontFamily: FONTS.title,
        fontSize: `${FONT_SIZE.banner}px`,
        color: HEX.bgBlack,
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setAlpha(0.5);
    overlay.add(shadow);
    const banner = this.add
      .text(0, 0, label, {
        fontFamily: FONTS.title,
        fontSize: `${FONT_SIZE.banner}px`,
        color,
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setScale(0.6)
      .setAlpha(0);
    overlay.add(banner);
    this.tweens.add({
      targets: banner,
      scale: 1,
      alpha: 1,
      duration: 360,
      ease: "Back.easeOut",
    });

    const sub = this.add
      .text(0, 80, this.endSubtitle(result), {
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZE.body}px`,
        color: HEX.textMuted,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    overlay.add(sub);
    this.tweens.add({ targets: sub, alpha: 1, duration: 400, delay: 280 });

    this.endOverlay = overlay;

    this.time.delayedCall(holdMs, () => this.applyOutcomeAndTransition(result));
  }

  private endLabel(result: CombatResult): string {
    if (result.winner === "draw") return "DRAW";
    return result.winner === "left" ? "VICTORY" : "DEFEAT";
  }

  private endColor(result: CombatResult): string {
    if (result.winner === "draw") return HEX.textMuted;
    return result.winner === "left" ? HEX.green : HEX.red;
  }

  private endSubtitle(result: CombatResult): string {
    const reason =
      result.reason === "timeout" ? "Time expired" : "Combat resolved";
    return `${reason} • ${result.duration.toFixed(1)}s`;
  }

  /**
   * Apply the round outcome to game state (tournament damage, bot fights,
   * gold income) and transition to the results screen.
   *
   * Called exactly once — the `outcomeApplied` guard makes the transition
   * idempotent even if `delayedCall` fires after a scene restart.
   */
  private applyOutcomeAndTransition(result: CombatResult): void {
    if (this.outcomeApplied) return;
    this.outcomeApplied = true;

    const gs = GameState.instance;
    const humanWon = result.winner === "left";
    const isDraw = result.winner === "draw";

    // Tournament damage to the loser (or both, on a draw).
    const fullDmg = TOURNAMENT_DAMAGE_PER_LOSS;
    const drawDmg = Math.floor(fullDmg / 2);
    if (isDraw) {
      this.human.takeTournamentDamage(drawDmg);
      this.opponent.takeTournamentDamage(drawDmg);
    } else if (humanWon) {
      this.opponent.takeTournamentDamage(fullDmg);
    } else {
      this.human.takeTournamentDamage(fullDmg);
    }

    // Record this round in the live match log.
    gs.recordRound({
      round: this.payload.roundNumber,
      winnerId: isDraw ? null : humanWon ? this.human.id : this.opponent.id,
      loserId: isDraw ? null : humanWon ? this.opponent.id : this.human.id,
      damageDealt: isDraw ? drawDmg : fullDmg,
    });

    // Resolve every other bot pair off-screen so the standings progress.
    this.resolveBotsCoinflip();

    // Income for the human (advances round counter via endRound).
    const income = gs.endRound(humanWon);

    // Compute damage-dealt / -taken from the engine result for the UI.
    const damageDealt = humanWon
      ? this.opponent.stats.hp - result.rightHpRemaining
      : this.human.stats.hp - result.leftHpRemaining;
    const damageTaken = humanWon
      ? this.human.stats.hp - result.leftHpRemaining
      : this.opponent.stats.hp - result.rightHpRemaining;

    const matchEnded =
      this.human.isEliminated() || gs.getAlivePlayers().length <= 1;

    const data: ResultsSceneInitData = {
      wasWin: humanWon,
      isDraw,
      roundNumber: this.payload.roundNumber,
      humanHeroKey: this.human.heroKey,
      opponentHeroKey: this.opponent.heroKey,
      damageDealt: Math.max(0, Math.round(damageDealt)),
      damageTaken: Math.max(0, Math.round(damageTaken)),
      goldEarned: income.total,
      baseGold: income.baseGold,
      interest: income.interest,
      combatDuration: result.duration,
      matchEnded,
      humanRemainingHP: this.human.tournamentHP,
    };
    this.scene.start("ResultsScene", data);
  }

  /**
   * Pair up every bot not in the visualized fight and assign a 50/50 win
   * for the round so the leaderboard keeps moving while bot-vs-bot fights
   * aren't yet animated.
   */
  private resolveBotsCoinflip(): void {
    const gs = GameState.instance;
    const bots = gs
      .getAlivePlayers()
      .filter((p) => p.id !== this.human.id && p.id !== this.opponent.id);

    for (let i = 0; i + 1 < bots.length; i += 2) {
      const a = bots[i]!;
      const b = bots[i + 1]!;
      const aWins = Math.random() < 0.5;
      const loser = aWins ? b : a;
      loser.takeTournamentDamage(BOT_TOURNAMENT_DAMAGE);
      gs.awardRoundIncome(aWins ? a : b, true);
      gs.awardRoundIncome(loser, false);
    }
    // Lone bot (odd count) gets a loss payout.
    if (bots.length % 2 === 1) {
      gs.awardRoundIncome(bots[bots.length - 1]!, false);
    }
  }

  private onShutdown(): void {
    this.endOverlay?.destroy();
    this.endOverlay = undefined;
  }
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

// `ElementType` is re-exported here for symmetry — callers wiring up speed
// HUDs or replay tooling sometimes want it without reaching into core.
export type { ElementType };
