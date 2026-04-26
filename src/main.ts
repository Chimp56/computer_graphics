import "./style.css";
import * as THREE from "three";
import { Loader } from "./ui/Loader";
import { AssetManifest } from "./assets/AssetManifest";
import { Renderer } from "./core/Renderer";
import { createScene } from "./core/Scene";
import { GameClock } from "./core/Clock";
import { EventBus, type GameEvents } from "./core/EventBus";
import { Island } from "./world/Island";
import { GameStateManager } from "./game/GameStateManager";
import { TriggerVolumes } from "./world/TriggerVolumes";
import { FinishBell } from "./world/FinishBell";

const loader = new Loader();
const assets = new AssetManifest();
const bus = new EventBus<GameEvents>();

let renderer: Renderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let clock: GameClock;
let island: Island | null = null;
let gsm: GameStateManager | null = null;
let triggers: TriggerVolumes | null = null;
let bell: FinishBell | null = null;

let coreInitialized = false;

// Expose bus and gsm on window for in-browser testing.
(window as unknown as Record<string, unknown>).bus = bus;
(window as unknown as Record<string, unknown>).getGsm = () => gsm;

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

    const spawnPos = new THREE.Vector3(
      spawnX,
      Number.isFinite(spawnHeight) ? spawnHeight + 1.5 : 8,
      spawnZ,
    );

    camera.position.copy(spawnPos).y += 1.5;
    camera.lookAt(0, Number.isFinite(centerHeight) ? centerHeight + 4 : 4, 0);

    // Finish bell placed near the centre of the island.
    const bellX = 0;
    const bellZ = -40;
    const bellHeight = island.getHeightAt(bellX, bellZ);
    const bellPos = new THREE.Vector3(
      bellX,
      Number.isFinite(bellHeight) ? bellHeight : 4,
      bellZ,
    );
    bell = new FinishBell(bellPos);
    scene.add(bell.group);

    // Game state manager — checkpoint at spawn.
    gsm = new GameStateManager(spawnPos, bus);
    gsm.onRespawn = (pos) => {
      camera.position.set(pos.x, pos.y + 1.5, pos.z);
      camera.lookAt(0, Number.isFinite(centerHeight) ? centerHeight + 4 : 4, 0);
      triggers?.reset();
    };
    gsm.onWin = (formattedTime) => {
      bell?.ring();
      // HUD win panel will be wired in Phase 8; log for now.
      console.log(`Run complete! Time: ${formattedTime}`);
    };

    // Trigger volumes — start zone near spawn, finish zone at bell.
    const startCenter = spawnPos.clone().setY(spawnPos.y + 1);
    triggers = new TriggerVolumes(startCenter, bellPos.clone().setY(bellPos.y + 1), bus);
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

  clock.tick((dt) => {
    // Per-frame update order (CLAUDE.md):
    // 1. Input          — Phase 3
    // 2. Player physics — Phase 3
    // 3. Collision      — Phase 4
    // 4. Triggers & interactions
    if (gsm && triggers) {
      triggers.update(camera.position, gsm.getState());
    }
    // 5. Game state & timer
    gsm?.update(dt);
    // 6. Obstacles      — Phase 6
    // 7. Bell animation
    bell?.update(dt);
  });

  renderer.render(scene, camera);
}
