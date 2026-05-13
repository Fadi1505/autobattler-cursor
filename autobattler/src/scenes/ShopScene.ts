import Phaser from "phaser";
import { GameState } from "@/core/GameState";
import type { ShopOffering } from "@/core/ShopManager";
import { Button } from "@/ui/Button";
import { drawDivider, drawPanel } from "@/ui/Panel";
import {
  CENTER,
  COLORS,
  FONTS,
  FONT_SIZE,
  HEX,
  SCREEN,
} from "@/ui/theme";

/**
 * Between-rounds shop. The player browses six upgrade tiles, buys what they
 * can afford, then commits with "Next Round" to fight an opponent via the
 * fast-simulation `CombatEngine` (animated combat lands in a future scene).
 *
 * Layout (1280×720 logical):
 *   - Top bar  (y=20..96)   : Gold | Gems | Round
 *   - Content  (y=130..560) : 3×2 grid of `UpgradeTile`s
 *   - Bottom   (y=600..680) : Reroll | Standings | Next Round
 */
export class ShopScene extends Phaser.Scene {
  public static readonly KEY = "ShopScene";

  private goldText!: Phaser.GameObjects.Text;
  private gemsText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private tiles: UpgradeTile[] = [];
  private nextRoundButton!: Button;

  /** Tracks whether the player has bought anything this round; gates the
   * Next Round button on rounds > 1 per the design spec. */
  private boughtThisRound = false;

  constructor() {
    super({ key: ShopScene.KEY });
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(HEX.bgDark);
    this.drawTopBar();
    this.drawShopGrid();
    this.drawBottomBar();
    this.refreshAll();

    // First-round freebie: the gate is open immediately.
    this.boughtThisRound = GameState.instance.currentRound === 1;
    this.updateNextRoundButton();
  }

  // -------------------------------------------------------------------------
  // Top bar
  // -------------------------------------------------------------------------

  private drawTopBar(): void {
    drawPanel(this, 30, 20, SCREEN.width - 60, 76, {
      fill: COLORS.bgParchment,
      radius: 8,
    });

    this.goldText = this.makeStatHeader(80, 58, "GOLD", "0", HEX.goldGlow);
    this.gemsText = this.makeStatHeader(320, 58, "GEMS", "0", HEX.purple || "#a64dc4");

    this.roundText = this.add
      .text(SCREEN.width - 80, 58, "ROUND 1", {
        fontFamily: FONTS.title,
        fontSize: `${FONT_SIZE.large}px`,
        color: HEX.textBright,
        fontStyle: "700",
      })
      .setOrigin(1, 0.5);

    this.add
      .text(SCREEN.width - 80, 32, "TOURNAMENT", {
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZE.micro}px`,
        color: HEX.textMuted,
        fontStyle: "600",
      })
      .setOrigin(1, 0.5);

    drawDivider(this, 60, 108, SCREEN.width - 120);
  }

  /** Build a "LABEL\nVALUE" stat readout pair. Returns the value text node. */
  private makeStatHeader(
    x: number,
    y: number,
    label: string,
    value: string,
    valueColor: string,
  ): Phaser.GameObjects.Text {
    this.add
      .text(x, y - 20, label, {
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZE.micro}px`,
        color: HEX.textMuted,
        fontStyle: "700",
      })
      .setOrigin(0, 0.5);

    return this.add
      .text(x, y + 6, value, {
        fontFamily: FONTS.number,
        fontSize: `${FONT_SIZE.large}px`,
        color: valueColor,
      })
      .setOrigin(0, 0.5);
  }

  // -------------------------------------------------------------------------
  // Upgrade grid
  // -------------------------------------------------------------------------

  private drawShopGrid(): void {
    const gs = GameState.instance;
    const shop = gs.currentShop;
    const human = gs.getHumanPlayer();
    if (!shop || !human) return;

    const cols = 3;
    const rows = 2;
    const tileW = 380;
    const tileH = 200;
    const gapX = 20;
    const gapY = 20;
    const totalW = cols * tileW + (cols - 1) * gapX;
    const startX = (SCREEN.width - totalW) / 2;
    const startY = 128;

    const offerings = shop.getOfferings(human);

    for (let i = 0; i < Math.min(offerings.length, cols * rows); i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (tileW + gapX);
      const y = startY + row * (tileH + gapY);
      const tile = new UpgradeTile(this, x, y, tileW, tileH, offerings[i]!);
      tile.onClick(() => this.onBuyClicked(tile));
      this.tiles.push(tile);
    }
  }

  // -------------------------------------------------------------------------
  // Bottom bar
  // -------------------------------------------------------------------------

  private drawBottomBar(): void {
    drawDivider(this, 60, 590, SCREEN.width - 120);

    // Reroll button is intentionally disabled — placeholder for the future
    // "special cards" feature pass; ShopManager already has the wiring.
    new Button(this, 180, 640, {
      label: "REROLL SPECIAL CARDS",
      width: 280,
      height: 56,
      variant: "subtle",
      fontSize: FONT_SIZE.small,
      fontFamily: FONTS.body,
      enabled: false,
      onClick: () => {
        /* Future: this.gs.currentShop.reroll(human) */
      },
    });

    new Button(this, CENTER.x, 640, {
      label: "VIEW STANDINGS",
      width: 240,
      height: 56,
      variant: "secondary",
      fontSize: FONT_SIZE.small,
      fontFamily: FONTS.body,
      onClick: () => this.scene.start("StandingsScene"),
    });

    this.nextRoundButton = new Button(this, SCREEN.width - 200, 640, {
      label: "READY",
      width: 280,
      height: 56,
      variant: "primary",
      fontSize: FONT_SIZE.medium,
      fontFamily: FONTS.title,
      onClick: () => this.onNextRound(),
    });
  }

  // -------------------------------------------------------------------------
  // Interaction
  // -------------------------------------------------------------------------

  private onBuyClicked(tile: UpgradeTile): void {
    const gs = GameState.instance;
    const result = gs.buyUpgrade(tile.categoryKey);
    if (!result.success) {
      // Subtle "cant" feedback — shake the tile.
      this.tweens.add({
        targets: tile.container,
        x: { from: tile.container.x - 4, to: tile.container.x },
        duration: 60,
        yoyo: true,
        repeat: 2,
      });
      return;
    }
    this.boughtThisRound = true;
    this.refreshAll();
    this.updateNextRoundButton();
  }

  private onNextRound(): void {
    const gs = GameState.instance;
    // `startCombat` picks a random alive opponent and transitions to
    // `CombatScene`, which now owns all round-outcome bookkeeping (tournament
    // damage, bot coin-flips, gold income, and handing off to ResultsScene).
    const launched = gs.startCombat(this);
    if (!launched) {
      // No valid opponent left — the match is effectively over.
      this.scene.start("StandingsScene", { matchEnded: true });
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Refresh all tiles + top-bar readouts from the current `GameState`. */
  private refreshAll(): void {
    const gs = GameState.instance;
    const human = gs.getHumanPlayer();
    const shop = gs.currentShop;
    if (!human || !shop) return;

    this.goldText.setText(`${human.gold}`);
    this.gemsText.setText(`${gs.cosmeticGems}`);
    this.roundText.setText(`ROUND ${gs.currentRound}`);

    const offerings = shop.getOfferings(human);
    for (let i = 0; i < this.tiles.length; i++) {
      this.tiles[i]!.refresh(offerings[i]!);
    }
  }

  private updateNextRoundButton(): void {
    const enabled = this.boughtThisRound;
    this.nextRoundButton.setEnabled(enabled);
    this.nextRoundButton.setLabel(
      GameState.instance.currentRound === 1 ? "READY" : "NEXT ROUND",
    );
  }

}

// ---------------------------------------------------------------------------
// UpgradeTile — one of the six upgrade panels in the shop grid.
// ---------------------------------------------------------------------------

/**
 * Visual representation of a single `ShopOffering`. Click anywhere on the
 * tile to attempt a purchase. The owner (`ShopScene`) is responsible for
 * calling `refresh()` after a successful buy so the cost and level update.
 */
class UpgradeTile {
  public readonly container: Phaser.GameObjects.Container;
  public readonly categoryKey: string;

  private readonly scene: Phaser.Scene;
  private readonly w: number;
  private readonly h: number;
  private bg!: Phaser.GameObjects.Graphics;
  private iconRect!: Phaser.GameObjects.Graphics;
  private nameText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private bonusText!: Phaser.GameObjects.Text;
  private costText!: Phaser.GameObjects.Text;
  private buyHint!: Phaser.GameObjects.Text;
  private hovered = false;
  private canAfford = true;
  private clickCallback: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    offering: ShopOffering,
  ) {
    this.scene = scene;
    this.w = width;
    this.h = height;
    this.categoryKey = offering.category.key;
    this.container = scene.add.container(x, y);
    this.buildContents(offering);
    this.refresh(offering);
  }

  // -------------------------------------------------------------------------
  // Build
  // -------------------------------------------------------------------------

  private buildContents(offering: ShopOffering): void {
    this.bg = this.scene.add.graphics();
    this.container.add(this.bg);

    // Category icon — placeholder colored chip with the first letter inside.
    this.iconRect = this.scene.add.graphics();
    this.container.add(this.iconRect);
    const iconLetter = this.scene.add
      .text(20 + 30, 20 + 30, offering.category.key.charAt(0), {
        fontFamily: FONTS.title,
        fontSize: `${FONT_SIZE.large}px`,
        color: HEX.textBright,
        fontStyle: "700",
      })
      .setOrigin(0.5);
    this.container.add(iconLetter);

    // Name + level.
    this.nameText = this.scene.add.text(96, 20, offering.category.name, {
      fontFamily: FONTS.title,
      fontSize: `${FONT_SIZE.medium}px`,
      color: HEX.goldGlow,
      fontStyle: "700",
    });
    this.container.add(this.nameText);

    this.levelText = this.scene.add.text(96, 50, "Lv 0 → 1", {
      fontFamily: FONTS.number,
      fontSize: `${FONT_SIZE.body}px`,
      color: HEX.textMuted,
    });
    this.container.add(this.levelText);

    // Description.
    this.descText = this.scene.add.text(20, 92, offering.category.description, {
      fontFamily: FONTS.body,
      fontSize: `${FONT_SIZE.small}px`,
      color: HEX.textNormal,
      wordWrap: { width: this.w - 40 },
    });
    this.container.add(this.descText);

    // Bottom row: bonus on left, cost on right.
    this.bonusText = this.scene.add.text(20, this.h - 36, "", {
      fontFamily: FONTS.number,
      fontSize: `${FONT_SIZE.body}px`,
      color: HEX.green,
    });
    this.container.add(this.bonusText);

    this.costText = this.scene.add
      .text(this.w - 20, this.h - 36, "", {
        fontFamily: FONTS.number,
        fontSize: `${FONT_SIZE.medium}px`,
        color: HEX.goldBright,
      })
      .setOrigin(1, 0);
    this.container.add(this.costText);

    this.buyHint = this.scene.add
      .text(this.w / 2, this.h - 14, "TAP TO BUY", {
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZE.micro}px`,
        color: HEX.textMuted,
        fontStyle: "700",
      })
      .setOrigin(0.5, 1);
    this.container.add(this.buyHint);

    // Full-tile hit-target.
    const hit = this.scene.add
      .rectangle(this.w / 2, this.h / 2, this.w, this.h, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    this.container.add(hit);

    hit.on("pointerover", () => {
      this.hovered = true;
      this.scene.tweens.add({
        targets: this.container,
        scale: 1.02,
        duration: 80,
        ease: "Quad.easeOut",
      });
      this.redrawBg();
    });
    hit.on("pointerout", () => {
      this.hovered = false;
      this.scene.tweens.add({
        targets: this.container,
        scale: 1,
        duration: 80,
        ease: "Quad.easeOut",
      });
      this.redrawBg();
    });
    hit.on("pointerup", () => {
      if (this.clickCallback) this.clickCallback();
    });
  }

  public onClick(callback: () => void): this {
    this.clickCallback = callback;
    return this;
  }

  // -------------------------------------------------------------------------
  // Refresh
  // -------------------------------------------------------------------------

  public refresh(offering: ShopOffering): void {
    this.canAfford = offering.canAfford;
    this.levelText.setText(
      `Lv ${offering.currentLevel} → ${offering.nextLevel}`,
    );

    const bonus = offering.category.bonusPerLevel;
    const stat = offering.category.statAffected;
    const isPct = stat === "evasion" || stat === "critChance";
    const formatted = isPct ? `+${(bonus * 100).toFixed(0)}% ${stat}` : `+${bonus} ${stat}`;
    this.bonusText.setText(formatted);

    this.costText.setText(`${offering.cost}g`);
    this.costText.setColor(offering.canAfford ? HEX.goldBright : HEX.red);
    this.buyHint.setText(offering.canAfford ? "TAP TO BUY" : "TOO EXPENSIVE");

    this.redrawIcon(offering);
    this.redrawBg();
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  private redrawIcon(offering: ShopOffering): void {
    this.iconRect.clear();
    const c = this.iconColor(offering.category.key);
    this.iconRect.fillStyle(c, 1);
    this.iconRect.fillRoundedRect(20, 20, 60, 60, 8);
    this.iconRect.lineStyle(2, COLORS.goldDeep, 1);
    this.iconRect.strokeRoundedRect(20, 20, 60, 60, 8);
  }

  private redrawBg(): void {
    this.bg.clear();
    const baseFill = this.canAfford ? COLORS.bgPanel : COLORS.bgParchment;
    const fill = this.hovered && this.canAfford ? COLORS.bgPanelHover : baseFill;
    const border = this.hovered && this.canAfford ? COLORS.goldBright : COLORS.goldDeep;
    const glowAlpha = this.hovered && this.canAfford ? 0.32 : 0.12;

    this.bg.lineStyle(8, COLORS.goldGlow, glowAlpha * 0.5);
    this.bg.strokeRoundedRect(-3, -3, this.w + 6, this.h + 6, 14);
    this.bg.lineStyle(4, COLORS.goldGlow, glowAlpha);
    this.bg.strokeRoundedRect(-1, -1, this.w + 2, this.h + 2, 12);

    this.bg.fillStyle(fill, 1);
    this.bg.fillRoundedRect(0, 0, this.w, this.h, 10);
    this.bg.lineStyle(2, border, 1);
    this.bg.strokeRoundedRect(0, 0, this.w, this.h, 10);
  }

  /** Map category key to a consistent placeholder icon color. */
  private iconColor(key: string): number {
    switch (key) {
      case "Attack": return 0xc44d4d;
      case "Mana": return 0x4d8cc4;
      case "Defense": return 0x8a8a8a;
      case "Evasion": return 0x5ec46c;
      case "Critical": return 0xe89c2c;
      case "Shield": return 0xa64dc4;
      default: return COLORS.bgPanelLight;
    }
  }
}
