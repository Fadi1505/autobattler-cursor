import Phaser from "phaser";
import type { ElementType } from "@/core/types";
import { ensureCircleTexture, ensureSparkTexture } from "@/ui/Panel";

/**
 * Tiny "manager" for element-colored particle effects.
 *
 * The class is stateless aside from the owning scene reference — every
 * call spawns a short-lived `ParticleEmitter` that destroys itself
 * automatically. That keeps the public surface (`burst`, `trail`,
 * `screenShake`, etc.) ergonomic without leaking emitter handles
 * across the codebase.
 *
 * Element styling lives in `STYLES` so balance/visual tweaks are a
 * single-table change. New `ParticleStyle`s can be added (`gold`,
 * `heal`, `shield`, etc.) without touching call-sites.
 */

/** All recognized particle styles. Includes elements + a few semantic tags. */
export type ParticleStyle =
  | ElementType
  | "gold"
  | "heal"
  | "shield"
  | "stun"
  | "slow"
  | "miss";

interface StyleProfile {
  /** Primary particle tint (0xRRGGBB). */
  tint: number;
  /** Optional secondary tint — emitter alternates between the two. */
  tintAlt?: number;
  /** Texture to use; we default to `white-spark` which is procedural. */
  texture: "white-spark" | "white-circle";
  /** Phaser blend mode. ADD looks lit; NORMAL looks solid. */
  blend: Phaser.BlendModes;
  /** Particle speed in px/s. */
  speedMin: number;
  speedMax: number;
  /** Gravity in px/s² applied to particles. */
  gravityY: number;
  /** Lifespan range in ms. */
  lifespanMin: number;
  lifespanMax: number;
  /** Starting scale (1 = full texture size). */
  scaleStart: number;
  /** Default particle count for `intensity = 1`. */
  baseQuantity: number;
}

// ---------------------------------------------------------------------------
// Style table — visuals & physics tuned per element.
// ---------------------------------------------------------------------------

const STYLES: Record<ParticleStyle, StyleProfile> = {
  fire: {
    tint: 0xff7a2c,
    tintAlt: 0xffd146,
    texture: "white-spark",
    blend: Phaser.BlendModes.ADD,
    speedMin: 90,
    speedMax: 200,
    gravityY: -130, // rising embers
    lifespanMin: 380,
    lifespanMax: 700,
    scaleStart: 0.55,
    baseQuantity: 10,
  },
  ice: {
    tint: 0x9fd9ff,
    tintAlt: 0x6bb6ff,
    texture: "white-spark",
    blend: Phaser.BlendModes.ADD,
    speedMin: 60,
    speedMax: 150,
    gravityY: 40,
    lifespanMin: 500,
    lifespanMax: 900,
    scaleStart: 0.5,
    baseQuantity: 9,
  },
  poison: {
    tint: 0x6fc46c,
    tintAlt: 0xc4ff8a,
    texture: "white-spark",
    blend: Phaser.BlendModes.SCREEN,
    speedMin: 50,
    speedMax: 140,
    gravityY: -30,
    lifespanMin: 600,
    lifespanMax: 1000,
    scaleStart: 0.5,
    baseQuantity: 8,
  },
  lightning: {
    tint: 0xfff04d,
    tintAlt: 0xffffff,
    texture: "white-spark",
    blend: Phaser.BlendModes.ADD,
    speedMin: 200,
    speedMax: 380,
    gravityY: 0,
    lifespanMin: 220,
    lifespanMax: 380,
    scaleStart: 0.6,
    baseQuantity: 12,
  },
  physical: {
    tint: 0xf4e4a3,
    texture: "white-spark",
    blend: Phaser.BlendModes.ADD,
    speedMin: 100,
    speedMax: 220,
    gravityY: 40,
    lifespanMin: 280,
    lifespanMax: 500,
    scaleStart: 0.5,
    baseQuantity: 8,
  },
  gold: {
    tint: 0xf4d76b,
    tintAlt: 0xfff1a8,
    texture: "white-spark",
    blend: Phaser.BlendModes.ADD,
    speedMin: 100,
    speedMax: 240,
    gravityY: 80,
    lifespanMin: 500,
    lifespanMax: 900,
    scaleStart: 0.55,
    baseQuantity: 10,
  },
  heal: {
    tint: 0x5ec46c,
    tintAlt: 0xb0ffba,
    texture: "white-spark",
    blend: Phaser.BlendModes.ADD,
    speedMin: 40,
    speedMax: 120,
    gravityY: -90, // rises like a calming aura
    lifespanMin: 600,
    lifespanMax: 1000,
    scaleStart: 0.5,
    baseQuantity: 8,
  },
  shield: {
    tint: 0xf4d76b,
    tintAlt: 0xffffff,
    texture: "white-circle",
    blend: Phaser.BlendModes.ADD,
    speedMin: 80,
    speedMax: 160,
    gravityY: 0,
    lifespanMin: 450,
    lifespanMax: 700,
    scaleStart: 0.4,
    baseQuantity: 10,
  },
  stun: {
    tint: 0xa64dc4,
    tintAlt: 0xfff04d,
    texture: "white-spark",
    blend: Phaser.BlendModes.ADD,
    speedMin: 60,
    speedMax: 140,
    gravityY: 0,
    lifespanMin: 600,
    lifespanMax: 1000,
    scaleStart: 0.5,
    baseQuantity: 7,
  },
  slow: {
    tint: 0x6bb6ff,
    texture: "white-spark",
    blend: Phaser.BlendModes.ADD,
    speedMin: 30,
    speedMax: 80,
    gravityY: 20,
    lifespanMin: 700,
    lifespanMax: 1200,
    scaleStart: 0.45,
    baseQuantity: 7,
  },
  miss: {
    tint: 0x8a7853,
    texture: "white-spark",
    blend: Phaser.BlendModes.NORMAL,
    speedMin: 30,
    speedMax: 80,
    gravityY: 60,
    lifespanMin: 250,
    lifespanMax: 400,
    scaleStart: 0.35,
    baseQuantity: 4,
  },
};

/** Cap on intensity to keep particle counts sane on slow hardware. */
const MAX_INTENSITY = 4;

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class ParticleManager {
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Ensure procedural particle textures exist; idempotent.
    ensureCircleTexture(scene);
    ensureSparkTexture(scene);
  }

  /**
   * Map an `ElementType` (or undefined) to its canonical tint. Useful for
   * call-sites that mix particles with text colors keyed off the same
   * element (`HeroSprite` flashes, damage numbers, etc.).
   */
  public static elementColor(element: ElementType | undefined): number {
    if (element && element in STYLES) return STYLES[element as ParticleStyle].tint;
    return STYLES.physical.tint;
  }

  /** Tint corresponding to any registered style. */
  public static colorFor(style: ParticleStyle): number {
    return STYLES[style].tint;
  }

  /**
   * Fire a one-shot particle burst at `(x, y)` styled per `style`. The
   * underlying emitter auto-destroys after the last particle dies.
   *
   * `intensity` (default 1) multiplies particle count and max speed,
   * letting the caller make ultimates feel chunkier than a basic ability
   * without authoring a new style entry.
   */
  public burst(
    x: number,
    y: number,
    style: ParticleStyle,
    intensity: number = 1,
  ): void {
    const profile = STYLES[style];
    const k = Math.max(1, Math.min(MAX_INTENSITY, intensity));

    const emitter = this.scene.add.particles(x, y, profile.texture, {
      tint: profile.tintAlt
        ? [profile.tint, profile.tintAlt]
        : profile.tint,
      lifespan: { min: profile.lifespanMin, max: profile.lifespanMax },
      speed: { min: profile.speedMin, max: profile.speedMax * k },
      gravityY: profile.gravityY,
      scale: { start: profile.scaleStart * (1 + (k - 1) * 0.25), end: 0 },
      alpha: { start: 0.95, end: 0 },
      blendMode: profile.blend,
      quantity: Math.round(profile.baseQuantity * k),
    });
    emitter.setDepth(20);

    // Single-pulse: stop emitting after a short window so the burst feels
    // discrete. Lifespan + the longest emission window determine the cleanup
    // deadline so we don't destroy particles that are still rendering.
    const stopAfter = 80;
    const destroyAfter = stopAfter + profile.lifespanMax + 100;
    this.scene.time.delayedCall(stopAfter, () => emitter.stop());
    this.scene.time.delayedCall(destroyAfter, () => emitter.destroy());
  }

  /**
   * Continuous trail emitter that follows a position-bearing target.
   * Returns the emitter so the caller can dispose of it (e.g., on death).
   *
   * `target` only needs to be position-readable (`{ x, y }`) — any Phaser
   * `GameObject` with the Transform component (and most plain objects with
   * x/y) satisfies this.
   */
  public trail(
    target: { x: number; y: number },
    style: ParticleStyle,
    intensity: number = 1,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    const profile = STYLES[style];
    const k = Math.max(1, Math.min(MAX_INTENSITY, intensity));

    const emitter = this.scene.add.particles(0, 0, profile.texture, {
      tint: profile.tint,
      lifespan: profile.lifespanMin,
      speed: { min: profile.speedMin * 0.5, max: profile.speedMax * 0.5 },
      gravityY: profile.gravityY,
      scale: { start: profile.scaleStart * 0.8, end: 0 },
      alpha: { start: 0.8, end: 0 },
      blendMode: profile.blend,
      frequency: 80 / k,
      follow: target,
    });
    emitter.setDepth(15);
    return emitter;
  }

  /**
   * Convenience camera-shake. Lives here so callers have one place to ask
   * for impact effects ("shake on ultimate") without reaching into the
   * camera API directly.
   */
  public screenShake(durationMs: number, intensity: number = 0.012): void {
    this.scene.cameras.main.shake(durationMs, intensity);
  }

  /**
   * Element → style helper. Returns the style key for an `ElementType`,
   * defaulting to `"physical"` for unknown / missing inputs. Useful when
   * wiring up event handlers that route by `ElementType`.
   */
  public static styleForElement(
    element: ElementType | undefined,
  ): ParticleStyle {
    return (element ?? "physical") as ParticleStyle;
  }
}
