import * as THREE from "three";

const ARM_LENGTH = 4.5;
const ARM_HEIGHT = 2.2;
const NUM_ARMS = 3;
const ROTATE_SPEED = 1.5; // rad/s
const ARM_SPHERE_RADIUS = 0.55;
const TIP_SPHERE_RADIUS = 0.35;
const SPHERES_PER_ARM = 5;
const POLE_RADIUS = 0.5;
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
    const armMat  = new THREE.MeshPhongMaterial({ map: tex, shininess: 100, specular: 0x333333 });
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

    // Three arms evenly spaced at 120°
    for (let i = 0; i < NUM_ARMS; i++) {
      const angle = (i / NUM_ARMS) * Math.PI * 2;

      const pivot = new THREE.Group();
      pivot.rotation.y = angle;
      pivot.position.y = ARM_HEIGHT;
      this.armGroup.add(pivot);

      const armGeo = new THREE.CylinderGeometry(0.18, 0.18, ARM_LENGTH, 10);
      armGeo.rotateZ(Math.PI / 2);
      armGeo.translate(ARM_LENGTH / 2, 0, 0);
      pivot.add(new THREE.Mesh(armGeo, armMat));

      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), ballMat);
      ball.position.x = ARM_LENGTH;
      pivot.add(ball);
    }

    this.mesh.add(this.armGroup);

    // Tip sphere (last per arm) gets tighter radius to match visual ball size
    for (let i = 0; i < NUM_ARMS; i++) {
      for (let j = 0; j < SPHERES_PER_ARM; j++) {
        const r = j === SPHERES_PER_ARM - 1 ? TIP_SPHERE_RADIUS : ARM_SPHERE_RADIUS;
        this.collisionSpheres.push(new THREE.Sphere(new THREE.Vector3(), r));
      }
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
      const worldAngle = (i / NUM_ARMS) * Math.PI * 2 + this.armGroup.rotation.y;
      const cos = Math.cos(worldAngle);
      const sin = Math.sin(worldAngle);

      for (let j = 0; j < SPHERES_PER_ARM; j++) {
        const dist = ((j + 1) / SPHERES_PER_ARM) * ARM_LENGTH;
        this.collisionSpheres[i * SPHERES_PER_ARM + j].center.set(
          cx + cos * dist, cy, cz + sin * dist,
        );
      }
    }
  }

  /**
   * Unified solid check — pole + every arm sphere + balls.
   * Uses 2D horizontal (XZ) distance so the player is treated as a vertical
   * capsule; height of the arm doesn't cause missed collisions.
   * Returns the displacement to add directly to player.position, or null.
   */
  checkSolid(playerPos: THREE.Vector3): THREE.Vector3 | null {
    // Pole (static cylinder)
    const pdx = playerPos.x - this.mesh.position.x;
    const pdz = playerPos.z - this.mesh.position.z;
    const poleDist = Math.sqrt(pdx * pdx + pdz * pdz);
    const poleMin  = POLE_RADIUS + PLAYER_RADIUS;
    if (poleDist < poleMin) {
      if (poleDist < 0.001) return new THREE.Vector3(poleMin, 0, 0);
      const ov = poleMin - poleDist;
      return new THREE.Vector3((pdx / poleDist) * ov, 0, (pdz / poleDist) * ov);
    }

    // Arms + balls (rotating spheres, XZ distance only)
    for (const sphere of this.collisionSpheres) {
      const dx = playerPos.x - sphere.center.x;
      const dz = playerPos.z - sphere.center.z;
      const d2  = Math.sqrt(dx * dx + dz * dz);
      const min = sphere.radius + PLAYER_RADIUS;
      if (d2 < min) {
        if (d2 < 0.001) return new THREE.Vector3(min, 0, 0);
        const ov = min - d2;
        return new THREE.Vector3((dx / d2) * ov, 0, (dz / d2) * ov);
      }
    }
    return null;
  }

  /**
   * Knockback direction — call this BEFORE checkSolid so the overlap still
   * exists. Returns a horizontal unit vector to multiply by knock speed, or null.
   */
  checkKnockback(playerPos: THREE.Vector3): THREE.Vector3 | null {
    for (const sphere of this.collisionSpheres) {
      const dx = playerPos.x - sphere.center.x;
      const dz = playerPos.z - sphere.center.z;
      const d2  = Math.sqrt(dx * dx + dz * dz);
      const min = sphere.radius + PLAYER_RADIUS;
      if (d2 < min) {
        const push = new THREE.Vector3(dx, 0, dz);
        if (d2 < 0.001) push.set(1, 0, 0);
        else push.divideScalar(d2);
        return push; // already normalised in XZ
      }
    }
    return null;
  }

  place(x: number, z: number, groundY: number): void {
    this.mesh.position.set(x, groundY, z);
  }
}
