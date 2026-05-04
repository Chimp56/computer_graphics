import * as THREE from "three";

const MAX_PARTICLES = 1200;
const GRAVITY = 6;

const PALETTE = [
  0xff4488, 0x66ddff, 0xffe066, 0x88ff88, 0xff8844, 0xc070ff, 0xffffff,
];

type PendingBurst = {
  at: number;
  origin: THREE.Vector3;
  color: THREE.Color;
  count: number;
};

/**
 * Pooled additive-blended particle fireworks. `celebrate(origin)` schedules a
 * staggered volley around that point; `update(dt)` advances all particles and
 * drains the pending-burst queue.
 */
export class Fireworks {
  readonly points: THREE.Points;

  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly baseColors: Float32Array;
  private readonly velocities: Float32Array;
  private readonly lives: Float32Array;
  private readonly maxLives: Float32Array;
  private readonly active: Uint8Array;

  private elapsed = 0;
  private nextSlot = 0;
  private pending: PendingBurst[] = [];

  constructor() {
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.baseColors = new Float32Array(MAX_PARTICLES * 3);
    this.velocities = new Float32Array(MAX_PARTICLES * 3);
    this.lives = new Float32Array(MAX_PARTICLES);
    this.maxLives = new Float32Array(MAX_PARTICLES);
    this.active = new Uint8Array(MAX_PARTICLES);

    // Park inactive particles far below the world so they aren't visible.
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.positions[i * 3 + 1] = -10000;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  /**
   * Schedules ~10 bursts spread across the next ~3 seconds in a wide spread
   * around `center`. Each burst gets a random palette color.
   */
  celebrate(center: THREE.Vector3, burstCount = 12): void {
    for (let i = 0; i < burstCount; i++) {
      const dx = (Math.random() - 0.5) * 60;
      const dz = (Math.random() - 0.5) * 60;
      const dy = 18 + Math.random() * 16;
      const origin = new THREE.Vector3(
        center.x + dx,
        center.y + dy,
        center.z + dz,
      );
      const colorHex = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      this.pending.push({
        at: this.elapsed + i * 0.28 + Math.random() * 0.18,
        origin,
        color: new THREE.Color(colorHex),
        count: 70 + Math.floor(Math.random() * 50),
      });
    }
  }

  update(dt: number): void {
    this.elapsed += dt;

    while (this.pending.length > 0) {
      let earliest = 0;
      for (let i = 1; i < this.pending.length; i++) {
        if (this.pending[i].at < this.pending[earliest].at) earliest = i;
      }
      if (this.pending[earliest].at > this.elapsed) break;
      const burst = this.pending.splice(earliest, 1)[0];
      this.spawnBurst(burst.origin, burst.color, burst.count);
    }

    let anyActive = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (!this.active[i]) continue;
      anyActive = true;

      this.lives[i] -= dt;
      if (this.lives[i] <= 0) {
        this.active[i] = 0;
        this.positions[i * 3 + 1] = -10000;
        this.colors[i * 3] = 0;
        this.colors[i * 3 + 1] = 0;
        this.colors[i * 3 + 2] = 0;
        continue;
      }

      const vi = i * 3;
      this.velocities[vi + 1] -= GRAVITY * dt;
      this.positions[vi] += this.velocities[vi] * dt;
      this.positions[vi + 1] += this.velocities[vi + 1] * dt;
      this.positions[vi + 2] += this.velocities[vi + 2] * dt;

      const fade = this.lives[i] / this.maxLives[i];
      this.colors[vi] = this.baseColors[vi] * fade;
      this.colors[vi + 1] = this.baseColors[vi + 1] * fade;
      this.colors[vi + 2] = this.baseColors[vi + 2] * fade;
    }

    if (anyActive || this.pending.length > 0) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
  }

  private spawnBurst(origin: THREE.Vector3, color: THREE.Color, count: number): void {
    for (let n = 0; n < count; n++) {
      const idx = this.acquireSlot();
      const vi = idx * 3;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 5 + Math.random() * 7;
      const sinPhi = Math.sin(phi);

      this.velocities[vi] = sinPhi * Math.cos(theta) * speed;
      this.velocities[vi + 1] = Math.cos(phi) * speed + 1.5;
      this.velocities[vi + 2] = sinPhi * Math.sin(theta) * speed;

      this.positions[vi] = origin.x;
      this.positions[vi + 1] = origin.y;
      this.positions[vi + 2] = origin.z;

      const jitter = 0.85 + Math.random() * 0.3;
      this.baseColors[vi] = color.r * jitter;
      this.baseColors[vi + 1] = color.g * jitter;
      this.baseColors[vi + 2] = color.b * jitter;
      this.colors[vi] = this.baseColors[vi];
      this.colors[vi + 1] = this.baseColors[vi + 1];
      this.colors[vi + 2] = this.baseColors[vi + 2];

      const life = 1.4 + Math.random() * 0.9;
      this.lives[idx] = life;
      this.maxLives[idx] = life;
      this.active[idx] = 1;
    }
  }

  private acquireSlot(): number {
    for (let tries = 0; tries < MAX_PARTICLES; tries++) {
      const idx = this.nextSlot;
      this.nextSlot = (this.nextSlot + 1) % MAX_PARTICLES;
      if (!this.active[idx]) return idx;
    }
    return this.nextSlot;
  }
}
