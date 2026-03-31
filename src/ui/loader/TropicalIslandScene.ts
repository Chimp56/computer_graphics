import type { LoaderScene } from "./LoaderScene";

type SceneViewport = {
  width: number;
  height: number;
  horizonY: number;
  time: number;
};

interface SceneElement {
  draw(ctx: CanvasRenderingContext2D, view: SceneViewport): void;
}

export class TropicalIslandScene implements LoaderScene {
  private readonly elements: SceneElement[];

  constructor(elements?: SceneElement[]) {
    this.elements = elements ?? [
      new SkyElement(),
      new SunElement(),
      new CloudElement(),
      new BackgroundIslandsElement(),
      new OceanElement(),
      new IslandElement(),
      new PalmClusterElement(),
      new ShoreFoamElement(),
      new WaveCrestsElement(),
    ];
  }

  draw(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    timeSeconds: number,
  ): void {
    const view: SceneViewport = {
      width,
      height,
      horizonY: height * 0.56,
      time: timeSeconds,
    };

    ctx.clearRect(0, 0, width, height);
    for (const element of this.elements) {
      element.draw(ctx, view);
    }
  }
}

class SkyElement implements SceneElement {
  draw(ctx: CanvasRenderingContext2D, view: SceneViewport): void {
    const dawn = 0.5 + Math.sin(view.time * 0.22 - 1.1) * 0.5;
    const sky = ctx.createLinearGradient(0, 0, 0, view.horizonY);
    sky.addColorStop(0, lerpColor("#1c2f4d", "#78c1d9", dawn));
    sky.addColorStop(0.55, lerpColor("#f07b57", "#f6bc67", dawn));
    sky.addColorStop(1, lerpColor("#f2a673", "#ffe7b1", dawn));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, view.width, view.horizonY);

    ctx.fillStyle = "rgba(255, 209, 145, 0.16)";
    ctx.fillRect(0, view.horizonY - view.height * 0.08, view.width, view.height * 0.08);
  }
}

class SunElement implements SceneElement {
  draw(ctx: CanvasRenderingContext2D, view: SceneViewport): void {
    const phase = 0.5 + Math.sin(view.time * 0.22 - 1.2) * 0.5;
    const sunX = view.width * (0.16 + phase * 0.3);
    const sunY = view.horizonY + view.height * 0.16 - phase * view.height * 0.52;
    const sunR = view.height * 0.065;

    const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3.4);
    glow.addColorStop(0, "rgba(255, 242, 150, 0.58)");
    glow.addColorStop(1, "rgba(255, 196, 90, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 3.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffe08d";
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#ffd593";
    ctx.fillRect(0, view.horizonY, view.width, view.height * 0.08);
    ctx.globalAlpha = 1;
  }
}

class CloudElement implements SceneElement {
  draw(ctx: CanvasRenderingContext2D, view: SceneViewport): void {
    const cloudSets = [
      { x: view.width * (0.18 + ((view.time * 0.01) % 1)), y: view.height * 0.2, scale: 1 },
      { x: view.width * (0.74 - ((view.time * 0.008) % 1)), y: view.height * 0.28, scale: 0.8 },
      { x: view.width * (0.55 + ((view.time * 0.006) % 1)), y: view.height * 0.16, scale: 0.7 },
    ];

    ctx.fillStyle = "rgba(255, 246, 229, 0.36)";
    for (const cloud of cloudSets) {
      this.drawCloud(
        ctx,
        cloud.x % (view.width + 140) - 70,
        cloud.y,
        view.height * 0.06 * cloud.scale,
      );
    }
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    ctx.beginPath();
    ctx.arc(x - radius * 1.4, y, radius * 0.78, 0, Math.PI * 2);
    ctx.arc(x - radius * 0.4, y - radius * 0.25, radius, 0, Math.PI * 2);
    ctx.arc(x + radius * 0.9, y, radius * 0.84, 0, Math.PI * 2);
    ctx.fill();
  }
}

class BackgroundIslandsElement implements SceneElement {
  draw(ctx: CanvasRenderingContext2D, view: SceneViewport): void {
    ctx.fillStyle = "rgba(22, 82, 74, 0.38)";
    ctx.beginPath();
    ctx.moveTo(view.width * 0.08, view.horizonY + view.height * 0.045);
    ctx.quadraticCurveTo(
      view.width * 0.19,
      view.horizonY - view.height * 0.02 + Math.sin(view.time * 0.25) * view.height * 0.005,
      view.width * 0.31,
      view.horizonY + view.height * 0.045,
    );
    ctx.lineTo(view.width * 0.08, view.horizonY + view.height * 0.045);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(view.width * 0.68, view.horizonY + view.height * 0.05);
    ctx.quadraticCurveTo(
      view.width * 0.79,
      view.horizonY - view.height * 0.015 + Math.cos(view.time * 0.23) * view.height * 0.004,
      view.width * 0.9,
      view.horizonY + view.height * 0.05,
    );
    ctx.lineTo(view.width * 0.68, view.horizonY + view.height * 0.05);
    ctx.fill();
  }
}

class OceanElement implements SceneElement {
  draw(ctx: CanvasRenderingContext2D, view: SceneViewport): void {
    const ocean = ctx.createLinearGradient(0, view.horizonY, 0, view.height);
    ocean.addColorStop(0, "#3ba0bd");
    ocean.addColorStop(1, "#0e4761");
    ctx.fillStyle = ocean;
    ctx.fillRect(0, view.horizonY, view.width, view.height - view.horizonY);

    const glare = ctx.createLinearGradient(view.width * 0.2, view.horizonY, view.width * 0.5, view.height);
    glare.addColorStop(0, "rgba(255, 220, 145, 0.34)");
    glare.addColorStop(1, "rgba(255, 220, 145, 0)");
    ctx.fillStyle = glare;
    ctx.beginPath();
    ctx.moveTo(view.width * 0.2, view.horizonY);
    ctx.lineTo(view.width * 0.37, view.height);
    ctx.lineTo(view.width * 0.56, view.height);
    ctx.lineTo(view.width * 0.5, view.horizonY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = Math.max(1, view.height * 0.004);
    for (let row = 0; row < 10; row++) {
      const y = view.horizonY + row * (view.height - view.horizonY) / 10;
      ctx.beginPath();
      for (let x = 0; x <= view.width; x += 6) {
        const wave =
          Math.sin(x * 0.012 + view.time * 1.2 + row * 0.7) * (view.height * 0.008) +
          Math.sin(x * 0.02 + view.time * 0.6 + row) * (view.height * 0.0045);
        if (x === 0) {
          ctx.moveTo(x, y + wave);
        } else {
          ctx.lineTo(x, y + wave);
        }
      }
      ctx.stroke();
    }
  }
}

class IslandElement implements SceneElement {
  draw(ctx: CanvasRenderingContext2D, view: SceneViewport): void {
    const left = view.width * 0.22;
    const right = view.width * 0.78;
    const baseY = view.horizonY + view.height * 0.115;
    const crestY = view.horizonY - view.height * 0.105;
    const backRidgeY = crestY + view.height * 0.055;

    const lagoon = ctx.createRadialGradient(
      view.width * 0.5,
      baseY - view.height * 0.01,
      view.width * 0.03,
      view.width * 0.5,
      baseY,
      view.width * 0.26,
    );
    lagoon.addColorStop(0, "rgba(94, 222, 205, 0.28)");
    lagoon.addColorStop(1, "rgba(94, 222, 205, 0)");
    ctx.fillStyle = lagoon;
    ctx.beginPath();
    ctx.ellipse(view.width * 0.5, baseY, view.width * 0.27, view.height * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(view.width * 0.27, baseY - view.height * 0.01);
    ctx.bezierCurveTo(
      view.width * 0.36,
      backRidgeY - view.height * 0.05,
      view.width * 0.64,
      backRidgeY - view.height * 0.045,
      view.width * 0.73,
      baseY - view.height * 0.01,
    );
    ctx.lineTo(view.width * 0.73, baseY + view.height * 0.06);
    ctx.lineTo(view.width * 0.27, baseY + view.height * 0.06);
    ctx.closePath();
    ctx.fillStyle = "rgba(39, 120, 73, 0.66)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(left, baseY);
    ctx.bezierCurveTo(
      view.width * 0.3,
      view.horizonY - view.height * 0.015,
      view.width * 0.39,
      crestY,
      view.width * 0.5,
      crestY + view.height * 0.015,
    );
    ctx.bezierCurveTo(
      view.width * 0.61,
      crestY + view.height * 0.035,
      view.width * 0.7,
      view.horizonY,
      right,
      baseY,
    );
    ctx.lineTo(right, baseY + view.height * 0.1);
    ctx.lineTo(left, baseY + view.height * 0.1);
    ctx.closePath();

    const hill = ctx.createLinearGradient(0, crestY, 0, baseY + view.height * 0.1);
    hill.addColorStop(0, "#48b15f");
    hill.addColorStop(0.5, "#2f8f51");
    hill.addColorStop(1, "#246f43");
    ctx.fillStyle = hill;
    ctx.fill();

    ctx.strokeStyle = "rgba(173, 240, 170, 0.18)";
    ctx.lineWidth = Math.max(1, view.height * 0.0035);
    ctx.beginPath();
    ctx.moveTo(view.width * 0.32, baseY - view.height * 0.012);
    ctx.quadraticCurveTo(view.width * 0.5, crestY + view.height * 0.03, view.width * 0.69, baseY - view.height * 0.01);
    ctx.stroke();

    const beachY = baseY + view.height * 0.03;
    ctx.fillStyle = "#ddb97b";
    ctx.beginPath();
    ctx.ellipse(view.width * 0.5, beachY, view.width * 0.29, view.height * 0.053, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(24, 95, 62, 0.45)";
    ctx.lineWidth = Math.max(1, view.height * 0.004);
    for (let i = 0; i < 6; i++) {
      const x = left + ((right - left) / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, baseY + view.height * 0.06);
      ctx.quadraticCurveTo(
        x + view.width * 0.013,
        baseY + view.height * 0.035 - Math.sin(view.time * 0.7 + i) * view.height * 0.008,
        x + view.width * 0.02,
        baseY + view.height * 0.012,
      );
      ctx.stroke();
    }
  }
}

class PalmClusterElement implements SceneElement {
  draw(ctx: CanvasRenderingContext2D, view: SceneViewport): void {
    const canopyBaseY = view.horizonY + view.height * 0.025;
    ctx.fillStyle = "rgba(34, 105, 60, 0.8)";
    for (let i = 0; i < 36; i++) {
      const p = i / 35;
      const jitterX = Math.sin(i * 2.31) * view.width * 0.006;
      const jitterY = Math.cos(i * 1.73) * view.height * 0.004;
      const x = view.width * (0.27 + p * 0.46) + jitterX;
      const y = canopyBaseY - Math.sin(p * Math.PI) * view.height * 0.09 + jitterY;
      const rx = view.width * (0.016 + (i % 3) * 0.0035);
      const ry = view.height * (0.024 + (i % 4) * 0.0035);
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(78, 168, 94, 0.32)";
    for (let i = 0; i < 24; i++) {
      const p = i / 23;
      const x = view.width * (0.28 + p * 0.44) + Math.sin(i * 2.13) * view.width * 0.006;
      const y = canopyBaseY - Math.sin(p * Math.PI) * view.height * 0.095 + view.height * 0.008;
      ctx.beginPath();
      ctx.ellipse(x, y, view.width * 0.012, view.height * 0.017, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 22; i++) {
      const p = i / 21;
      const x = view.width * (0.29 + p * 0.42) + Math.sin(i * 1.47) * view.width * 0.012;
      const y = view.horizonY + view.height * (0.1 + Math.cos(i * 0.9) * 0.012);
      const h = view.height * (0.14 + (i % 5) * 0.018);
      const s = 0.55 + (i % 4) * 0.12;
      const sway = Math.sin(view.time * 1.15 + i * 0.6) * view.height * 0.012 * s;
      this.drawPalmTree(ctx, x, y, h, sway, s);
    }
  }

  private drawPalmTree(
    ctx: CanvasRenderingContext2D,
    baseX: number,
    baseY: number,
    height: number,
    sway: number,
    scale: number,
  ): void {
    const trunkTopX = baseX + sway;
    const trunkTopY = baseY - height;

    ctx.strokeStyle = "#6b4726";
    ctx.lineWidth = Math.max(2, 6 * scale);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(baseX + sway * 0.5, baseY - height * 0.45, trunkTopX, trunkTopY);
    ctx.stroke();

    const leafColors = ["#2e8c4d", "#3ea85a", "#2a7f46"];
    ctx.lineWidth = Math.max(1, 3 * scale);
    for (let i = 0; i < 7; i++) {
      const angle = -Math.PI * 0.78 + i * 0.28;
      const length = height * (0.44 + (i % 2) * 0.12);
      const endX = trunkTopX + Math.cos(angle) * length;
      const endY = trunkTopY + Math.sin(angle) * length * 0.55;
      ctx.strokeStyle = leafColors[i % leafColors.length];
      ctx.beginPath();
      ctx.moveTo(trunkTopX, trunkTopY);
      ctx.quadraticCurveTo(
        trunkTopX + Math.cos(angle) * length * 0.45,
        trunkTopY + Math.sin(angle) * length * 0.35,
        endX,
        endY,
      );
      ctx.stroke();
    }
  }
}

class ShoreFoamElement implements SceneElement {
  draw(ctx: CanvasRenderingContext2D, view: SceneViewport): void {
    ctx.strokeStyle = "rgba(255, 245, 228, 0.42)";
    ctx.lineWidth = Math.max(1, view.height * 0.004);
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const p = i / 80;
      const x = view.width * (0.2 + p * 0.6);
      const y =
        view.horizonY +
        view.height * 0.145 -
        Math.sin(p * Math.PI) * view.height * 0.036 +
        Math.sin(view.time * 1.9 + p * 10) * view.height * 0.003;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
}

class WaveCrestsElement implements SceneElement {
  draw(ctx: CanvasRenderingContext2D, view: SceneViewport): void {
    for (let i = 0; i < 18; i++) {
      const phase = i / 18;
      const x = view.width * phase + Math.sin(view.time * 0.9 + i * 0.4) * view.width * 0.012;
      const y =
        view.horizonY +
        view.height * (0.22 + ((i % 6) * 0.05)) +
        Math.sin(view.time * 1.4 + i) * view.height * 0.008;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.16 + (i % 4) * 0.04})`;
      ctx.beginPath();
      ctx.ellipse(x, y, view.width * 0.02, view.height * 0.006, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
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
