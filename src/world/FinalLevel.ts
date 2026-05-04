import * as THREE from "three";
import { WipeoutObstacle } from "../obstacles/WipeoutObstacle";
import { HydraulicPiston } from "../obstacles/HydraulicPiston";
import { SuctionPlunger } from "../obstacles/SuctionPlunger";
import { Checkpoint } from "./Checkpoint";

const CX = -120;
const BASE_Y = 35;

const SLOPE_FOOT_Z = 192;
const SLOPE_TOP_Z = 242;
const SLOPE_LEN = SLOPE_TOP_Z - SLOPE_FOOT_Z;
const SLOPE_RISE = 10;
const SLOPE = SLOPE_RISE / SLOPE_LEN;
const TOP_Y = BASE_Y + SLOPE_RISE;

const SLAB_THICKNESS = 1.2;

type Pad = {
  x: number;
  z: number;
  width: number;
  depth: number;
  y?: number;
};

const PADS: ReadonlyArray<Pad> = [
  // Section 1 — Pit/Wipeout course
  { x: CX, z: 86, width: 16, depth: 12 }, // start pad
  { x: CX, z: 105, width: 14, depth: 14 }, // mid pad with wipeout
  { x: CX, z: 120, width: 16, depth: 8 }, // pre-checkpoint A pad
  // Section 2 — Waterfall walkway
  { x: CX, z: 158, width: 8, depth: 68 },
  // Section 2 → 3 transition / checkpoint B pad
  { x: CX, z: 188, width: 14, depth: 8 },
  // Top platform after slope
  { x: CX, z: 246, width: 14, depth: 10, y: TOP_Y },
];

export type FinalSection = "section1" | "section2" | "section3";

export class FinalLevel {
  readonly group = new THREE.Group();
  readonly wipeouts: WipeoutObstacle[] = [];
  readonly pistons: HydraulicPiston[] = [];
  readonly plungers: SuctionPlunger[] = [];
  readonly checkpoints: Checkpoint[] = [];

  /** First checkpoint == start spawn. Always activated on level entry. */
  readonly startSpawn = new THREE.Vector3(CX, BASE_Y + 0.4, 86);
  readonly topPortalPosition = new THREE.Vector3(CX, TOP_Y, 248.5);
  readonly startPortalPosition = new THREE.Vector3(CX, BASE_Y, 81);

  private readonly waterfallTex: THREE.CanvasTexture;
  private readonly slopeTex: THREE.CanvasTexture;
  private elapsed = 0;

  constructor() {
    const padMat = new THREE.MeshPhongMaterial({
      color: 0x6c5a44,
      shininess: 26,
      specular: 0x222222,
    });
    const trimMat = new THREE.MeshPhongMaterial({
      color: 0x352818,
      shininess: 8,
    });

    for (const p of PADS) {
      const y = p.y ?? BASE_Y;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(p.width, SLAB_THICKNESS, p.depth),
        padMat,
      );
      slab.position.set(p.x, y - SLAB_THICKNESS / 2, p.z);
      this.group.add(slab);

      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(p.width + 0.2, 0.18, p.depth + 0.2),
        trimMat,
      );
      trim.position.set(p.x, y - SLAB_THICKNESS - 0.05, p.z);
      this.group.add(trim);
    }

    // Section 1 wipeout on the middle pad.
    const wipe = new WipeoutObstacle();
    wipe.place(CX, 105, BASE_Y);
    this.wipeouts.push(wipe);
    this.group.add(wipe.mesh);

    // Section 2 — rock wall + waterfall + pistons.
    const rockMat = new THREE.MeshPhongMaterial({
      color: 0x40342a,
      shininess: 8,
    });
    const rockWall = new THREE.Mesh(
      new THREE.BoxGeometry(1, 18, 68),
      rockMat,
    );
    rockWall.position.set(CX + 4.7, BASE_Y + 8, 158);
    this.group.add(rockWall);

    this.waterfallTex = buildWaterfallTexture();
    const waterMat = new THREE.MeshPhongMaterial({
      map: this.waterfallTex,
      color: 0xbfe4ff,
      transparent: true,
      opacity: 0.85,
      shininess: 140,
      specular: 0xbfe6ff,
      side: THREE.DoubleSide,
    });
    const waterfall = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 24, 70),
      waterMat,
    );
    waterfall.position.set(CX - 5, BASE_Y + 10, 158);
    this.group.add(waterfall);

    const pistonZs = [134, 144, 154, 164, 174, 184];
    const period = 2.8;
    for (let i = 0; i < pistonZs.length; i++) {
      const piston = new HydraulicPiston({
        basePosition: new THREE.Vector3(CX + 4.2, BASE_Y + 1.2, pistonZs[i]),
        direction: new THREE.Vector3(-1, 0, 0),
        extendDistance: 5,
        period,
        phase: (i * 0.47) % period,
      });
      this.pistons.push(piston);
      this.group.add(piston.group);
    }

    // Section 3 — glass slope + plungers.
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
    const slopeSlabLength = Math.sqrt(SLOPE_LEN ** 2 + SLOPE_RISE ** 2);
    const slope = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.28, slopeSlabLength),
      slopeMat,
    );
    slope.position.set(
      CX,
      BASE_Y + SLOPE_RISE / 2,
      SLOPE_FOOT_Z + SLOPE_LEN / 2,
    );
    slope.rotation.x = -Math.atan2(SLOPE_RISE, SLOPE_LEN);
    this.group.add(slope);

    const slopeWallMat = new THREE.MeshPhongMaterial({
      color: 0x6cb4d8,
      transparent: true,
      opacity: 0.32,
      shininess: 200,
      specular: 0xeaffff,
      side: THREE.DoubleSide,
    });
    for (const sign of [-1, 1] as const) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 14, SLOPE_LEN + 4),
        slopeWallMat,
      );
      wall.position.set(
        CX + sign * 4.15,
        BASE_Y + SLOPE_RISE / 2 + 5,
        SLOPE_FOOT_Z + SLOPE_LEN / 2,
      );
      this.group.add(wall);
    }

    const plungerCount = 4;
    const plungerPeriod = 4.4;
    for (let i = 0; i < plungerCount; i++) {
      const t = (i + 1) / (plungerCount + 1);
      const z = SLOPE_FOOT_Z + t * SLOPE_LEN;
      const fromLeft = i % 2 === 0;
      const sideX = fromLeft ? CX - 4.05 : CX + 4.05;
      const dir = new THREE.Vector3(fromLeft ? 1 : -1, 0, 0);
      const baseY = this.heightAtZ(z) + 1.2;
      const plunger = new SuctionPlunger({
        basePosition: new THREE.Vector3(sideX, baseY, z),
        direction: dir,
        extendDistance: 5.4,
        period: plungerPeriod,
        phase: (i * 0.91) % plungerPeriod,
      });
      this.plungers.push(plunger);
      this.group.add(plunger.group);
    }

    // Checkpoints
    const cpStart = new Checkpoint({
      position: new THREE.Vector3(CX, BASE_Y, 86),
      spawnPosition: this.startSpawn,
      triggerRadius: 2.5,
    });
    cpStart.activate();
    this.checkpoints.push(cpStart);
    this.group.add(cpStart.group);

    const cpA = new Checkpoint({
      position: new THREE.Vector3(CX, BASE_Y, 121),
      spawnPosition: new THREE.Vector3(CX, BASE_Y + 0.4, 121),
    });
    this.checkpoints.push(cpA);
    this.group.add(cpA.group);

    const cpB = new Checkpoint({
      position: new THREE.Vector3(CX, BASE_Y, 188),
      spawnPosition: new THREE.Vector3(CX, BASE_Y + 0.4, 188),
    });
    this.checkpoints.push(cpB);
    this.group.add(cpB.group);
  }

  /** Top-surface Y at (x, z), or null when off the course. */
  getHeightAt(x: number, z: number): number | null {
    for (const p of PADS) {
      const halfW = p.width * 0.5;
      const halfD = p.depth * 0.5;
      if (
        x >= p.x - halfW &&
        x <= p.x + halfW &&
        z >= p.z - halfD &&
        z <= p.z + halfD
      ) {
        return p.y ?? BASE_Y;
      }
    }
    if (x >= CX - 4 && x <= CX + 4 && z >= SLOPE_FOOT_Z && z <= SLOPE_TOP_Z) {
      return this.heightAtZ(z);
    }
    return null;
  }

  private heightAtZ(z: number): number {
    const t = Math.max(0, Math.min(SLOPE_LEN, z - SLOPE_FOOT_Z));
    return BASE_Y + t * SLOPE;
  }

  /** Section dictating physics (slippery + water pressure) at this position. */
  getActiveSection(playerPos: THREE.Vector3): FinalSection {
    if (playerPos.z >= SLOPE_FOOT_Z - 1) return "section3";
    if (playerPos.z >= 124) return "section2";
    return "section1";
  }

  /** Returns the most-recently-activated checkpoint's spawn (for respawn). */
  getActiveSpawn(): THREE.Vector3 {
    for (let i = this.checkpoints.length - 1; i >= 0; i--) {
      if (this.checkpoints[i].isActive()) {
        return this.checkpoints[i].spawnPosition.clone();
      }
    }
    return this.startSpawn.clone();
  }

  /** Activates any new checkpoint the player just stepped into. */
  pollCheckpointEntries(playerPos: THREE.Vector3): boolean {
    let any = false;
    for (const cp of this.checkpoints) {
      if (cp.consumeEnter(playerPos)) any = true;
    }
    return any;
  }

  /** Reset all checkpoints (call on level entry). */
  resetCheckpoints(): void {
    for (let i = 0; i < this.checkpoints.length; i++) {
      this.checkpoints[i].reset();
    }
    this.checkpoints[0]?.activate();
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.waterfallTex.offset.y = (-this.elapsed * 1.2) % 1;
    this.slopeTex.offset.y = (this.elapsed * 0.5) % 1;
    for (const w of this.wipeouts) w.update(dt);
    for (const p of this.pistons) p.update(dt);
    for (const p of this.plungers) p.update(dt);
    for (const cp of this.checkpoints) cp.update(dt);
  }

  /** Returns the wipeout the player is currently being arm-hit by, or null. */
  checkWipeoutHit(playerPos: THREE.Vector3): WipeoutObstacle | null {
    for (const w of this.wipeouts) {
      if (w.checkKnockback(playerPos)) return w;
    }
    return null;
  }

  /** Pole/arm solid push (call before knockback check). */
  resolveWipeoutSolids(playerPos: THREE.Vector3): THREE.Vector3 | null {
    for (const w of this.wipeouts) {
      const push = w.checkSolid(playerPos);
      if (push) return push;
    }
    return null;
  }

  checkPistonHit(playerPos: THREE.Vector3): HydraulicPiston | null {
    for (const p of this.pistons) {
      if (p.hits(playerPos)) return p;
    }
    return null;
  }

  checkPlungerHit(playerPos: THREE.Vector3): SuctionPlunger | null {
    for (const p of this.plungers) {
      if (p.hits(playerPos)) return p;
    }
    return null;
  }
}

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
  for (let i = 0; i < 32; i++) {
    const x = (i / 32) * W;
    ctx.beginPath();
    for (let y = 0; y <= H; y += 8) {
      const wobble = Math.sin(y * 0.04 + i) * 1.5;
      if (y === 0) ctx.moveTo(x + wobble, y);
      else ctx.lineTo(x + wobble, y);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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

  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.2;
  for (let y = 0; y < H; y += 12) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const yy = y + Math.sin(x * 0.07 + y * 0.03) * 1.4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(2, 6);
  return tex;
}
