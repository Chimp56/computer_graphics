import * as THREE from "three";

const ROD_RADIUS = 0.12;
const CUP_FRONT_RADIUS = 0.85;
const CUP_BACK_RADIUS = 0.4;
const CUP_LENGTH = 0.55;
const WALL_FRONT_LOCAL = 0.4;
const RETRACTED_OFFSET = -0.5;
const ARM_THRESHOLD = WALL_FRONT_LOCAL - CUP_LENGTH;
const PLAYER_RADIUS = 0.32;

const TELEGRAPH_FRAC = 0.12;
const EXTEND_FRAC = 0.07;
const HOLD_FRAC = 0.20;
const RETRACT_FRAC = 0.18;

export type PlungerOptions = {
  basePosition: THREE.Vector3;
  /** Unit vector from wall toward play area. */
  direction: THREE.Vector3;
  extendDistance: number;
  period: number;
  phase?: number;
};

/**
 * Wall-mounted suction plunger. A thin metal rod telescopes out followed by a
 * flared rubber cup. Hits register only while the cup is poking out from its
 * mounting port. The caller is responsible for any "stick"/lock effect on the
 * player — this class only reports overlap.
 */
export class SuctionPlunger {
  readonly group = new THREE.Group();
  readonly direction = new THREE.Vector3();

  private armed = false;
  private elapsed: number;
  private currentOffset = 0;
  private readonly period: number;
  private readonly extendDistance: number;
  private readonly base = new THREE.Vector3();
  private readonly cup: THREE.Mesh;
  private readonly rim: THREE.Mesh;
  private readonly rod: THREE.Mesh;
  private readonly port: THREE.Mesh;

  constructor(opts: PlungerOptions) {
    this.base.copy(opts.basePosition);
    this.direction.copy(opts.direction).normalize();
    this.extendDistance = opts.extendDistance;
    this.period = opts.period;
    this.elapsed = opts.phase ?? 0;

    const cupMat = new THREE.MeshPhongMaterial({
      color: 0xb33030,
      shininess: 18,
      specular: 0x661a1a,
    });
    const rimMat = new THREE.MeshPhongMaterial({
      color: 0x2a0a0a,
      shininess: 8,
    });
    const rodMat = new THREE.MeshPhongMaterial({
      color: 0xc8ccd0,
      shininess: 80,
      specular: 0x666666,
    });
    const portMat = new THREE.MeshPhongMaterial({
      color: 0x111418,
      shininess: 5,
    });

    const cupGeo = new THREE.CylinderGeometry(
      CUP_FRONT_RADIUS,
      CUP_BACK_RADIUS,
      CUP_LENGTH,
      20,
      1,
      true,
    );
    cupGeo.rotateX(Math.PI / 2);
    cupMat.side = THREE.DoubleSide;
    this.cup = new THREE.Mesh(cupGeo, cupMat);
    this.group.add(this.cup);

    const rimGeo = new THREE.TorusGeometry(CUP_FRONT_RADIUS, 0.08, 8, 24);
    this.rim = new THREE.Mesh(rimGeo, rimMat);
    this.group.add(this.rim);

    this.rod = new THREE.Mesh(
      new THREE.CylinderGeometry(ROD_RADIUS, ROD_RADIUS, 1, 12),
      rodMat,
    );
    this.rod.geometry.rotateX(Math.PI / 2);
    this.group.add(this.rod);

    const portGeo = new THREE.CircleGeometry(CUP_FRONT_RADIUS + 0.12, 24);
    this.port = new THREE.Mesh(portGeo, portMat);
    this.port.position.set(0, 0, WALL_FRONT_LOCAL - 0.02);
    this.port.rotation.y = Math.PI;
    this.group.add(this.port);

    const yaw = Math.atan2(this.direction.x, this.direction.z);
    this.group.rotation.y = yaw;
    this.group.position.copy(this.base);

    this.applyOffset(RETRACTED_OFFSET);
  }

  update(dt: number): void {
    this.elapsed = (this.elapsed + dt) % this.period;
    const t = this.elapsed / this.period;

    let offset = RETRACTED_OFFSET;
    const T1 = TELEGRAPH_FRAC;
    const T2 = T1 + EXTEND_FRAC;
    const T3 = T2 + HOLD_FRAC;
    const T4 = T3 + RETRACT_FRAC;

    if (t < T1) {
      offset = RETRACTED_OFFSET;
    } else if (t < T2) {
      const k = (t - T1) / EXTEND_FRAC;
      offset =
        RETRACTED_OFFSET + (this.extendDistance - RETRACTED_OFFSET) * easeOut(k);
    } else if (t < T3) {
      offset = this.extendDistance;
    } else if (t < T4) {
      const k = (t - T3) / RETRACT_FRAC;
      offset =
        this.extendDistance -
        (this.extendDistance - RETRACTED_OFFSET) * easeIn(k);
    }

    this.armed = offset > ARM_THRESHOLD;
    this.applyOffset(offset);
  }

  isArmed(): boolean {
    return this.armed;
  }

  hits(playerPos: THREE.Vector3): boolean {
    if (!this.armed) return false;

    const cupWorld = this.getCupWorldPosition(_tmpCup);
    const dx = playerPos.x - cupWorld.x;
    const dz = playerPos.z - cupWorld.z;
    const dy = playerPos.y - cupWorld.y;
    const horiz2 = dx * dx + dz * dz;
    const r = CUP_FRONT_RADIUS + PLAYER_RADIUS;
    return horiz2 < r * r && Math.abs(dy) < 1.6;
  }

  private getCupWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    return out
      .copy(this.direction)
      .multiplyScalar(this.currentOffset + CUP_LENGTH / 2)
      .add(this.base);
  }

  private applyOffset(offset: number): void {
    this.currentOffset = offset;
    const cupCenter = offset + CUP_LENGTH / 2;
    this.cup.position.set(0, 0, cupCenter);
    this.rim.position.set(0, 0, offset + CUP_LENGTH);

    const rodFront = offset;
    const rodBack = -1.0;
    const rodLen = Math.max(0.05, rodFront - rodBack);
    this.rod.scale.z = rodLen;
    this.rod.position.set(0, 0, (rodFront + rodBack) / 2);
  }
}

const _tmpCup = new THREE.Vector3();

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeIn(t: number): number {
  return t * t;
}
