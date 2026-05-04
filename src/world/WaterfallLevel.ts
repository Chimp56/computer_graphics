import * as THREE from "three";
import { HydraulicPiston } from "../obstacles/HydraulicPiston";

const PLATFORM_THICKNESS = 1.5;
const WALKWAY_WIDTH = 60;
const WALKWAY_DEPTH = 3;
const PLATFORM_Y = 25;

const ROCK_WALL_DEPTH = 4;
const ROCK_WALL_HEIGHT = 22;

const WATERFALL_HEIGHT = 32;
const WATERFALL_THICKNESS = 0.25;

function buildWaterfallTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#a8d8f0");
  grad.addColorStop(0.5, "#5fa9d4");
  grad.addColorStop(1, "#2a6f9f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 36; i++) {
    const x = (i / 36) * W + Math.random() * 4;
    ctx.beginPath();
    for (let y = 0; y <= H; y += 8) {
      const wobble = Math.sin(y * 0.04 + i) * 1.5;
      if (y === 0) ctx.moveTo(x + wobble, y);
      else ctx.lineTo(x + wobble, y);
    }
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  for (let i = 0; i < 80; i++) {
    const px = Math.random() * W;
    const py = Math.random() * H;
    ctx.beginPath();
    ctx.ellipse(px, py, 1.2 + Math.random() * 1.4, 6 + Math.random() * 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildRockTexture(): THREE.CanvasTexture {
  const W = 512;
  const H = 256;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#403a36";
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 600; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 1 + Math.random() * 3;
    const shade = 30 + Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 8})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(20,15,10,0.55)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 30; i++) {
    ctx.beginPath();
    const x0 = Math.random() * W;
    const y0 = Math.random() * H;
    ctx.moveTo(x0, y0);
    let cx = x0;
    let cy = y0;
    for (let s = 0; s < 5; s++) {
      cx += (Math.random() - 0.5) * 60;
      cy += (Math.random() - 0.5) * 30;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export type WaterfallLevelOptions = {
  /** XZ center of the walkway. */
  center: THREE.Vector3;
};

/**
 * Self-contained level: long narrow walkway tucked between a sheer rock wall
 * (rear) and a thundering waterfall (front). Pistons mounted on the wall
 * extend forward on a staggered rhythm, telegraphed by splash rings just
 * before they fire.
 */
export class WaterfallLevel {
  readonly group = new THREE.Group();
  readonly pistons: HydraulicPiston[] = [];
  readonly platformY: number = PLATFORM_Y;

  /** XZ rectangle of the walkway top surface. */
  private readonly walkX0: number;
  private readonly walkX1: number;
  private readonly walkZ0: number;
  private readonly walkZ1: number;

  private readonly waterfallMat: THREE.MeshPhongMaterial;
  private readonly waterfallTex: THREE.CanvasTexture;
  private elapsed = 0;

  constructor(opts: WaterfallLevelOptions) {
    const cx = opts.center.x;
    const cz = opts.center.z;

    this.walkX0 = cx - WALKWAY_WIDTH / 2;
    this.walkX1 = cx + WALKWAY_WIDTH / 2;
    this.walkZ0 = cz - WALKWAY_DEPTH / 2;
    this.walkZ1 = cz + WALKWAY_DEPTH / 2;

    const walkwayMat = new THREE.MeshPhongMaterial({
      color: 0x6b6e74,
      shininess: 110,
      specular: 0x8090a0,
    });
    const walkway = new THREE.Mesh(
      new THREE.BoxGeometry(WALKWAY_WIDTH, PLATFORM_THICKNESS, WALKWAY_DEPTH),
      walkwayMat,
    );
    walkway.position.set(cx, PLATFORM_Y - PLATFORM_THICKNESS / 2, cz);
    this.group.add(walkway);

    const wetSheen = new THREE.Mesh(
      new THREE.BoxGeometry(WALKWAY_WIDTH - 0.2, 0.05, WALKWAY_DEPTH - 0.2),
      new THREE.MeshBasicMaterial({
        color: 0xaad4ee,
        transparent: true,
        opacity: 0.18,
      }),
    );
    wetSheen.position.set(cx, PLATFORM_Y + 0.03, cz);
    this.group.add(wetSheen);

    const rockTex = buildRockTexture();
    const rockMat = new THREE.MeshPhongMaterial({
      map: rockTex,
      shininess: 6,
      specular: 0x111111,
    });
    const wallZ = cz + WALKWAY_DEPTH / 2 + ROCK_WALL_DEPTH / 2;
    const rockWall = new THREE.Mesh(
      new THREE.BoxGeometry(WALKWAY_WIDTH + 4, ROCK_WALL_HEIGHT, ROCK_WALL_DEPTH),
      rockMat,
    );
    rockWall.position.set(cx, PLATFORM_Y + ROCK_WALL_HEIGHT / 2 - 2, wallZ);
    this.group.add(rockWall);

    const ledge = new THREE.Mesh(
      new THREE.BoxGeometry(WALKWAY_WIDTH + 6, 1, ROCK_WALL_DEPTH + 1.2),
      rockMat,
    );
    ledge.position.set(
      cx,
      PLATFORM_Y + ROCK_WALL_HEIGHT - 2 + 0.5,
      wallZ,
    );
    this.group.add(ledge);

    this.waterfallTex = buildWaterfallTexture();
    this.waterfallMat = new THREE.MeshPhongMaterial({
      map: this.waterfallTex,
      transparent: true,
      opacity: 0.85,
      shininess: 140,
      specular: 0xbfe6ff,
      side: THREE.DoubleSide,
    });
    const fallZ = cz - WALKWAY_DEPTH / 2 - 1.5;
    const waterfall = new THREE.Mesh(
      new THREE.BoxGeometry(WALKWAY_WIDTH + 6, WATERFALL_HEIGHT, WATERFALL_THICKNESS),
      this.waterfallMat,
    );
    waterfall.position.set(
      cx,
      PLATFORM_Y + WATERFALL_HEIGHT / 2 - 4,
      fallZ,
    );
    this.group.add(waterfall);

    const mistMat = new THREE.MeshBasicMaterial({
      color: 0xbfe6ff,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mist = new THREE.Mesh(
      new THREE.PlaneGeometry(WALKWAY_WIDTH + 8, 6),
      mistMat,
    );
    mist.rotation.x = -Math.PI / 2;
    mist.position.set(cx, PLATFORM_Y + 0.15, fallZ + 0.3);
    this.group.add(mist);

    const pistonCount = 9;
    const period = 2.6;
    for (let i = 0; i < pistonCount; i++) {
      const px = cx - WALKWAY_WIDTH / 2 + ((i + 1) * WALKWAY_WIDTH) / (pistonCount + 1);
      const baseZ = cz + WALKWAY_DEPTH / 2 + 0.4;
      const piston = new HydraulicPiston({
        basePosition: new THREE.Vector3(px, PLATFORM_Y + 1.2, baseZ),
        direction: new THREE.Vector3(0, 0, -1),
        extendDistance: 3.6,
        period,
        phase: (i * 0.41) % period,
      });
      this.pistons.push(piston);
      this.group.add(piston.group);
    }
  }

  /** Top Y of the walkway at (x, z), or null when off the walkway. */
  getHeightAt(x: number, z: number): number | null {
    if (x < this.walkX0 || x > this.walkX1) return null;
    if (z < this.walkZ0 || z > this.walkZ1) return null;
    return PLATFORM_Y;
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.waterfallTex.offset.y = (-this.elapsed * 1.4) % 1;
    this.waterfallTex.offset.x = Math.sin(this.elapsed * 0.6) * 0.02;

    for (const p of this.pistons) p.update(dt);
  }

  /**
   * Returns the armed piston whose head overlaps the player, or null.
   */
  checkPistonHit(playerPos: THREE.Vector3): HydraulicPiston | null {
    for (const p of this.pistons) {
      if (p.hits(playerPos)) return p;
    }
    return null;
  }
}
