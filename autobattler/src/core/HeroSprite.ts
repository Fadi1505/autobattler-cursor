import Phaser from "phaser";
import type { CombatSide, HeroDefinition } from "@/core/types";
import { COLORS, FONTS, FONT_SIZE, HEX, ROLE_COLOR } from "@/ui/theme";

/**
 * Animated visual for a single hero inside the `CombatScene`.
 *
 * Has two interchangeable render backends:
 *
 *   1. **Sprite mode** — a real spritesheet exists for this hero
 *      (`scene.textures.exists(hero.key) === true` with > 1 frames). The
 *      sprite plays named Phaser animations (`<key>-idle`, `<key>-attack`,
 *      etc.) that `HeroSprite` registers on demand.
 *
 *   2. **Procedural mode** — no usable spritesheet. A colored body
 *      rectangle (role-tinted, gold-bordered) stands in for the hero;
 *      animations are simulated with tweens (lunge, recoil, fade, etc.).
 *
 * The public API is identical for both modes so callers don't need to know
 * which backend is in use. Real sprites can be added later without
 * touching any consumer code.
 */

// ---------------------------------------------------------------------------
// Spritesheet layout (in case a real PNG is provided)
//
// frames 0..3   → idle (6 fps, looped)
// frames 4..7   → attack (12 fps, plays once → idle)
// frames 8..11  → cast (10 fps, plays once → idle)
// frames 12..13 → hit (15 fps, plays once → idle)
// frames 14..17 → death (10 fps, plays once, holds on last frame)
// ---------------------------------------------------------------------------

const ANIM_FRAMES = {
  idle: { start: 0, end: 3, frameRate: 6, repeat: -1 },
  attack: { start: 4, end: 7, frameRate: 14, repeat: 0 },
  cast: { start: 8, end: 11, frameRate: 12, repeat: 0 },
  hit: { start: 12, end: 13, frameRate: 16, repeat: 0 },
  death: { start: 14, end: 17, frameRate: 10, repeat: 0 },
} as const;

type AnimName = keyof typeof ANIM_FRAMES;

const BODY_W = 120;
const BODY_H = 160;
/** Sprite display size — keeps a real 128×128 sheet roughly body-sized. */
const SPRITE_DISPLAY_H = 168;
const LUNGE_DISTANCE = 60;

export interface HeroSpriteOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  side: CombatSide;
  hero: HeroDefinition;
}

export class HeroSprite extends Phaser.GameObjects.Container {
  public readonly side: CombatSide;
  public readonly hero: HeroDefinition;

  /** True if we're rendering via a real spritesheet. */
  private readonly useSprite: boolean;

  // Backend graphics. Only `sprite` and `bodyGraphics` are referenced
  // post-construction — the outline / label assets are added once to
  // the art container and never mutated again, so we don't keep handles.
  private readonly sprite?: Phaser.GameObjects.Sprite;
  private readonly bodyGraphics?: Phaser.GameObjects.Graphics;

  private isDead = false;
  private lungeTween?: Phaser.Tweens.Tween;
  private idleTween?: Phaser.Tweens.Tween;

  /** Sub-container that holds the actual artwork — kept separate from the
   *  outer `Container` (this) so we can mirror facing via `setScale(-1, 1)`
   *  on a child without flipping the bars/text rendered by our parent. */
  private readonly art: Phaser.GameObjects.Container;

  constructor(opts: HeroSpriteOptions) {
    super(opts.scene, opts.x, opts.y);
    this.side = opts.side;
    this.hero = opts.hero;

    this.art = opts.scene.add.container(0, 0);
    this.add(this.art);

    // Decide backend: real sprite if the texture exists and looks usable.
    const textureKey = opts.hero.key;
    this.useSprite =
      opts.scene.textures.exists(textureKey) &&
      this.textureHasFrames(opts.scene, textureKey);

    if (this.useSprite) {
      this.sprite = this.buildSpriteBackend(opts.scene, textureKey);
      this.art.add(this.sprite);
    } else {
      const { graphics, outline, label } = this.buildProceduralBackend(
        opts.scene,
        opts.hero,
      );
      this.bodyGraphics = graphics;
      this.art.add([outline, graphics, label]);
    }

    // Right-side fighters face left. Mirror only the art container so the
    // bars / labels rendered by the FighterView in our parent remain readable.
    if (this.side === "right") this.art.setScale(-1, 1);

    opts.scene.add.existing(this);
    this.playIdle();
  }

  // -------------------------------------------------------------------------
  // Public animation API
  // -------------------------------------------------------------------------

  /** Start (or resume) the looping idle animation. */
  public playIdle(): void {
    if (this.isDead) return;
    if (this.sprite) {
      const key = this.animKey("idle");
      if (this.sprite.scene.anims.exists(key)) {
        this.sprite.anims.play({ key, repeat: -1 }, true);
      }
    } else {
      this.startProceduralIdle();
    }
  }

  /**
   * Quick attack: lunges the body forward and plays the attack animation.
   * Returns to idle afterward.
   */
  public playAttack(): void {
    if (this.isDead) return;
    this.lunge(LUNGE_DISTANCE);
    this.playOneShot("attack");
  }

  /**
   * Casting an ability/ult. `_abilityName` is accepted so future sprites
   * can branch animations by ability if desired — currently unused.
   * Sub-classes / sprite variants may pick a different frame range here.
   */
  public playCast(_abilityName: string, color: number, isUltimate = false): void {
    if (this.isDead) return;
    this.flashBody(color, isUltimate ? 0.8 : 0.55, isUltimate ? 480 : 280);
    this.playOneShot("cast");
    // A small upward bob during casting reads as "channeling".
    this.scene.tweens.add({
      targets: this.art,
      y: { from: 0, to: -8 },
      duration: 150,
      yoyo: true,
      ease: "Sine.easeInOut",
    });
  }

  /** Flinch / recoil — used when this fighter takes a hit. */
  public playHit(): void {
    if (this.isDead) return;
    const recoilX = this.side === "left" ? -8 : 8;
    this.scene.tweens.add({
      targets: this.art,
      x: { from: 0, to: recoilX },
      duration: 60,
      yoyo: true,
      ease: "Quad.easeOut",
    });
    this.flashBody(0xffffff, 0.55, 110);
    this.playOneShot("hit");
  }

  /** Death — collapse + dim + (sprite) play death anim. Idempotent. */
  public playDeath(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.lungeTween?.stop();
    this.idleTween?.stop();
    this.idleTween = undefined;

    if (this.sprite) {
      const key = this.animKey("death");
      if (this.sprite.scene.anims.exists(key)) {
        this.sprite.anims.play(key);
      }
    }

    this.scene.tweens.add({
      targets: this.art,
      alpha: 0.25,
      scaleY: this.art.scaleY * 0.85,
      duration: 450,
      ease: "Quad.easeIn",
    });
  }

  // -------------------------------------------------------------------------
  // Backend: real spritesheet
  // -------------------------------------------------------------------------

  private buildSpriteBackend(
    scene: Phaser.Scene,
    textureKey: string,
  ): Phaser.GameObjects.Sprite {
    this.ensureAnimations(scene, textureKey);
    const sprite = scene.add.sprite(0, 0, textureKey, 0).setOrigin(0.5, 0.5);
    // Scale uniformly to a consistent visual height regardless of source res.
    const baseH = sprite.height || 128;
    sprite.setScale(SPRITE_DISPLAY_H / baseH);
    return sprite;
  }

  private ensureAnimations(scene: Phaser.Scene, textureKey: string): void {
    for (const name of Object.keys(ANIM_FRAMES) as AnimName[]) {
      const key = `${textureKey}-${name}`;
      if (scene.anims.exists(key)) continue;
      const spec = ANIM_FRAMES[name];
      // Clip frame range to the texture's actual frame count to avoid errors
      // on shorter / partial sheets.
      const frameCount = scene.textures.get(textureKey).frameTotal;
      const start = Math.min(spec.start, frameCount - 1);
      const end = Math.min(spec.end, frameCount - 1);
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(textureKey, { start, end }),
        frameRate: spec.frameRate,
        repeat: spec.repeat,
      });
    }
  }

  private textureHasFrames(scene: Phaser.Scene, key: string): boolean {
    const tex = scene.textures.get(key);
    // `__BASE` is the placeholder default frame on textures with no real
    // frames — we treat that as "no usable sprite".
    return tex && tex.frameTotal > 1;
  }

  // -------------------------------------------------------------------------
  // Backend: procedural body
  // -------------------------------------------------------------------------

  private buildProceduralBackend(
    scene: Phaser.Scene,
    hero: HeroDefinition,
  ): {
    graphics: Phaser.GameObjects.Graphics;
    outline: Phaser.GameObjects.Graphics;
    label: Phaser.GameObjects.Text;
  } {
    const bodyColor = ROLE_COLOR[hero.role];

    const outline = scene.add.graphics();
    outline.lineStyle(10, COLORS.goldDeep, 0.4);
    outline.strokeRoundedRect(
      -BODY_W / 2 - 2,
      -BODY_H / 2 - 2,
      BODY_W + 4,
      BODY_H + 4,
      14,
    );

    const graphics = scene.add.graphics();
    graphics.fillStyle(bodyColor, 1);
    graphics.fillRoundedRect(-BODY_W / 2, -BODY_H / 2, BODY_W, BODY_H, 12);
    graphics.lineStyle(2, COLORS.goldBright, 0.85);
    graphics.strokeRoundedRect(-BODY_W / 2, -BODY_H / 2, BODY_W, BODY_H, 12);
    // Inner highlight — a hint of dimensionality.
    graphics.fillStyle(0xffffff, 0.08);
    graphics.fillRoundedRect(
      -BODY_W / 2 + 6,
      -BODY_H / 2 + 6,
      BODY_W - 12,
      BODY_H / 3,
      8,
    );

    const label = scene.add
      .text(0, 30, firstWordOf(hero.name).toUpperCase(), {
        fontFamily: FONTS.title,
        fontSize: `${FONT_SIZE.body}px`,
        color: HEX.textBright,
        fontStyle: "700",
      })
      .setOrigin(0.5);

    return { graphics, outline, label };
  }

  /** Subtle vertical bob loop on the procedural body. */
  private startProceduralIdle(): void {
    if (!this.bodyGraphics || this.idleTween) return;
    this.idleTween = this.scene.tweens.add({
      targets: this.art,
      y: { from: 0, to: -4 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  // -------------------------------------------------------------------------
  // Animation helpers shared between backends
  // -------------------------------------------------------------------------

  private playOneShot(name: AnimName): void {
    if (!this.sprite) return;
    const key = this.animKey(name);
    if (!this.sprite.scene.anims.exists(key)) return;
    this.sprite.anims.play(key, true);
    this.sprite.once(
      Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key,
      () => {
        if (!this.isDead) this.playIdle();
      },
    );
  }

  private animKey(name: AnimName): string {
    return `${this.hero.key}-${name}`;
  }

  /** Forward lunge of `distance` px, then return — used by `playAttack`. */
  private lunge(distance: number): void {
    const dir = this.side === "left" ? +1 : -1;
    this.lungeTween?.stop();
    this.lungeTween = this.scene.tweens.add({
      targets: this.art,
      x: { from: 0, to: dir * distance },
      duration: 100,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => {
        // Snap to canonical position to avoid floating-point drift.
        this.art.x = 0;
      },
    });
  }

  /**
   * Brief tinted overlay that gives the hero a "lit by element" feel during
   * casts / crits / hits. Works for both backends because it's drawn over
   * the art container, not the sprite itself.
   */
  private flashBody(color: number, alpha: number, durationMs: number): void {
    const flash = this.scene.add.graphics();
    flash.fillStyle(color, alpha);
    flash.fillRoundedRect(-BODY_W / 2, -BODY_H / 2, BODY_W, BODY_H, 12);
    this.art.add(flash);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: durationMs,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy(),
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function firstWordOf(name: string): string {
  const trimmed = name.trim();
  const sep = trimmed.indexOf(" ");
  return sep < 0 ? trimmed : trimmed.slice(0, sep);
}
