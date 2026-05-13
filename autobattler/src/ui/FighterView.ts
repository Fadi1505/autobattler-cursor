import Phaser from "phaser";
import type { FighterSnapshot } from "@/core/CombatEngine";
import { HeroSprite } from "@/core/HeroSprite";
import type { CombatSide, ElementType, HeroDefinition } from "@/core/types";
import { ensureSparkTexture } from "@/ui/Panel";
import { COLORS, FONTS, FONT_SIZE, HEX } from "@/ui/theme";

/**
 * Visual chrome around one fighter inside the `CombatScene`.
 *
 * Owns the smoothing layer on top of the engine snapshot:
 *
 *  - `HeroSprite`           — the rendered hero body (real spritesheet or
 *                              procedural rectangle, behind a uniform API).
 *  - `HP / Mana / Shield`   — bars that lerp their displayed value toward
 *                              the engine's authoritative target each frame.
 *  - `HP readout / badges`  — secondary chrome around the bars.
 *  - `damage popups`        — tiered floating numbers, colored by impact.
 *  - `DEFEATED` overlay     — revealed when the engine reports a death.
 *
 * Animations and visual response to combat events are delegated to the
 * embedded `HeroSprite` — `playAttack()`, `playCast()`, `playHit()`,
 * `playDeath()` are all simple forwards plus optional view-side flourishes
 * (the `DEFEATED` label on death, particle bursts on hit, etc.).
 */

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const BAR_W = 230;
const BAR_HP_H = 16;
const BAR_MANA_H = 7;
const BAR_SHIELD_H = 5;
const BAR_GAP = 3;
const BODY_H = 160;

/** Bars float this many px above the body's top edge. */
const BARS_ABOVE_BODY = 56;
/** Speed at which display bar values catch up to engine targets (per second). */
const BAR_LERP_RATE = 9;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FighterViewOptions {
  scene: Phaser.Scene;
  /** Center-x of the fighter on screen. */
  x: number;
  /** Center-y of the fighter on screen. */
  y: number;
  side: CombatSide;
  hero: HeroDefinition;
  /** Maximum HP shown on the bar — fixes the bar's scale for the round. */
  maxHp: number;
}

/** Discriminator for the kind of floating number to show. */
export type FloatingTextKind = "damage" | "crit" | "miss" | "heal" | "shield";

// ---------------------------------------------------------------------------
// FighterView
// ---------------------------------------------------------------------------

export class FighterView {
  public readonly container: Phaser.GameObjects.Container;
  public readonly side: CombatSide;
  public readonly hero: HeroDefinition;
  public readonly maxHp: number;

  private readonly scene: Phaser.Scene;
  private readonly heroSprite: HeroSprite;

  private readonly hpBar: Phaser.GameObjects.Graphics;
  private readonly manaBar: Phaser.GameObjects.Graphics;
  private readonly shieldBar: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly statusBadges: Phaser.GameObjects.Text;
  private readonly defeatedLabel: Phaser.GameObjects.Text;
  private readonly originX: number;
  private readonly originY: number;

  // Display vs. target values. The bars lerp `display*` toward `target*`.
  private displayHp: number;
  private displayMana = 0;
  private displayShield: number;
  private targetHp: number;
  private targetMana = 0;
  private targetShield: number;

  private isDead = false;

  constructor(opts: FighterViewOptions) {
    this.scene = opts.scene;
    this.side = opts.side;
    this.hero = opts.hero;
    this.maxHp = Math.max(1, opts.maxHp);
    this.originX = opts.x;
    this.originY = opts.y;

    ensureSparkTexture(this.scene);

    this.displayHp = this.maxHp;
    this.targetHp = this.maxHp;
    this.displayShield = opts.hero.baseStats.shield;
    this.targetShield = opts.hero.baseStats.shield;

    // Outer container — the embedded `HeroSprite` is itself a Container,
    // so we add it directly. The bars + labels live alongside.
    this.container = this.scene.add.container(opts.x, opts.y);

    this.heroSprite = new HeroSprite({
      scene: this.scene,
      x: 0,
      y: 0,
      side: this.side,
      hero: this.hero,
    });
    // The HeroSprite constructor already calls `scene.add.existing` — adding
    // it to our container reparents it so our positioning takes effect.
    this.container.add(this.heroSprite);

    // ---- Bar layout (above the body) -----------------------------------
    // Stacked top-to-bottom: shield, hp, mana. Anchor on `barTop`.
    const barTop = -BODY_H / 2 - BARS_ABOVE_BODY;
    this.shieldBar = this.scene.add.graphics().setY(barTop);
    this.hpBar = this.scene.add
      .graphics()
      .setY(barTop + BAR_SHIELD_H + BAR_GAP);
    this.manaBar = this.scene.add
      .graphics()
      .setY(barTop + BAR_SHIELD_H + BAR_GAP + BAR_HP_H + BAR_GAP);

    // HP readout (numeric) — sits above the shield strip.
    this.hpText = this.scene.add
      .text(0, barTop - 4, `${Math.round(this.targetHp)} / ${this.maxHp}`, {
        fontFamily: FONTS.number,
        fontSize: `${FONT_SIZE.small}px`,
        color: HEX.textBright,
        stroke: HEX.bgBlack,
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1);

    // Bar icons (HP / MP / SH labels) — tiny, sit to the left of each bar.
    const iconStyle = {
      fontFamily: FONTS.number,
      fontSize: `${FONT_SIZE.micro}px`,
      fontStyle: "700",
      stroke: HEX.bgBlack,
      strokeThickness: 2,
    } as const;
    const hpIcon = this.scene.add
      .text(
        -BAR_W / 2 - 4,
        barTop + BAR_SHIELD_H + BAR_GAP + BAR_HP_H / 2,
        "HP",
        { ...iconStyle, color: HEX.red },
      )
      .setOrigin(1, 0.5);
    const mpIcon = this.scene.add
      .text(
        -BAR_W / 2 - 4,
        barTop +
          BAR_SHIELD_H +
          BAR_GAP +
          BAR_HP_H +
          BAR_GAP +
          BAR_MANA_H / 2,
        "MP",
        { ...iconStyle, color: HEX.blue },
      )
      .setOrigin(1, 0.5);
    const shIcon = this.scene.add
      .text(-BAR_W / 2 - 4, barTop + BAR_SHIELD_H / 2, "SH", {
        ...iconStyle,
        color: "#f4d76b",
      })
      .setOrigin(1, 0.5)
      .setVisible(opts.hero.baseStats.shield > 0)
      .setName("shieldIcon");

    // Status badges (stun / slow / dot / buff) — below the body.
    this.statusBadges = this.scene.add
      .text(0, BODY_H / 2 + 8, "", {
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZE.micro}px`,
        color: HEX.orange,
        fontStyle: "700",
        stroke: HEX.bgBlack,
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);

    // DEFEATED stamp — hidden until `playDeath` runs.
    this.defeatedLabel = this.scene.add
      .text(0, 0, "DEFEATED", {
        fontFamily: FONTS.title,
        fontSize: `${FONT_SIZE.large}px`,
        color: HEX.red,
        fontStyle: "700",
        stroke: HEX.bgBlack,
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.container.add([
      this.shieldBar,
      this.hpBar,
      this.manaBar,
      hpIcon,
      mpIcon,
      shIcon,
      this.hpText,
      this.statusBadges,
      this.defeatedLabel,
    ]);

    this.redrawBars();
  }

  // -------------------------------------------------------------------------
  // Public position helpers — used by `CombatScene` for particle bursts.
  // -------------------------------------------------------------------------

  /** Canonical x of this fighter (ignores transient lunge tweens). */
  public getCenterX(): number {
    return this.originX;
  }

  /** Canonical y of this fighter. */
  public getCenterY(): number {
    return this.originY;
  }

  // -------------------------------------------------------------------------
  // Driven state
  // -------------------------------------------------------------------------

  /** Pull the latest authoritative values from the engine snapshot. */
  public setSnapshot(snap: FighterSnapshot): void {
    this.targetHp = snap.hp;
    this.targetMana = snap.mana;
    this.targetShield = snap.shield;

    const badges: string[] = [];
    if (snap.isStunned) badges.push("STUN");
    if (snap.activeEffectTypes.includes("slow")) badges.push("SLOW");
    if (snap.activeEffectTypes.includes("dot")) badges.push("DOT");
    if (snap.activeEffectTypes.includes("buff")) badges.push("BUFF");
    this.statusBadges.setText(badges.join("  "));

    if (!snap.isAlive && !this.isDead) this.playDeath();
  }

  /** Tick smoothing/animation. Called once per frame from the scene. */
  public update(dt: number): void {
    const factor = 1 - Math.exp(-BAR_LERP_RATE * Math.max(0, dt));
    this.displayHp = lerp(this.displayHp, this.targetHp, factor);
    this.displayMana = lerp(this.displayMana, this.targetMana, factor);
    this.displayShield = lerp(this.displayShield, this.targetShield, factor);
    this.redrawBars();
  }

  // -------------------------------------------------------------------------
  // Animations driven by combat events
  // -------------------------------------------------------------------------

  /** Quick forward-and-back lunge in the direction of the opponent. */
  public playAttack(): void {
    if (this.isDead) return;
    this.heroSprite.playAttack();
  }

  /** Casting an ability — sprite anim + floating label over the body. */
  public playAbility(name: string, color: number, isUltimate = false): void {
    if (this.isDead) return;
    this.heroSprite.playCast(name, color, isUltimate);

    // Floating ability/ult label — text-only flourish over the body.
    const y = -BODY_H / 2 - (isUltimate ? 80 : 64);
    const size = isUltimate ? FONT_SIZE.large : FONT_SIZE.medium;
    const label = this.scene.add
      .text(this.container.x, this.container.y + y, name.toUpperCase(), {
        fontFamily: FONTS.title,
        fontSize: `${size}px`,
        color: toHex(color),
        fontStyle: "700",
        stroke: HEX.bgBlack,
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(0.6);

    this.scene.tweens.add({
      targets: label,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.6, to: 1.1 },
      duration: 180,
      ease: "Back.easeOut",
      onComplete: () => {
        this.scene.tweens.add({
          targets: label,
          y: label.y - 28,
          alpha: 0,
          duration: 700,
          ease: "Quad.easeIn",
          onComplete: () => label.destroy(),
        });
      },
    });
  }

  /** Flinch — used when the fighter takes a hit. */
  public playHit(): void {
    if (this.isDead) return;
    this.heroSprite.playHit();
  }

  /** Pop a floating damage / heal / miss number over the fighter. */
  public spawnDamageNumber(value: number, kind: FloatingTextKind): void {
    const visual = damageVisual(value, kind);
    const offsetX = (Math.random() - 0.5) * 50;
    const popup = this.scene.add
      .text(this.container.x + offsetX, this.container.y - 50, visual.text, {
        fontFamily: FONTS.title,
        fontSize: `${visual.size}px`,
        color: visual.color,
        fontStyle: "700",
        stroke: HEX.bgBlack,
        strokeThickness: visual.stroke,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(visual.startScale);
    if (visual.italic) popup.setFontStyle("italic 700");

    this.scene.tweens.add({
      targets: popup,
      alpha: 1,
      scale: visual.popScale,
      duration: 120,
      ease: "Back.easeOut",
      onComplete: () => {
        // Slight horizontal drift on the float-up — feels less robotic.
        const driftX = popup.x + (Math.random() - 0.5) * 30;
        this.scene.tweens.add({
          targets: popup,
          x: driftX,
          y: popup.y - 70,
          alpha: 0,
          scale: visual.popScale * 0.85,
          duration: visual.holdMs,
          ease: "Quad.easeIn",
          onComplete: () => popup.destroy(),
        });
      },
    });
  }

  /** Death animation — collapse + fade body, reveal DEFEATED stamp. */
  public playDeath(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.heroSprite.playDeath();
    this.defeatedLabel.setVisible(true).setAlpha(0);
    this.scene.tweens.add({
      targets: this.defeatedLabel,
      alpha: 1,
      duration: 350,
      delay: 150,
      ease: "Quad.easeOut",
    });
  }

  /** Snap to a final state without animation — used by Skip. */
  public snapToFinalSnapshot(snap: FighterSnapshot): void {
    this.targetHp = snap.hp;
    this.targetMana = snap.mana;
    this.targetShield = snap.shield;
    this.displayHp = snap.hp;
    this.displayMana = snap.mana;
    this.displayShield = snap.shield;
    if (!snap.isAlive && !this.isDead) this.playDeath();
    this.redrawBars();
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  private redrawBars(): void {
    const hpFrac = Math.max(0, Math.min(1, this.displayHp / this.maxHp));
    const hpColor =
      hpFrac > 0.5 ? COLORS.green : hpFrac > 0.25 ? COLORS.orange : COLORS.red;

    // HP bar — fill with inner highlight, gold border.
    this.hpBar.clear();
    this.hpBar.fillStyle(0x140e08, 1);
    this.hpBar.fillRoundedRect(-BAR_W / 2, 0, BAR_W, BAR_HP_H, 5);
    this.hpBar.fillStyle(hpColor, 1);
    this.hpBar.fillRoundedRect(-BAR_W / 2, 0, BAR_W * hpFrac, BAR_HP_H, 5);
    // Inner top highlight to give the bar a little dimension.
    this.hpBar.fillStyle(0xffffff, 0.18);
    this.hpBar.fillRoundedRect(
      -BAR_W / 2 + 1,
      1,
      Math.max(0, BAR_W * hpFrac - 2),
      Math.max(1, BAR_HP_H / 3),
      4,
    );
    this.hpBar.lineStyle(2, COLORS.goldDeep, 0.95);
    this.hpBar.strokeRoundedRect(-BAR_W / 2, 0, BAR_W, BAR_HP_H, 5);

    // Mana bar.
    const manaFrac = Math.max(0, Math.min(1, this.displayMana / 100));
    this.manaBar.clear();
    this.manaBar.fillStyle(0x140e08, 1);
    this.manaBar.fillRoundedRect(-BAR_W / 2, 0, BAR_W, BAR_MANA_H, 3);
    this.manaBar.fillStyle(COLORS.blue, 1);
    this.manaBar.fillRoundedRect(-BAR_W / 2, 0, BAR_W * manaFrac, BAR_MANA_H, 3);
    // When mana is full ult is ready — pulse with a brighter color.
    if (manaFrac >= 1) {
      this.manaBar.fillStyle(0x9fd9ff, 0.6);
      this.manaBar.fillRoundedRect(-BAR_W / 2, 0, BAR_W, BAR_MANA_H, 3);
    }
    this.manaBar.lineStyle(1, COLORS.goldDeep, 0.7);
    this.manaBar.strokeRoundedRect(-BAR_W / 2, 0, BAR_W, BAR_MANA_H, 3);

    // Shield strip — only visible when there's any to show. We also toggle
    // the SH icon's visibility in lockstep.
    this.shieldBar.clear();
    const hasShield = this.displayShield > 0.5;
    const shIcon = this.container.getByName(
      "shieldIcon",
    ) as Phaser.GameObjects.Text | null;
    if (shIcon) shIcon.setVisible(hasShield);
    if (hasShield) {
      const shieldFrac = Math.min(1, this.displayShield / this.maxHp);
      this.shieldBar.fillStyle(0x140e08, 0.8);
      this.shieldBar.fillRoundedRect(-BAR_W / 2, 0, BAR_W, BAR_SHIELD_H, 2);
      this.shieldBar.fillStyle(0xf4d76b, 1);
      this.shieldBar.fillRoundedRect(
        -BAR_W / 2,
        0,
        BAR_W * shieldFrac,
        BAR_SHIELD_H,
        2,
      );
      this.shieldBar.lineStyle(1, COLORS.goldDeep, 0.6);
      this.shieldBar.strokeRoundedRect(-BAR_W / 2, 0, BAR_W, BAR_SHIELD_H, 2);
    }

    this.hpText.setText(
      `${Math.max(0, Math.round(this.displayHp))} / ${this.maxHp}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Damage-number visual tiering — small helpers shared by the popup spawner.
// ---------------------------------------------------------------------------

interface DamageVisual {
  text: string;
  color: string;
  size: number;
  startScale: number;
  popScale: number;
  stroke: number;
  italic: boolean;
  holdMs: number;
}

/**
 * Pick the visual presentation for a floating damage number based on its
 * magnitude and category. Larger hits get progressively warmer/larger
 * text so a glance at the screen tells you "that was a big one".
 */
function damageVisual(value: number, kind: FloatingTextKind): DamageVisual {
  if (kind === "miss") {
    return {
      text: "MISS",
      color: HEX.textMuted,
      size: FONT_SIZE.body,
      startScale: 0.9,
      popScale: 1,
      stroke: 3,
      italic: true,
      holdMs: 500,
    };
  }
  if (kind === "heal") {
    return {
      text: `+${roundDisplay(value)}`,
      color: HEX.green,
      size: FONT_SIZE.medium,
      startScale: 0.85,
      popScale: 1,
      stroke: 4,
      italic: false,
      holdMs: 700,
    };
  }
  if (kind === "shield") {
    return {
      text: `+${roundDisplay(value)} ◆`,
      color: "#f4d76b",
      size: FONT_SIZE.medium,
      startScale: 0.85,
      popScale: 1,
      stroke: 4,
      italic: false,
      holdMs: 700,
    };
  }
  if (kind === "crit") {
    return {
      text: `${roundDisplay(value)}!`,
      color: HEX.goldGlow,
      size: FONT_SIZE.xlarge,
      startScale: 0.6,
      popScale: 1.4,
      stroke: 5,
      italic: false,
      holdMs: 800,
    };
  }
  // Regular damage — tiered by magnitude. Explicit `string`/`number`
  // annotations are required because `HEX.*` and `FONT_SIZE.*` are
  // `as const` literal types — TS would otherwise narrow on first
  // assignment and reject the alternative tiers.
  const v = Math.round(value);
  let color: string = HEX.red;
  let size: number = FONT_SIZE.medium;
  if (v >= 60) {
    color = "#ff4d2c";
    size = FONT_SIZE.large;
  } else if (v >= 30) {
    color = "#e85a3a";
    size = FONT_SIZE.medium + 2;
  } else if (v >= 12) {
    color = HEX.red;
    size = FONT_SIZE.medium;
  } else {
    color = "#e89c8c";
    size = FONT_SIZE.body + 1;
  }
  return {
    text: `${roundDisplay(value)}`,
    color,
    size,
    startScale: 0.85,
    popScale: 1.05,
    stroke: 4,
    italic: false,
    holdMs: 700,
  };
}

function roundDisplay(v: number): number {
  return Math.max(1, Math.round(v));
}

// ---------------------------------------------------------------------------
// Shared utility helpers
// ---------------------------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function toHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** Map an `ElementType` (or undefined) to the canonical visual color. */
export function elementColor(element: ElementType | undefined): number {
  switch (element) {
    case "fire":
      return 0xff7a2c;
    case "ice":
      return 0x6bb6ff;
    case "poison":
      return 0x6fc46c;
    case "lightning":
      return 0xfff04d;
    case "physical":
    default:
      return 0xf4e4a3;
  }
}

/**
 * Best-effort extraction of an `ElementType` from an event's `effectType`
 * tag. The engine packs nested causes into `effectType` like `"dot:fire"`
 * or `"fire"`; we parse either shape.
 */
export function parseElementFromEffectType(
  effectType: string | undefined,
): ElementType | undefined {
  if (!effectType) return undefined;
  const candidate = effectType.includes(":")
    ? effectType.split(":")[1]
    : effectType;
  switch (candidate) {
    case "fire":
    case "ice":
    case "poison":
    case "lightning":
    case "physical":
      return candidate;
    default:
      return undefined;
  }
}
