import * as THREE from "three";
import { EventBus, type GameEvents } from "../core/EventBus";
import { RunContext } from "./RunContext";

export type GameState = "idle" | "running" | "won" | "respawning";

/** How long the respawning state lasts before returning to idle (seconds). */
const RESPAWN_DURATION = 0.8;

/**
 * Drives the idle → running → won → respawning state machine.
 *
 * - Timer only ticks in the "running" state.
 * - restart() resets the run without re-triggering the loader.
 * - Respawn fires a brief "respawning" state then snaps player to checkpoint.
 */
export class GameStateManager {
  private state: GameState = "idle";
  private respawnTimer = 0;

  readonly context: RunContext;

  /** Called when a respawn should move the player. Set this from main.ts. */
  onRespawn: ((position: THREE.Vector3) => void) | null = null;

  /** Called when the run is won. Receives final formatted time. */
  onWin: ((formattedTime: string) => void) | null = null;

  constructor(
    checkpointPosition: THREE.Vector3,
    private readonly bus: EventBus<GameEvents>,
  ) {
    this.context = new RunContext(checkpointPosition);
    this.registerEvents();
  }

  getState(): GameState {
    return this.state;
  }

  /** Call once per fixed timestep tick (dt in seconds). */
  update(dt: number): void {
    switch (this.state) {
      case "running":
        this.context.addTime(dt);
        break;

      case "respawning":
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
          this.state = "idle";
          this.onRespawn?.(this.context.checkpoint);
        }
        break;

      case "idle":
      case "won":
        break;
    }
  }

  /** Reset run and return to idle — does not re-trigger the loading screen. */
  restart(): void {
    this.context.reset();
    this.state = "idle";
    this.respawnTimer = 0;
  }

  private registerEvents(): void {
    this.bus.on("runStarted", () => {
      if (this.state === "idle") {
        this.state = "running";
      }
    });

    this.bus.on("runWon", () => {
      if (this.state === "running") {
        this.state = "won";
        this.onWin?.(this.context.formattedTime());
      }
    });

    this.bus.on("respawn", () => {
      if (this.state === "running" || this.state === "idle") {
        this.context.reset();
        this.state = "respawning";
        this.respawnTimer = RESPAWN_DURATION;
      }
    });

    this.bus.on("leverFlipped", () => {
      this.context.setFlag("leverFlipped");
    });

    this.bus.on("buttonPressed", () => {
      this.context.setFlag("buttonPressed");
    });

    this.bus.on("targetHit", () => {
      this.context.setFlag("targetHit");
    });
  }
}
