import * as THREE from "three";

export type PortalOptions = {
  position: THREE.Vector3;
  color: number;
  /** Horizontal trigger radius in world units. */
  radius?: number;
  /** Rotate the ring around Y so its face points along this normal (XZ plane). */
  faceNormal?: THREE.Vector3;
};

const RING_RADIUS = 1.6;
const RING_TUBE = 0.18;
const RING_HEIGHT = 2.2;

/**
 * Glowing ring portal. Calls into checkEnter() once per frame; returns true on
 * the frame the player first enters the trigger volume (edge-detected).
 */
export class Portal {
  readonly group = new THREE.Group();
  readonly position: THREE.Vector3;

  private readonly radius: number;
  private wasInside = false;
  private readonly disc: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private readonly ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshPhongMaterial>;

  constructor(opts: PortalOptions) {
    this.position = opts.position.clone();
    this.radius = opts.radius ?? 1.8;

    const ringGeo = new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 14, 36);
    const ringMat = new THREE.MeshPhongMaterial({
      color: opts.color,
      emissive: opts.color,
      emissiveIntensity: 0.85,
      shininess: 90,
      specular: 0x222222,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.position.y = RING_HEIGHT;
    this.group.add(this.ring);

    const discGeo = new THREE.CircleGeometry(RING_RADIUS - RING_TUBE, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: opts.color,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    this.disc = new THREE.Mesh(discGeo, discMat);
    this.disc.position.y = RING_HEIGHT;
    this.group.add(this.disc);

    const baseGeo = new THREE.CylinderGeometry(0.7, 0.85, 0.3, 18);
    const baseMat = new THREE.MeshPhongMaterial({
      color: 0x222236,
      shininess: 30,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.15;
    this.group.add(base);

    if (opts.faceNormal) {
      const yaw = Math.atan2(opts.faceNormal.x, opts.faceNormal.z);
      this.ring.rotation.y = yaw;
      this.disc.rotation.y = yaw;
    }

    this.group.position.copy(this.position);
  }

  /**
   * Returns true only on the frame the player first enters the trigger volume.
   * Resets internal edge state when the player leaves so re-entry fires again.
   */
  checkEnter(playerPos: THREE.Vector3): boolean {
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const dy = playerPos.y - (this.position.y + RING_HEIGHT);
    const horiz2 = dx * dx + dz * dz;
    const inside =
      horiz2 < this.radius * this.radius && Math.abs(dy) < 2.8;

    const fired = inside && !this.wasInside;
    this.wasInside = inside;
    return fired;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
    if (!visible) this.wasInside = false;
  }

  update(dt: number): void {
    this.ring.rotation.z += dt * 0.6;
    this.disc.material.opacity = 0.3 + 0.1 * Math.sin(performance.now() * 0.003);
  }
}
