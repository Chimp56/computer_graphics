import * as THREE from "three";

const ARM_LENGTH = 4.5;
const ARM_HEIGHT = 2.2;
const NUM_ARMS = 2;
const ROTATE_SPEED = 1.5; // rad/s
const COLLISION_RADIUS = 0.7;
const SPHERES_PER_ARM = 5;
const PLAYER_RADIUS = 0.4;

function createStripedTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const stripeW = 32;
  for (let x = 0; x < canvas.width; x += stripeW) {
    ctx.fillStyle = Math.floor(x / stripeW) % 2 === 0 ? "#dd2222" : "#ffffff";
    ctx.fillRect(x, 0, stripeW, canvas.height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export class WipeoutObstacle {
  readonly mesh = new THREE.Group();
  private readonly armGroup = new THREE.Group();
  private readonly collisionSpheres: THREE.Sphere[] = [];

  constructor() {
    const tex = createStripedTexture();
    const poleMat = new THREE.MeshPhongMaterial({ color: 0x999999, shininess: 80, specular: 0x444444 });
    const armMat = new THREE.MeshPhongMaterial({ map: tex, shininess: 100, specular: 0x333333 });
    const ballMat = new THREE.MeshPhongMaterial({ color: 0xdd2222, shininess: 120, specular: 0x553333 });
    const baseMat = new THREE.MeshPhongMaterial({ color: 0x555566, shininess: 40 });

    // Base platform
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.4, 16), baseMat);
    base.position.y = 0.2;
    this.mesh.add(base);

    // Central pole
    const poleGeo = new THREE.CylinderGeometry(0.22, 0.28, ARM_HEIGHT + 1.0, 12);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = (ARM_HEIGHT + 1.0) / 2;
    this.mesh.add(pole);

    // Two opposite arms
    for (let i = 0; i < NUM_ARMS; i++) {
      const angle = (i / NUM_ARMS) * Math.PI; // 0 and π

      const pivot = new THREE.Group();
      pivot.rotation.y = angle;
      pivot.position.y = ARM_HEIGHT;
      this.armGroup.add(pivot);

      // Arm cylinder: rotated to lie along +X, starting at pivot center
      const armGeo = new THREE.CylinderGeometry(0.18, 0.18, ARM_LENGTH, 10);
      armGeo.rotateZ(Math.PI / 2);
      armGeo.translate(ARM_LENGTH / 2, 0, 0);
      pivot.add(new THREE.Mesh(armGeo, armMat));

      // Ball at tip
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), ballMat);
      ball.position.x = ARM_LENGTH;
      pivot.add(ball);
    }

    this.mesh.add(this.armGroup);

    // Pre-allocate collision spheres (updated each frame)
    for (let i = 0; i < NUM_ARMS * SPHERES_PER_ARM; i++) {
      this.collisionSpheres.push(new THREE.Sphere(new THREE.Vector3(), COLLISION_RADIUS));
    }
  }

  update(dt: number): void {
    this.armGroup.rotation.y += ROTATE_SPEED * dt;
    this._syncCollisionSpheres();
  }

  private _syncCollisionSpheres(): void {
    const cx = this.mesh.position.x;
    const cy = this.mesh.position.y + ARM_HEIGHT;
    const cz = this.mesh.position.z;

    for (let i = 0; i < NUM_ARMS; i++) {
      const worldAngle = (i / NUM_ARMS) * Math.PI + this.armGroup.rotation.y;
      const cos = Math.cos(worldAngle);
      const sin = Math.sin(worldAngle);

      for (let j = 0; j < SPHERES_PER_ARM; j++) {
        const dist = ((j + 1) / SPHERES_PER_ARM) * ARM_LENGTH;
        const sphere = this.collisionSpheres[i * SPHERES_PER_ARM + j];
        sphere.center.set(cx + cos * dist, cy, cz + sin * dist);
      }
    }
  }

  /**
   * Returns a normalised push direction if the player sphere overlaps any arm
   * sphere, otherwise null. The caller should multiply by a knock speed and
   * pass the result to PlayerController.applyImpulse().
   */
  checkCollision(playerPos: THREE.Vector3): THREE.Vector3 | null {
    for (const sphere of this.collisionSpheres) {
      const dx = playerPos.x - sphere.center.x;
      const dy = playerPos.y - sphere.center.y;
      const dz = playerPos.z - sphere.center.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const minDist = sphere.radius + PLAYER_RADIUS;

      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        const push = new THREE.Vector3(dx, dy, dz);
        if (dist < 0.001) push.set(0, 1, 0);
        else push.divideScalar(dist);
        // Small upward kick so the arc looks natural — horizontal force carries them off the edge
        push.y = Math.max(push.y, 0.15);
        push.normalize();
        return push;
      }
    }
    return null;
  }

  place(x: number, z: number, groundY: number): void {
    this.mesh.position.set(x, groundY, z);
  }
}
