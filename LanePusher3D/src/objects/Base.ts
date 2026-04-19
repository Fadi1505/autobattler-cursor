import * as THREE from "three";
import type { Team } from "../units/Unit";

const BASE_COLORS: Record<Team, number> = {
  player: 0x3a86ff,
  enemy: 0xff006e,
};

export class Base {
  readonly team: Team;
  readonly mesh: THREE.Group;
  health: number;
  maxHealth: number;

  private hpBarFill!: THREE.Mesh;

  constructor(team: Team, position: THREE.Vector3, maxHealth = 500) {
    this.team = team;
    this.maxHealth = maxHealth;
    this.health = maxHealth;

    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    this.buildStructure();
    this.buildHpBar();
  }

  private buildStructure(): void {
    const color = BASE_COLORS[this.team];

    const towerGeo = new THREE.CylinderGeometry(6, 8, 10, 6);
    const towerMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0.3,
    });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.y = 5;
    tower.castShadow = true;
    this.mesh.add(tower);

    const roofGeo = new THREE.ConeGeometry(7, 6, 6);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 13;
    roof.castShadow = true;
    this.mesh.add(roof);
  }

  private buildHpBar(): void {
    const w = 14;
    const h = 1.2;

    const bgGeo = new THREE.PlaneGeometry(w, h);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.position.set(0, 18, 0);
    bg.rotation.x = -Math.PI / 2;
    this.mesh.add(bg);

    const fillGeo = new THREE.PlaneGeometry(w, h);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x44ff44 });
    this.hpBarFill = new THREE.Mesh(fillGeo, fillMat);
    this.hpBarFill.position.set(0, 18.05, 0);
    this.hpBarFill.rotation.x = -Math.PI / 2;
    this.mesh.add(this.hpBarFill);
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    const ratio = this.health / this.maxHealth;

    this.hpBarFill.scale.x = ratio;
    this.hpBarFill.position.x = -(1 - ratio) * 7;

    const mat = this.hpBarFill.material as THREE.MeshBasicMaterial;
    if (ratio > 0.5) mat.color.setHex(0x44ff44);
    else if (ratio > 0.25) mat.color.setHex(0xffaa00);
    else mat.color.setHex(0xff2222);
  }

  get isDestroyed(): boolean {
    return this.health <= 0;
  }
}
