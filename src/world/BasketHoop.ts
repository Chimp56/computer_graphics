import * as THREE from "three";

const POST_HEIGHT = 3.6;
const RIM_HEIGHT = 3.05;
const RIM_DEPTH = 0.55;
const RIM_RADIUS = 0.45;
const RIM_TUBE_RADIUS = 0.035;

const NET_SWOOSH_DURATION = 0.45;
const POLE_RADIUS = 0.14;

/**
 * Simple basketball hoop made from primitive meshes.
 */
export class BasketHoop {
  readonly group = new THREE.Group();

  private readonly rimCenterLocal = new THREE.Vector3(0, RIM_HEIGHT, RIM_DEPTH);
  private readonly backboardCenterLocal = new THREE.Vector3(0, 3.3, 0);
  private readonly backboardSize = new THREE.Vector3(1.7, 1, 0.08);

  private readonly rimCenterWorld = new THREE.Vector3();
  private readonly boardCenterWorld = new THREE.Vector3();

  private readonly net: THREE.Mesh;
  private swooshTime = 0;

  constructor(position: THREE.Vector3) {
    const poleMat = new THREE.MeshPhongMaterial({
      color: 0x5f5f68,
      shininess: 55,
      specular: new THREE.Color(0x7f7f90),
    });
    const boardMat = new THREE.MeshPhongMaterial({
      color: 0xf1f1f1,
      shininess: 25,
      specular: new THREE.Color(0xdddddd),
    });
    const rimMat = new THREE.MeshPhongMaterial({
      color: 0xd36324,
      shininess: 80,
      specular: new THREE.Color(0xffc9a5),
    });
    const netMat = new THREE.MeshPhongMaterial({
      color: 0xe6e6e6,
      transparent: true,
      opacity: 0.85,
      shininess: 10,
      side: THREE.DoubleSide,
    });

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, POST_HEIGHT, 14),
      poleMat,
    );
    pole.position.y = POST_HEIGHT * 0.5;
    pole.castShadow = true;
    pole.receiveShadow = true;

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(this.backboardSize.x, this.backboardSize.y, this.backboardSize.z),
      boardMat,
    );
    board.position.copy(this.backboardCenterLocal);
    board.castShadow = true;
    board.receiveShadow = true;

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(RIM_RADIUS, RIM_TUBE_RADIUS, 14, 28),
      rimMat,
    );
    rim.rotation.x = Math.PI * 0.5;
    rim.position.copy(this.rimCenterLocal);
    rim.castShadow = true;
    rim.receiveShadow = true;

    this.net = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.22, 0.48, 14, 1, true),
      netMat,
    );
    this.net.position.set(0, RIM_HEIGHT - 0.26, RIM_DEPTH);
    this.net.castShadow = true;
    this.net.receiveShadow = true;

    this.group.add(pole, board, rim, this.net);
    this.group.position.copy(position);
    this.group.name = "BasketHoop";
  }

  update(dt: number): void {
    if (this.swooshTime <= 0) {
      this.net.rotation.x = 0;
      this.net.rotation.z = 0;
      this.net.scale.set(1, 1, 1);
      return;
    }

    this.swooshTime = Math.max(0, this.swooshTime - dt);
    const t = 1 - this.swooshTime / NET_SWOOSH_DURATION;
    const envelope = 1 - t;

    this.net.rotation.x = Math.sin(t * Math.PI * 5) * 0.12 * envelope;
    this.net.rotation.z = Math.sin(t * Math.PI * 7) * 0.08 * envelope;
    this.net.scale.set(
      1 + 0.1 * envelope,
      1 - 0.18 * envelope,
      1 + 0.1 * envelope,
    );
  }

  triggerNetSwoosh(): void {
    this.swooshTime = NET_SWOOSH_DURATION;
  }

  getRimCenter(out: THREE.Vector3): THREE.Vector3 {
    out.copy(this.rimCenterLocal).add(this.group.position);
    return out;
  }

  getScoreRadius(ballRadius: number): number {
    return Math.max(0.1, RIM_RADIUS - ballRadius * 0.55);
  }

  /** Pushes player out of hoop solids (pole, backboard, rim). */
  resolvePlayerCollision(position: THREE.Vector3, playerRadius: number): boolean {
    let collided = false;

    // Pole
    const dx = position.x - this.group.position.x;
    const dz = position.z - this.group.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const minDist = POLE_RADIUS + playerRadius;
    if (dist < minDist) {
      if (dist < 1e-6) {
        position.x += minDist;
      } else {
        const push = minDist - dist;
        position.x += (dx / dist) * push;
        position.z += (dz / dist) * push;
      }
      collided = true;
    }

    // Backboard (thin AABB)
    this.boardCenterWorld.copy(this.backboardCenterLocal).add(this.group.position);
    const relX = position.x - this.boardCenterWorld.x;
    const relY = position.y - this.boardCenterWorld.y;
    const relZ = position.z - this.boardCenterWorld.z;
    const halfX = this.backboardSize.x * 0.5 + playerRadius;
    const halfY = this.backboardSize.y * 0.5 + playerRadius;
    const halfZ = this.backboardSize.z * 0.5 + playerRadius;
    if (Math.abs(relX) < halfX && Math.abs(relY) < halfY && Math.abs(relZ) < halfZ) {
      const px = halfX - Math.abs(relX);
      const pz = halfZ - Math.abs(relZ);
      if (px < pz) {
        position.x += relX >= 0 ? px : -px;
      } else {
        position.z += relZ >= 0 ? pz : -pz;
      }
      collided = true;
    }

    // Rim ring (torus tube)
    this.getRimCenter(this.rimCenterWorld);
    const rx = position.x - this.rimCenterWorld.x;
    const ry = position.y - this.rimCenterWorld.y;
    const rz = position.z - this.rimCenterWorld.z;
    const radial = Math.sqrt(rx * rx + rz * rz);
    if (radial > 1e-6) {
      const ringX = this.rimCenterWorld.x + (rx / radial) * RIM_RADIUS;
      const ringZ = this.rimCenterWorld.z + (rz / radial) * RIM_RADIUS;
      const tx = position.x - ringX;
      const tz = position.z - ringZ;
      const tubeDist = Math.sqrt(tx * tx + ry * ry + tz * tz);
      const minTubeDist = RIM_TUBE_RADIUS + playerRadius;
      if (tubeDist < minTubeDist) {
        const nx = tubeDist > 1e-6 ? tx / tubeDist : 1;
        const ny = tubeDist > 1e-6 ? ry / tubeDist : 0;
        const nz = tubeDist > 1e-6 ? tz / tubeDist : 0;
        const push = minTubeDist - tubeDist;
        position.x += nx * push;
        position.y += ny * push;
        position.z += nz * push;
        collided = true;
      }
    }

    return collided;
  }

  /** Prevents the ball from passing through the pole; reflects horizontal velocity. */
  resolvePoleCollision(
    currentPosition: THREE.Vector3,
    velocity: THREE.Vector3,
    ballRadius: number,
  ): boolean {
    const minY = this.group.position.y;
    const maxY = this.group.position.y + POST_HEIGHT;
    if (currentPosition.y + ballRadius < minY || currentPosition.y - ballRadius > maxY) {
      return false;
    }

    const dx = currentPosition.x - this.group.position.x;
    const dz = currentPosition.z - this.group.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const minDist = POLE_RADIUS + ballRadius;
    if (dist >= minDist) return false;

    if (dist < 1e-6) {
      currentPosition.x += minDist;
      velocity.x = Math.abs(velocity.x) * 0.5;
      velocity.z *= 0.7;
      return true;
    }

    const nx = dx / dist;
    const nz = dz / dist;
    const push = minDist - dist;
    currentPosition.x += nx * push;
    currentPosition.z += nz * push;

    const vn = velocity.x * nx + velocity.z * nz;
    if (vn < 0) {
      velocity.x -= vn * nx * 1.6;
      velocity.z -= vn * nz * 1.6;
      velocity.x *= 0.82;
      velocity.z *= 0.82;
    }

    return true;
  }

  /** Ball collision against the rim torus tube. */
  resolveRimCollision(
    currentPosition: THREE.Vector3,
    velocity: THREE.Vector3,
    ballRadius: number,
  ): boolean {
    this.getRimCenter(this.rimCenterWorld);

    const rx = currentPosition.x - this.rimCenterWorld.x;
    const ry = currentPosition.y - this.rimCenterWorld.y;
    const rz = currentPosition.z - this.rimCenterWorld.z;
    const radial = Math.sqrt(rx * rx + rz * rz);
    if (radial < 1e-6) return false;

    const ringX = this.rimCenterWorld.x + (rx / radial) * RIM_RADIUS;
    const ringZ = this.rimCenterWorld.z + (rz / radial) * RIM_RADIUS;
    const tx = currentPosition.x - ringX;
    const tz = currentPosition.z - ringZ;

    const tubeDist = Math.sqrt(tx * tx + ry * ry + tz * tz);
    const minTubeDist = RIM_TUBE_RADIUS + ballRadius;
    if (tubeDist >= minTubeDist) return false;

    const nx = tubeDist > 1e-6 ? tx / tubeDist : 1;
    const ny = tubeDist > 1e-6 ? ry / tubeDist : 0;
    const nz = tubeDist > 1e-6 ? tz / tubeDist : 0;
    const push = minTubeDist - tubeDist;

    currentPosition.x += nx * push;
    currentPosition.y += ny * push;
    currentPosition.z += nz * push;

    const vn = velocity.x * nx + velocity.y * ny + velocity.z * nz;
    if (vn < 0) {
      velocity.x -= vn * nx * 1.7;
      velocity.y -= vn * ny * 1.7;
      velocity.z -= vn * nz * 1.7;
      velocity.multiplyScalar(0.84);
    }

    return true;
  }

  /**
   * Prevents the ball from passing through the backboard by pushing it
   * back to the front face and reflecting Z velocity.
   */
  resolveBackboardCollision(
    previousPosition: THREE.Vector3,
    currentPosition: THREE.Vector3,
    velocity: THREE.Vector3,
    ballRadius: number,
  ): boolean {
    if (velocity.z >= 0) {
      return false;
    }

    this.boardCenterWorld.copy(this.backboardCenterLocal).add(this.group.position);

    const halfX = this.backboardSize.x * 0.5;
    const halfY = this.backboardSize.y * 0.5;
    const boardFrontZ = this.boardCenterWorld.z + this.backboardSize.z * 0.5;

    const overlapsX = Math.abs(currentPosition.x - this.boardCenterWorld.x) <= halfX + ballRadius;
    const overlapsY = Math.abs(currentPosition.y - this.boardCenterWorld.y) <= halfY + ballRadius;

    const crossedFrontFace =
      previousPosition.z - ballRadius >= boardFrontZ &&
      currentPosition.z - ballRadius <= boardFrontZ;

    if (!overlapsX || !overlapsY || !crossedFrontFace) {
      return false;
    }

    currentPosition.z = boardFrontZ + ballRadius + 0.002;
    velocity.z = Math.abs(velocity.z) * 0.35;
    velocity.x *= 0.92;
    velocity.y *= 0.95;
    return true;
  }

  /**
   * Scoring check: ball crosses downward through rim plane and is inside rim radius.
   */
  checkScored(
    previousPosition: THREE.Vector3,
    currentPosition: THREE.Vector3,
    ballRadius: number,
  ): boolean {
    this.getRimCenter(this.rimCenterWorld);

    const rimY = this.rimCenterWorld.y;
    const movingDown = currentPosition.y < previousPosition.y;
    if (!movingDown || previousPosition.y < rimY || currentPosition.y > rimY) {
      return false;
    }

    const dy = previousPosition.y - currentPosition.y;
    if (Math.abs(dy) < 1e-6) {
      return false;
    }

    const t = (previousPosition.y - rimY) / dy;
    if (t < 0 || t > 1) {
      return false;
    }

    const crossX = THREE.MathUtils.lerp(previousPosition.x, currentPosition.x, t);
    const crossZ = THREE.MathUtils.lerp(previousPosition.z, currentPosition.z, t);

    const dx = crossX - this.rimCenterWorld.x;
    const dz = crossZ - this.rimCenterWorld.z;
    const scoreRadius = this.getScoreRadius(ballRadius);

    return dx * dx + dz * dz <= scoreRadius * scoreRadius;
  }
}
