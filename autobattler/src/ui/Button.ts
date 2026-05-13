import Phaser from "phaser";
import { COLORS, FONTS, FONT_SIZE, HEX } from "@/ui/theme";

/**
 * Reusable parchment-style button.
 *
 * Renders as a glowing-gold-bordered panel with a centered label. Hovering
 * scales it up slightly and brightens the border; clicking dips the scale.
 * Disabled buttons are dimmed and ignore pointer input.
 *
 * Use as a normal `GameObject` — add it to a scene with `scene.add.existing(...)`
 * (the constructor does this for you) and position with `.setPosition()`.
 */

export type ButtonVariant = "primary" | "secondary" | "danger" | "subtle";

export interface ButtonOptions {
  width?: number;
  height?: number;
  label: string;
  /** Visual variant — changes fill and border colors. */
  variant?: ButtonVariant;
  fontSize?: number;
  /** Font family override; defaults to body font. */
  fontFamily?: string;
  /** Initial enabled state. Disabled buttons ignore pointer events. */
  enabled?: boolean;
  /** Click handler. May also be added later via `.onClick(...)`. */
  onClick?: () => void;
}

interface VariantStyle {
  fill: number;
  fillHover: number;
  border: number;
  borderHover: number;
  text: string;
  textDisabled: string;
}

const VARIANT_STYLES: Record<ButtonVariant, VariantStyle> = {
  primary: {
    fill: COLORS.bgPanel,
    fillHover: COLORS.bgPanelHover,
    border: COLORS.goldDeep,
    borderHover: COLORS.goldBright,
    text: HEX.goldGlow,
    textDisabled: HEX.textDim,
  },
  secondary: {
    fill: COLORS.bgPanel,
    fillHover: COLORS.bgPanelLight,
    border: 0x4a3a2a,
    borderHover: COLORS.goldDeep,
    text: HEX.textNormal,
    textDisabled: HEX.textDim,
  },
  danger: {
    fill: 0x3a1a1a,
    fillHover: 0x4a2222,
    border: 0x8a3a3a,
    borderHover: COLORS.red,
    text: "#f4c4a8",
    textDisabled: HEX.textDim,
  },
  subtle: {
    fill: 0x1f1610,
    fillHover: 0x2c2018,
    border: 0x3a2a1a,
    borderHover: COLORS.goldDeep,
    text: HEX.textMuted,
    textDisabled: HEX.textDim,
  },
};

const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 56;
const HOVER_SCALE = 1.04;
const PRESS_SCALE = 0.96;
const TWEEN_MS = 90;

export class Button extends Phaser.GameObjects.Container {
  private bg!: Phaser.GameObjects.Graphics;
  private labelText!: Phaser.GameObjects.Text;
  private hitArea!: Phaser.GameObjects.Rectangle;
  // Underscored to avoid clashes with `Container`'s public `w`/`h`/`width`/
  // `height` getters in Phaser 4.
  private readonly _w: number;
  private readonly _h: number;
  private readonly variant: ButtonVariant;
  private style: VariantStyle;
  private _enabled: boolean = true;
  private hovering: boolean = false;
  private pressing: boolean = false;
  private clickCallbacks: Array<() => void> = [];

  constructor(scene: Phaser.Scene, x: number, y: number, options: ButtonOptions) {
    super(scene, x, y);
    this._w = options.width ?? DEFAULT_WIDTH;
    this._h = options.height ?? DEFAULT_HEIGHT;
    this.variant = options.variant ?? "primary";
    this.style = VARIANT_STYLES[this.variant];

    // Background graphic + visible label.
    this.bg = scene.add.graphics();
    this.labelText = scene.add
      .text(0, 0, options.label, {
        fontFamily: options.fontFamily ?? FONTS.body,
        fontSize: `${options.fontSize ?? FONT_SIZE.medium}px`,
        color: this.style.text,
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Invisible hit-target sized to the full button rect — keeps the active
    // area stable even when the bg is redrawn.
    this.hitArea = scene.add
      .rectangle(0, 0, this._w, this._h, 0xffffff, 0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.add([this.bg, this.hitArea, this.labelText]);
    scene.add.existing(this);

    this.attachPointerEvents();
    this.redraw();

    if (options.onClick) this.clickCallbacks.push(options.onClick);
    if (options.enabled === false) this.setEnabled(false);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  public setEnabled(enabled: boolean): this {
    if (this._enabled === enabled) return this;
    this._enabled = enabled;
    if (enabled) {
      this.hitArea.setInteractive({ useHandCursor: true });
      this.setAlpha(1);
    } else {
      this.hitArea.disableInteractive();
      this.setAlpha(0.45);
      this.hovering = false;
      this.pressing = false;
      this.setScale(1);
    }
    this.redraw();
    return this;
  }

  public isEnabled(): boolean {
    return this._enabled;
  }

  public setLabel(text: string): this {
    this.labelText.setText(text);
    return this;
  }

  public onClick(callback: () => void): this {
    this.clickCallbacks.push(callback);
    return this;
  }

  public setVariant(variant: ButtonVariant): this {
    this.style = VARIANT_STYLES[variant];
    this.labelText.setColor(this._enabled ? this.style.text : this.style.textDisabled);
    this.redraw();
    return this;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private attachPointerEvents(): void {
    this.hitArea.on("pointerover", () => {
      if (!this._enabled) return;
      this.hovering = true;
      this.tweenTo(HOVER_SCALE);
      this.redraw();
    });
    this.hitArea.on("pointerout", () => {
      this.hovering = false;
      this.pressing = false;
      if (!this._enabled) return;
      this.tweenTo(1);
      this.redraw();
    });
    this.hitArea.on("pointerdown", () => {
      if (!this._enabled) return;
      this.pressing = true;
      this.tweenTo(PRESS_SCALE);
      this.redraw();
    });
    this.hitArea.on("pointerup", () => {
      if (!this._enabled) return;
      const wasPressing = this.pressing;
      this.pressing = false;
      this.tweenTo(this.hovering ? HOVER_SCALE : 1);
      this.redraw();
      if (wasPressing) {
        // Fire callbacks after the visual ease-out finishes so the click feels tactile.
        for (const cb of this.clickCallbacks) cb();
      }
    });
  }

  private tweenTo(scale: number): void {
    this.scene.tweens.add({
      targets: this,
      scale,
      duration: TWEEN_MS,
      ease: "Quad.easeOut",
    });
  }

  /**
   * Redraw the panel background. Cheap — called on hover/press/enable
   * changes. Border brightness and fill darken on hover for tactile feedback.
   */
  private redraw(): void {
    this.bg.clear();

    const fill = this.hovering ? this.style.fillHover : this.style.fill;
    const border = this.hovering ? this.style.borderHover : this.style.border;
    const halfW = this._w / 2;
    const halfH = this._h / 2;

    // Soft outer glow — stronger on hover.
    const glowAlpha = this.hovering ? 0.35 : 0.15;
    this.bg.lineStyle(8, this.style.borderHover, glowAlpha * 0.5);
    this.bg.strokeRoundedRect(-halfW - 3, -halfH - 3, this._w + 6, this._h + 6, 12);
    this.bg.lineStyle(4, this.style.borderHover, glowAlpha);
    this.bg.strokeRoundedRect(-halfW - 1, -halfH - 1, this._w + 2, this._h + 2, 10);

    // Fill.
    this.bg.fillStyle(fill, 1);
    this.bg.fillRoundedRect(-halfW, -halfH, this._w, this._h, 8);

    // Border.
    this.bg.lineStyle(2, border, 1);
    this.bg.strokeRoundedRect(-halfW, -halfH, this._w, this._h, 8);

    this.labelText.setColor(
      this._enabled ? this.style.text : this.style.textDisabled,
    );
  }
}
