import Phaser from "phaser";
import { COLORS } from "@/ui/theme";

/**
 * Cheap reusable UI primitives: parchment panels, procedural textures.
 *
 * Kept as small free functions (rather than classes) because the resulting
 * `Phaser.GameObjects.Graphics` already owns everything mutable. Drop them
 * into containers, tween them, destroy them — they're just shapes.
 */

// ---------------------------------------------------------------------------
// Parchment panel
// ---------------------------------------------------------------------------

export interface PanelStyle {
  /** Fill color of the parchment interior. */
  fill?: number;
  /** Border color. Defaults to deep gold. */
  border?: number;
  /** Outer "glow" color — drawn as a translucent halo. */
  glow?: number;
  /** Border thickness in px. */
  borderWidth?: number;
  /** Corner radius in px. */
  radius?: number;
  /** When true, an extra inner highlight stroke is drawn for emphasis. */
  highlighted?: boolean;
  /** Fill alpha (0..1). Defaults to 1. */
  alpha?: number;
}

/**
 * Draw a dark-parchment rounded panel with a glowing gold border into
 * a fresh `Graphics` and return it. The panel is positioned at `(x, y)`
 * with its **top-left corner** there (not center) — matches the rest of
 * Phaser's `fillRoundedRect` convention.
 */
export function drawPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  style: PanelStyle = {},
): Phaser.GameObjects.Graphics {
  const fill = style.fill ?? COLORS.bgPanel;
  const border = style.border ?? COLORS.goldDeep;
  const glow = style.glow ?? COLORS.goldBright;
  const borderWidth = style.borderWidth ?? 2;
  const radius = style.radius ?? 10;
  const alpha = style.alpha ?? 1;

  const g = scene.add.graphics();

  // Soft outer glow — two stacked translucent strokes give the impression
  // of a halo without needing a shader / blur filter.
  g.lineStyle(borderWidth + 8, glow, 0.08);
  g.strokeRoundedRect(x - 4, y - 4, width + 8, height + 8, radius + 4);
  g.lineStyle(borderWidth + 4, glow, 0.18);
  g.strokeRoundedRect(x - 2, y - 2, width + 4, height + 4, radius + 2);

  // Fill.
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x, y, width, height, radius);

  // Crisp border.
  g.lineStyle(borderWidth, border, 1);
  g.strokeRoundedRect(x, y, width, height, radius);

  // Optional inner highlight line for selected / accented panels.
  if (style.highlighted) {
    g.lineStyle(1, COLORS.goldGlow, 0.8);
    g.strokeRoundedRect(
      x + borderWidth + 2,
      y + borderWidth + 2,
      width - (borderWidth + 2) * 2,
      height - (borderWidth + 2) * 2,
      Math.max(0, radius - borderWidth - 2),
    );
  }

  return g;
}

/**
 * Draw a thin gold horizontal divider line. Useful for separating top bars
 * and table headers from content.
 */
export function drawDivider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  color: number = COLORS.goldDeep,
  alpha: number = 0.6,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(1, color, alpha);
  g.lineBetween(x, y, x + width, y);
  g.lineStyle(1, COLORS.goldGlow, alpha * 0.5);
  g.lineBetween(x, y + 1, x + width, y + 1);
  return g;
}

// ---------------------------------------------------------------------------
// Procedural textures — created on-demand into the scene's texture cache.
// ---------------------------------------------------------------------------

/**
 * Ensure a tiny white circle texture exists (key: `white-circle`). Useful as
 * a particle texture that can be tinted to any color downstream. Idempotent.
 */
export function ensureCircleTexture(
  scene: Phaser.Scene,
  key: string = "white-circle",
  radius: number = 8,
): string {
  if (scene.textures.exists(key)) return key;
  const size = radius * 2;
  const g = scene.add.graphics({ x: 0, y: 0 });
  g.fillStyle(0xffffff, 1);
  g.fillCircle(radius, radius, radius);
  g.generateTexture(key, size, size);
  g.destroy();
  return key;
}

/**
 * Ensure a tiny soft-edged "spark" texture exists, useful for particles
 * that need a glowy feel without the rectangular hard edges of a square.
 */
export function ensureSparkTexture(
  scene: Phaser.Scene,
  key: string = "white-spark",
  radius: number = 12,
): string {
  if (scene.textures.exists(key)) return key;
  const size = radius * 2;
  const g = scene.add.graphics({ x: 0, y: 0 });
  for (let r = radius; r > 0; r--) {
    const alpha = (1 - r / radius) * 0.5 + 0.2 * (r === 1 ? 1 : 0);
    g.fillStyle(0xffffff, Math.min(1, alpha));
    g.fillCircle(radius, radius, r);
  }
  g.generateTexture(key, size, size);
  g.destroy();
  return key;
}
