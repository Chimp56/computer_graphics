import * as THREE from "three";

const HEAD_RADIUS = 0.7;
const HEAD_LENGTH = 0.8;
/** Local-space depth of wall material in front of the mounting base. */
const WALL_FRONT_LOCAL = 0.4;
/** Retracted offset — head sits fully behind the wall front face. */
const RETRACTED_OFFSET = -0.55;
/** Local-space offset at which the head emerges from the wall surface. */
const ARM_THRESHOLD = WALL_FRONT_LOCAL - HEAD_LENGTH;
const PLAYER_RADIUS = 0.32;

const TELEGRAPH_FRAC = 0.10;
const EXTEND_FRAC = 0.07;
const HOLD_FRAC = 0.12;
const RETRACT_FRAC = 0.20;

/**
 * Wall-mounted piston. The head sits inside the wall when retracted, slams out
 * along its `direction` vector, dwells, then snaps back. A splash ring
 * telegraphs the strike a fraction of a second before it fires.
 */
export type PistonOptions = {
  /** Mount point inside the wall — the head's resting anchor. */
  basePosition: THREE.Vector3;
  /** Unit vector pointing from wall toward the playable area. */
  direction: THREE.Vector3;
  /** How far the head travels from base when fully extended. */
  extendDistance: number;
  /** Total cycle period in seconds. */
  period: number;
  /** Phase offset within the period (0..period). */
  phase?: number;
};

export class HydraulicPiston {
  readonly group = new THREE.Group();

  private armed = false;
  private elapsed: number;
  private readonly period: number;
  private readonly extendDistance: number;
  readonly direction = new THREE.Vector3();
  private readonly base = new THREE.Vector3();
  private readonly head: THREE.Mesh;
  private readonly splash: THREE.Mesh;
  private readonly port: THREE.Mesh;
  private currentOffset = 0;

  constructor(opts: PistonOptions) {
    this.base.copy(opts.basePosition);
    this.direction.copy(opts.direction).normalize();
    this.extendDistance = opts.extendDistance;
    this.period = opts.period;
    this.elapsed = opts.phase ?? 0;

    const headMat = new THREE.MeshPhongMaterial({
      color: 0x222831,
      shininess: 120,
      specular: 0xaaaaaa,
    });
    const portMat = new THREE.MeshPhongMaterial({
      color: 0x111418,
      shininess: 5,
    });
    const splashMat = new THREE.MeshBasicMaterial({
      color: 0xbfe6ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    const headGeo = new THREE.CylinderGeometry(HEAD_RADIUS, HEAD_RADIUS, HEAD_LENGTH, 18);
    headGeo.rotateX(Math.PI / 2);
    this.head = new THREE.Mesh(headGeo, headMat);
    this.group.add(this.head);

    const portGeo = new THREE.CircleGeometry(HEAD_RADIUS + 0.1, 24);
    this.port = new THREE.Mesh(portGeo, portMat);
    this.port.position.set(0, 0, WALL_FRONT_LOCAL - 0.02);
    this.port.rotation.y = Math.PI;
    this.group.add(this.port);

    const splashGeo = new THREE.RingGeometry(HEAD_RADIUS + 0.05, HEAD_RADIUS + 1.1, 24);
    this.splash = new THREE.Mesh(splashGeo, splashMat);
    this.splash.position.set(0, 0, WALL_FRONT_LOCAL + 0.02);
    this.splash.rotation.y = Math.PI;
    this.group.add(this.splash);

    const yaw = Math.atan2(this.direction.x, this.direction.z);
    this.group.rotation.y = yaw;
    this.group.position.copy(this.base);

    this.applyHeadOffset(RETRACTED_OFFSET);
  }

  update(dt: number): void {
    this.elapsed = (this.elapsed + dt) % this.period;
    const t = this.elapsed / this.period;

    let offset = RETRACTED_OFFSET;
    let splashOpacity = 0;

    const T1 = TELEGRAPH_FRAC;
    const T2 = T1 + EXTEND_FRAC;
    const T3 = T2 + HOLD_FRAC;
    const T4 = T3 + RETRACT_FRAC;

    if (t < T1) {
      const k = t / TELEGRAPH_FRAC;
      splashOpacity = Math.sin(k * Math.PI) * 0.85;
    } else if (t < T2) {
      const k = (t - T1) / EXTEND_FRAC;
      offset =
        RETRACTED_OFFSET + (this.extendDistance - RETRACTED_OFFSET) * easeOut(k);
      splashOpacity = 0.5 * (1 - k);
    } else if (t < T3) {
      offset = this.extendDistance;
    } else if (t < T4) {
      const k = (t - T3) / RETRACT_FRAC;
      offset =
        this.extendDistance -
        (this.extendDistance - RETRACTED_OFFSET) * easeIn(k);
    }

    this.armed = offset > ARM_THRESHOLD;
    this.applyHeadOffset(offset);

    const splashMat = this.splash.material as THREE.MeshBasicMaterial;
    splashMat.opacity = splashOpacity;
    if (splashOpacity > 0) {
      const s = 0.6 + (1 - splashOpacity / 0.85) * 0.8;
      this.splash.scale.set(s, s, 1);
    }
  }

  isArmed(): boolean {
    return this.armed;
  }

  /** Returns true when the player overlaps the head while it's armed. */
  hits(playerPos: THREE.Vector3): boolean {
    if (!this.armed) return false;

    const headWorld = this.getHeadWorldPosition(_tmpHead);
    const dx = playerPos.x - headWorld.x;
    const dz = playerPos.z - headWorld.z;
    const dy = playerPos.y - headWorld.y;
    const horiz2 = dx * dx + dz * dz;
    const minR = HEAD_RADIUS + PLAYER_RADIUS;
    return horiz2 < minR * minR && Math.abs(dy) < 1.7;
  }

  private getHeadWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    return out
      .copy(this.direction)
      .multiplyScalar(this.currentOffset + HEAD_LENGTH / 2)
      .add(this.base);
  }

  private applyHeadOffset(offset: number): void {
    this.currentOffset = offset;
    this.head.position.set(0, 0, offset + HEAD_LENGTH / 2);
  }
}

const _tmpHead = new THREE.Vector3();

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeIn(t: number): number {
  return t * t;
}
