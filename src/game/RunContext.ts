import * as THREE from "three";

/** Interactions that must all be completed before the finish bell can be rung. */
export type InteractionFlag =
  | "leverFlipped"
  | "buttonPressed"
  | "targetHit";

const REQUIRED_FLAGS: ReadonlyArray<InteractionFlag> = [
  "leverFlipped",
  "buttonPressed",
  "targetHit",
];

/**
 * Single authoritative state object for one run.
 *
 * Holds elapsed time, the respawn checkpoint, and which required
 * interactions have been completed. Only GameStateManager should
 * mutate this object.
 */
export class RunContext {
  /** Seconds elapsed since the run started. Only advances while running. */
  elapsedTime = 0;

  /** World-space position the player teleports to on respawn. */
  readonly checkpoint = new THREE.Vector3();

  private readonly flags = new Map<InteractionFlag, boolean>();

  constructor(checkpointPosition: THREE.Vector3) {
    this.checkpoint.copy(checkpointPosition);
    this.resetFlags();
  }

  /** Advance the run timer by dt seconds. */
  addTime(dt: number): void {
    this.elapsedTime += dt;
  }

  /** Mark a required interaction as completed. */
  setFlag(flag: InteractionFlag): void {
    this.flags.set(flag, true);
  }

  /** Returns true when every required interaction has been completed. */
  allRequired(): boolean {
    return REQUIRED_FLAGS.every((f) => this.flags.get(f) === true);
  }

  /** Reset to initial state for a new run (checkpoint position is preserved). */
  reset(): void {
    this.elapsedTime = 0;
    this.resetFlags();
  }

  /** Returns the elapsed time formatted as MM:SS.mm */
  formattedTime(): string {
    const total = this.elapsedTime;
    const minutes = Math.floor(total / 60);
    const seconds = Math.floor(total % 60);
    const millis = Math.floor((total % 1) * 100);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(2, "0")}`;
  }

  private resetFlags(): void {
    for (const flag of REQUIRED_FLAGS) {
      this.flags.set(flag, false);
    }
  }
}
