import { Clock as ThreeClock } from "three";

const FIXED_DT = 1 / 60;
const MAX_FRAME = 0.1; // clamp to prevent spiral of death

/**
 * Fixed-timestep game clock.
 *
 * Call `tick(cb)` once per requestAnimationFrame. The callback fires
 * zero or more times with a constant dt of 1/60 s, ensuring deterministic
 * physics regardless of frame rate.
 */
export class GameClock {
  private readonly clock = new ThreeClock();
  private accumulator = 0;

  /** Run physics callback with fixed timestep. Returns number of ticks executed. */
  tick(callback: (dt: number) => void): number {
    const frameDelta = Math.min(this.clock.getDelta(), MAX_FRAME);
    this.accumulator += frameDelta;

    let ticks = 0;
    while (this.accumulator >= FIXED_DT) {
      callback(FIXED_DT);
      this.accumulator -= FIXED_DT;
      ticks++;
    }
    return ticks;
  }

  /** Fractional remainder for optional render interpolation (0–1). */
  get alpha(): number {
    return this.accumulator / FIXED_DT;
  }
}
