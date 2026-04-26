import * as THREE from "three";

const DEFAULT_WIDTH = 200;
const DEFAULT_DEPTH = 200;
const DEFAULT_SEGMENTS = 127;
const DEFAULT_MIN_HEIGHT = 0;
const DEFAULT_MAX_HEIGHT = 24;
const DEFAULT_HEIGHTMAP_URL = "/textures/heightmap.png";
const DEFAULT_SAND_TEXTURE_URL = "/textures/sand.png";
const DEFAULT_TEXTURE_REPEAT = 16;

export type IslandOptions = {
  width?: number;
  depth?: number;
  segments?: number;
  minHeight?: number;
  maxHeight?: number;
  heightmapUrl?: string;
  sandTextureUrl?: string;
  textureRepeat?: number;
  textureLoader?: THREE.TextureLoader;
};

/**
 * Terrain mesh backed by a sampled heightfield.
 *
 * The rendered mesh and collision lookup use the same height data.
 */
export class Island {
  public readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhongMaterial>;

  private readonly width: number;
  private readonly depth: number;
  private readonly resolution: number;
  private readonly heights: Float32Array;

  private constructor(
    mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhongMaterial>,
    width: number,
    depth: number,
    resolution: number,
    heights: Float32Array,
  ) {
    this.mesh = mesh;
    this.width = width;
    this.depth = depth;
    this.resolution = resolution;
    this.heights = heights;
  }

  static async create(options: IslandOptions = {}): Promise<Island> {
    const width = options.width ?? DEFAULT_WIDTH;
    const depth = options.depth ?? DEFAULT_DEPTH;
    const segments = options.segments ?? DEFAULT_SEGMENTS;
    const minHeight = options.minHeight ?? DEFAULT_MIN_HEIGHT;
    const maxHeight = options.maxHeight ?? DEFAULT_MAX_HEIGHT;
    const heightmapUrl = options.heightmapUrl ?? DEFAULT_HEIGHTMAP_URL;
    const sandTextureUrl = options.sandTextureUrl ?? DEFAULT_SAND_TEXTURE_URL;
    const textureRepeat = options.textureRepeat ?? DEFAULT_TEXTURE_REPEAT;
    const textureLoader = options.textureLoader ?? new THREE.TextureLoader();

    const [heightmapTexture, sandTexture] = await Promise.all([
      loadTexture(textureLoader, heightmapUrl),
      loadTexture(textureLoader, sandTextureUrl),
    ]);

    const heightImage = textureToImageData(heightmapTexture);
    const resolution = segments + 1;
    const heights = buildHeightField(
      heightImage,
      resolution,
      minHeight,
      maxHeight,
    );

    const geometry = new THREE.PlaneGeometry(width, depth, segments, segments);
    applyHeightFieldToGeometry(geometry, heights, resolution);

    sandTexture.colorSpace = THREE.SRGBColorSpace;
    sandTexture.wrapS = THREE.RepeatWrapping;
    sandTexture.wrapT = THREE.RepeatWrapping;
    sandTexture.repeat.set(textureRepeat, textureRepeat);

    const material = new THREE.MeshPhongMaterial({
      map: sandTexture,
      shininess: 18,
      specular: new THREE.Color(0x2a2a2a),
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.name = "Island";

    heightmapTexture.dispose();

    return new Island(mesh, width, depth, resolution, heights);
  }

  /**
   * Bilinear terrain lookup for world-space X/Z coordinates.
   * Returns -Infinity when the point is outside terrain bounds.
   */
  getHeightAt(worldX: number, worldZ: number): number {
    const localX = worldX - this.mesh.position.x;
    const localZ = worldZ - this.mesh.position.z;

    const halfWidth = this.width * 0.5;
    const halfDepth = this.depth * 0.5;

    if (
      localX < -halfWidth ||
      localX > halfWidth ||
      localZ < -halfDepth ||
      localZ > halfDepth
    ) {
      return Number.NEGATIVE_INFINITY;
    }

    const u = (localX + halfWidth) / this.width;
    const v = (localZ + halfDepth) / this.depth;

    const gx = u * (this.resolution - 1);
    const gz = v * (this.resolution - 1);

    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const x1 = Math.min(x0 + 1, this.resolution - 1);
    const z1 = Math.min(z0 + 1, this.resolution - 1);

    const tx = gx - x0;
    const tz = gz - z0;

    const h00 = this.heights[z0 * this.resolution + x0];
    const h10 = this.heights[z0 * this.resolution + x1];
    const h01 = this.heights[z1 * this.resolution + x0];
    const h11 = this.heights[z1 * this.resolution + x1];

    const h0 = lerp(h00, h10, tx);
    const h1 = lerp(h01, h11, tx);

    return lerp(h0, h1, tz) + this.mesh.position.y;
  }

  dispose(): void {
    const material = this.mesh.material;
    material.map?.dispose();
    material.dispose();
    this.mesh.geometry.dispose();
  }
}

function applyHeightFieldToGeometry(
  geometry: THREE.PlaneGeometry,
  heights: Float32Array,
  resolution: number,
): void {
  const positions = geometry.attributes.position;

  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const index = z * resolution + x;
      positions.setZ(index, heights[index]);
    }
  }

  positions.needsUpdate = true;
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function buildHeightField(
  source: HeightImageData,
  resolution: number,
  minHeight: number,
  maxHeight: number,
): Float32Array {
  const heights = new Float32Array(resolution * resolution);

  for (let z = 0; z < resolution; z++) {
    const v = resolution > 1 ? z / (resolution - 1) : 0;

    for (let x = 0; x < resolution; x++) {
      const u = resolution > 1 ? x / (resolution - 1) : 0;
      const normalizedHeight = sampleHeight(source, u, v);
      heights[z * resolution + x] =
        minHeight + (maxHeight - minHeight) * normalizedHeight;
    }
  }

  return heights;
}

type HeightImageData = {
  width: number;
  height: number;
  values: Float32Array;
};

function textureToImageData(texture: THREE.Texture): HeightImageData {
  const source = texture.source.data;

  if (
    !(source instanceof HTMLImageElement) &&
    !(source instanceof HTMLCanvasElement) &&
    !(source instanceof ImageBitmap)
  ) {
    throw new Error("Unsupported heightmap source format");
  }

  const width =
    source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height =
    source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  if (width <= 0 || height <= 0) {
    throw new Error("Heightmap image has invalid dimensions");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create 2D context for heightmap decoding");
  }

  ctx.drawImage(source, 0, 0, width, height);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const values = new Float32Array(width * height);

  for (let i = 0; i < values.length; i++) {
    const offset = i * 4;
    const r = rgba[offset];
    const g = rgba[offset + 1];
    const b = rgba[offset + 2];

    values[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  }

  return { width, height, values };
}

function sampleHeight(source: HeightImageData, u: number, v: number): number {
  const x = clamp01(u) * (source.width - 1);
  const y = clamp01(v) * (source.height - 1);

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, source.width - 1);
  const y1 = Math.min(y0 + 1, source.height - 1);

  const tx = x - x0;
  const ty = y - y0;

  const h00 = source.values[y0 * source.width + x0];
  const h10 = source.values[y0 * source.width + x1];
  const h01 = source.values[y1 * source.width + x0];
  const h11 = source.values[y1 * source.width + x1];

  const h0 = lerp(h00, h10, tx);
  const h1 = lerp(h01, h11, tx);

  return lerp(h0, h1, ty);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function loadTexture(
  loader: THREE.TextureLoader,
  url: string,
): Promise<THREE.Texture> {
  return new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(
      url,
      (texture) => resolve(texture),
      undefined,
      () => reject(new Error(`Failed to load texture: ${url}`)),
    );
  });
}
