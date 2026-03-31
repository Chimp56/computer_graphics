import * as THREE from "three";

export type IslandTextures = {
  heightmap: THREE.Texture;
  sand: THREE.Texture;
  grass?: THREE.Texture;
};

export class Island {
  public readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhongMaterial>;

  private readonly width = 200;
  private readonly depth = 200;
  private readonly maxHeight = 24;

  private readonly fieldWidth: number;
  private readonly fieldHeight: number;
  private readonly field: Float32Array;

  constructor(textures: IslandTextures) {
    const heightData = readHeightField(textures.heightmap);
    this.fieldWidth = heightData.width;
    this.fieldHeight = heightData.height;
    this.field = heightData.values;

    configureTiledTexture(textures.sand, 16, 16);

    const geometry = new THREE.PlaneGeometry(
      this.width,
      this.depth,
      this.fieldWidth - 1,
      this.fieldHeight - 1,
    );
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position as THREE.BufferAttribute;
    for (let z = 0; z < this.fieldHeight; z++) {
      for (let x = 0; x < this.fieldWidth; x++) {
        const index = z * this.fieldWidth + x;
        positions.setY(index, this.field[index] * this.maxHeight);
      }
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
      map: textures.sand,
      color: new THREE.Color(0xf0d8ac),
      shininess: 12,
      specular: new THREE.Color(0x2f2a1f),
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
  }

  getHeightAt(x: number, z: number): number {
    const halfWidth = this.width * 0.5;
    const halfDepth = this.depth * 0.5;

    const u = clamp01((x - this.mesh.position.x + halfWidth) / this.width);
    const v = clamp01((z - this.mesh.position.z + halfDepth) / this.depth);

    const px = u * (this.fieldWidth - 1);
    const pz = v * (this.fieldHeight - 1);

    const x0 = Math.floor(px);
    const z0 = Math.floor(pz);
    const x1 = Math.min(x0 + 1, this.fieldWidth - 1);
    const z1 = Math.min(z0 + 1, this.fieldHeight - 1);

    const tx = px - x0;
    const tz = pz - z0;

    const h00 = this.sample(x0, z0);
    const h10 = this.sample(x1, z0);
    const h01 = this.sample(x0, z1);
    const h11 = this.sample(x1, z1);

    const h0 = h00 + (h10 - h00) * tx;
    const h1 = h01 + (h11 - h01) * tx;
    const h = h0 + (h1 - h0) * tz;

    return this.mesh.position.y + h * this.maxHeight;
  }

  private sample(x: number, z: number): number {
    return this.field[z * this.fieldWidth + x] ?? 0;
  }
}

function readHeightField(texture: THREE.Texture): {
  width: number;
  height: number;
  values: Float32Array;
} {
  const image = texture.image as { width?: number; height?: number } | undefined;
  const width = image?.width;
  const height = image?.height;

  if (!width || !height) {
    throw new Error("Heightmap image missing dimensions.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create 2D context for heightmap.");
  }

  ctx.drawImage(texture.image as CanvasImageSource, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;

  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i++) {
    values[i] = pixels[i * 4] / 255;
  }

  return { width, height, values };
}

function configureTiledTexture(texture: THREE.Texture, repeatX: number, repeatY: number): void {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
