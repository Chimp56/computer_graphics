import "./style.css";
import * as THREE from "three";
import { Loader } from "./ui/Loader";
import { AssetManifest } from "./assets/AssetManifest";
import { Renderer } from "./core/Renderer";
import { createScene } from "./core/Scene";
import { GameClock } from "./core/Clock";
import { EventBus, type GameEvents } from "./core/EventBus";

const loader = new Loader();
const assets = new AssetManifest();
const bus = new EventBus<GameEvents>();

let renderer: Renderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let clock: GameClock;

void bus;

startLoading();

loader.onRetry(() => {
  startLoading();
});

loader.onStart(() => {
  initGame();
  startImmersiveMode(renderer.domElement);
  raf();
});

async function startLoading(): Promise<void> {
  try {
    await assets.loadAll((v) => loader.setProgress(v));
    await loader.showReady();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown loading error";
    loader.showError(msg);
  }
}

function initGame(): void {
  renderer = new Renderer();
  scene = createScene();
  clock = new GameClock();

  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 2, 5);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });
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
