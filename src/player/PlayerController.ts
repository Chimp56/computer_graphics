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

  private flyMode = false;
  private grounded = false;
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

    this.planarForward.copy(this.camera.forward).setY(0).normalize();
    this.planarRight.copy(this.camera.right).setY(0).normalize();
    this.planarMove.set(0, 0, 0);

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

    if (this.planarMove.lengthSq() > 0) {
      this.planarMove.normalize();
      this.position.addScaledVector(this.planarMove, moveSpeed * dt);
    }

    if (this.input.jump && this.grounded) {
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

  teleport(pos: THREE.Vector3): void {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
  }

  get isFlyMode(): boolean {
    return this.flyMode;
  }
}
ort * as THREE from "three";

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

  private flyMode = false;
  private grounded = false;
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

    this.planarForward.copy(this.camera.forward).setY(0).normalize();
    this.planarRight.copy(this.camera.right).setY(0).normalize();
    this.planarMove.set(0, 0, 0);

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

    if (this.planarMove.lengthSq() > 0) {
      this.planarMove.normalize();
      this.position.addScaledVector(this.planarMove, moveSpeed * dt);
    }

    if (this.input.jump && this.grounded) {
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

  get isFlyMode(): boolean {
    return this.flyMode;
  }
}
