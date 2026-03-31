import * as THREE from "three";

/**
 * Central asset-loading hub.
 *
 * All textures, models, and audio should load through the shared manager
 * so the loading UI can track total progress.
 */
export class AssetManifest {
  public readonly manager: THREE.LoadingManager;
  public readonly textures: THREE.TextureLoader;

  constructor() {
    this.manager = new THREE.LoadingManager();
    this.textures = new THREE.TextureLoader(this.manager);
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

  /**
   * Register every asset that must be loaded before gameplay.
   *
   * Phase 1: no startup assets yet.
   */
  private enqueueAssets(): number {
    let queued = 0;

    // Example for later phases:
    // this.textures.load("/textures/sand.jpg");
    // queued += 1;

    return queued;
  }
}
