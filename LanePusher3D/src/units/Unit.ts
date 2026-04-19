import * as THREE from "three";

export type Team = "player" | "enemy";

const TEAM_COLORS: Record<Team, number> = {
  player: 0x3a86ff,
  enemy: 0xff006e,
};

const UNIT_SIZE = 2;

/** Units closer than this (XZ distance) will fight. */
export const COMBAT_RANGE = 4;
/** Damage dealt per second while in combat. */
export const COMBAT_DPS = 25;
/** Damage dealt to the opposing base when a unit reaches the end. */
export const BASE_DAMAGE = 20;

export class Unit {
  speed: number;
  team: Team;
  health: number;
  laneIndex: number;

  readonly mesh: THREE.Mesh;

  private curve: THREE.CatmullRomCurve3;
  private progress = 0;
  private alive = true;
  private _fighting = false;

  /**
   * Player units walk progress 0 → 1  (player base → enemy base).
   * Enemy  units walk progress 1 → 0  (enemy base → player base).
   */
  private readonly direction: 1 | -1;

  constructor(
    curve: THREE.CatmullRomCurve3,
    team: Team,
    speed = 6,
    health = 100,
    laneIndex = 0,
  ) {
    this.curve = curve;
    this.team = team;
    this.speed = speed;
    this.health = health;
    this.laneIndex = laneIndex;
    this.direction = team === "player" ? 1 : -1;

    const geo = new THREE.BoxGeometry(UNIT_SIZE, UNIT_SIZE * 1.4, UNIT_SIZE);
    const mat = new THREE.MeshStandardMaterial({
      color: TEAM_COLORS[team],
      roughness: 0.45,
      metalness: 0.2,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;

    this.progress = team === "player" ? 0 : 1;
    this.syncPosition();
  }

  get isAlive(): boolean {
    return this.alive;
  }

  get isFighting(): boolean {
    return this._fighting;
  }

  set fighting(v: boolean) {
    this._fighting = v;
  }

  get reachedEnd(): boolean {
    if (this.team === "player") return this.progress >= 1;
    return this.progress <= 0;
  }

  get worldPosition(): THREE.Vector3 {
    return this.mesh.position;
  }

  update(delta: number): void {
    if (!this.alive || this._fighting) return;

    const curveLength = this.curve.getLength();
    const step = (this.speed * delta) / curveLength;
    this.progress += step * this.direction;
    this.progress = THREE.MathUtils.clamp(this.progress, 0, 1);

    this.syncPosition();
  }

  takeDamage(amount: number): void {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.mesh.visible = false;
    }
  }

  dispose(): void {
    this.alive = false;
    this.mesh.removeFromParent();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.geometry.dispose();
  }

  private syncPosition(): void {
    const pos = this.curve.getPointAt(this.progress);
    this.mesh.position.copy(pos);
    this.mesh.position.y = UNIT_SIZE * 0.7;

    const lookT = THREE.MathUtils.clamp(
      this.progress + 0.01 * this.direction,
      0,
      1,
    );
    const target = this.curve.getPointAt(lookT);
    target.y = this.mesh.position.y;
    this.mesh.lookAt(target);
  }
}
