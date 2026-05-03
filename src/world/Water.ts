import * as THREE from "three";

export const WATER_LEVEL = 0.5;

const DEFAULT_SIZE = 500;
const DEFAULT_TEXTURE_URL = "/textures/water.png";
const DEFAULT_TEXTURE_REPEAT = 12;

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

type WaterOptions = {
  size?: number;
  textureUrl?: string;
  textureRepeat?: number;
  textureLoader?: THREE.TextureLoader;
};

export class Water {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhongMaterial>;

  private readonly texture: THREE.Texture;
  private elapsed = 0;

  private constructor(
    mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhongMaterial>,
    texture: THREE.Texture,
  ) {
    this.mesh = mesh;
    this.texture = texture;
  }

  static async create(options: WaterOptions = {}): Promise<Water> {
    const size = options.size ?? DEFAULT_SIZE;
    const textureUrl = options.textureUrl ?? DEFAULT_TEXTURE_URL;
    const textureRepeat = options.textureRepeat ?? DEFAULT_TEXTURE_REPEAT;
    const textureLoader = options.textureLoader ?? new THREE.TextureLoader();

    const texture = await loadTexture(textureLoader, textureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(textureRepeat, textureRepeat);

    const geometry = new THREE.PlaneGeometry(size, size, 1, 1);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshPhongMaterial({
      map: texture,
      color: 0x3b7fc4,
      transparent: true,
      opacity: 0.72,
      shininess: 100,
      specular: new THREE.Color(0xa7dfff),
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = WATER_LEVEL;
    mesh.name = "Water";

    return new Water(mesh, texture);
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.texture.offset.x = (this.elapsed * 0.035) % 1;
    this.texture.offset.y = (this.elapsed * 0.02) % 1;
  }

  /** Returns a random safe respawn position above land. */
  randomSpawn(getHeight: (x: number, z: number) => number): THREE.Vector3 {
    const [x, z] = SPAWN_CANDIDATES[Math.floor(Math.random() * SPAWN_CANDIDATES.length)];
    const groundY = getHeight(x, z);
    return new THREE.Vector3(x, Number.isFinite(groundY) ? groundY + 0.1 : WATER_LEVEL + 3, z);
  }

  dispose(): void {
    this.texture.dispose();
    this.mesh.material.dispose();
    this.mesh.geometry.dispose();
  }
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
