import "./style.css";
import * as THREE from "three";
import { Loader } from "./ui/Loader";
import { AssetManifest } from "./assets/AssetManifest";
import { Renderer } from "./core/Renderer";
import { createScene } from "./core/Scene";
import { GameClock } from "./core/Clock";
import { EventBus, type GameEvents } from "./core/EventBus";
import { Island } from "./world/Island";
import {
  PlayerController,
  type CameraBasis,
  type PlayerInputState,
} from "./player/PlayerController";
import { WipeoutObstacle } from "./obstacles/WipeoutObstacle";
import { Water, WATER_LEVEL } from "./world/Water";

const PLAYER_EYE_HEIGHT = 1.7;
const LOOK_SENSITIVITY = 0.002;
const MAX_PITCH = Math.PI * 0.49;

const loader = new Loader();
const assets = new AssetManifest();
const bus = new EventBus<GameEvents>();

let renderer: Renderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let clock: GameClock;
let island: Island | null = null;
let player: PlayerController | null = null;
const wipeouts: WipeoutObstacle[] = [];
let water: Water | null = null;
let respawnCooldown = 0;

let coreInitialized = false;

const input: PlayerInputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  descend: false,
};

const cameraBasis: CameraBasis = {
  forward: new THREE.Vector3(0, 0, -1),
  right: new THREE.Vector3(1, 0, 0),
};

let yaw = 0;
let pitch = -0.12;

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
    camera.rotation.order = "YXZ";

    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(80, 120, 40);
    scene.add(sun);

    bindInput();

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
  }

  if (!player) {
    player = new PlayerController(input, cameraBasis);
    player.init();
  }

  const spawnX = 0;
  const spawnZ = 70;
  const spawnHeight = island.getHeightAt(spawnX, spawnZ);
  const spawnY = Number.isFinite(spawnHeight) ? spawnHeight : 5;

  player.position.set(spawnX, spawnY, spawnZ);

  if (!water) {
    water = new Water();
    scene.add(water.mesh);
  }

  if (wipeouts.length === 0) {
    const placements: [number, number][] = [
      [0, 45],
      [-6, 20],
      [7, 0],
    ];
    for (const [wx, wz] of placements) {
      const obs = new WipeoutObstacle();
      const gy = island.getHeightAt(wx, wz);
      obs.place(wx, wz, Number.isFinite(gy) ? gy : 0);
      scene.add(obs.mesh);
      wipeouts.push(obs);
    }
  }

  yaw = 0;
  pitch = -0.12;
  updateCameraTransform();
}

function bindInput(): void {
  window.addEventListener("keydown", (event) => {
    if (event.code === "KeyW") input.forward = true;
    if (event.code === "KeyS") input.backward = true;
    if (event.code === "KeyA") input.left = true;
    if (event.code === "KeyD") input.right = true;
    if (event.code === "Space") {
      input.jump = true;
      event.preventDefault();
    }
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") input.descend = true;
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "KeyW") input.forward = false;
    if (event.code === "KeyS") input.backward = false;
    if (event.code === "KeyA") input.left = false;
    if (event.code === "KeyD") input.right = false;
    if (event.code === "Space") input.jump = false;
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") input.descend = false;
  });

  renderer.domElement.addEventListener("click", () => {
    if (document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock?.();
    }
  });

  window.addEventListener("mousemove", (event) => {
    const pointerLocked = document.pointerLockElement === renderer.domElement;

    if (pointerLocked) {
      yaw -= event.movementX * LOOK_SENSITIVITY;
      pitch -= event.movementY * LOOK_SENSITIVITY;
      pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
      return;
    }

    const nx = event.clientX / window.innerWidth;
    const ny = event.clientY / window.innerHeight;

    yaw = (0.5 - nx) * Math.PI * 2;
    pitch = (0.5 - ny) * MAX_PITCH * 2;
    pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
  });
}

function startImmersiveMode(canvas: HTMLCanvasElement): void {
  const requestPointerLock = (): void => {
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  };

  if (document.fullscreenElement) {
    requestPointerLock();
    return;
  }

  const root = document.documentElement as HTMLElement & {
    requestFullscreen?: () => Promise<void>;
  };

  const request = root.requestFullscreen?.();
  if (request) {
    void request
      .catch(() => {
        // Ignore fullscreen rejection; gameplay still starts in viewport mode.
      })
      .finally(() => {
        requestPointerLock();
      });
    return;
  }

  requestPointerLock();
}

function raf(): void {
  requestAnimationFrame(raf);

  clock.tick((dt) => {
    if (!player || !island) {
      return;
    }

    updateCameraBasis();

    const groundHeight = island.getHeightAt(player.position.x, player.position.z);
    player.update(dt, Number.isFinite(groundHeight) ? groundHeight : undefined);

    for (const obs of wipeouts) {
      obs.update(dt);
      const hit = obs.checkCollision(player.position);
      if (hit) {
        player.applyImpulse(hit.multiplyScalar(22));
      }
    }

    if (water) {
      water.update(dt);
      respawnCooldown = Math.max(0, respawnCooldown - dt);
      if (player.position.y < WATER_LEVEL && respawnCooldown === 0) {
        const spawn = water.randomSpawn((x, z) => island!.getHeightAt(x, z));
        player.teleport(spawn);
        respawnCooldown = 1.5;
      }
    }

    updateCameraTransform();
  });

  renderer.render(scene, camera);
}

function updateCameraBasis(): void {
  camera.rotation.set(pitch, yaw, 0);
  camera.getWorldDirection(cameraBasis.forward);
  cameraBasis.forward.normalize();
  cameraBasis.right
    .crossVectors(cameraBasis.forward, THREE.Object3D.DEFAULT_UP)
    .normalize();
}

function updateCameraTransform(): void {
  if (!player) {
    return;
  }

  camera.rotation.set(pitch, yaw, 0);
  camera.position.set(
    player.position.x,
    player.position.y + PLAYER_EYE_HEIGHT,
    player.position.z,
  );
}
