import Phaser from "phaser";
import { PreloadScene } from "@/scenes/PreloadScene";

/**
 * Tiny first-launch scene. Use this for any work that must happen before
 * `PreloadScene` starts (e.g. loading a small asset pack used to render the
 * loading bar, configuring custom plugins, hooking up analytics, etc.).
 */
export class BootScene extends Phaser.Scene {
  public static readonly KEY = "BootScene";

  constructor() {
    super({ key: BootScene.KEY });
  }

  preload(): void {
    // Empty for now. Add bootstrap-only assets here later.
  }

  create(): void {
    this.scene.start(PreloadScene.KEY);
  }
}
