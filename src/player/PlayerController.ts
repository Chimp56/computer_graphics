import * as THREE from "three";

export type PlayerInputState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  descend: boolean;
};

export type CameraBasis = {
  forward: THREE.Vector3;
  right: THREE.Vector3;
};

export class PlayerController {
  readonly position = new THREE.Vector3();

  private readonly velocity = new THREE.Vector3();
  private readonly planarForward = new THREE.Vector3();
  private readonly planarRight = new THREE.Vector3();
  private readonly planarMove = new THREE.Vector3();
  private readonly horizVel = new THREE.Vector3();

  private flyMode = false;
  private grounded = false;
  /** 0 = full grip (snappy), 1 = ice (long inertia, slow stop). */
  private slippery = 0;
  /** Constant world-space horizontal acceleration applied while slippery (e.g. water pressure). */
  private readonly externalAccel = new THREE.Vector3();
  /** Time remaining where input is ignored and player rides slideVel. */
  private stuckTimer = 0;
  /** Horizontal velocity applied while stuckTimer > 0. */
  private readonly slideVel = new THREE.Vector3();
  private cleanupDevToggle?: () => void;

  constructor(
    private readonly input: PlayerInputState,
    private readonly camera: CameraBasis,
  ) {}

  init(): void {
    if (import.meta.env.DEV) {
      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "f" || event.key === "F") {
          this.flyMode = !this.flyMode;
          if (this.flyMode) {
            this.velocity.set(0, 0, 0);
            this.grounded = false;
          }
        }
      };

      window.addEventListener("keydown", onKeyDown);
      this.cleanupDevToggle = () => {
        window.removeEventListener("keydown", onKeyDown);
      };
    }
  }

  dispose(): void {
    this.cleanupDevToggle?.();
    this.cleanupDevToggle = undefined;
  }

  update(dt: number, groundHeight?: number): void {
    if (this.flyMode) {
      const speed = 20;
      const step = speed * dt;

      this.planarForward.copy(this.camera.forward).normalize();
      this.planarRight.copy(this.camera.right).normalize();

      if (this.input.forward) {
        this.position.addScaledVector(this.planarForward, step);
      }
      if (this.input.backward) {
        this.position.addScaledVector(this.planarForward, -step);
      }
      if (this.input.left) {
        this.position.addScaledVector(this.planarRight, -step);
      }
      if (this.input.right) {
        this.position.addScaledVector(this.planarRight, step);
      }
      if (this.input.jump) {
        this.position.y += step;
      }
      if (this.input.descend) {
        this.position.y -= step;
      }

      return;
    }

    const moveSpeed = 8;
    const gravity = 25;
    const jumpImpulse = 10;

    const isStuck = this.stuckTimer > 0;
    if (isStuck) this.stuckTimer = Math.max(0, this.stuckTimer - dt);

    this.planarForward.copy(this.camera.forward).setY(0).normalize();
    this.planarRight.copy(this.camera.right).setY(0).normalize();
    this.planarMove.set(0, 0, 0);

    if (!isStuck) {
      if (this.input.forward) {
        this.planarMove.add(this.planarForward);
      }
      if (this.input.backward) {
        this.planarMove.sub(this.planarForward);
      }
      if (this.input.left) {
        this.planarMove.sub(this.planarRight);
      }
      if (this.input.right) {
        this.planarMove.add(this.planarRight);
      }
    }

    if (isStuck) {
      this.horizVel.copy(this.slideVel);
      this.position.x += this.horizVel.x * dt;
      this.position.z += this.horizVel.z * dt;
    } else if (this.slippery > 0) {
      const desiredSpeed = this.planarMove.lengthSq() > 0 ? moveSpeed : 0;
      if (desiredSpeed > 0) this.planarMove.normalize();
      const desiredVel = this.planarMove.clone().multiplyScalar(desiredSpeed);
      const accel = (1 - this.slippery) * 14 + 0.6;
      const k = 1 - Math.exp(-accel * dt);
      this.horizVel.lerp(desiredVel, k);
      this.horizVel.x += this.externalAccel.x * dt;
      this.horizVel.z += this.externalAccel.z * dt;
      this.position.x += this.horizVel.x * dt;
      this.position.z += this.horizVel.z * dt;
    } else {
      this.horizVel.set(0, 0, 0);
      if (this.planarMove.lengthSq() > 0) {
        this.planarMove.normalize();
        this.position.addScaledVector(this.planarMove, moveSpeed * dt);
      }
    }

    if (!isStuck && this.input.jump && this.grounded) {
      this.velocity.y = jumpImpulse;
      this.grounded = false;
    }

    this.velocity.y -= gravity * dt;
    this.position.y += this.velocity.y * dt;

    if (groundHeight !== undefined && this.position.y <= groundHeight) {
      this.position.y = groundHeight;
      this.velocity.y = 0;
      this.grounded = true;
    }
  }

  applyImpulse(impulse: THREE.Vector3): void {
    this.velocity.add(impulse);
    this.grounded = false;
  }

  /**
   * Hard launch — overwrites horizontal momentum and the vertical velocity so
   * the hit reads as a single decisive shove. Only meaningful while the player
   * has a non-zero slippery factor (otherwise horizontal motion is driven
   * purely by input each frame).
   */
  applyKnockback(impulse: THREE.Vector3): void {
    this.horizVel.set(impulse.x, 0, impulse.z);
    this.velocity.y = impulse.y;
    this.grounded = false;
  }

  teleport(pos: THREE.Vector3): void {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.horizVel.set(0, 0, 0);
    this.slideVel.set(0, 0, 0);
    this.stuckTimer = 0;
    this.grounded = false;
  }

  /**
   * 0 = full grip (default snap-to-direction). 1 = pure ice — input nudges a
   * persistent horizontal velocity that decays slowly. Anything in between
   * scales the response.
   */
  setSlipperyFactor(value: number): void {
    this.slippery = Math.max(0, Math.min(1, value));
    if (this.slippery === 0) this.horizVel.set(0, 0, 0);
  }

  /** Continuous horizontal acceleration (m/s²). Only takes effect while slippery > 0. */
  setExternalAccel(accel: THREE.Vector3): void {
    this.externalAccel.copy(accel);
  }

  /**
   * Lock input for `durationSeconds` and pin horizontal velocity to `slideVel`
   * each frame. Y still uses gravity, so the player can land/fall normally
   * while being washed along.
   */
  setStuck(durationSeconds: number, slideVel: THREE.Vector3): void {
    this.stuckTimer = Math.max(this.stuckTimer, durationSeconds);
    this.slideVel.copy(slideVel);
    this.horizVel.copy(slideVel);
  }

  isStuck(): boolean {
    return this.stuckTimer > 0;
  }

  get isFlyMode(): boolean {
    return this.flyMode;
  }

  get isGrounded(): boolean {
  return this.grounded;
}
}
