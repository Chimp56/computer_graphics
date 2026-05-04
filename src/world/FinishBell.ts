import * as THREE from "three";

const BELL_COLOR = 0xd4a017;   // brass
const POST_COLOR = 0x5c3a1e;   // dark wood

const WOBBLE_DURATION = 1.2;   // seconds the bell rocks after being rung
const WOBBLE_AMPLITUDE = 0.35; // radians
const WOBBLE_FREQUENCY = 8;    // oscillations per second

/**
 * Finish bell built from primitives (cone + cylinder bell body, cylinder post).
 *
 * Usage:
 *   const bell = new FinishBell(new THREE.Vector3(0, 5, -60));
 *   scene.add(bell.group);
 *
 *   // In render loop:
 *   bell.update(dt);
 *
 *   // When player wins:
 *   bell.ring();
 */
export class FinishBell {
  readonly group = new THREE.Group();

  private readonly bell: THREE.Group;
  private wobbleTime = 0;

  constructor(position: THREE.Vector3) {
    const brassMat = new THREE.MeshPhongMaterial({
      color: BELL_COLOR,
      shininess: 90,
      specular: new THREE.Color(0xffd966),
    });

    const woodMat = new THREE.MeshPhongMaterial({
      color: POST_COLOR,
      shininess: 10,
    });

    // Post
    const postGeo = new THREE.CylinderGeometry(0.1, 0.13, 2.4, 10);
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.y = 1.2;
    post.castShadow = true;

    // Crossbar
    const barGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8);
    const bar = new THREE.Mesh(barGeo, woodMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 2.5, 0);
    bar.castShadow = true;

    // Bell body — open-ended cone for the skirt + small cylinder for the crown
    const skirtGeo = new THREE.ConeGeometry(0.38, 0.55, 16, 1, true);
    const skirt = new THREE.Mesh(skirtGeo, brassMat);
    skirt.rotation.x = Math.PI; // open end faces down
    skirt.position.y = -0.18;
    skirt.castShadow = true;

    const crownGeo = new THREE.CylinderGeometry(0.12, 0.22, 0.22, 16);
    const crown = new THREE.Mesh(crownGeo, brassMat);
    crown.position.y = 0.16;
    crown.castShadow = true;

    // Clapper
    const clapperGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const clapper = new THREE.Mesh(clapperGeo, brassMat);
    clapper.position.y = -0.38;

    this.bell = new THREE.Group();
    this.bell.add(skirt, crown, clapper);
    this.bell.position.set(0, 2.5, 0); // hang from crossbar

    this.group.add(post, bar, this.bell);
    this.group.position.copy(position);
    this.group.name = "FinishBell";
  }

  /** Trigger the wobble animation. Call this when the player wins. */
  ring(): void {
    this.wobbleTime = WOBBLE_DURATION;
  }

  /** Pushes player out of bell solids (post + bell body). */
  resolvePlayerCollision(position: THREE.Vector3, playerRadius: number): boolean {
    let collided = false;

    // Post cylinder
    const postDx = position.x - this.group.position.x;
    const postDz = position.z - this.group.position.z;
    const postDist = Math.sqrt(postDx * postDx + postDz * postDz);
    const postMin = 0.13 + playerRadius;
    if (postDist < postMin) {
      if (postDist < 1e-6) {
        position.x += postMin;
      } else {
        const push = postMin - postDist;
        position.x += (postDx / postDist) * push;
        position.z += (postDz / postDist) * push;
      }
      collided = true;
    }

    // Bell body approximate sphere
    const bellCenter = new THREE.Vector3(
      this.group.position.x,
      this.group.position.y + 2.32,
      this.group.position.z,
    );
    const dx = position.x - bellCenter.x;
    const dy = position.y - bellCenter.y;
    const dz = position.z - bellCenter.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const minDist = 0.42 + playerRadius;
    if (dist < minDist) {
      const nx = dist > 1e-6 ? dx / dist : 1;
      const ny = dist > 1e-6 ? dy / dist : 0;
      const nz = dist > 1e-6 ? dz / dist : 0;
      const push = minDist - dist;
      position.x += nx * push;
      position.y += ny * push;
      position.z += nz * push;
      collided = true;
    }

    return collided;
  }

  /** Call once per fixed-timestep tick (dt in seconds). */
  update(dt: number): void {
    if (this.wobbleTime <= 0) {
      this.bell.rotation.z = 0;
      return;
    }

    this.wobbleTime -= dt;

    const progress = this.wobbleTime / WOBBLE_DURATION;
    const decay = progress * progress; // ease out
    this.bell.rotation.z =
      Math.sin(this.wobbleTime * WOBBLE_FREQUENCY * Math.PI * 2) *
      WOBBLE_AMPLITUDE *
      decay;
  }
}
