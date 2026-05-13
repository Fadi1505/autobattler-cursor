import Phaser from "phaser";
import { listHeroes } from "@/data/heroes";
import type { HeroDefinition } from "@/core/types";
import { COLORS, ROLE_COLOR } from "@/ui/theme";
import { GAME_WIDTH, GAME_HEIGHT } from "@/utils/constants";

/** Standard frame size for hero spritesheets (matches `HeroSprite`). */
const HERO_FRAME_SIZE = 128;

/**
 * Loads the main game asset bundle and shows a progress bar while doing so.
 *
 * Hero spritesheets are queued in `preload()` — if the PNGs don't exist on
 * disk yet, the loader logs an error and continues; the missing textures
 * are filled in with procedural placeholders during `create()` so
 * `CombatScene` always has something to render.
 */
export class PreloadScene extends Phaser.Scene {
  public static readonly KEY = "PreloadScene";

  private static readonly BAR_WIDTH = 480;
  private static readonly BAR_HEIGHT = 28;
  private static readonly BAR_PADDING = 4;

  private barFill!: Phaser.GameObjects.Graphics;
  private percentText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: PreloadScene.KEY });
  }

  preload(): void {
    this.createProgressUI();

    this.load.on(Phaser.Loader.Events.PROGRESS, this.onProgress, this);
    this.load.on(Phaser.Loader.Events.COMPLETE, this.onComplete, this);

    // Missing hero spritesheets are an expected, recoverable state today —
    // swallow the loader's stderr so the console stays clean. Placeholder
    // textures are generated in `create()` for any hero that didn't resolve.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onFileError, this);

    this.queueHeroSpriteSheets();
  }

  create(): void {
    this.ensureHeroPlaceholders();

    // If preload() had nothing queued, the COMPLETE event already fired
    // before create() ran. Force the bar to a finished state in that case.
    if (this.load.totalToLoad === 0) {
      this.onProgress(1);
      this.onComplete();
    }
  }

  // -------------------------------------------------------------------------
  // Hero asset loading
  // -------------------------------------------------------------------------

  /**
   * Queue a `spritesheet` load for every hero in the data table. Each uses
   * the hero's own `key` as the texture key, so `HeroSprite` can look the
   * texture up by `hero.key` without any indirection.
   *
   * URL note: Vite's `publicDir` is set to `assets/`, so anything inside
   * that folder is served from the root in dev and copied to `dist/` at
   * the same path in production. We therefore reference sprites as
   * `sprites/heroes/...` (without the `assets/` prefix) so the URL matches
   * what Vite actually exposes.
   */
  private queueHeroSpriteSheets(): void {
    for (const hero of listHeroes()) {
      this.load.spritesheet(
        hero.key,
        `sprites/heroes/${hero.key}.png`,
        { frameWidth: HERO_FRAME_SIZE, frameHeight: HERO_FRAME_SIZE },
      );
    }
  }

  /**
   * For any hero whose spritesheet failed to load (file missing, 404,
   * etc.), synthesise a single-frame placeholder texture so consumers
   * (`HeroSprite`) can still render *something* in procedural fallback
   * mode without crashing or showing the dreaded green-and-magenta
   * "missing texture" checker.
   */
  private ensureHeroPlaceholders(): void {
    for (const hero of listHeroes()) {
      if (this.textures.exists(hero.key)) continue;
      this.generatePlaceholderHeroTexture(hero);
    }
  }

  /**
   * Draw a 128×128 placeholder texture for the given hero: a role-tinted
   * rounded rectangle with the hero's initial centered inside.
   *
   * `HeroSprite` will see this as a single-frame texture and fall back to
   * its procedural animation path automatically.
   */
  private generatePlaceholderHeroTexture(hero: HeroDefinition): void {
    const size = HERO_FRAME_SIZE;
    const g = this.add.graphics();

    // Body fill.
    const tint = ROLE_COLOR[hero.role];
    g.fillStyle(tint, 1);
    g.fillRoundedRect(0, 0, size, size, 14);
    // Inner top highlight for a tiny bit of depth.
    g.fillStyle(0xffffff, 0.08);
    g.fillRoundedRect(6, 6, size - 12, size / 3, 8);
    // Gold border to match the rest of the UI.
    g.lineStyle(3, COLORS.goldBright, 1);
    g.strokeRoundedRect(0, 0, size, size, 14);

    g.generateTexture(hero.key, size, size);
    g.destroy();
  }

  // -------------------------------------------------------------------------
  // Loader error handling
  // -------------------------------------------------------------------------

  private onFileError(file: Phaser.Loader.File): void {
    // Squashing the loader's noisy default error path — placeholders cover us.
    // Devs can still see what failed during local development.
    if (file.type === "spritesheet" || file.type === "image") {
      // eslint-disable-next-line no-console
      console.info(`[Preload] Missing sprite "${file.key}", using placeholder.`);
    }
  }

  // -------------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------------

  private createProgressUI(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const w = PreloadScene.BAR_WIDTH;
    const h = PreloadScene.BAR_HEIGHT;
    const x = cx - w / 2;
    const y = cy;

    this.add
      .text(cx, cy - 80, "AUTOBATTLER", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "48px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const bg = this.add.graphics();
    bg.lineStyle(2, 0x4a5160, 1);
    bg.fillStyle(0x1a1f2b, 1);
    bg.fillRoundedRect(x, y, w, h, 6);
    bg.strokeRoundedRect(x, y, w, h, 6);

    this.barFill = this.add.graphics();

    this.percentText = this.add
      .text(cx, cy + 50, "0%", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: "#cbd5e1",
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(cx, cy + 80, "Loading...", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#94a3b8",
      })
      .setOrigin(0.5);
  }

  private onProgress(value: number): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const w = PreloadScene.BAR_WIDTH;
    const h = PreloadScene.BAR_HEIGHT;
    const p = PreloadScene.BAR_PADDING;
    const innerWidth = (w - p * 2) * Phaser.Math.Clamp(value, 0, 1);

    this.barFill.clear();
    if (innerWidth > 0) {
      this.barFill.fillStyle(0x60a5fa, 1);
      this.barFill.fillRoundedRect(
        cx - w / 2 + p,
        cy + p,
        innerWidth,
        h - p * 2,
        4,
      );
    }

    this.percentText.setText(`${Math.round(value * 100)}%`);
  }

  private onComplete(): void {
    this.load.off(Phaser.Loader.Events.PROGRESS, this.onProgress, this);
    this.load.off(Phaser.Loader.Events.COMPLETE, this.onComplete, this);
    this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onFileError, this);
    this.statusText.setText("Ready");
    // Small breath so the bar reads "100%" before transitioning.
    this.time.delayedCall(120, () => this.scene.start("DraftScene"));
  }
}
