import * as THREE from "three";

// ────────────────────────────────────────────────────────
//  TWEAK: Lane control points
//
//  Map plane is 120×120 (X: -60..60, Z: -60..60).
//  Player base sits at Z ≈ +55 (bottom of screen).
//  Enemy  base sits at Z ≈ -55 (top of screen).
//
//  Each array below is a list of (X, 0, Z) waypoints
//  defining one winding road from player base → enemy base.
//  Move points to match your map_reference.jpg.
//  Set DEBUG_SPHERES = true to see yellow markers at each point.
// ────────────────────────────────────────────────────────

/** Tube radius — thicker = wider road overlay. */
const TUBE_RADIUS = 3;
const TUBE_SEGMENTS = 80;

/** Road colour per lane — earthy brown palette. */
const LANE_COLORS = [0xc9a96e, 0xb8935a, 0xa67c4a, 0x8f6838, 0x7a5628];

/** Show yellow wireframe spheres at every control point. */
const DEBUG_SPHERES = true;
const DEBUG_SPHERE_RADIUS = 2;

// ──── Lane definitions (Player base +Z → Enemy base -Z) ────

const LANE_POINTS: THREE.Vector3[][] = [

  // Lane 0 — far left, wide S-curve
  [
    new THREE.Vector3(-40, 0,  52),     // start near player base
    new THREE.Vector3(-48, 0,  38),
    new THREE.Vector3(-36, 0,  20),
    new THREE.Vector3(-48, 0,   0),
    new THREE.Vector3(-36, 0, -20),
    new THREE.Vector3(-48, 0, -38),
    new THREE.Vector3(-40, 0, -52),     // end near enemy base
  ],

  // Lane 1 — inner left, gentle weave
  [
    new THREE.Vector3(-18, 0,  52),
    new THREE.Vector3(-26, 0,  35),
    new THREE.Vector3(-14, 0,  15),
    new THREE.Vector3(-26, 0,  -5),
    new THREE.Vector3(-14, 0, -25),
    new THREE.Vector3(-22, 0, -42),
    new THREE.Vector3(-18, 0, -52),
  ],

  // Lane 2 — centre, big snake
  [
    new THREE.Vector3(  0, 0,  52),
    new THREE.Vector3( 12, 0,  36),
    new THREE.Vector3(-12, 0,  18),
    new THREE.Vector3( 12, 0,   0),
    new THREE.Vector3(-12, 0, -18),
    new THREE.Vector3( 12, 0, -36),
    new THREE.Vector3(  0, 0, -52),
  ],

  // Lane 3 — inner right, gentle weave (mirror of lane 1)
  [
    new THREE.Vector3( 18, 0,  52),
    new THREE.Vector3( 26, 0,  35),
    new THREE.Vector3( 14, 0,  15),
    new THREE.Vector3( 26, 0,  -5),
    new THREE.Vector3( 14, 0, -25),
    new THREE.Vector3( 22, 0, -42),
    new THREE.Vector3( 18, 0, -52),
  ],

  // Lane 4 — far right, wide S-curve (mirror of lane 0)
  [
    new THREE.Vector3( 40, 0,  52),
    new THREE.Vector3( 48, 0,  38),
    new THREE.Vector3( 36, 0,  20),
    new THREE.Vector3( 48, 0,   0),
    new THREE.Vector3( 36, 0, -20),
    new THREE.Vector3( 48, 0, -38),
    new THREE.Vector3( 40, 0, -52),
  ],
];

// ──── Public types ────

export interface Lane {
  index: number;
  curve: THREE.CatmullRomCurve3;
  tubeGroup: THREE.Group;
  debugGroup: THREE.Group;
}

// ──── LaneManager ────

export class LaneManager {
  readonly lanes: Lane[] = [];
  readonly laneCount: number;

  private root = new THREE.Group();

  constructor(scene: THREE.Scene, debug = DEBUG_SPHERES) {
    scene.add(this.root);
    this.laneCount = LANE_POINTS.length;
    this.buildAll(debug);
  }

  // ─── Convenience helpers for unit movement ───

  getPointAt(laneIndex: number, t: number): THREE.Vector3 {
    return this.lanes[laneIndex].curve.getPointAt(t);
  }

  getTangentAt(laneIndex: number, t: number): THREE.Vector3 {
    return this.lanes[laneIndex].curve.getTangentAt(t);
  }

  getCurve(laneIndex: number): THREE.CatmullRomCurve3 {
    return this.lanes[laneIndex].curve;
  }

  setDebugVisible(visible: boolean): void {
    for (const lane of this.lanes) lane.debugGroup.visible = visible;
  }

  // ─── Build ───

  private buildAll(debug: boolean): void {
    LANE_POINTS.forEach((points, i) => {
      const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);

      const tubeGroup = new THREE.Group();
      tubeGroup.name = `lane_${i}_tube`;
      this.buildTube(curve, LANE_COLORS[i], tubeGroup);

      const debugGroup = new THREE.Group();
      debugGroup.name = `lane_${i}_debug`;
      debugGroup.visible = debug;
      this.buildDebugSpheres(points, i, debugGroup);

      this.root.add(tubeGroup);
      this.root.add(debugGroup);
      this.lanes.push({ index: i, curve, tubeGroup, debugGroup });
    });
  }

  private buildTube(
    curve: THREE.CatmullRomCurve3,
    color: number,
    parent: THREE.Group,
  ): void {
    const tubeGeo = new THREE.TubeGeometry(curve, TUBE_SEGMENTS, TUBE_RADIUS, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      transparent: true,
      opacity: 0.55,
      emissive: color,
      emissiveIntensity: 0.15,
    });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.position.y = 0.05;
    parent.add(tube);

    // Dashed centre-line
    const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(160));
    const lineMat = new THREE.LineDashedMaterial({
      color: 0xffffff,
      dashSize: 2.5,
      gapSize: 1.2,
      transparent: true,
      opacity: 0.3,
    });
    const line = new THREE.Line(lineGeo, lineMat);
    line.computeLineDistances();
    line.position.y = 0.2;
    parent.add(line);
  }

  private buildDebugSpheres(
    points: THREE.Vector3[],
    laneIndex: number,
    parent: THREE.Group,
  ): void {
    const geo = new THREE.SphereGeometry(DEBUG_SPHERE_RADIUS, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });

    points.forEach((pt, j) => {
      const sphere = new THREE.Mesh(geo, mat);
      sphere.position.copy(pt);
      sphere.position.y = DEBUG_SPHERE_RADIUS;
      sphere.name = `L${laneIndex}_CP${j}`;
      parent.add(sphere);
    });
  }
}
