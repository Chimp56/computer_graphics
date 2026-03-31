/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Minimal typed event emitter.
 *
 * Usage:
 *   const bus = new EventBus<GameEvents>();
 *   bus.on("respawn", () => { ... });
 *   bus.emit("respawn", undefined);
 */
export class EventBus<EventMap extends Record<string, any>> {
  private listeners = new Map<keyof EventMap, Set<(data: any) => void>>();

  on<K extends keyof EventMap>(event: K, cb: (data: EventMap[K]) => void): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(cb);
  }

  off<K extends keyof EventMap>(event: K, cb: (data: EventMap[K]) => void): void {
    this.listeners.get(event)?.delete(cb);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }
}

/** All gameplay events. Expanded in later phases. */
export type GameEvents = {
  runStarted: undefined;
  runWon: { time: number };
  respawn: undefined;
  leverFlipped: { leverId: string };
  buttonPressed: { buttonId: string };
  targetHit: { targetId: string };
};
