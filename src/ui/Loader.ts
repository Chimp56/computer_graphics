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
    const horizonY = H * 0.56;

    c.clearRect(0, 0, W, H);

    this.drawSky(c, W, H, horizonY, t);
    this.drawSun(c, W, H, horizonY, t);
    this.drawClouds(c, W, H, t);
    this.drawBackgroundIslands(c, W, H, horizonY, t);
    this.drawOcean(c, W, H, horizonY, t);
    this.drawIsland(c, W, H, horizonY, t);
    this.drawPalmCluster(c, W, H, horizonY, t);
    this.drawShoreFoam(c, W, H, horizonY, t);
    this.drawWaveCrests(c, W, H, horizonY, t);
  }

  private drawSky(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    horizonY: number,
    t: number,
  ): void {
    const dawn = 0.5 + Math.sin(t * 0.22 - 1.1) * 0.5;
    const sky = c.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, lerpColor("#1c2f4d", "#78c1d9", dawn));
    sky.addColorStop(0.55, lerpColor("#f07b57", "#f6bc67", dawn));
    sky.addColorStop(1, lerpColor("#f2a673", "#ffe7b1", dawn));
    c.fillStyle = sky;
    c.fillRect(0, 0, width, horizonY);

    c.fillStyle = "rgba(255, 209, 145, 0.16)";
    c.fillRect(0, horizonY - height * 0.08, width, height * 0.08);
  }

  private drawSun(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    horizonY: number,
    t: number,
  ): void {
    const phase = 0.5 + Math.sin(t * 0.22 - 1.2) * 0.5;
    const sunX = width * (0.16 + phase * 0.3);
    const sunY = horizonY + height * 0.16 - phase * height * 0.52;
    const sunR = height * 0.065;

    const glow = c.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3.4);
    glow.addColorStop(0, "rgba(255, 242, 150, 0.58)");
    glow.addColorStop(1, "rgba(255, 196, 90, 0)");
    c.fillStyle = glow;
    c.beginPath();
    c.arc(sunX, sunY, sunR * 3.4, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = "#ffe08d";
    c.beginPath();
    c.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    c.fill();

    c.globalAlpha = 0.18;
    c.fillStyle = "#ffd593";
    c.fillRect(0, horizonY, width, height * 0.08);
    c.globalAlpha = 1;
  }

  private drawBackgroundIslands(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    horizonY: number,
    t: number,
  ): void {
    c.fillStyle = "rgba(22, 82, 74, 0.38)";
    c.beginPath();
    c.moveTo(width * 0.08, horizonY + height * 0.045);
    c.quadraticCurveTo(
      width * 0.19,
      horizonY - height * 0.02 + Math.sin(t * 0.25) * height * 0.005,
      width * 0.31,
      horizonY + height * 0.045,
    );
    c.lineTo(width * 0.08, horizonY + height * 0.045);
    c.fill();

    c.beginPath();
    c.moveTo(width * 0.68, horizonY + height * 0.05);
    c.quadraticCurveTo(
      width * 0.79,
      horizonY - height * 0.015 + Math.cos(t * 0.23) * height * 0.004,
      width * 0.9,
      horizonY + height * 0.05,
    );
    c.lineTo(width * 0.68, horizonY + height * 0.05);
    c.fill();
  }

  private drawClouds(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    t: number,
  ): void {
    const cloudSets = [
      { x: width * (0.18 + ((t * 0.01) % 1)), y: height * 0.2, scale: 1 },
      { x: width * (0.74 - ((t * 0.008) % 1)), y: height * 0.28, scale: 0.8 },
      { x: width * (0.55 + ((t * 0.006) % 1)), y: height * 0.16, scale: 0.7 },
    ];

    c.fillStyle = "rgba(255, 246, 229, 0.36)";
    for (const cloud of cloudSets) {
      this.drawCloud(c, cloud.x % (width + 140) - 70, cloud.y, height * 0.06 * cloud.scale);
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
    ocean.addColorStop(0, "#3ba0bd");
    ocean.addColorStop(1, "#0e4761");
    c.fillStyle = ocean;
    c.fillRect(0, horizonY, width, height - horizonY);

    const glare = c.createLinearGradient(width * 0.2, horizonY, width * 0.5, height);
    glare.addColorStop(0, "rgba(255, 220, 145, 0.34)");
    glare.addColorStop(1, "rgba(255, 220, 145, 0)");
    c.fillStyle = glare;
    c.beginPath();
    c.moveTo(width * 0.2, horizonY);
    c.lineTo(width * 0.37, height);
    c.lineTo(width * 0.56, height);
    c.lineTo(width * 0.5, horizonY);
    c.closePath();
    c.fill();

    c.strokeStyle = "rgba(255,255,255,0.15)";
    c.lineWidth = Math.max(1, height * 0.004);
    for (let row = 0; row < 10; row++) {
      const y = horizonY + row * (height - horizonY) / 10;
      c.beginPath();
      for (let x = 0; x <= width; x += 6) {
        const wave =
          Math.sin(x * 0.012 + t * 1.2 + row * 0.7) * (height * 0.008) +
          Math.sin(x * 0.02 + t * 0.6 + row) * (height * 0.0045);
        if (x === 0) {
          c.moveTo(x, y + wave);
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
    const left = width * 0.22;
    const right = width * 0.78;
    const baseY = horizonY + height * 0.115;
    const crestY = horizonY - height * 0.105;
    const backRidgeY = crestY + height * 0.055;

    const lagoon = c.createRadialGradient(
      width * 0.5,
      baseY - height * 0.01,
      width * 0.03,
      width * 0.5,
      baseY,
      width * 0.26,
    );
    lagoon.addColorStop(0, "rgba(94, 222, 205, 0.28)");
    lagoon.addColorStop(1, "rgba(94, 222, 205, 0)");
    c.fillStyle = lagoon;
    c.beginPath();
    c.ellipse(width * 0.5, baseY, width * 0.27, height * 0.08, 0, 0, Math.PI * 2);
    c.fill();

    c.beginPath();
    c.moveTo(width * 0.27, baseY - height * 0.01);
    c.bezierCurveTo(
      width * 0.36,
      backRidgeY - height * 0.05,
      width * 0.64,
      backRidgeY - height * 0.045,
      width * 0.73,
      baseY - height * 0.01,
    );
    c.lineTo(width * 0.73, baseY + height * 0.06);
    c.lineTo(width * 0.27, baseY + height * 0.06);
    c.closePath();
    c.fillStyle = "rgba(39, 120, 73, 0.66)";
    c.fill();

    c.beginPath();
    c.moveTo(left, baseY);
    c.bezierCurveTo(
      width * 0.3,
      horizonY - height * 0.015,
      width * 0.39,
      crestY,
      width * 0.5,
      crestY + height * 0.015,
    );
    c.bezierCurveTo(
      width * 0.61,
      crestY + height * 0.035,
      width * 0.7,
      horizonY,
      right,
      baseY,
    );
    c.lineTo(right, baseY + height * 0.1);
    c.lineTo(left, baseY + height * 0.1);
    c.closePath();

    const hill = c.createLinearGradient(0, crestY, 0, baseY + height * 0.1);
    hill.addColorStop(0, "#48b15f");
    hill.addColorStop(0.5, "#2f8f51");
    hill.addColorStop(1, "#246f43");
    c.fillStyle = hill;
    c.fill();

    c.strokeStyle = "rgba(173, 240, 170, 0.18)";
    c.lineWidth = Math.max(1, height * 0.0035);
    c.beginPath();
    c.moveTo(width * 0.32, baseY - height * 0.012);
    c.quadraticCurveTo(width * 0.5, crestY + height * 0.03, width * 0.69, baseY - height * 0.01);
    c.stroke();

    const beachY = baseY + height * 0.03;
    c.fillStyle = "#ddb97b";
    c.beginPath();
    c.ellipse(width * 0.5, beachY, width * 0.29, height * 0.053, 0, 0, Math.PI * 2);
    c.fill();

    c.strokeStyle = "rgba(24, 95, 62, 0.45)";
    c.lineWidth = Math.max(1, height * 0.004);
    for (let i = 0; i < 6; i++) {
      const x = left + ((right - left) / 5) * i;
      c.beginPath();
      c.moveTo(x, baseY + height * 0.06);
      c.quadraticCurveTo(
        x + width * 0.013,
        baseY + height * 0.035 - Math.sin(t * 0.7 + i) * height * 0.008,
        x + width * 0.02,
        baseY + height * 0.012,
      );
      c.stroke();
    }
  }

  private drawPalmCluster(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    horizonY: number,
    t: number,
  ): void {
    const canopyBaseY = horizonY + height * 0.025;
    c.fillStyle = "rgba(34, 105, 60, 0.8)";
    for (let i = 0; i < 36; i++) {
      const p = i / 35;
      const jitterX = Math.sin(i * 2.31) * width * 0.006;
      const jitterY = Math.cos(i * 1.73) * height * 0.004;
      const x = width * (0.27 + p * 0.46) + jitterX;
      const y = canopyBaseY - Math.sin(p * Math.PI) * height * 0.09 + jitterY;
      const rx = width * (0.016 + (i % 3) * 0.0035);
      const ry = height * (0.024 + (i % 4) * 0.0035);
      c.beginPath();
      c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
    }

    c.fillStyle = "rgba(78, 168, 94, 0.32)";
    for (let i = 0; i < 24; i++) {
      const p = i / 23;
      const x = width * (0.28 + p * 0.44) + Math.sin(i * 2.13) * width * 0.006;
      const y = canopyBaseY - Math.sin(p * Math.PI) * height * 0.095 + height * 0.008;
      c.beginPath();
      c.ellipse(x, y, width * 0.012, height * 0.017, 0, 0, Math.PI * 2);
      c.fill();
    }

    for (let i = 0; i < 22; i++) {
      const p = i / 21;
      const x = width * (0.29 + p * 0.42) + Math.sin(i * 1.47) * width * 0.012;
      const y = horizonY + height * (0.1 + Math.cos(i * 0.9) * 0.012);
      const h = height * (0.14 + (i % 5) * 0.018);
      const s = 0.55 + (i % 4) * 0.12;
      const sway = Math.sin(t * 1.15 + i * 0.6) * height * 0.012 * s;
      this.drawPalmTree(c, x, y, h, sway, s);
    }
  }

  private drawShoreFoam(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    horizonY: number,
    t: number,
  ): void {
    c.strokeStyle = "rgba(255, 245, 228, 0.42)";
    c.lineWidth = Math.max(1, height * 0.004);
    c.beginPath();
    for (let i = 0; i <= 80; i++) {
      const p = i / 80;
      const x = width * (0.2 + p * 0.6);
      const y =
        horizonY +
        height * 0.145 -
        Math.sin(p * Math.PI) * height * 0.036 +
        Math.sin(t * 1.9 + p * 10) * height * 0.003;
      if (i === 0) {
        c.moveTo(x, y);
      } else {
        c.lineTo(x, y);
      }
    }
    c.stroke();
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

    c.strokeStyle = "#6b4726";
    c.lineWidth = Math.max(2, 6 * scale);
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(baseX, baseY);
    c.quadraticCurveTo(baseX + sway * 0.5, baseY - height * 0.45, trunkTopX, trunkTopY);
    c.stroke();

    const leafColors = ["#2e8c4d", "#3ea85a", "#2a7f46"];
    c.lineWidth = Math.max(1, 3 * scale);
    for (let i = 0; i < 7; i++) {
      const angle = -Math.PI * 0.78 + i * 0.28;
      const length = height * (0.44 + (i % 2) * 0.12);
      const endX = trunkTopX + Math.cos(angle) * length;
      const endY = trunkTopY + Math.sin(angle) * length * 0.55;
      c.strokeStyle = leafColors[i % leafColors.length];
      c.beginPath();
      c.moveTo(trunkTopX, trunkTopY);
      c.quadraticCurveTo(
        trunkTopX + Math.cos(angle) * length * 0.45,
        trunkTopY + Math.sin(angle) * length * 0.35,
        endX,
        endY,
      );
      c.stroke();
    }
  }

  private drawWaveCrests(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    horizonY: number,
    t: number,
  ): void {
    for (let i = 0; i < 18; i++) {
      const phase = i / 18;
      const x = width * phase + Math.sin(t * 0.9 + i * 0.4) * width * 0.012;
      const y = horizonY + height * (0.22 + ((i % 6) * 0.05)) + Math.sin(t * 1.4 + i) * height * 0.008;
      c.fillStyle = `rgba(255, 255, 255, ${0.16 + (i % 4) * 0.04})`;
      c.beginPath();
      c.ellipse(x, y, width * 0.02, height * 0.006, 0, 0, Math.PI * 2);
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

function lerpColor(from: string, to: string, t: number): string {
  const clamped = clamp01(t);
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const r = Math.round(a.r + (b.r - a.r) * clamped);
  const g = Math.round(a.g + (b.g - a.g) * clamped);
  const bChannel = Math.round(a.b + (b.b - a.b) * clamped);
  return `rgb(${r}, ${g}, ${bChannel})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}
