import Phaser from "phaser";
import { GameState } from "@/core/GameState";
import { Player } from "@/core/Player";
import type { UpgradeCategoryKey, UpgradeLevels } from "@/core/types";
import { getHero } from "@/data/heroes";
import { UPGRADE_CATEGORY_KEYS } from "@/data/upgrades";
import { Button } from "@/ui/Button";
import { drawDivider, drawPanel } from "@/ui/Panel";
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

export interface StandingsSceneInitData {
  /** If the calling scene already knows the match has ended, hide the
   * "Back to Shop" affordance and show "Back to Draft" instead. */
  matchEnded?: boolean;
}

/**
 * Tournament leaderboard. Renders all eight players sorted by remaining
 * tournament HP (desc), with the human player's row highlighted in gold.
 * Also has a collapsible match-history panel that lists each completed
 * round with winner/loser/damage.
 */
export class StandingsScene extends Phaser.Scene {
  public static readonly KEY = "StandingsScene";

  private historyVisible = false;
  private historyPanel?: Phaser.GameObjects.Container;

  private matchEnded = false;

  constructor() {
    super({ key: StandingsScene.KEY });
  }

  public init(data?: StandingsSceneInitData): void {
    this.matchEnded = data?.matchEnded ?? false;
    this.historyVisible = false;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(HEX.bgDark);

    this.drawTitle();
    this.drawTable();
    this.drawFooter();
  }

  // -------------------------------------------------------------------------
  // Layout
  // -------------------------------------------------------------------------

  private drawTitle(): void {
    this.add
      .text(CENTER.x, 48, "TOURNAMENT STANDINGS", {
        fontFamily: FONTS.title,
        fontSize: `${FONT_SIZE.xlarge}px`,
        color: HEX.goldGlow,
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const gs = GameState.instance;
    const subtitle = gs.currentMatch
      ? `Round ${gs.currentRound}  •  ${gs.getAlivePlayers().length} of ${gs.players.length} alive`
      : "No active match";
    this.add
      .text(CENTER.x, 86, subtitle, {
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZE.body}px`,
        color: HEX.textMuted,
      })
      .setOrigin(0.5);

    drawDivider(this, 80, 110, SCREEN.width - 160);
  }

  private drawTable(): void {
    const gs = GameState.instance;
    const players = [...gs.players].sort(
      (a, b) => b.tournamentHP - a.tournamentHP,
    );

    // Column anchors — match the header & each row.
    const colX = {
      rank: 110,
      portrait: 170,
      name: 250,
      hp: 760,
      upgrades: 920,
    };

    const tableX = 80;
    const tableY = 130;
    const tableW = SCREEN.width - 160;
    const headerH = 36;
    const rowH = 56;
    const tableH = headerH + rowH * players.length + 16;

    drawPanel(this, tableX, tableY, tableW, tableH, {
      fill: COLORS.bgParchment,
      radius: 10,
    });

    // Header.
    const headerY = tableY + headerH / 2 + 4;
    const headerStyle = {
      fontFamily: FONTS.body,
      fontSize: `${FONT_SIZE.small}px`,
      color: HEX.textMuted,
      fontStyle: "700",
    } as const;
    this.add.text(colX.rank, headerY, "RANK", headerStyle).setOrigin(0.5);
    this.add.text(colX.portrait, headerY, "", headerStyle).setOrigin(0.5);
    this.add.text(colX.name, headerY, "CHAMPION", headerStyle).setOrigin(0, 0.5);
    this.add.text(colX.hp, headerY, "HP", headerStyle).setOrigin(0.5);
    this.add.text(colX.upgrades, headerY, "UPGRADES", headerStyle).setOrigin(0, 0.5);

    drawDivider(this, tableX + 10, tableY + headerH + 4, tableW - 20);

    // Rows.
    let rowY = tableY + headerH + 16;
    for (let i = 0; i < players.length; i++) {
      this.drawRow(players[i]!, i + 1, tableX + 10, rowY, tableW - 20, rowH, colX);
      rowY += rowH;
    }
  }

  private drawRow(
    player: Player,
    rank: number,
    x: number,
    y: number,
    w: number,
    h: number,
    colX: { rank: number; portrait: number; name: number; hp: number; upgrades: number },
  ): void {
    const isHuman = player.isHuman;
    const eliminated = player.isEliminated();
    const hero = getHero(player.heroKey);

    // Row background.
    const bg = this.add.graphics();
    const rowFill = isHuman
      ? 0x3a2a14
      : rank % 2 === 0
        ? 0x1f1610
        : 0x271d14;
    bg.fillStyle(rowFill, isHuman ? 0.95 : 0.7);
    bg.fillRoundedRect(x, y, w, h - 6, 6);
    if (isHuman) {
      bg.lineStyle(2, COLORS.goldBright, 0.95);
      bg.strokeRoundedRect(x, y, w, h - 6, 6);
    }

    const textColor = eliminated
      ? HEX.textDim
      : isHuman
        ? HEX.goldGlow
        : HEX.textNormal;
    const midY = y + (h - 6) / 2;

    // Rank.
    this.add
      .text(colX.rank, midY, `#${rank}`, {
        fontFamily: FONTS.number,
        fontSize: `${FONT_SIZE.large}px`,
        color: isHuman ? HEX.goldBright : HEX.textMuted,
      })
      .setOrigin(0.5);

    // Portrait chip.
    const portraitSize = 36;
    const portrait = this.add.graphics();
    portrait.fillStyle(ROLE_COLOR[hero.role], eliminated ? 0.4 : 1);
    portrait.fillRoundedRect(
      colX.portrait - portraitSize / 2,
      midY - portraitSize / 2,
      portraitSize,
      portraitSize,
      6,
    );
    portrait.lineStyle(2, COLORS.goldDeep, eliminated ? 0.4 : 1);
    portrait.strokeRoundedRect(
      colX.portrait - portraitSize / 2,
      midY - portraitSize / 2,
      portraitSize,
      portraitSize,
      6,
    );

    // Name + role badge.
    this.add
      .text(colX.name, midY - 9, hero.name + (isHuman ? "  (YOU)" : ""), {
        fontFamily: FONTS.title,
        fontSize: `${FONT_SIZE.body}px`,
        color: textColor,
        fontStyle: "700",
      })
      .setOrigin(0, 0.5);

    this.add
      .text(colX.name, midY + 11, hero.role.toUpperCase(), {
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZE.micro}px`,
        color: eliminated ? HEX.textDim : ROLE_HEX[hero.role],
        fontStyle: "700",
      })
      .setOrigin(0, 0.5);

    // HP bar + label.
    const hpFrac = Math.max(0, Math.min(1, player.tournamentHP / 100));
    const hpBarX = colX.hp - 40;
    const hpBarW = 80;
    const hpBarH = 8;
    const hpBg = this.add.graphics();
    hpBg.fillStyle(COLORS.bgBlack, 1);
    hpBg.fillRoundedRect(hpBarX, midY + 10, hpBarW, hpBarH, 4);
    hpBg.fillStyle(
      hpFrac > 0.5 ? COLORS.green : hpFrac > 0.25 ? COLORS.orange : COLORS.red,
      1,
    );
    hpBg.fillRoundedRect(hpBarX, midY + 10, hpBarW * hpFrac, hpBarH, 4);
    hpBg.lineStyle(1, COLORS.goldDeep, 0.6);
    hpBg.strokeRoundedRect(hpBarX, midY + 10, hpBarW, hpBarH, 4);

    this.add
      .text(colX.hp, midY - 6, eliminated ? "OUT" : `${player.tournamentHP}`, {
        fontFamily: FONTS.number,
        fontSize: `${FONT_SIZE.medium}px`,
        color: eliminated
          ? HEX.red
          : hpFrac > 0.5
            ? HEX.green
            : hpFrac > 0.25
              ? HEX.orange
              : HEX.red,
      })
      .setOrigin(0.5, 0.5);

    // Upgrades summary — compact A1 M0 D2 E0 C1 S0 style.
    this.add
      .text(colX.upgrades, midY, this.upgradeSummary(player.upgrades), {
        fontFamily: FONTS.number,
        fontSize: `${FONT_SIZE.body}px`,
        color: eliminated ? HEX.textDim : HEX.textNormal,
      })
      .setOrigin(0, 0.5);
  }

  private upgradeSummary(levels: UpgradeLevels): string {
    const parts: string[] = [];
    for (const key of UPGRADE_CATEGORY_KEYS) {
      parts.push(`${this.shortKey(key)}${levels[key]}`);
    }
    return parts.join("  ");
  }

  private shortKey(key: UpgradeCategoryKey): string {
    switch (key) {
      case "Attack": return "A";
      case "Mana": return "M";
      case "Defense": return "D";
      case "Evasion": return "E";
      case "Critical": return "C";
      case "Shield": return "S";
    }
  }

  // -------------------------------------------------------------------------
  // Footer (buttons + match history modal)
  // -------------------------------------------------------------------------

  private drawFooter(): void {
    drawDivider(this, 80, 600, SCREEN.width - 160);

    new Button(this, 220, 650, {
      label: "VIEW MATCH HISTORY",
      width: 320,
      height: 56,
      variant: "secondary",
      fontSize: FONT_SIZE.small,
      fontFamily: FONTS.body,
      onClick: () => this.toggleHistory(),
    });

    new Button(this, SCREEN.width - 180, 650, {
      label: this.matchEnded ? "BACK TO DRAFT" : "BACK TO SHOP",
      width: 280,
      height: 56,
      variant: "primary",
      fontSize: FONT_SIZE.medium,
      fontFamily: FONTS.title,
      onClick: () => {
        if (this.matchEnded) this.scene.start("DraftScene");
        else this.scene.start("ShopScene");
      },
    });
  }

  private toggleHistory(): void {
    if (this.historyVisible) {
      this.historyPanel?.destroy();
      this.historyPanel = undefined;
      this.historyVisible = false;
      return;
    }
    this.historyVisible = true;
    this.historyPanel = this.buildHistoryPanel();
  }

  /**
   * Build a centered modal listing each completed round of the active
   * match. Click anywhere outside to dismiss.
   */
  private buildHistoryPanel(): Phaser.GameObjects.Container {
    const gs = GameState.instance;
    const rounds = gs.currentMatch?.rounds ?? [];
    const container = this.add.container(0, 0).setDepth(100);

    // Dimmed backdrop.
    const dim = this.add
      .rectangle(0, 0, SCREEN.width, SCREEN.height, 0x000000, 0.65)
      .setOrigin(0)
      .setInteractive();
    dim.on("pointerup", () => this.toggleHistory());
    container.add(dim);

    const panelW = 720;
    const panelH = 500;
    const panelX = (SCREEN.width - panelW) / 2;
    const panelY = (SCREEN.height - panelH) / 2;
    const panel = drawPanel(this, panelX, panelY, panelW, panelH, {
      fill: COLORS.bgPanel,
      radius: 12,
      highlighted: true,
    });
    container.add(panel);

    // Title.
    const title = this.add
      .text(SCREEN.width / 2, panelY + 36, "MATCH HISTORY", {
        fontFamily: FONTS.title,
        fontSize: `${FONT_SIZE.large}px`,
        color: HEX.goldGlow,
        fontStyle: "700",
      })
      .setOrigin(0.5);
    container.add(title);

    const divider = this.add.graphics();
    divider.lineStyle(1, COLORS.goldDeep, 0.5);
    divider.lineBetween(panelX + 40, panelY + 76, panelX + panelW - 40, panelY + 76);
    container.add(divider);

    // Row list.
    if (rounds.length === 0) {
      const empty = this.add
        .text(SCREEN.width / 2, panelY + panelH / 2, "No rounds completed yet.", {
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZE.body}px`,
          color: HEX.textMuted,
        })
        .setOrigin(0.5);
      container.add(empty);
    } else {
      let y = panelY + 100;
      for (const r of rounds.slice(-12)) {
        const winner =
          r.winnerId === null ? "DRAW" : `Player #${r.winnerId} won`;
        const loser =
          r.loserId === null ? "" : `vs Player #${r.loserId}`;
        const line = this.add.text(
          panelX + 60,
          y,
          `Round ${r.round.toString().padStart(2, "0")}   ${winner}   ${loser}   −${r.damageDealt} HP`,
          {
            fontFamily: FONTS.number,
            fontSize: `${FONT_SIZE.body}px`,
            color: r.winnerId === null ? HEX.textMuted : HEX.textNormal,
          },
        );
        container.add(line);
        y += 28;
      }
    }

    const dismiss = this.add
      .text(
        SCREEN.width / 2,
        panelY + panelH - 30,
        "Tap anywhere to dismiss",
        {
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZE.small}px`,
          color: HEX.textMuted,
        },
      )
      .setOrigin(0.5);
    container.add(dismiss);

    return container;
  }
}
