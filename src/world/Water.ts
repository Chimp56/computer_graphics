import * as THREE from "three";

export const WATER_LEVEL = 1.2;

// Safe land positions [x, z] used for random respawns
const SPAWN_CANDIDATES: [number, number][] = [
  [0, 65],
  [12, 55],
  [-12, 55],
  [8, 40],
  [-8, 40],
  [15, 30],
  [-15, 30],
  [0, 20],
];

function buildWaterTexture(): THREE.CanvasTexture {
  const W = 512;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Deep water base
  ctx.fillStyle = "#1558a8";
  ctx.fillRect(0, 0, W, H);

  // Lighter mid layer
  ctx.fillStyle = "rgba(30, 120, 200, 0.45)";
  ctx.fillRect(0, 0, W, H);

  // Wave bands
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 14; i++) {
      const baseY = row * (H / 3) + i * 12;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(120, 210, 255, ${0.15 + i * 0.012})`;
      ctx.lineWidth = 1.5;
      for (let x = 0; x <= W; x += 4) {
        const y = baseY + Math.sin(x * 0.035 + i * 0.9) * 7 + Math.sin(x * 0.07 + i) * 3;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // Foam/highlight patches
  ctx.fillStyle = "rgba(200, 240, 255, 0.18)";
  const patches: [number, number, number][] = [
    [80, 120, 40], [300, 60, 30], [200, 350, 50],
    [420, 250, 25], [60, 400, 35], [350, 180, 28],
    [150, 460, 20], [460, 80, 22],
  ];
  for (const [px, py, r] of patches) {
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, "rgba(220,245,255,0.4)");
    grad.addColorStop(1, "rgba(220,245,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(px, py, r * 1.6, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Water {
  readonly mesh: THREE.Mesh;
  private readonly tex: THREE.CanvasTexture;
  private elapsed = 0;

  constructor(size = 500) {
    this.tex = buildWaterTexture();

    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshPhongMaterial({
      map: this.tex,
      color: 0x1a6ec4,
      transparent: true,
      opacity: 0.85,
      shininess: 140,
      specular: new THREE.Color(0x99ddff),
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = WATER_LEVEL;
    this.mesh.name = "Water";
    this.mesh.receiveShadow = false;
  }

  update(dt: number): void {
    this.elapsed += dt;
    // Scroll UV diagonally for a flowing look
    this.tex.offset.set(
      (this.elapsed * 0.05) % 1,
      (this.elapsed * 0.025) % 1,
    );
  }

  /** Returns a random safe respawn position above land. */
  randomSpawn(getHeight: (x: number, z: number) => number): THREE.Vector3 {
    const [x, z] = SPAWN_CANDIDATES[Math.floor(Math.random() * SPAWN_CANDIDATES.length)];
    const groundY = getHeight(x, z);
    return new THREE.Vector3(x, Number.isFinite(groundY) ? groundY + 0.1 : WATER_LEVEL + 3, z);
  }

  dispose(): void {
    this.tex.dispose();
    (this.mesh.material as THREE.MeshPhongMaterial).dispose();
    this.mesh.geometry.dispose();
  }
}
