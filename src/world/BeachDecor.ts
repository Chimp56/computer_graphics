import * as THREE from "three";

type GroundFn = (x: number, z: number) => number;

const PALM_POSITIONS: ReadonlyArray<[number, number]> = [
  // Perimeter ring around the playable spine.
  [-55, 78], [55, 78],
  [-68, 60], [68, 60],
  [-72, 38], [72, 38],
  [-72, 16], [72, 16],
  [-72, -8], [72, -8],
  [-70, -28], [70, -28],
  [-58, -52], [58, -52],
  [-36, -70], [36, -70],
  [-36, 86], [36, 86],
  // A few scattered inland palms (offset from x=0 spine).
  [-42, 60], [42, 60],
  [-46, -20], [46, -20],
];

const ROCK_POSITIONS: ReadonlyArray<[number, number, number]> = [
  // x, z, scale
  [-44, 70, 1.4],
  [44, 70, 1.1],
  [-50, 30, 1.7],
  [50, 30, 1.5],
  [-48, -2, 1.3],
  [48, -2, 1.6],
  [-40, -42, 1.4],
  [40, -42, 1.8],
  [-22, -62, 1.2],
  [22, -62, 1.0],
];

type UmbrellaSpot = { x: number; z: number; color: number; rot: number };

const UMBRELLA_SPOTS: ReadonlyArray<UmbrellaSpot> = [
  { x: -28, z: 75, color: 0xff6b6b, rot: 0.3 },
  { x: 28, z: 75, color: 0xffd93d, rot: -0.3 },
  { x: -30, z: -56, color: 0x4ecdc4, rot: -0.4 },
  { x: 30, z: -56, color: 0xff9f1c, rot: 0.4 },
];

const TORCH_POSITIONS: ReadonlyArray<[number, number]> = [
  [-7, -33],
  [7, -33],
  [-7, -47],
  [7, -47],
];

export class BeachDecor {
  readonly group = new THREE.Group();

  constructor(ground: GroundFn) {
    this.group.name = "BeachDecor";
    this.buildPalms(ground);
    this.buildRocks(ground);
    this.buildUmbrellas(ground);
    this.buildTorches(ground);
  }

  private placeOnGround(x: number, z: number, ground: GroundFn): number | null {
    const y = ground(x, z);
    if (!Number.isFinite(y) || y < 0.4) return null;
    return y;
  }

  private buildPalms(ground: GroundFn): void {
    for (const [x, z] of PALM_POSITIONS) {
      const y = this.placeOnGround(x, z, ground);
      if (y === null) continue;
      const palm = createPalm();
      palm.position.set(x, y, z);
      palm.rotation.y = hashAngle(x, z);
      this.group.add(palm);
    }
  }

  private buildRocks(ground: GroundFn): void {
    for (const [x, z, scale] of ROCK_POSITIONS) {
      const y = this.placeOnGround(x, z, ground);
      if (y === null) continue;
      const rock = createRock(scale);
      rock.position.set(x, y - 0.15, z);
      rock.rotation.y = hashAngle(x + 7, z + 13);
      this.group.add(rock);
    }
  }

  private buildUmbrellas(ground: GroundFn): void {
    for (const spot of UMBRELLA_SPOTS) {
      const y = this.placeOnGround(spot.x, spot.z, ground);
      if (y === null) continue;
      const umbrella = createUmbrella(spot.color);
      umbrella.position.set(spot.x, y, spot.z);
      umbrella.rotation.y = spot.rot;
      this.group.add(umbrella);

      const offX = Math.cos(spot.rot + Math.PI / 2) * 2.2;
      const offZ = Math.sin(spot.rot + Math.PI / 2) * 2.2;
      const lounger = createLounger(spot.color);
      const ly = this.placeOnGround(spot.x + offX, spot.z + offZ, ground) ?? y;
      lounger.position.set(spot.x + offX, ly + 0.05, spot.z + offZ);
      lounger.rotation.y = spot.rot + Math.PI / 2;
      this.group.add(lounger);
    }
  }

  private buildTorches(ground: GroundFn): void {
    for (const [x, z] of TORCH_POSITIONS) {
      const y = this.placeOnGround(x, z, ground);
      if (y === null) continue;
      const torch = createTikiTorch();
      torch.position.set(x, y, z);
      this.group.add(torch);
    }
  }
}

function createPalm(): THREE.Group {
  const palm = new THREE.Group();

  const trunkMat = new THREE.MeshPhongMaterial({
    color: 0x7a5230,
    shininess: 8,
    specular: 0x111111,
  });
  const segmentCount = 7;
  const trunkHeight = 7.5;
  const segH = trunkHeight / segmentCount;

  for (let i = 0; i < segmentCount; i++) {
    const t = i / (segmentCount - 1);
    const radius = 0.34 - t * 0.12;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius + 0.04, segH * 1.02, 10),
      trunkMat,
    );
    const lean = Math.sin(t * Math.PI) * 0.35;
    seg.position.set(lean, segH * 0.5 + i * segH, 0);
    seg.castShadow = true;
    palm.add(seg);
  }

  const crownX = Math.sin(Math.PI) * 0.35;
  const crownY = trunkHeight;
  const crownZ = 0;

  const coconutMat = new THREE.MeshPhongMaterial({
    color: 0x2d1f12,
    shininess: 30,
  });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), coconutMat);
    c.position.set(
      crownX + Math.cos(a) * 0.42,
      crownY - 0.18,
      crownZ + Math.sin(a) * 0.42,
    );
    c.castShadow = true;
    palm.add(c);
  }

  const frondMat = new THREE.MeshPhongMaterial({
    color: 0x3fa84a,
    shininess: 24,
    specular: 0x335533,
    side: THREE.DoubleSide,
  });
  const frondCount = 9;
  for (let i = 0; i < frondCount; i++) {
    const frond = createFrond(frondMat);
    const angle = (i / frondCount) * Math.PI * 2;
    const droop = -Math.PI * 0.18 - Math.random() * 0.05;
    frond.position.set(crownX, crownY, crownZ);
    frond.rotation.order = "YXZ";
    frond.rotation.y = angle;
    frond.rotation.x = droop;
    palm.add(frond);
  }

  return palm;
}

function createFrond(material: THREE.Material): THREE.Mesh {
  const length = 3.3;
  const width = 0.95;
  const geo = new THREE.PlaneGeometry(length, width, 6, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const t = (x + length / 2) / length;
    pos.setY(i, pos.getY(i) - t * t * 0.7);
    pos.setZ(i, pos.getZ(i) + Math.sin(t * Math.PI) * 0.12);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.translate(length / 2, 0, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

function createRock(scale: number): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(1.1 * scale, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = (Math.sin(x * 4.1) + Math.cos(y * 3.7) + Math.sin(z * 5.3)) * 0.07;
    pos.setX(i, x + n);
    pos.setY(i, y + n);
    pos.setZ(i, z + n);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhongMaterial({
    color: 0x8a8576,
    shininess: 6,
    specular: 0x222222,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createUmbrella(color: number): THREE.Group {
  const u = new THREE.Group();

  const poleMat = new THREE.MeshPhongMaterial({
    color: 0xe8d6b0,
    shininess: 16,
  });
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.08, 4.2, 10),
    poleMat,
  );
  pole.position.y = 2.1;
  pole.castShadow = true;
  u.add(pole);

  const canopyMat = new THREE.MeshPhongMaterial({
    color,
    shininess: 30,
    specular: 0x333333,
    side: THREE.DoubleSide,
  });
  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(2.4, 1.1, 16, 1, true),
    canopyMat,
  );
  canopy.position.y = 4.0;
  canopy.castShadow = true;
  u.add(canopy);

  const trimMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
  const trim = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.06, 6, 24),
    trimMat,
  );
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 3.45;
  u.add(trim);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 8),
    new THREE.MeshPhongMaterial({ color: 0xffffff }),
  );
  cap.position.y = 4.6;
  u.add(cap);

  return u;
}

function createLounger(accentColor: number): THREE.Group {
  const g = new THREE.Group();

  const woodMat = new THREE.MeshPhongMaterial({
    color: 0xd9b27a,
    shininess: 10,
  });
  const cushionMat = new THREE.MeshPhongMaterial({
    color: accentColor,
    shininess: 24,
  });

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.18, 0.85),
    woodMat,
  );
  frame.position.y = 0.32;
  frame.castShadow = true;
  g.add(frame);

  for (const sx of [-0.85, 0.85]) {
    for (const sz of [-0.32, 0.32]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.32, 0.1),
        woodMat,
      );
      leg.position.set(sx, 0.16, sz);
      g.add(leg);
    }
  }

  const cushion = new THREE.Mesh(
    new THREE.BoxGeometry(1.85, 0.14, 0.72),
    cushionMat,
  );
  cushion.position.y = 0.48;
  cushion.castShadow = true;
  g.add(cushion);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(1.85, 0.7, 0.12),
    cushionMat,
  );
  back.position.set(-0.85, 0.7, 0);
  back.rotation.z = -0.55;
  back.castShadow = true;
  g.add(back);

  return g;
}

function createTikiTorch(): THREE.Group {
  const g = new THREE.Group();

  const poleMat = new THREE.MeshPhongMaterial({
    color: 0x4a3220,
    shininess: 6,
  });
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.11, 2.6, 10),
    poleMat,
  );
  pole.position.y = 1.3;
  pole.castShadow = true;
  g.add(pole);

  const bowlMat = new THREE.MeshPhongMaterial({
    color: 0x2a1a10,
    shininess: 14,
  });
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.18, 0.32, 12),
    bowlMat,
  );
  bowl.position.y = 2.75;
  bowl.castShadow = true;
  g.add(bowl);

  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xffb030,
    transparent: true,
    opacity: 0.85,
  });
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.7, 8),
    flameMat,
  );
  flame.position.y = 3.25;
  g.add(flame);

  const light = new THREE.PointLight(0xffae44, 0.8, 12, 2);
  light.position.y = 3.1;
  g.add(light);

  return g;
}

function hashAngle(x: number, z: number): number {
  const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return (h - Math.floor(h)) * Math.PI * 2;
}
