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
  private wasInWaterOrOOB = false;

  /** Visualisation helpers — added to scene when debug mode is on. */
  readonly debugMeshes: THREE.Object3D[] = [];

  constructor(
    _startCenter: THREE.Vector3,
    _finishCenter: THREE.Vector3,
    private readonly bus: EventBus<GameEvents>,
    private readonly debug = false,
  ) {
    if (this.debug) {
      this.debugMeshes.push(
        makeWireframe(OOB_BOUNDS, 0xff0000),
      );
    }
  }

  /**
   * Call once per fixed-timestep tick, after collision resolution.
   * Handles respawn hazards only; run start/win are driven by portal/win logic.
   */
  update(position: THREE.Vector3, _gameState: string): void {
    const inWaterOrOOB =
      position.y < WATER_Y || !OOB_BOUNDS.containsPoint(position);

    if (inWaterOrOOB && !this.wasInWaterOrOOB) {
      this.bus.emit("respawn", undefined);
    }
    this.wasInWaterOrOOB = inWaterOrOOB;
  }

  /** Call when the player is teleported so edge-detection resets correctly. */
  reset(): void {
    this.wasInWaterOrOOB = false;
  }
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
