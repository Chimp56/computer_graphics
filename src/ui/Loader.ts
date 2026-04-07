import type { LoaderScene } from "./loader/LoaderScene";
import { TropicalIslandScene } from "./loader/TropicalIslandScene";

const MIN_DISPLAY_MS = 1500;

export class Loader {
  private readonly overlay: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly statusText: HTMLElement;
  private readonly progressGroup: HTMLElement;
  private readonly progressFill: HTMLElement;
  private readonly progressText: HTMLElement;
  private readonly errorText: HTMLElement;
  private readonly retryBtn: HTMLButtonElement;
  private readonly live: HTMLElement;
  private readonly scene: LoaderScene;

  private rafId = 0;
  private loadStartMs = performance.now();
  private lastAnnouncedDecile = -1;
  private isReady = false;
  private hasStarted = false;

  constructor(scene: LoaderScene = new TropicalIslandScene()) {
    this.overlay = this.el("loader-overlay");
    this.canvas = this.el("loader-canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.statusText = this.el("loader-status-text");
    this.progressGroup = this.el("loader-progress-group");
    this.progressFill = this.el("loader-progress-fill");
    this.progressText = this.el("loader-progress-text");
    this.errorText = this.el("loader-error-text");
    this.retryBtn = this.el("loader-retry-btn") as HTMLButtonElement;
    this.live = this.el("loader-live");
    this.scene = scene;

    this.syncSize();
    window.addEventListener("resize", this.syncSize);
    this.tick();
  }

  setProgress(value: number): void {
    const pct = Math.round(clamp01(value) * 100);
    this.progressFill.style.width = `${pct}%`;
    this.progressText.textContent = `${pct} %`;

    const decile = Math.floor(pct / 10);
    if (decile !== this.lastAnnouncedDecile) {
      this.lastAnnouncedDecile = decile;
      this.announce(`Loading: ${pct} percent`);
    }
  }

  async showReady(): Promise<void> {
    const remaining = MIN_DISPLAY_MS - (performance.now() - this.loadStartMs);
    if (remaining > 0) {
      await sleep(remaining);
    }

    this.isReady = true;
    this.hasStarted = false;
    this.statusText.textContent = "Click anywhere to start";
    this.statusText.classList.add("ready");
    this.progressGroup.classList.add("hidden");
    this.overlay.classList.add("is-ready");
    this.announce("Loading complete. Click anywhere to start.");
  }

  showError(message: string): void {
    this.isReady = false;
    this.hasStarted = false;
    this.overlay.classList.remove("is-ready");
    this.statusText.classList.remove("ready");
    this.statusText.classList.add("hidden");
    this.progressGroup.classList.add("hidden");
    this.errorText.textContent = message;
    this.errorText.classList.remove("hidden");
    this.retryBtn.classList.remove("hidden");
    this.retryBtn.focus();
    this.announce(`Error: ${message}`);
  }

  resetToLoading(): void {
    this.loadStartMs = performance.now();
    this.lastAnnouncedDecile = -1;
    this.isReady = false;
    this.hasStarted = false;
    this.overlay.classList.remove("is-ready");
    this.errorText.classList.add("hidden");
    this.retryBtn.classList.add("hidden");
    this.statusText.textContent = "Loading assets...";
    this.statusText.classList.remove("hidden");
    this.statusText.classList.remove("ready");
    this.progressGroup.classList.remove("hidden");
    this.progressFill.style.width = "0%";
    this.progressText.textContent = "0 %";
    this.announce("Retrying. Loading assets.");
  }

  onRetry(fn: () => void): void {
    this.retryBtn.addEventListener("click", () => {
      this.resetToLoading();
      fn();
    });
  }

  onStart(fn: () => void): void {
    const start = (event: Event): void => {
      if (!this.isReady || this.hasStarted) {
        return;
      }

      const target = event.target as Node | null;
      if (target && this.retryBtn.contains(target)) {
        return;
      }

      this.hasStarted = true;
      fn();
      this.hide();
    };

    this.overlay.addEventListener("click", start);
    this.overlay.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        start(event);
      }
    });
  }

  hide(): void {
    cancelAnimationFrame(this.rafId);
    this.overlay.classList.add("is-hidden");
    this.overlay.addEventListener(
      "transitionend",
      () => {
        this.overlay.style.display = "none";
      },
      { once: true },
    );
  }

  private readonly syncSize = (): void => {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  };

  private readonly tick = (): void => {
    this.rafId = requestAnimationFrame(this.tick);
    const timeSeconds = (performance.now() - this.loadStartMs) * 0.001;
    this.scene.draw(this.ctx, this.canvas.width, this.canvas.height, timeSeconds);
  };

  private el(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Loader: #${id} not found`);
    }
    return element;
  }

  private announce(text: string): void {
    this.live.textContent = text;
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
