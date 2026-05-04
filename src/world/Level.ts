import * as THREE from "three";
import { WipeoutObstacle } from "../obstacles/WipeoutObstacle";

export type PlatformDef = {
  /** Center X. */
  x: number;
  /** Center Z. */
  z: number;
  width: number;
  depth: number;
};

export type LevelOptions = {
  /** Top-surface Y of every platform. */
  platformY: number;
  platforms: PlatformDef[];
  wipeoutPositions: [number, number][];
  /** Tint for platform material. */
  color?: number;
};

const PLATFORM_THICKNESS = 1.5;

/**
 * A floating obstacle level made of axis-aligned platform slabs separated by
 * gaps (pit falls) and decorated with wipeout obstacles. The gaps are simply
 * the absence of a platform — players who walk off fall toward the water below.
 */
export class Level {
  readonly group = new THREE.Group();
  readonly wipeouts: WipeoutObstacle[] = [];
  readonly platformY: number;

  private readonly platforms: PlatformDef[];

  constructor(opts: LevelOptions) {
    this.platformY = opts.platformY;
    this.platforms = opts.platforms;

    const platformMat = new THREE.MeshPhongMaterial({
      color: opts.color ?? 0x8a6a4a,
      shininess: 24,
      specular: 0x222222,
    });
    const edgeMat = new THREE.MeshPhongMaterial({
      color: 0x553a22,
      shininess: 10,
    });

    for (const p of opts.platforms) {
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(p.width, PLATFORM_THICKNESS, p.depth),
        platformMat,
      );
      slab.position.set(p.x, this.platformY - PLATFORM_THICKNESS / 2, p.z);
      slab.castShadow = true;
      slab.receiveShadow = true;
      this.group.add(slab);

      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(p.width + 0.2, 0.2, p.depth + 0.2),
        edgeMat,
      );
      trim.position.set(
        p.x,
        this.platformY - PLATFORM_THICKNESS - 0.05,
        p.z,
      );
      trim.castShadow = true;
      trim.receiveShadow = true;
      this.group.add(trim);
    }

    for (const [wx, wz] of opts.wipeoutPositions) {
      const obs = new WipeoutObstacle();
      obs.place(wx, wz, this.platformY);
      this.group.add(obs.mesh);
      this.wipeouts.push(obs);
    }
  }

  /**
   * Top-surface Y at (x, z) when standing on a platform; null when over a gap.
   */
  getHeightAt(x: number, z: number): number | null {
    for (const p of this.platforms) {
      const halfW = p.width * 0.5;
      const halfD = p.depth * 0.5;
      if (
        x >= p.x - halfW &&
        x <= p.x + halfW &&
        z >= p.z - halfD &&
        z <= p.z + halfD
      ) {
        return this.platformY;
      }
    }
    return null;
  }

  update(dt: number): void {
    for (const w of this.wipeouts) w.update(dt);
  }
}
