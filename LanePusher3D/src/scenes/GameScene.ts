import * as THREE from "three";
import { LaneManager } from "../lanes/LaneManager";
import { Unit, COMBAT_RANGE, COMBAT_DPS, BASE_DAMAGE } from "../units/Unit";
import { Base } from "../objects/Base";
import { Spawner } from "../spawners/Spawner";

// TODO: Switch to WebGPURenderer when Three.js WebGPU API stabilises
// import WebGPURenderer from "three/examples/jsm/renderers/webgpu/WebGPURenderer.js";

// ────────────────────────────────────────────────────────
//  TWEAK — adjust these to fit your map_reference image
// ────────────────────────────────────────────────────────

/** Ground plane size (X × Z). Change to match your image aspect ratio. */
const MAP_SIZE = 120;                       // ← tweak until map fills nicely

/** Camera height.  Increase = more zoomed out. */
const CAMERA_HEIGHT = 80;                   // ← raise if map looks too zoomed in

/** Extra world-units of padding around the map edge. */
const CAMERA_PADDING = 4;

/** Show grid + axes overlay for alignment. */
const SHOW_DEBUG_HELPERS = true;

/**
 * Map image path inside public/.
 * CHANGE THIS LINE if your file is .png instead of .jpg
 */
const MAP_TEXTURE_PATH = "/assets/map_reference.jpg";   // ← .jpg here

export class GameScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;

  private clock = new THREE.Clock();
  private laneManager!: LaneManager;
  private units: Unit[] = [];
  private playerBase!: Base;
  private enemyBase!: Base;
  private playerSpawner!: Spawner;
  private enemySpawner!: Spawner;
  private gameOver = false;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // --- Renderer ---
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    // --- Orthographic camera (locked top-down, no OrbitControls) ---
    this.camera = this.buildCamera();

    this.buildGround();
    this.buildLighting();
    if (SHOW_DEBUG_HELPERS) this.buildDebugHelpers();
    this.buildLanes();
    this.buildBases();
    this.buildSpawners();

    window.addEventListener("resize", this.onResize);
  }

  // ───────────────────── Camera ─────────────────────

  private buildCamera(): THREE.OrthographicCamera {
    const { left, right, top, bottom } = this.frustumForWindow();
    const cam = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 1000);

    cam.position.set(0, CAMERA_HEIGHT, 0);    // straight down
    cam.lookAt(0, 0, 0);
    cam.up.set(0, 0, -1);                     // -Z = top of screen

    return cam;
  }

  /**
   * Fit the map into the viewport with padding.
   * The map is never cropped — extra space is added on the narrower axis.
   */
  private frustumForWindow() {
    const aspect = window.innerWidth / window.innerHeight;
    const half = MAP_SIZE / 2 + CAMERA_PADDING;

    let halfW: number;
    let halfH: number;

    if (aspect >= 1) {
      halfH = half;
      halfW = half * aspect;
    } else {
      halfW = half;
      halfH = half / aspect;
    }

    return { left: -halfW, right: halfW, top: halfH, bottom: -halfH };
  }

  // ───────────────────── Ground ─────────────────────

  private buildGround(): void {
    const loader = new THREE.TextureLoader();
    const texture = loader.load(
      MAP_TEXTURE_PATH,
      () => console.log("Map loaded as JPEG"),
      undefined,
      () => console.warn("Could not load map texture — showing grid only."),
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;

    const geometry = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
    });

    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;     // flat on ground
    ground.position.y = -0.1;             // slightly below lanes so tubes sit on top
    this.scene.add(ground);
  }

  // ───────────────────── Lighting ─────────────────────

  private buildLighting(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(30, 60, 20);
    dir.castShadow = true;
    this.scene.add(dir);
  }

  // ───────────────────── Debug helpers ─────────────────────

  private buildDebugHelpers(): void {
    const grid = new THREE.GridHelper(MAP_SIZE, MAP_SIZE / 5, 0x555555, 0x333333);
    grid.position.y = 0.02;
    this.scene.add(grid);

    const axes = new THREE.AxesHelper(10);
    axes.position.y = 0.03;
    this.scene.add(axes);
  }

  // ───────────────────── Lanes ─────────────────────

  private buildLanes(): void {
    this.laneManager = new LaneManager(this.scene);
  }

  // ───────────────────── Bases ─────────────────────

  private buildBases(): void {
    // Player base — bottom of map (+Z)
    this.playerBase = new Base("player", new THREE.Vector3(0, 0, 55), 500);
    this.scene.add(this.playerBase.mesh);

    // Enemy base — top of map (-Z)
    this.enemyBase = new Base("enemy", new THREE.Vector3(0, 0, -55), 500);
    this.scene.add(this.enemyBase.mesh);
  }

  // ───────────────────── Spawners ─────────────────────

  private buildSpawners(): void {
    this.playerSpawner = new Spawner(this.scene, this.laneManager, {
      team: "player",
      interval: 2.5,
      batchSize: 1,
      unitSpeed: 6,
      unitHealth: 100,
    });
    this.playerSpawner.onUnitSpawned = (u) => this.units.push(u);

    this.enemySpawner = new Spawner(this.scene, this.laneManager, {
      team: "enemy",
      interval: 3.0,
      batchSize: 1,
      unitSpeed: 5,
      unitHealth: 120,
    });
    this.enemySpawner.onUnitSpawned = (u) => this.units.push(u);
  }

  // ───────────────────── Resize ─────────────────────

  private onResize = (): void => {
    const { left, right, top, bottom } = this.frustumForWindow();
    this.camera.left = left;
    this.camera.right = right;
    this.camera.top = top;
    this.camera.bottom = bottom;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  // ───────────────────── Game loop ─────────────────────

  update(): void {
    if (this.gameOver) return;

    const dt = this.clock.getDelta();

    this.playerSpawner.update(dt);
    this.enemySpawner.update(dt);
    this.resolveCombat(dt);

    for (const unit of this.units) {
      unit.update(dt);
    }

    this.checkBaseHits();
    this.cleanupDead();
    this.checkGameOver();
  }

  private resolveCombat(dt: number): void {
    const byLane = new Map<number, { players: Unit[]; enemies: Unit[] }>();

    for (const u of this.units) {
      if (!u.isAlive) continue;
      let bucket = byLane.get(u.laneIndex);
      if (!bucket) {
        bucket = { players: [], enemies: [] };
        byLane.set(u.laneIndex, bucket);
      }
      if (u.team === "player") bucket.players.push(u);
      else bucket.enemies.push(u);
    }

    for (const { players, enemies } of byLane.values()) {
      for (const p of players) {
        p.fighting = false;
        for (const e of enemies) {
          if (!e.isAlive) continue;
          const dist = p.worldPosition.distanceTo(e.worldPosition);
          if (dist < COMBAT_RANGE) {
            p.fighting = true;
            e.fighting = true;
            const dmg = COMBAT_DPS * dt;
            p.takeDamage(dmg);
            e.takeDamage(dmg);
          }
        }
      }
      for (const e of enemies) {
        if (!e.isFighting) e.fighting = false;
      }
    }
  }

  private checkBaseHits(): void {
    for (const u of this.units) {
      if (!u.isAlive || !u.reachedEnd) continue;
      if (u.team === "player") {
        this.enemyBase.takeDamage(BASE_DAMAGE);
      } else {
        this.playerBase.takeDamage(BASE_DAMAGE);
      }
      u.takeDamage(Infinity);
    }
  }

  private cleanupDead(): void {
    for (let i = this.units.length - 1; i >= 0; i--) {
      if (!this.units[i].isAlive) {
        this.units[i].dispose();
        this.units.splice(i, 1);
      }
    }
  }

  private checkGameOver(): void {
    if (this.playerBase.isDestroyed) {
      this.gameOver = true;
      console.log("GAME OVER — Enemy wins!");
    } else if (this.enemyBase.isDestroyed) {
      this.gameOver = true;
      console.log("GAME OVER — Player wins!");
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener("resize", this.onResize);
    this.renderer.dispose();
  }
}
