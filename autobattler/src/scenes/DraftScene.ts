import Phaser from "phaser";
import { GameState } from "@/core/GameState";
import type { HeroDefinition } from "@/core/types";
import { listHeroes } from "@/data/heroes";
import { Button } from "@/ui/Button";
import { drawDivider } from "@/ui/Panel";
import {
  CENTER,
  COLORS,
  FONTS,
  FONT_SIZE,
  HEX,
  ROLE_COLOR,
  ROLE_HEX,
  SCREEN,
} from "@/ui/theme";

/**
 * Hero-pick screen. Lays out the eight hero roster cards in a 4×2 grid and
 * lets the player select one. Confirming the selection starts a new match
 * via `GameState` with the chosen hero assigned to the human player.
 */
export class DraftScene extends Phaser.Scene {
  public static readonly KEY = "DraftScene";

  private selectedKey: string | null = null;
  private cards: HeroCard[] = [];
  private confirmButton!: Button;

  constructor() {
    super({ key: DraftScene.KEY });
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(HEX.bgDark);
    this.drawTitle();

    const heroes = listHeroes();
    this.cards = this.layoutHeroGrid(heroes);

    this.confirmButton = new Button(this, CENTER.x, 680, {
      label: "SELECT HERO",
      width: 320,
      height: 56,
      variant: "primary",
      fontSize: FONT_SIZE.medium,
      fontFamily: FONTS.title,
      enabled: false,
      onClick: () => this.onConfirm(),
    });

    // First-time hint: pulse the cards for half a second so the user notices
    // they're interactive (especially on touch screens).
    this.tweens.add({
      targets: this.cards.map((c) => c.container),
      alpha: { from: 0, to: 1 },
      duration: 280,
      delay: this.tweens.stagger(40),
      ease: "Quad.easeOut",
    });
  }

  // -------------------------------------------------------------------------
  // Layout helpers
  // -------------------------------------------------------------------------

  private drawTitle(): void {
    this.add
      .text(CENTER.x, 48, "CHOOSE YOUR HERO", {
        fontFamily: FONTS.title,
        fontSize: `${FONT_SIZE.xlarge}px`,
        color: HEX.goldGlow,
        fontStyle: "700",
      })
      .setOrigin(0.5);

    this.add
      .text(CENTER.x, 86, "Select a champion to lead into the tournament", {
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZE.body}px`,
        color: HEX.textMuted,
      })
      .setOrigin(0.5);

    drawDivider(this, 80, 110, SCREEN.width - 160);
  }

  /**
   * Place hero cards in a 4×2 grid centered horizontally with consistent
   * spacing. Returns the created `HeroCard` instances for later updates.
   */
  private layoutHeroGrid(heroes: readonly HeroDefinition[]): HeroCard[] {
    const cols = 4;
    const rows = 2;
    const cardW = 270;
    const cardH = 235;
    const gapX = 18;
    const gapY = 18;
    const totalW = cols * cardW + (cols - 1) * gapX;
    const startX = (SCREEN.width - totalW) / 2;
    const startY = 142;

    const cards: HeroCard[] = [];
    for (let i = 0; i < Math.min(heroes.length, cols * rows); i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);
      const card = new HeroCard(this, x, y, cardW, cardH, heroes[i]!);
      card.onClick(() => this.onCardClick(card));
      cards.push(card);
    }
    return cards;
  }

  // -------------------------------------------------------------------------
  // Interaction
  // -------------------------------------------------------------------------

  private onCardClick(card: HeroCard): void {
    this.selectedKey = card.heroKey;
    for (const c of this.cards) c.setSelected(c === card);
    this.confirmButton.setEnabled(true);
    this.confirmButton.setLabel(`SELECT ${card.heroName.toUpperCase()}`);
  }

  private onConfirm(): void {
    if (!this.selectedKey) return;
    const gs = GameState.instance;

    // Build the 8-hero match: human gets their pick, the other 7 get
    // random heroes from the full roster.
    const allKeys = listHeroes().map((h) => h.key);
    const others: string[] = [];
    for (let i = 1; i < 8; i++) {
      others.push(allKeys[Math.floor(Math.random() * allKeys.length)]!);
    }
    const heroKeys = [this.selectedKey, ...others];

    gs.startNewMatch({
      heroKeys,
      humanPlayerId: 0,
      startingGold: 5,
    });

    this.scene.start("ShopScene");
  }
}

// ---------------------------------------------------------------------------
// HeroCard — encapsulates the visual + selection state of a single card.
// ---------------------------------------------------------------------------

/**
 * One hero portrait card in the draft grid. Owns its own background, hover
 * effects, and "selected" gold-glow state. The card itself is the hit-target
 * (no separate button) so the whole tile is tappable on mobile.
 */
class HeroCard {
  public readonly container: Phaser.GameObjects.Container;
  public readonly heroKey: string;
  public readonly heroName: string;
  private readonly w: number;
  private readonly h: number;
  private bg!: Phaser.GameObjects.Graphics;
  private hovered = false;
  private selected = false;
  private clickCallback: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    private readonly hero: HeroDefinition,
  ) {
    this.heroKey = hero.key;
    this.heroName = hero.name;
    this.w = width;
    this.h = height;
    this.container = scene.add.container(x, y);
    this.buildContents();
  }

  // -------------------------------------------------------------------------
  // Build
  // -------------------------------------------------------------------------

  private buildContents(): void {
    this.bg = this.scene.add.graphics();
    this.container.add(this.bg);

    // Portrait placeholder — a colored chip top-left.
    const portraitSize = 56;
    const portrait = this.scene.add.graphics();
    portrait.fillStyle(ROLE_COLOR[this.hero.role], 1);
    portrait.fillRoundedRect(12, 12, portraitSize, portraitSize, 8);
    portrait.lineStyle(2, COLORS.goldDeep, 1);
    portrait.strokeRoundedRect(12, 12, portraitSize, portraitSize, 8);
    this.container.add(portrait);

    // Hero name + role.
    const name = this.scene.add.text(80, 14, this.hero.name, {
      fontFamily: FONTS.title,
      fontSize: `${FONT_SIZE.medium}px`,
      color: HEX.goldGlow,
      fontStyle: "700",
      wordWrap: { width: this.w - 92 },
    });
    this.container.add(name);

    const role = this.scene.add.text(80, 44, this.hero.role.toUpperCase(), {
      fontFamily: FONTS.body,
      fontSize: `${FONT_SIZE.small}px`,
      color: ROLE_HEX[this.hero.role],
      fontStyle: "600",
    });
    this.container.add(role);

    // Description — single block of muted text.
    const desc = this.scene.add.text(12, 80, this.hero.description, {
      fontFamily: FONTS.body,
      fontSize: `${FONT_SIZE.small}px`,
      color: HEX.textNormal,
      wordWrap: { width: this.w - 24, useAdvancedWrap: true },
    });
    this.container.add(desc);

    // Base stats — concise summary line.
    const stats = this.hero.baseStats;
    const statLine = `HP ${stats.hp}    ATK ${stats.attack}    DEF ${stats.defense}`;
    const statLine2 = `MANA/HIT ${stats.manaGain}    CRIT ${(stats.critChance * 100).toFixed(0)}%    EVA ${(stats.evasion * 100).toFixed(0)}%`;

    const statText = this.scene.add.text(12, this.h - 50, statLine, {
      fontFamily: FONTS.number,
      fontSize: `${FONT_SIZE.body}px`,
      color: HEX.goldBright,
    });
    this.container.add(statText);

    const statText2 = this.scene.add.text(12, this.h - 26, statLine2, {
      fontFamily: FONTS.number,
      fontSize: `${FONT_SIZE.small}px`,
      color: HEX.textMuted,
    });
    this.container.add(statText2);

    // Make the whole card interactive.
    const hit = this.scene.add
      .rectangle(this.w / 2, this.h / 2, this.w, this.h, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    this.container.add(hit);

    hit.on("pointerover", () => {
      this.hovered = true;
      this.scene.tweens.add({
        targets: this.container,
        scale: 1.03,
        duration: 90,
        ease: "Quad.easeOut",
      });
      this.redraw();
    });
    hit.on("pointerout", () => {
      this.hovered = false;
      this.scene.tweens.add({
        targets: this.container,
        scale: 1,
        duration: 90,
        ease: "Quad.easeOut",
      });
      this.redraw();
    });
    hit.on("pointerup", () => {
      if (this.clickCallback) this.clickCallback();
    });

    this.redraw();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  public setSelected(selected: boolean): void {
    this.selected = selected;
    this.redraw();
  }

  public onClick(callback: () => void): this {
    this.clickCallback = callback;
    return this;
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  private redraw(): void {
    this.bg.clear();

    const fill = this.selected
      ? COLORS.bgPanelHover
      : this.hovered
        ? COLORS.bgPanelLight
        : COLORS.bgPanel;
    const border = this.selected || this.hovered ? COLORS.goldBright : COLORS.goldDeep;
    const glowAlpha = this.selected ? 0.45 : this.hovered ? 0.3 : 0.12;

    // Outer glow halo.
    this.bg.lineStyle(8, COLORS.goldGlow, glowAlpha * 0.5);
    this.bg.strokeRoundedRect(-3, -3, this.w + 6, this.h + 6, 14);
    this.bg.lineStyle(4, COLORS.goldGlow, glowAlpha);
    this.bg.strokeRoundedRect(-1, -1, this.w + 2, this.h + 2, 12);

    // Fill + border.
    this.bg.fillStyle(fill, 1);
    this.bg.fillRoundedRect(0, 0, this.w, this.h, 10);
    this.bg.lineStyle(this.selected ? 3 : 2, border, 1);
    this.bg.strokeRoundedRect(0, 0, this.w, this.h, 10);

    if (this.selected) {
      // Selected: extra inner gold accent.
      this.bg.lineStyle(1, COLORS.goldGlow, 0.7);
      this.bg.strokeRoundedRect(4, 4, this.w - 8, this.h - 8, 8);
    }
  }
}
