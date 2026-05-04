import * as THREE from "three";
import { EventBus, type GameEvents } from "../core/EventBus";

/**
 * World-space bounds for the playable area.
 * Players outside this box trigger a respawn (OOB).
 */
const OOB_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-260, -20, -260),
  new THREE.Vector3(260, 80, 260),
);

/** Y threshold below which a player is considered to have fallen into water. */
const WATER_Y = 0.5;

/**
 * Axis-aligned box volumes for start and finish zones, plus
 * water/OOB threshold checks. All checks are edge-detected so
 * events only fire once per entry.
 */
export class TriggerVolumes {
  private readonly startZone: THREE.Box3;
  private readonly finishZone: THREE.Box3;

  private wasInStart = false;
  private wasInFinish = false;
  private wasInWaterOrOOB = false;

  /** Visualisation helpers — added to scene when debug mode is on. */
  readonly debugMeshes: THREE.Object3D[] = [];

  constructor(
    startCenter: THREE.Vector3,
    finishCenter: THREE.Vector3,
    private readonly bus: EventBus<GameEvents>,
    private readonly debug = false,
  ) {
    this.startZone = boxFromCenter(startCenter, new THREE.Vector3(6, 4, 6));
    this.finishZone = boxFromCenter(finishCenter, new THREE.Vector3(6, 4, 6));

    if (this.debug) {
      this.debugMeshes.push(
        makeWireframe(this.startZone, 0x00ff00),
        makeWireframe(this.finishZone, 0xffff00),
        makeWireframe(OOB_BOUNDS, 0xff0000),
      );
    }
  }

  /**
   * Call once per fixed-timestep tick, after collision resolution.
   * @param position  Current player world-space position.
   * @param gameState Current state — finish zone only fires while running.
   */
  update(position: THREE.Vector3, gameState: string): void {
    const inWaterOrOOB =
      position.y < WATER_Y || !OOB_BOUNDS.containsPoint(position);

    if (inWaterOrOOB && !this.wasInWaterOrOOB) {
      this.bus.emit("respawn", undefined);
    }
    this.wasInWaterOrOOB = inWaterOrOOB;

    // Don't process start/finish while player is out of bounds.
    if (inWaterOrOOB) return;

    const inStart = this.startZone.containsPoint(position);
    if (inStart && !this.wasInStart) {
      this.bus.emit("runStarted", undefined);
    }
    this.wasInStart = inStart;

    const inFinish = this.finishZone.containsPoint(position);
    if (inFinish && !this.wasInFinish && gameState === "running") {
      this.bus.emit("runWon", { time: 0 }); // time value unused; GSM owns elapsed time
    }
    this.wasInFinish = inFinish;
  }

  /** Call when the player is teleported so edge-detection resets correctly. */
  reset(): void {
    this.wasInStart = false;
    this.wasInFinish = false;
    this.wasInWaterOrOOB = false;
  }
}

function boxFromCenter(center: THREE.Vector3, size: THREE.Vector3): THREE.Box3 {
  const half = size.clone().multiplyScalar(0.5);
  return new THREE.Box3(center.clone().sub(half), center.clone().add(half));
}

function makeWireframe(box: THREE.Box3, color: number): THREE.LineSegments {
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const edges = new THREE.EdgesGeometry(geo);
  geo.dispose();

  const mat = new THREE.LineBasicMaterial({ color });
  const mesh = new THREE.LineSegments(edges, mat);
  mesh.position.copy(center);
  return mesh;
}
