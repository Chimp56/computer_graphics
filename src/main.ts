import "./style.css";
import * as THREE from "three";
import { Loader } from "./ui/Loader";
import { AssetManifest } from "./assets/AssetManifest";
import { Renderer } from "./core/Renderer";
import { createScene } from "./core/Scene";
import { GameClock } from "./core/Clock";
import { EventBus, type GameEvents } from "./core/EventBus";
import { Island } from "./world/Island";

const loader = new Loader();
const assets = new AssetManifest();
const bus = new EventBus<GameEvents>();

let renderer: Renderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let clock: GameClock;
let island: Island | null = null;

let coreInitialized = false;

void bus;

void startLoading();

loader.onRetry(() => {
  void startLoading();
});

loader.onStart(() => {
  startImmersiveMode(renderer.domElement);
  raf();
});

async function startLoading(): Promise<void> {
  try {
    await assets.loadAll((v) => loader.setProgress(v));
    await initGame();
    await loader.showReady();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown loading error";
    loader.showError(msg);
  }
}

async function initGame(): Promise<void> {
  if (!coreInitialized) {
    renderer = new Renderer();
    scene = createScene();
    clock = new GameClock();

    camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );

    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(80, 120, 40);
    scene.add(sun);

    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });

    coreInitialized = true;
  }

  if (!island) {
    island = await Island.create({
      textureLoader: assets.textures,
      sandTextureUrl: "/textures/sand.png",
    });
    scene.add(island.mesh);

    const spawnX = 0;
    const spawnZ = 70;
    const spawnHeight = island.getHeightAt(spawnX, spawnZ);
    const centerHeight = island.getHeightAt(0, 0);

    camera.position.set(
      spawnX,
      Number.isFinite(spawnHeight) ? spawnHeight + 3 : 8,
      spawnZ,
    );
    camera.lookAt(0, Number.isFinite(centerHeight) ? centerHeight + 4 : 4, 0);
  }
}

function startImmersiveMode(canvas: HTMLCanvasElement): void {
  canvas.requestPointerLock?.();

  if (document.fullscreenElement) {
    return;
  }

  const root = document.documentElement as HTMLElement & {
    requestFullscreen?: () => Promise<void>;
  };

  const request = root.requestFullscreen?.();
  if (request) {
    void request.catch(() => {
      // Ignore fullscreen rejection; gameplay still starts in viewport mode.
    });
  }
}

function raf(): void {
  requestAnimationFrame(raf);

  clock.tick((_dt) => {
    // Phase 2+: player update, collision, triggers, game state, obstacles
  });

  renderer.render(scene, camera);
}
