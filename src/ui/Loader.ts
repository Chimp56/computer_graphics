/**
 * Loading-screen controller.
 *
 * Uses a Canvas 2D tropical side-view sunrise scene with animated water,
 * island silhouette, and multiple palm trees.
 */

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

  private rafId = 0;
  private loadStartMs = performance.now();
  private lastAnnouncedDecile = -1;
  private isReady = false;
  private hasStarted = false;

  constructor() {
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
    this.draw((performance.now() - this.loadStartMs) * 0.001);
  };

  private draw(t: number): void {
    const c = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const horizonY = H * 0.6;

    c.clearRect(0, 0, W, H);

    this.drawSky(c, W, H, horizonY);
    this.drawSun(c, W, H, horizonY, t);
    this.drawClouds(c, W, H);
    this.drawOcean(c, W, H, horizonY, t);
    this.drawIsland(c, W, H, horizonY, t);
    this.drawPalmCluster(c, W, H, horizonY, t);
    this.drawBirds(c, W, H, t);
    this.drawFishShadows(c, W, H, horizonY, t);
  }

  private drawSky(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    horizonY: number,
  ): void {
    const sky = c.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, "#96d9e8");
    sky.addColorStop(1, "#87cedf");
    c.fillStyle = sky;
    c.fillRect(0, 0, width, horizonY);
  }

  private drawSun(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    horizonY: number,
    t: number,
  ): void {
    const rise = 0.5 + Math.sin(t * 0.16 - 1.1) * 0.5;
    const sunX = width * 0.62;
    const sunY = horizonY + height * 0.08 - rise * height * 0.26;
    const sunR = height * 0.055;

    const glow = c.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3);
    glow.addColorStop(0, "rgba(255, 244, 178, 0.5)");
    glow.addColorStop(1, "rgba(255, 244, 178, 0)");
    c.fillStyle = glow;
    c.beginPath();
    c.arc(sunX, sunY, sunR * 3, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = "#fff0b5";
    c.beginPath();
    c.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    c.fill();
  }

  private drawClouds(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    const cloudSets = [
      { x: width * 0.11, y: height * 0.47, scale: 1.6 },
      { x: width * 0.88, y: height * 0.46, scale: 1.5 },
    ];

    c.fillStyle = "rgba(204, 231, 238, 0.8)";
    for (const cloud of cloudSets) {
      this.drawCloud(c, cloud.x, cloud.y, height * 0.06 * cloud.scale);
    }
  }

  private drawCloud(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    c.beginPath();
    c.arc(x - r * 1.4, y, r * 0.78, 0, Math.PI * 2);
    c.arc(x - r * 0.4, y - r * 0.25, r, 0, Math.PI * 2);
    c.arc(x + r * 0.9, y, r * 0.84, 0, Math.PI * 2);
    c.fill();
  }

  private drawOcean(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    horizonY: number,
    t: number,
  ): void {
    const ocean = c.createLinearGradient(0, horizonY, 0, height);
    ocean.addColorStop(0, "#79bbd6");
    ocean.addColorStop(1, "#68acce");
    c.fillStyle = ocean;
    c.fillRect(0, horizonY, width, height - horizonY);

    c.strokeStyle = "rgba(130, 191, 217, 0.5)";
    c.lineWidth = Math.max(1, height * 0.006);
    for (let row = 0; row < 4; row++) {
      const y = horizonY + height * (0.12 + row * 0.09);
      c.beginPath();
      let first = true;
      for (let x = width * 0.08; x <= width * 0.92; x += 8) {
        const wave = Math.sin(x * 0.015 + t * 1.15 + row) * height * 0.0035;
        if (first) {
          c.moveTo(x, y + wave);
          first = false;
        } else {
          c.lineTo(x, y + wave);
        }
      }
      c.stroke();
    }
  }

  private drawIsland(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    horizonY: number,
    t: number,
  ): void {
    const islandCenterX = width * 0.5;
    const sandY = horizonY + height * 0.075;
    const sandW = width * 0.22;
    const sandH = height * 0.055;

    c.fillStyle = "#efe5b7";
    c.beginPath();
    c.ellipse(islandCenterX, sandY, sandW, sandH, 0, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = "#7db95f";
    c.beginPath();
    const ridgeY = sandY - sandH * 0.63;
    const startX = islandCenterX - sandW * 0.95;
    const endX = islandCenterX + sandW * 0.95;
    c.moveTo(startX, sandY - sandH * 0.22);
    for (let i = 0; i <= 26; i++) {
      const p = i / 26;
      const x = startX + (endX - startX) * p;
      const peak = ridgeY - Math.sin(p * Math.PI) * sandH * 0.58;
      const blade = peak - (Math.sin(i * 1.7 + t * 0.3) * 0.5 + 0.5) * sandH * 0.35;
      c.lineTo(x, blade);
    }
    c.lineTo(endX, sandY - sandH * 0.22);
    c.lineTo(startX, sandY - sandH * 0.22);
    c.closePath();
    c.fill();
  }

  private drawPalmCluster(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    horizonY: number,
    t: number,
  ): void {
    const baseY = horizonY + height * 0.05;
    const palms = [
      { x: width * 0.43, h: height * 0.12, lean: -0.03, s: 0.88 },
      { x: width * 0.47, h: height * 0.165, lean: -0.045, s: 1 },
      { x: width * 0.5, h: height * 0.14, lean: -0.02, s: 0.92 },
      { x: width * 0.54, h: height * 0.163, lean: -0.028, s: 1 },
      { x: width * 0.58, h: height * 0.12, lean: -0.035, s: 0.88 },
    ];

    for (let i = 0; i < palms.length; i++) {
      const palm = palms[i];
      const sway = Math.sin(t * 1.3 + i * 0.85) * height * 0.004;
      this.drawPalmTree(
        c,
        palm.x,
        baseY + Math.sin(i) * height * 0.004,
        palm.h,
        palm.lean * height + sway,
        palm.s,
      );
    }
  }

  private drawPalmTree(
    c: CanvasRenderingContext2D,
    baseX: number,
    baseY: number,
    height: number,
    sway: number,
    scale: number,
  ): void {
    const trunkTopX = baseX + sway;
    const trunkTopY = baseY - height;

    c.strokeStyle = "#9f8f79";
    c.lineWidth = Math.max(1.5, 4 * scale);
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(baseX, baseY);
    c.quadraticCurveTo(baseX + sway * 0.6, baseY - height * 0.45, trunkTopX, trunkTopY);
    c.stroke();

    c.strokeStyle = "rgba(157, 142, 124, 0.55)";
    c.lineWidth = Math.max(1, 1.2 * scale);
    for (let i = 1; i <= 6; i++) {
      const p = i / 7;
      const x = baseX + sway * 0.6 * p;
      const y = baseY - height * p;
      c.beginPath();
      c.moveTo(x - 2 * scale, y);
      c.lineTo(x + 2 * scale, y);
      c.stroke();
    }

    const leafColors = ["#7dad5f", "#87b969", "#79aa5a"];
    c.lineWidth = Math.max(1.5, 3.4 * scale);
    for (let i = 0; i < 6; i++) {
      const angle = -Math.PI * 0.82 + i * 0.34;
      const length = height * (0.32 + (i % 2) * 0.07);
      const endX = trunkTopX + Math.cos(angle) * length;
      const endY = trunkTopY + Math.sin(angle) * length * 0.62;
      c.strokeStyle = leafColors[i % leafColors.length];
      c.beginPath();
      c.moveTo(trunkTopX, trunkTopY);
      c.quadraticCurveTo(
        trunkTopX + Math.cos(angle) * length * 0.52,
        trunkTopY + Math.sin(angle) * length * 0.3,
        endX,
        endY,
      );
      c.stroke();
    }
  }

  private drawBirds(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    t: number,
  ): void {
    const birds = [
      { x: width * 0.77, y: height * 0.21, s: 1 },
      { x: width * 0.81, y: height * 0.17, s: 1.15 },
      { x: width * 0.86, y: height * 0.2, s: 1.07 },
    ];
    c.strokeStyle = "rgba(241, 247, 249, 0.8)";
    c.lineWidth = Math.max(1, height * 0.003);
    for (let i = 0; i < birds.length; i++) {
      const bird = birds[i];
      const wing = width * 0.02 * bird.s;
      const bob = Math.sin(t * 1.4 + i * 0.6) * height * 0.002;
      c.beginPath();
      c.moveTo(bird.x - wing, bird.y + bob);
      c.quadraticCurveTo(bird.x, bird.y - wing * 0.22 + bob, bird.x + wing, bird.y + bob);
      c.stroke();
    }
  }

  private drawFishShadows(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    horizonY: number,
    t: number,
  ): void {
    const fish = [
      { x: width * 0.09, y: horizonY + height * 0.09, w: width * 0.03 },
      { x: width * 0.13, y: horizonY + height * 0.075, w: width * 0.038 },
    ];
    c.fillStyle = "rgba(90, 140, 162, 0.45)";
    for (let i = 0; i < fish.length; i++) {
      const f = fish[i];
      const bob = Math.sin(t * 1.1 + i) * height * 0.0025;
      c.beginPath();
      c.ellipse(f.x, f.y + bob, f.w, height * 0.008, -0.12, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(f.x - f.w, f.y + bob);
      c.lineTo(f.x - f.w - f.w * 0.45, f.y + bob - height * 0.004);
      c.lineTo(f.x - f.w - f.w * 0.45, f.y + bob + height * 0.004);
      c.closePath();
      c.fill();
    }
  }

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
