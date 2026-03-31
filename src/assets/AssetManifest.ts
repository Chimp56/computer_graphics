import * as THREE from "three";

export type AssetTextureKey = "heightmap" | "sand" | "grass" | "water";

type TextureEntry = {
  key: AssetTextureKey;
  path: string;
};

const TEXTURE_ENTRIES: TextureEntry[] = [
  { key: "heightmap", path: "/textures/heightmap.png" },
  { key: "sand", path: "/textures/sand.jpg" },
  { key: "grass", path: "/textures/grass.jpg" },
  { key: "water", path: "/textures/water.jpg" },
];

/**
 * Central asset-loading hub.
 *
 * All startup textures load through one shared LoadingManager so the loader
 * can track real progress against the full asset set.
 */
export class AssetManifest {
  public readonly manager: THREE.LoadingManager;
  public readonly textures: THREE.TextureLoader;
  private readonly textureMap: Partial<Record<AssetTextureKey, THREE.Texture>>;

  constructor() {
    this.manager = new THREE.LoadingManager();
    this.textures = new THREE.TextureLoader(this.manager);
    this.textureMap = {};
  }

  /**
   * Load every registered startup asset.
   * @param onProgress Called with values in the [0, 1] range.
   * @param onError Called with the URL that failed to load.
   */
  loadAll(
    onProgress?: (value: number) => void,
    onError?: (url: string) => void,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.manager.onProgress = (_url, loaded, total) => {
        onProgress?.(total > 0 ? loaded / total : 0);
      };

      this.manager.onLoad = () => {
        onProgress?.(1);
        resolve();
      };

      this.manager.onError = (url) => {
        onError?.(url);
        reject(new Error(`Failed to load: ${url}`));
      };

      const queuedAssets = this.enqueueAssets();

      // LoadingManager does not emit onLoad if zero assets are queued.
      if (queuedAssets === 0) {
        queueMicrotask(() => {
          onProgress?.(1);
          resolve();
        });
      }
    });
  }

  getTexture(key: AssetTextureKey): THREE.Texture {
    const texture = this.textureMap[key];
    if (!texture) {
      throw new Error(`Texture '${key}' was requested before load completion.`);
    }
    return texture;
  }

  private enqueueAssets(): number {
    let queued = 0;

    for (const entry of TEXTURE_ENTRIES) {
      this.textureMap[entry.key] = this.textures.load(entry.path);
      queued += 1;
    }

    return queued;
  }
}
