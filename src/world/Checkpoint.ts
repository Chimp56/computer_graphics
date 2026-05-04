import * as THREE from "three";

const PILLAR_HEIGHT = 2.4;
const ORB_RADIUS = 0.55;

const INACTIVE_COLOR = 0x882222;
const ACTIVE_COLOR = 0x33dd66;

export type CheckpointOptions = {
  /** Center of the trigger box (and the pillar's foot). */
  position: THREE.Vector3;
  /** Position the player teleports to when respawning at this checkpoint. */
  spawnPosition: THREE.Vector3;
  /** XZ trigger half-extent; default 2.0. */
  triggerRadius?: number;
};

/**
 * Save-point pillar with a glowing orb. Inactive (red) until the player walks
 * into the trigger volume the first time, then locks active (green) for the
 * rest of the run. Use `consumeEnter()` to detect first activation as an edge.
 */
export class Checkpoint {
  readonly group = new THREE.Group();
  readonly position: THREE.Vector3;
  readonly spawnPosition: THREE.Vector3;

  private readonly orbMat: THREE.MeshPhongMaterial;
  private readonly orb: THREE.Mesh;
  private readonly radius: number;
  private active = false;
  private wasInside = false;

  constructor(opts: CheckpointOptions) {
    this.position = opts.position.clone();
    this.spawnPosition = opts.spawnPosition.clone();
    this.radius = opts.triggerRadius ?? 2.0;

    const pillarMat = new THREE.MeshPhongMaterial({
      color: 0x303642,
      shininess: 60,
      specular: 0x666666,
    });
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, PILLAR_HEIGHT, 12),
      pillarMat,
    );
    pillar.position.y = PILLAR_HEIGHT / 2;
    this.group.add(pillar);

    this.orbMat = new THREE.MeshPhongMaterial({
      color: INACTIVE_COLOR,
      emissive: INACTIVE_COLOR,
      emissiveIntensity: 0.7,
      shininess: 100,
    });
    this.orb = new THREE.Mesh(
      new THREE.SphereGeometry(ORB_RADIUS, 18, 14),
      this.orbMat,
    );
    this.orb.position.y = PILLAR_HEIGHT + ORB_RADIUS * 0.6;
    this.group.add(this.orb);

    const baseGeo = new THREE.CylinderGeometry(0.55, 0.65, 0.16, 18);
    const base = new THREE.Mesh(
      baseGeo,
      new THREE.MeshPhongMaterial({ color: 0x222428 }),
    );
    base.position.y = 0.08;
    this.group.add(base);

    this.group.position.copy(this.position);
  }

  /**
   * Returns true on the frame the player first crosses into the trigger zone.
   * Subsequent re-entries return false unless reset() is called.
   */
  consumeEnter(playerPos: THREE.Vector3): boolean {
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const dy = playerPos.y - this.position.y;
    const inside =
      Math.abs(dx) < this.radius &&
      Math.abs(dz) < this.radius &&
      Math.abs(dy) < 3;
    const fired = inside && !this.wasInside && !this.active;
    this.wasInside = inside;
    if (fired) this.activate();
    return fired;
  }

  activate(): void {
    if (this.active) return;
    this.active = true;
    this.orbMat.color.setHex(ACTIVE_COLOR);
    this.orbMat.emissive.setHex(ACTIVE_COLOR);
  }

  reset(): void {
    this.active = false;
    this.wasInside = false;
    this.orbMat.color.setHex(INACTIVE_COLOR);
    this.orbMat.emissive.setHex(INACTIVE_COLOR);
  }

  isActive(): boolean {
    return this.active;
  }

  update(dt: number): void {
    this.orb.rotation.y += dt * 1.2;
    const pulse = 0.6 + 0.25 * Math.sin(performance.now() * 0.004);
    this.orbMat.emissiveIntensity = this.active ? pulse + 0.15 : pulse * 0.7;
  }
}
