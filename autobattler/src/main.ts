import Phaser from "phaser";
import { BootScene } from "@/scenes/BootScene";
import { CombatScene } from "@/scenes/CombatScene";
import { DraftScene } from "@/scenes/DraftScene";
import { PreloadScene } from "@/scenes/PreloadScene";
import { ResultsScene } from "@/scenes/ResultsScene";
import { ShopScene } from "@/scenes/ShopScene";
import { StandingsScene } from "@/scenes/StandingsScene";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GAME_PARENT_ID,
  GAME_BG_COLOR,
} from "@/utils/constants";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: GAME_PARENT_ID,
  backgroundColor: GAME_BG_COLOR,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    min: { width: 320, height: 180 },
    max: { width: 2560, height: 1440 },
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: "high-performance",
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  input: {
    activePointers: 3,
  },
  fps: {
    target: 60,
    smoothStep: true,
  },
  // Scene order matters: the first entry is auto-started on game boot.
  // `BootScene` → `PreloadScene` → `DraftScene`; gameplay scenes follow.
  scene: [
    BootScene,
    PreloadScene,
    DraftScene,
    ShopScene,
    CombatScene,
    ResultsScene,
    StandingsScene,
  ],
};

const game = new Phaser.Game(config);

window.addEventListener("resize", () => {
  game.scale.refresh();
});

export default game;
