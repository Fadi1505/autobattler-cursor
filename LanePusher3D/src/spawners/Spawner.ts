import * as THREE from "three";
import { Unit, type Team } from "../units/Unit";
import type { LaneManager } from "../lanes/LaneManager";

export interface SpawnerConfig {
  team: Team;
  /** Seconds between spawns. */
  interval: number;
  /** Units per spawn wave. */
  batchSize: number;
  /** Base speed for spawned units (small random variance added). */
  unitSpeed: number;
  /** HP for spawned units. */
  unitHealth: number;
  /** If set, always spawn on this lane index. Otherwise picks randomly. */
  fixedLane?: number;
}

const DEFAULTS: SpawnerConfig = {
  team: "player",
  interval: 3,
  batchSize: 1,
  unitSpeed: 6,
  unitHealth: 100,
};

export class Spawner {
  readonly config: SpawnerConfig;
  private laneManager: LaneManager;
  private scene: THREE.Scene;
  private timer = 0;
  private active = true;

  onUnitSpawned: ((unit: Unit) => void) | null = null;

  constructor(
    scene: THREE.Scene,
    laneManager: LaneManager,
    config: Partial<SpawnerConfig> & { team: Team },
  ) {
    this.scene = scene;
    this.laneManager = laneManager;
    this.config = { ...DEFAULTS, ...config };
  }

  update(delta: number): void {
    if (!this.active) return;

    this.timer += delta;
    if (this.timer >= this.config.interval) {
      this.timer -= this.config.interval;
      this.spawnBatch();
    }
  }

  private spawnBatch(): void {
    for (let i = 0; i < this.config.batchSize; i++) {
      const lane = this.pickLane();
      const curve = this.laneManager.getCurve(lane);
      const variance = (Math.random() - 0.5) * 1.5;

      const unit = new Unit(
        curve,
        this.config.team,
        this.config.unitSpeed + variance,
        this.config.unitHealth,
        lane,
      );

      this.scene.add(unit.mesh);
      this.onUnitSpawned?.(unit);
    }
  }

  private pickLane(): number {
    if (this.config.fixedLane !== undefined) return this.config.fixedLane;
    return Math.floor(Math.random() * this.laneManager.lanes.length);
  }

  start(): void { this.active = true; }
  stop(): void { this.active = false; }
  reset(): void { this.timer = 0; }
}
