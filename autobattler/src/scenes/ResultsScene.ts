import Phaser from "phaser";
import { getHero } from "@/data/heroes";
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

/**
 * Data passed to `ResultsScene` from the scene that resolved combat
 * (currently `ShopScene`). All optional for safety — if the scene is
 * launched without payload (e.g. during dev), placeholder values appear.
 */
export interface ResultsSceneInitData {
  wasWin: boolean;
  isDraw?: boolean;
  roundNumber: number;
  humanHeroKey: string;
  opponentHeroKey: string;
  damageDealt: number;
  damageTaken: number;
  goldEarned: number;
  baseGold: number;
  interest: number;
  combatDuration: number;
  /** True when the match is over (human dead OR only one player alive). */
  matchEnded: boolean;
  humanRemainingHP: number;
}

const DEFAULT_DATA: ResultsSceneInitData = {
  wasWin: true,
  isDraw: false,
  roundNumber: 1,
  humanHeroKey: "infernoDrake",
  opponentHeroKey: "thrainStonebeard",
  damageDealt: 0,
  damageTaken: 0,
  goldEarned: 40,
  baseGold: 40,
  interest: 0,
  combatDuration: 0,
  matchEnded: false,
  humanRemainingHP: 100,
};

/**
 * Round outcome screen. Shows a big VICTORY / DEFEAT / DRAW banner with
 * tasteful sparkle particles, the stats from the round, and a Continue
 * button that routes to either the next ShopScene round or the final
 * StandingsScene if the match has ended.
 */
export class ResultsScene extends Phaser.Scene {
  public static readonly KEY = "ResultsScene";

  // Renamed from `data` because `Phaser.Scene.data` is the built-in DataManager
  // — overriding it confuses TypeScript and the framework alike.
  private payload: ResultsSceneInitData = DEFAULT_DATA;
  private particles?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super({ key: ResultsScene.KEY });
  }

  public init(data?: Partial<ResultsSceneInitData>): void {
    this.payload = { ...DEFAULT_DATA, ...(data ?? {}) };
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(HEX.bgDark);
    ensureSparkTexture(this);

    this.drawBanner();
    this.drawStats();
    this.drawFooter();
    this.startParticles();
    this.playBannerEntrance();
  }

  // -------------------------------------------------------------------------
  // Banner
  // -------------------------------------------------------------------------

  private drawBanner(): void {
    const { wasWin, isDraw } = this.payload;
    const label = isDraw ? "DRAW" : wasWin ? "VICTORY" : "DEFEAT";
    const color = isDraw
      ? HEX.textMuted
      : wasWin
        ? HEX.green
        : HEX.red;

    // Subtitle.
    const subtitle = `Round ${this.payload.roundNumber}`;
    this.add
      .text(CENTER.x, 110, subtitle, {
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZE.medium}px`,
        color: HEX.textMuted,
        fontStyle: "600",
      })
      .setOrigin(0.5);

    // Shadow pass for depth.
    this.add
      .text(CENTER.x + 4, 218 + 4, label, {
        fontFamily: FONTS.title,
        fontSize: `${FONT_SIZE.banner}px`,
        color: HEX.bgBlack,
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setAlpha(0.5);

    const bannerText = this.add
      .text(CENTER.x, 218, label, {
        fontFamily: FONTS.title,
        fontSize: `${FONT_SIZE.banner}px`,
        color,
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setName("banner");

    // Subtle bob — gentler than a flash, doesn't draw the eye away from stats.
    this.tweens.add({
      targets: bannerText,
      y: 224,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private playBannerEntrance(): void {
    const banner = this.children.getByName("banner") as Phaser.GameObjects.Text;
    if (!banner) return;
    banner.setScale(0.6).setAlpha(0);
    this.tweens.add({
      targets: banner,
      scale: 1,
      alpha: 1,
      duration: 360,
      ease: "Back.easeOut",
    });
  }

  // -------------------------------------------------------------------------
  // Stats panel
  // -------------------------------------------------------------------------

  private drawStats(): void {
    const panelW = 720;
    const panelH = 240;
    const panelX = (SCREEN.width - panelW) / 2;
    const panelY = 320;

    drawPanel(this, panelX, panelY, panelW, panelH, {
      fill: COLORS.bgPanel,
      radius: 12,
      highlighted: true,
    });

    // Header: matchup line.
    const humanName = getHero(this.payload.humanHeroKey).name;
    const opponentName = getHero(this.payload.opponentHeroKey).name;
    this.add
      .text(
        CENTER.x,
        panelY + 32,
        `${humanName.toUpperCase()}  vs  ${opponentName.toUpperCase()}`,
        {
          fontFamily: FONTS.title,
          fontSize: `${FONT_SIZE.medium}px`,
          color: HEX.goldGlow,
          fontStyle: "700",
        },
      )
      .setOrigin(0.5);
    drawDivider(this, panelX + 40, panelY + 60, panelW - 80);

    // 2×2 stat grid.
    const colLeft = panelX + 80;
    const colRight = panelX + panelW - 80;
    const row1Y = panelY + 102;
    const row2Y = panelY + 172;

    this.drawStatPair(
      colLeft,
      row1Y,
      "DAMAGE DEALT",
      `${this.payload.damageDealt}`,
      HEX.green,
      0,
    );
    this.drawStatPair(
      colRight,
      row1Y,
      "DAMAGE TAKEN",
      `${this.payload.damageTaken}`,
      HEX.red,
      1,
    );
    this.drawStatPair(
      colLeft,
      row2Y,
      "GOLD EARNED",
      `+${this.payload.goldEarned}`,
      HEX.goldBright,
      0,
      `${this.payload.baseGold} base + ${this.payload.interest} interest`,
    );
    this.drawStatPair(
      colRight,
      row2Y,
      "TOURNAMENT HP",
      `${this.payload.humanRemainingHP}`,
      this.payload.humanRemainingHP > 50
        ? HEX.green
        : this.payload.humanRemainingHP > 25
          ? HEX.orange
          : HEX.red,
      1,
      `${this.payload.combatDuration.toFixed(1)}s fight`,
    );
  }

  /** One labeled stat tile (label above, value below, optional caption). */
  private drawStatPair(
    x: number,
    y: number,
    label: string,
    value: string,
    valueColor: string,
    align: 0 | 1,
    caption?: string,
  ): void {
    const labelStyle = {
      fontFamily: FONTS.body,
      fontSize: `${FONT_SIZE.micro}px`,
      color: HEX.textMuted,
      fontStyle: "700",
    } as const;
    const valueStyle = {
      fontFamily: FONTS.number,
      fontSize: `${FONT_SIZE.large}px`,
      color: valueColor,
    } as const;
    const captionStyle = {
      fontFamily: FONTS.body,
      fontSize: `${FONT_SIZE.micro}px`,
      color: HEX.textDim,
    } as const;

    this.add.text(x, y - 18, label, labelStyle).setOrigin(align, 0.5);
    this.add.text(x, y + 6, value, valueStyle).setOrigin(align, 0.5);
    if (caption) {
      this.add.text(x, y + 28, caption, captionStyle).setOrigin(align, 0.5);
    }
  }

  // -------------------------------------------------------------------------
  // Footer
  // -------------------------------------------------------------------------

  private drawFooter(): void {
    const isMatchEnd = this.payload.matchEnded;
    const label = isMatchEnd
      ? "VIEW FINAL STANDINGS"
      : this.payload.wasWin
        ? "CONTINUE"
        : "NEXT ROUND";

    new Button(this, CENTER.x, 640, {
      label,
      width: 360,
      height: 64,
      variant: "primary",
      fontSize: FONT_SIZE.medium,
      fontFamily: FONTS.title,
      onClick: () => {
        if (isMatchEnd) {
          this.scene.start("StandingsScene", { matchEnded: true });
        } else {
          this.scene.start("ShopScene");
        }
      },
    });
  }

  // -------------------------------------------------------------------------
  // Particles — gold for wins, red embers for losses, gray for draws.
  // -------------------------------------------------------------------------

  private startParticles(): void {
    const tint = this.payload.isDraw
      ? 0xa89878
      : this.payload.wasWin
        ? 0xf4d76b
        : 0xc44d4d;
    const gravity = this.payload.wasWin ? 150 : -120;

    this.particles = this.add.particles(0, 0, "white-spark", {
      x: { min: CENTER.x - 360, max: CENTER.x + 360 },
      y: this.payload.wasWin ? 120 : 320,
      lifespan: 1800,
      speedY: this.payload.wasWin
        ? { min: 60, max: 140 }
        : { min: -160, max: -60 },
      speedX: { min: -30, max: 30 },
      gravityY: gravity,
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.9, end: 0 },
      quantity: 1,
      frequency: 80,
      tint,
      blendMode: "ADD",
    });
    this.particles.setDepth(-1);
  }

  public shutdown(): void {
    this.particles?.destroy();
    this.particles = undefined;
  }
}
