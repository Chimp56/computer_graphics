import * as THREE from "three";
import { type EventBus, type GameEvents } from "../core/EventBus";
import { BasketHoop } from "../world/BasketHoop";

type BasketballState = "onGround" | "held" | "flying" | "scoredDrop";

type BasketballUpdateParams = {
  dt: number;
  playerPosition: THREE.Vector3;
  camera: THREE.PerspectiveCamera;
  interactPressed: boolean;
  mouseLeftDown: boolean;
  mouseLeftReleased: boolean;
  terrainHeightAt: (x: number, z: number) => number;
  waterLevel: number;
};

const BALL_RADIUS = 0.32;
const PICKUP_RANGE = 2.2;
const CHARGE_MAX_SECONDS = 2;
const THROW_SPEED_MIN = 10;
const THROW_SPEED_MAX = 24;
const GRAVITY = 24;
const SCORED_DROP_DURATION = 1.2;

/**
 * Basketball interaction:
 * onGround -> held (E), held -> flying (release LMB), flying -> onGround (hit/miss/reset)
 */
export class Basketball {
  readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>;
  readonly trajectoryLine: THREE.Line;

  private readonly spawnPosition = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private readonly holdForward = new THREE.Vector3();
  private readonly holdRight = new THREE.Vector3();
  private readonly throwDirection = new THREE.Vector3();
  private readonly trajectorySimPos = new THREE.Vector3();
  private readonly trajectorySimVel = new THREE.Vector3();
  private readonly previousPosition = new THREE.Vector3();
  private readonly rimCenter = new THREE.Vector3();

  private state: BasketballState = "onGround";
  private chargeTime = 0;
  private scoredThisFlight = false;
  private scoredDropTime = 0;
  private trajectoryPreviewEnabled = false;

  private constructor(
    mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>,
    spawnPosition: THREE.Vector3,
    private readonly hoop: BasketHoop,
    private readonly bus: EventBus<GameEvents>,
    private readonly targetId = "basket-hoop",
  ) {
    this.mesh = mesh;
    this.spawnPosition.copy(spawnPosition);

    this.trajectoryLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffd46b }),
    );
    this.trajectoryLine.visible = false;
    this.trajectoryLine.name = "BasketballTrajectory";
  }

  static async create(params: {
    textureLoader: THREE.TextureLoader;
    textureUrl: string;
    spawnPosition: THREE.Vector3;
    hoop: BasketHoop;
    bus: EventBus<GameEvents>;
    targetId?: string;
  }): Promise<Basketball> {
    const texture = await loadTexture(params.textureLoader, params.textureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshPhongMaterial({
      map: texture,
      shininess: 35,
      specular: new THREE.Color(0x553322),
    });

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 24, 24), material);
    mesh.position.copy(params.spawnPosition);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = "Basketball";

    return new Basketball(
      mesh,
      params.spawnPosition,
      params.hoop,
      params.bus,
      params.targetId,
    );
  }

  update(params: BasketballUpdateParams): void {
    if (this.state === "onGround") {
      this.trajectoryLine.visible = false;

      if (params.interactPressed) {
        const dist = this.mesh.position.distanceTo(params.playerPosition);
        if (dist <= PICKUP_RANGE) {
          this.state = "held";
          this.chargeTime = 0;
          this.velocity.set(0, 0, 0);
        }
      }
      return;
    }

    if (this.state === "held") {
      this.updateHeldTransform(params.playerPosition, params.camera);

      if (params.mouseLeftDown) {
        this.chargeTime = Math.min(CHARGE_MAX_SECONDS, this.chargeTime + params.dt);
      }

      if (this.trajectoryPreviewEnabled) {
        this.updateTrajectoryPreview(
          params.camera,
          params.terrainHeightAt,
          params.waterLevel,
        );
      } else {
        this.trajectoryLine.visible = false;
      }

      if (params.mouseLeftReleased) {
        this.throw(params.camera);
      }
      return;
    }

    this.trajectoryLine.visible = false;

    if (this.state === "scoredDrop") {
      this.scoredDropTime -= params.dt;
      this.hoop.getRimCenter(this.rimCenter);

      this.velocity.y -= GRAVITY * params.dt * 0.4;
      this.mesh.position.x = this.rimCenter.x;
      this.mesh.position.z = this.rimCenter.z;
      this.mesh.position.y += this.velocity.y * params.dt;

      this.mesh.rotation.x += 3.5 * params.dt;

      const ground = params.terrainHeightAt(this.mesh.position.x, this.mesh.position.z);
      if (Number.isFinite(ground) && this.mesh.position.y <= ground + BALL_RADIUS * 0.95) {
        this.resetToSpawn();
        return;
      }

      if (this.scoredDropTime <= 0 || this.mesh.position.y < params.waterLevel - 1) {
        this.resetToSpawn();
      }
      return;
    }

    // Flying
    this.previousPosition.copy(this.mesh.position);

    this.velocity.y -= GRAVITY * params.dt;
    this.mesh.position.addScaledVector(this.velocity, params.dt);

    this.hoop.resolveBackboardCollision(
      this.previousPosition,
      this.mesh.position,
      this.velocity,
      BALL_RADIUS,
    );
    this.hoop.resolvePoleCollision(this.mesh.position, this.velocity, BALL_RADIUS);
    this.hoop.resolveRimCollision(this.mesh.position, this.velocity, BALL_RADIUS);

    // Air rotation while flying
    this.mesh.rotation.x += this.velocity.length() * params.dt * 0.08;
    this.mesh.rotation.z += this.velocity.length() * params.dt * 0.04;

    if (
      !this.scoredThisFlight &&
      this.hoop.checkScored(this.previousPosition, this.mesh.position, BALL_RADIUS)
    ) {
      this.scoredThisFlight = true;
      this.bus.emit("targetHit", { targetId: this.targetId });
      this.startScoredDrop();
      return;
    }

    const ground = params.terrainHeightAt(this.mesh.position.x, this.mesh.position.z);
    if (Number.isFinite(ground) && this.mesh.position.y <= ground + BALL_RADIUS * 0.9) {
      this.resetToSpawn();
      return;
    }

    if (!Number.isFinite(ground) || this.mesh.position.y < params.waterLevel - 1) {
      this.resetToSpawn();
    }
  }

  resetToSpawn(): void {
    this.state = "onGround";
    this.chargeTime = 0;
    this.scoredThisFlight = false;
    this.scoredDropTime = 0;
    this.velocity.set(0, 0, 0);
    this.mesh.position.copy(this.spawnPosition);
    this.trajectoryLine.visible = false;
  }

  setTrajectoryPreviewEnabled(enabled: boolean): void {
    this.trajectoryPreviewEnabled = enabled;
    if (!enabled) {
      this.trajectoryLine.visible = false;
    }
  }

  getPrompt(playerPosition: THREE.Vector3): string | null {
    if (this.state === "held") {
      return "Hold LMB to throw • T: trajectory preview";
    }

    if (
      this.state === "onGround" &&
      this.mesh.position.distanceTo(playerPosition) <= PICKUP_RANGE
    ) {
      return "Press E to pick up";
    }

    return null;
  }

  private startScoredDrop(): void {
    this.state = "scoredDrop";
    this.scoredDropTime = SCORED_DROP_DURATION;
    this.chargeTime = 0;

    this.hoop.triggerNetSwoosh();
    this.hoop.getRimCenter(this.rimCenter);
    this.mesh.position.copy(this.rimCenter).addScaledVector(THREE.Object3D.DEFAULT_UP, -0.08);
    this.velocity.set(0, -2.4, 0);
  }

  private updateHeldTransform(
    playerPosition: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
  ): void {
    camera.getWorldDirection(this.holdForward);
    this.holdForward.y = 0;
    if (this.holdForward.lengthSq() < 1e-6) {
      this.holdForward.set(0, 0, -1);
    }
    this.holdForward.normalize();
    this.holdRight.crossVectors(this.holdForward, THREE.Object3D.DEFAULT_UP).normalize();

    this.mesh.position
      .copy(playerPosition)
      .addScaledVector(THREE.Object3D.DEFAULT_UP, 1.05)
      .addScaledVector(this.holdForward, 0.9)
      .addScaledVector(this.holdRight, 0.35);
  }

  private throw(camera: THREE.PerspectiveCamera): void {
    this.getThrowDirection(camera, this.throwDirection);
    const speed = this.getThrowSpeed();

    this.velocity.copy(this.throwDirection).multiplyScalar(speed);
    this.mesh.position.addScaledVector(this.throwDirection, 0.5);

    this.state = "flying";
    this.chargeTime = 0;
    this.scoredThisFlight = false;
    this.trajectoryLine.visible = false;
  }

  private getThrowDirection(camera: THREE.PerspectiveCamera, out: THREE.Vector3): void {
    camera.getWorldDirection(out);
    out.normalize();
  }

  private getThrowSpeed(): number {
    const t = this.chargeTime / CHARGE_MAX_SECONDS;
    return THREE.MathUtils.lerp(THROW_SPEED_MIN, THROW_SPEED_MAX, t);
  }

  private updateTrajectoryPreview(
    camera: THREE.PerspectiveCamera,
    terrainHeightAt: (x: number, z: number) => number,
    waterLevel: number,
  ): void {
    this.getThrowDirection(camera, this.throwDirection);
    this.trajectorySimPos.copy(this.mesh.position).addScaledVector(this.throwDirection, 0.5);
    this.trajectorySimVel.copy(this.throwDirection).multiplyScalar(this.getThrowSpeed());

    const points: THREE.Vector3[] = [this.mesh.position.clone()];
    const step = 1 / 30;

    for (let i = 0; i < 50; i++) {
      this.trajectorySimVel.y -= GRAVITY * step;
      this.trajectorySimPos.addScaledVector(this.trajectorySimVel, step);
      points.push(this.trajectorySimPos.clone());

      const ground = terrainHeightAt(this.trajectorySimPos.x, this.trajectorySimPos.z);
      if (
        (Number.isFinite(ground) && this.trajectorySimPos.y <= ground + BALL_RADIUS * 0.9) ||
        !Number.isFinite(ground) ||
        this.trajectorySimPos.y < waterLevel - 1
      ) {
        break;
      }
    }

    this.trajectoryLine.geometry.setFromPoints(points);
    this.trajectoryLine.visible = true;
  }
}

function loadTexture(
  loader: THREE.TextureLoader,
  url: string,
): Promise<THREE.Texture> {
  return new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(
      url,
      (texture) => resolve(texture),
      undefined,
      () => reject(new Error(`Failed to load texture: ${url}`)),
    );
  });
}
