import "./style.css";
import * as THREE from "three";
import { Loader } from "./ui/Loader";
import { AssetManifest } from "./assets/AssetManifest";
import { Renderer } from "./core/Renderer";
import { createScene } from "./core/Scene";
import { GameClock } from "./core/Clock";
import { PlayerMesh } from "./player/PlayerMesh";
import { EventBus, type GameEvents } from "./core/EventBus";
import { Island } from "./world/Island";
import {
  PlayerController,
  type CameraBasis,
  type PlayerInputState,
} from "./player/PlayerController";
import { WipeoutObstacle } from "./obstacles/WipeoutObstacle";
import { Water, WATER_LEVEL } from "./world/Water";
import { GameStateManager } from "./game/GameStateManager";
import { TriggerVolumes } from "./world/TriggerVolumes";
import { FinishBell } from "./world/FinishBell";
import { BasketHoop } from "./world/BasketHoop";
import { Basketball } from "./interactions/Basketball";

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
let gsm: GameStateManager | null = null;
let triggers: TriggerVolumes | null = null;
let bell: FinishBell | null = null;
let hoop: BasketHoop | null = null;
let basketball: Basketball | null = null;
let interactionPromptEl: HTMLDivElement | null = null;

let interactPressed = false;
let mouseLeftDown = false;
let mouseLeftReleased = false;
let trajectoryPreviewEnabled = false;

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

let playerMesh: PlayerMesh | null = null;
const CAMERA_DISTANCE = 8;
const CAMERA_HEIGHT = 3;

void bus;
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
    camera.rotation.order = "YXZ";

    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(80, 120, 40);
    scene.add(sun);

    bindInput();

    interactionPromptEl = document.createElement("div");
    interactionPromptEl.className = "interaction-prompt hidden";
    document.body.appendChild(interactionPromptEl);

    bus.on("targetHit", ({ targetId }) => {
      console.log(`Basket hit: ${targetId}`);
    });

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

    const spawnX = 0;
    const spawnZ = 70;
    const spawnHeight = island.getHeightAt(spawnX, spawnZ);
    const spawnY = Number.isFinite(spawnHeight) ? spawnHeight : 5;
    const spawnPos = new THREE.Vector3(spawnX, spawnY, spawnZ);

    gsm = new GameStateManager(spawnPos, bus);
    gsm.onRespawn = (pos) => {
      player?.position.set(pos.x, pos.y, pos.z);
      basketball?.resetToSpawn();
      triggers?.reset();
    };
    gsm.onWin = (formattedTime) => {
      bell?.ring();
      console.log(`Run complete! Time: ${formattedTime}`);
    };

    const startCenter = spawnPos.clone().setY(spawnY + 1);
    triggers = new TriggerVolumes(
      startCenter,
      bellPos.clone().setY(bellPos.y + 1),
      bus,
    );

    const hoopX = -12;
    const hoopZ = -14;
    const hoopGround = island.getHeightAt(hoopX, hoopZ);
    const hoopPos = new THREE.Vector3(
      hoopX,
      Number.isFinite(hoopGround) ? hoopGround : 5,
      hoopZ,
    );
    hoop = new BasketHoop(hoopPos);
    scene.add(hoop.group);

    const ballX = -7;
    const ballZ = -4;
    const ballGround = island.getHeightAt(ballX, ballZ);
    const ballSpawn = new THREE.Vector3(
      ballX,
      (Number.isFinite(ballGround) ? ballGround : 5) + 0.34,
      ballZ,
    );
    basketball = await Basketball.create({
      textureLoader: assets.textures,
      textureUrl: "/textures/basketball_lines.png",
      spawnPosition: ballSpawn,
      hoop,
      bus,
      targetId: "basket-hoop-main",
    });
    basketball.setTrajectoryPreviewEnabled(trajectoryPreviewEnabled);
    scene.add(basketball.mesh);
    scene.add(basketball.trajectoryLine);
  }

  if (!player) {
    player = new PlayerController(input, cameraBasis);
    player.init();
  }

  if (!playerMesh) {
    playerMesh = new PlayerMesh();
    await playerMesh.load(scene);
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
      [0, 50],
      [0, 30],
      [0, 10],
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
    if (event.code === "KeyE" && !event.repeat) interactPressed = true;
    if (event.code === "KeyT" && !event.repeat) {
      trajectoryPreviewEnabled = !trajectoryPreviewEnabled;
      basketball?.setTrajectoryPreviewEnabled(trajectoryPreviewEnabled);
    }
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

  window.addEventListener("mousedown", (event) => {
    if (event.button === 0) {
      mouseLeftDown = true;
    }
  });

  window.addEventListener("mouseup", (event) => {
    if (event.button === 0) {
      mouseLeftDown = false;
      mouseLeftReleased = true;
    }
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
    if (!player || !island || !playerMesh) return;

    const consumedInteract = interactPressed;
    const consumedMouseRelease = mouseLeftReleased;
    interactPressed = false;
    mouseLeftReleased = false;

    // 1. Input (bound via events above)
    // 2. Player physics
    updateCameraBasis();
    const groundHeight = island.getHeightAt(player.position.x, player.position.z);
    player.update(dt, Number.isFinite(groundHeight) ? groundHeight : undefined);

    for (const obs of wipeouts) {
      obs.update(dt);

      // Solid — pole + arms + balls all block the player horizontally
      const solid = obs.checkSolid(player.position);
      if (solid) player.position.add(solid);

      // Arm hit → respawn immediately (same cooldown as water respawn)
      if (obs.checkKnockback(player.position) && respawnCooldown === 0 && water) {
        const spawn = water.randomSpawn((x, z) => island!.getHeightAt(x, z));
        player.teleport(spawn);
        respawnCooldown = 1.5;
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

    basketball?.update({
      dt,
      playerPosition: player.position,
      camera,
      interactPressed: consumedInteract,
      mouseLeftDown,
      mouseLeftReleased: consumedMouseRelease,
      terrainHeightAt: (x, z) => island!.getHeightAt(x, z),
      waterLevel: WATER_LEVEL,
    });

    updateInteractionPrompt(basketball?.getPrompt(player.position) ?? null);

    if (input.jump) {
      playerMesh.playAnimation("jump");
    } else if (input.forward || input.backward || input.left || input.right) {
      playerMesh.playAnimation("walk");
    } else {
      playerMesh.playAnimation("idle");
    }

    playerMesh.update(dt);

    updateCameraTransform();

    // 3. Collision — Phase 4
    // 4. Triggers & interactions
    if (gsm && triggers) {
      triggers.update(player.position, gsm.getState());
    }
    // 5. Game state & timer
    gsm?.update(dt);
    // 6. Obstacles — Phase 6
    // 7. Bell + hoop animation
    bell?.update(dt);
    hoop?.update(dt);
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
  if (!player || !playerMesh) return;

  playerMesh.group.position.copy(player.position);
  playerMesh.group.rotation.y = yaw + Math.PI;

  const offset = new THREE.Vector3(
    Math.sin(yaw) * CAMERA_DISTANCE,
    CAMERA_HEIGHT,
    Math.cos(yaw) * CAMERA_DISTANCE,
  );

  camera.position.copy(player.position).add(offset);
  camera.rotation.set(pitch, yaw, 0);
}

function updateInteractionPrompt(text: string | null): void {
  if (!interactionPromptEl) return;

  if (!text) {
    interactionPromptEl.classList.add("hidden");
    interactionPromptEl.textContent = "";
    return;
  }

  interactionPromptEl.textContent = text;
  interactionPromptEl.classList.remove("hidden");
}
