import * as THREE from "three";
import { SuctionPlunger } from "../obstacles/SuctionPlunger";

const SLOPE_LENGTH = 80;
const WALKWAY_HALF_WIDTH = 4;
const BASE_Y = 25;
const TOP_RISE = 12;
const SLOPE = TOP_RISE / SLOPE_LENGTH;
const WALL_HEIGHT = 18;

function buildGlassTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 256;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#a3d6f5");
  grad.addColorStop(1, "#3a7ea8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.4;
  for (let y = 0; y < H; y += 12) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const yy = y + Math.sin(x * 0.07 + y * 0.03) * 1.6;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  for (let i = 0; i < 90; i++) {
    const px = Math.random() * W;
    const py = Math.random() * H;
    ctx.beginPath();
    ctx.arc(px, py, 0.8 + Math.random() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(2, 8);
  return tex;
}

export type FountainLevelOptions = {
  /** XZ position of the foot of the slope (lowest terrace). */
  footCenter: THREE.Vector3;
};

/**
 * Tilted glass walkway climbing in -Z. Side walls flank both edges;
 * suction plungers fire from the walls in alternation. The base is constant
 * at +Z; the top sits at footCenter.z - SLOPE_LENGTH.
 */
export class FountainLevel {
  readonly group = new THREE.Group();
  readonly plungers: SuctionPlunger[] = [];

  /** World-space center of the foot of the slope. */
  readonly footCenter = new THREE.Vector3();
  /** World-space top of the slope (where the exit portal sits). */
  readonly topCenter = new THREE.Vector3();
  /** Unit vector pointing downhill (slope's natural slide direction). */
  readonly downhillDir = new THREE.Vector3(0, 0, 1);

  private readonly slopeTex: THREE.CanvasTexture;

  private elapsed = 0;

  constructor(opts: FountainLevelOptions) {
    this.footCenter.copy(opts.footCenter);
    this.topCenter.set(
      this.footCenter.x,
      this.footCenter.y + TOP_RISE,
      this.footCenter.z - SLOPE_LENGTH,
    );

    this.slopeTex = buildGlassTexture();

    const slopeMat = new THREE.MeshPhongMaterial({
      map: this.slopeTex,
      color: 0xb8e2f7,
      transparent: true,
      opacity: 0.78,
      shininess: 180,
      specular: 0xffffff,
      side: THREE.DoubleSide,
    });

    const slabLength = Math.sqrt(SLOPE_LENGTH * SLOPE_LENGTH + TOP_RISE * TOP_RISE);
    const slope = new THREE.Mesh(
      new THREE.BoxGeometry(WALKWAY_HALF_WIDTH * 2, 0.3, slabLength),
      slopeMat,
    );
    slope.position.set(
      this.footCenter.x,
      this.footCenter.y + TOP_RISE / 2,
      this.footCenter.z - SLOPE_LENGTH / 2,
    );
    slope.rotation.x = Math.atan2(TOP_RISE, SLOPE_LENGTH);
    this.group.add(slope);

    const terraceMat = new THREE.MeshPhongMaterial({
      color: 0xdaf0ff,
      transparent: true,
      opacity: 0.38,
      shininess: 220,
      specular: 0xffffff,
    });
    const terraceCount = 7;
    for (let i = 1; i <= terraceCount; i++) {
      const tz = this.footCenter.z - (i / (terraceCount + 1)) * SLOPE_LENGTH;
      const ty = this.heightAtZ(tz) + 0.2;
      const cascade = new THREE.Mesh(
        new THREE.BoxGeometry(WALKWAY_HALF_WIDTH * 2 + 0.4, 0.1, 0.6),
        terraceMat,
      );
      cascade.position.set(this.footCenter.x, ty, tz);
      this.group.add(cascade);
    }

    const wallMat = new THREE.MeshPhongMaterial({
      color: 0x6cb4d8,
      transparent: true,
      opacity: 0.32,
      shininess: 200,
      specular: 0xeaffff,
      side: THREE.DoubleSide,
    });
    const wallLength = SLOPE_LENGTH + 4;
    for (const sign of [-1, 1] as const) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, WALL_HEIGHT, wallLength),
        wallMat,
      );
      wall.position.set(
        this.footCenter.x + sign * (WALKWAY_HALF_WIDTH + 0.2),
        this.footCenter.y + TOP_RISE / 2 + WALL_HEIGHT / 2 - 1,
        this.footCenter.z - SLOPE_LENGTH / 2,
      );
      this.group.add(wall);
    }

    const plungerCount = 7;
    const period = 4.6;
    for (let i = 0; i < plungerCount; i++) {
      const t = (i + 1) / (plungerCount + 1);
      const z = this.footCenter.z - t * SLOPE_LENGTH;
      const y = this.heightAtZ(z) + 1.3;
      const fromLeft = i % 2 === 0;
      const sideX = fromLeft ? -WALKWAY_HALF_WIDTH - 0.1 : WALKWAY_HALF_WIDTH + 0.1;
      const dir = new THREE.Vector3(fromLeft ? 1 : -1, 0, 0);
      const plunger = new SuctionPlunger({
        basePosition: new THREE.Vector3(this.footCenter.x + sideX, y, z),
        direction: dir,
        extendDistance: 5.4,
        period,
        phase: (i * 0.83) % period,
      });
      this.plungers.push(plunger);
      this.group.add(plunger.group);
    }
  }

  /** Returns slope-surface Y at (x, z), or null if off the walkway. */
  getHeightAt(x: number, z: number): number | null {
    const cx = this.footCenter.x;
    const cz = this.footCenter.z;
    if (x < cx - WALKWAY_HALF_WIDTH || x > cx + WALKWAY_HALF_WIDTH) return null;
    if (z > cz || z < cz - SLOPE_LENGTH) return null;
    return this.heightAtZ(z);
  }

  private heightAtZ(z: number): number {
    const tz = Math.max(0, Math.min(SLOPE_LENGTH, this.footCenter.z - z));
    return this.footCenter.y + tz * SLOPE;
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.slopeTex.offset.y = (this.elapsed * 0.6) % 1;
    for (const p of this.plungers) p.update(dt);
  }

  /** Returns the plunger that hit the player this frame, or null. */
  checkPlungerHit(playerPos: THREE.Vector3): SuctionPlunger | null {
    for (const p of this.plungers) {
      if (p.hits(playerPos)) return p;
    }
    return null;
  }
}
