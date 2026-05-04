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
import { Sky } from "./world/Sky";
import { GameStateManager } from "./game/GameStateManager";
import { TriggerVolumes } from "./world/TriggerVolumes";
import { FinishBell } from "./world/FinishBell";
import { MushroomEnemy } from "./enemies/MushroomEnemy";
import { BasketHoop } from "./world/BasketHoop";
import { Basketball } from "./interactions/Basketball";
import { Coin } from "./world/Coin";
import { HUD } from "./ui/HUD";
import { Level } from "./world/Level";
import { Portal } from "./world/Portal";
import { WaterfallLevel } from "./world/WaterfallLevel";
import { FountainLevel } from "./world/FountainLevel";
import { FinalLevel } from "./world/FinalLevel";
import { Fireworks } from "./effects/Fireworks";

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
let sky: Sky | null = null;
let respawnCooldown = 0;
let pistonHitCooldown = 0;
let plungerHitCooldown = 0;
let gsm: GameStateManager | null = null;
let triggers: TriggerVolumes | null = null;
let bell: FinishBell | null = null;
let hoop: BasketHoop | null = null;
let basketball: Basketball | null = null;
let interactionPromptEl: HTMLDivElement | null = null;

type LevelLocation =
  | "island"
  | "level1"
  | "level2"
  | "level3"
  | "level4"
  | "level5";
let level1: Level | null = null;
let level2: Level | null = null;
let level3: WaterfallLevel | null = null;
let level4: FountainLevel | null = null;
let level5: FinalLevel | null = null;
let islandPortalToL1: Portal | null = null;
let islandPortalToL2: Portal | null = null;
let islandPortalToL3: Portal | null = null;
let islandPortalToL4: Portal | null = null;
let islandPortalToL5: Portal | null = null;
let l1ExitToIsland: Portal | null = null;
let l1ExitToL2: Portal | null = null;
let l2ExitToIsland: Portal | null = null;
let l3ExitToIsland: Portal | null = null;
let l4ExitToIsland: Portal | null = null;
let l5ExitToIsland: Portal | null = null;
let l1StartToIsland: Portal | null = null;
let l2StartToIsland: Portal | null = null;
let l3StartToIsland: Portal | null = null;
let l4StartToIsland: Portal | null = null;
let l5StartToIsland: Portal | null = null;
const levelState = {
  current: "island" as LevelLocation,
  level1Beaten: false,
  level2Beaten: false,
  level3Beaten: false,
  level4Beaten: false,
  islandSpawn: new THREE.Vector3(),
  islandReturnSpawn: new THREE.Vector3(),
  level1Spawn: new THREE.Vector3(180, 26, 22),
  level2Spawn: new THREE.Vector3(-200, 27, 22),
  level3Spawn: new THREE.Vector3(-22, 26, 200),
  level4Spawn: new THREE.Vector3(0, 26.05, -167),
  level5Spawn: new THREE.Vector3(-120, 35.4, 86),
};
let level5LastSection: "section1" | "section2" | "section3" | null = null;
let fireworks: Fireworks | null = null;

let interactPressed = false;
let mouseLeftDown = false;
let mouseLeftReleased = false;
let trajectoryPreviewEnabled = false;
let isJumping = false;
const mushroomEnemies: MushroomEnemy[] = [];
const coins: Coin[] = [];
let hud: HUD | null = null;



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
const CAMERA_DISTANCE = 5.5;
const CAMERA_HEIGHT = 2.5;

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
    hud = new HUD();


    camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.rotation.order = "YXZ";

    sky = new Sky();
    scene.add(sky.group);

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
      heightmapUrl: "/textures/heightmap2.png",
      sandTextureUrl: "/textures/sand.png",
      maxHeight: 18,
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
    water = await Water.create({
      textureLoader: assets.textures,
      textureUrl: "/textures/water.png",
    });
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

  levelState.islandSpawn.set(spawnX, spawnY, spawnZ);
  buildLevels();

  if (!fireworks) {
    fireworks = new Fireworks();
    scene.add(fireworks.points);
  }

  if (mushroomEnemies.length === 0) {
  const enemyPlacements: [number, number][] = [
    [10, 40],
    [-10, 20],
    [5, 0],
  ];
  for (const [ex, ez] of enemyPlacements) {
    const enemy = new MushroomEnemy();
    await enemy.load(scene);
    const ey = island.getHeightAt(ex, ez);
    enemy.group.position.set(ex, Number.isFinite(ey) ? ey : 0, ez);
    mushroomEnemies.push(enemy);
  }
}

  if (coins.length === 0) {
    const coinPlacements: [number, number][] = [
      [5, 40],
      [-5, 20],
      [8, 0],
    ];
    for (const [cx, cz] of coinPlacements) {
      const coin = new Coin();
      await coin.load(scene);
      const cy = island.getHeightAt(cx, cz);
      coin.group.position.set(cx, Number.isFinite(cy) ? cy + 1 : 1, cz);
      coins.push(coin);
    }
  }

  yaw = 0;
  pitch = -0.12;
  updateCameraTransform();
}

function buildLevels(): void {
  if (level1 || level2) return;

  const PLATFORM_Y = 25;

  level1 = new Level({
    platformY: PLATFORM_Y,
    color: 0x9c7a55,
    platforms: [
      { x: 180, z: 22, width: 12, depth: 12 },
      { x: 180, z: 2, width: 12, depth: 20 },
      { x: 180, z: -16, width: 20, depth: 14 },
    ],
    wipeoutPositions: [[180, 2]],
  });
  scene.add(level1.group);

  level2 = new Level({
    platformY: PLATFORM_Y,
    color: 0x5a4a86,
    platforms: [
      { x: -200, z: 24, width: 12, depth: 12 },
      { x: -200, z: 9, width: 12, depth: 12 },
      { x: -200, z: -7, width: 12, depth: 12 },
      { x: -200, z: -27, width: 16, depth: 18 },
    ],
    wipeoutPositions: [
      [-200, 9],
      [-200, -7],
      [-200, -22],
    ],
  });
  scene.add(level2.group);

  const portalL1Pos = new THREE.Vector3(-16, 0, -20);
  const portalL1Ground = island!.getHeightAt(portalL1Pos.x, portalL1Pos.z);
  portalL1Pos.y = Number.isFinite(portalL1Ground) ? portalL1Ground : 5;
  islandPortalToL1 = new Portal({
    position: portalL1Pos,
    color: 0x33d6ff,
    faceNormal: new THREE.Vector3(0, 0, 1),
  });
  scene.add(islandPortalToL1.group);

  const portalL2Pos = new THREE.Vector3(-8, 0, -20);
  const portalL2Ground = island!.getHeightAt(portalL2Pos.x, portalL2Pos.z);
  portalL2Pos.y = Number.isFinite(portalL2Ground) ? portalL2Ground : 5;
  islandPortalToL2 = new Portal({
    position: portalL2Pos,
    color: 0xff66cc,
    faceNormal: new THREE.Vector3(0, 0, 1),
  });
  islandPortalToL2.setVisible(false);
  scene.add(islandPortalToL2.group);

  const returnX = portalL2Pos.x;
  const returnZ = portalL2Pos.z + 4;
  const returnGround = island!.getHeightAt(returnX, returnZ);
  const returnY = Number.isFinite(returnGround) ? returnGround : 5;
  levelState.islandReturnSpawn.set(returnX, returnY + 0.1, returnZ);

  l1ExitToIsland = new Portal({
    position: new THREE.Vector3(174, PLATFORM_Y, -18),
    color: 0x33d6ff,
    faceNormal: new THREE.Vector3(0, 0, 1),
  });
  scene.add(l1ExitToIsland.group);

  l1ExitToL2 = new Portal({
    position: new THREE.Vector3(186, PLATFORM_Y, -18),
    color: 0xff66cc,
    faceNormal: new THREE.Vector3(0, 0, 1),
  });
  scene.add(l1ExitToL2.group);

  l2ExitToIsland = new Portal({
    position: new THREE.Vector3(-200, PLATFORM_Y, -33),
    color: 0x33d6ff,
    faceNormal: new THREE.Vector3(0, 0, 1),
  });
  scene.add(l2ExitToIsland.group);

  level3 = new WaterfallLevel({
    center: new THREE.Vector3(0, PLATFORM_Y, 200),
  });
  scene.add(level3.group);

  l3ExitToIsland = new Portal({
    position: new THREE.Vector3(28, PLATFORM_Y, 200),
    color: 0x33d6ff,
    faceNormal: new THREE.Vector3(1, 0, 0),
  });
  scene.add(l3ExitToIsland.group);

  const portalL3Pos = new THREE.Vector3(0, 0, -20);
  const portalL3Ground = island!.getHeightAt(portalL3Pos.x, portalL3Pos.z);
  portalL3Pos.y = Number.isFinite(portalL3Ground) ? portalL3Ground : 5;
  islandPortalToL3 = new Portal({
    position: portalL3Pos,
    color: 0xffcc33,
    faceNormal: new THREE.Vector3(0, 0, 1),
  });
  islandPortalToL3.setVisible(false);
  scene.add(islandPortalToL3.group);

  level4 = new FountainLevel({
    footCenter: new THREE.Vector3(0, 25, -160),
  });
  scene.add(level4.group);
  levelState.level4Spawn.set(
    level4.footCenter.x,
    level4.footCenter.y + 0.4,
    level4.footCenter.z - 1.5,
  );

  l4ExitToIsland = new Portal({
    position: new THREE.Vector3(
      level4.topCenter.x,
      level4.topCenter.y,
      level4.topCenter.z + 1.5,
    ),
    color: 0x33d6ff,
    faceNormal: new THREE.Vector3(0, 0, -1),
  });
  scene.add(l4ExitToIsland.group);

  l1StartToIsland = new Portal({
    position: new THREE.Vector3(180, PLATFORM_Y, 27.5),
    color: 0x33d6ff,
    faceNormal: new THREE.Vector3(0, 0, -1),
  });
  scene.add(l1StartToIsland.group);

  l2StartToIsland = new Portal({
    position: new THREE.Vector3(-200, PLATFORM_Y, 28.5),
    color: 0x33d6ff,
    faceNormal: new THREE.Vector3(0, 0, -1),
  });
  scene.add(l2StartToIsland.group);

  l3StartToIsland = new Portal({
    position: new THREE.Vector3(-29, PLATFORM_Y, 200),
    color: 0x33d6ff,
    faceNormal: new THREE.Vector3(1, 0, 0),
  });
  scene.add(l3StartToIsland.group);

  const l4StartZ = level4.footCenter.z - 1;
  const l4StartY = (level4.getHeightAt(level4.footCenter.x, l4StartZ) ?? level4.footCenter.y);
  l4StartToIsland = new Portal({
    position: new THREE.Vector3(level4.footCenter.x, l4StartY, l4StartZ),
    color: 0x33d6ff,
    faceNormal: new THREE.Vector3(0, 0, 1),
  });
  scene.add(l4StartToIsland.group);

  const portalL4Pos = new THREE.Vector3(8, 0, -20);
  const portalL4Ground = island!.getHeightAt(portalL4Pos.x, portalL4Pos.z);
  portalL4Pos.y = Number.isFinite(portalL4Ground) ? portalL4Ground : 5;
  islandPortalToL4 = new Portal({
    position: portalL4Pos,
    color: 0x66ff99,
    faceNormal: new THREE.Vector3(0, 0, 1),
  });
  islandPortalToL4.setVisible(false);
  scene.add(islandPortalToL4.group);

  level5 = new FinalLevel();
  scene.add(level5.group);
  levelState.level5Spawn.copy(level5.startSpawn);

  l5StartToIsland = new Portal({
    position: level5.startPortalPosition.clone(),
    color: 0x33d6ff,
    faceNormal: new THREE.Vector3(0, 0, -1),
  });
  scene.add(l5StartToIsland.group);

  l5ExitToIsland = new Portal({
    position: level5.topPortalPosition.clone(),
    color: 0xffd633,
    faceNormal: new THREE.Vector3(0, 0, -1),
  });
  scene.add(l5ExitToIsland.group);

  const portalL5Pos = new THREE.Vector3(16, 0, -20);
  const portalL5Ground = island!.getHeightAt(portalL5Pos.x, portalL5Pos.z);
  portalL5Pos.y = Number.isFinite(portalL5Ground) ? portalL5Ground : 5;
  islandPortalToL5 = new Portal({
    position: portalL5Pos,
    color: 0xffd633,
    faceNormal: new THREE.Vector3(0, 0, 1),
  });
  islandPortalToL5.setVisible(false);
  scene.add(islandPortalToL5.group);
}

function transitionTo(loc: LevelLocation): void {
  levelState.current = loc;
  let target: THREE.Vector3;
  if (loc === "island") target = levelState.islandReturnSpawn;
  else if (loc === "level1") target = levelState.level1Spawn;
  else if (loc === "level2") target = levelState.level2Spawn;
  else if (loc === "level3") target = levelState.level3Spawn;
  else if (loc === "level4") target = levelState.level4Spawn;
  else target = levelState.level5Spawn;

  player?.teleport(target.clone());
  if (gsm) gsm.context.checkpoint.copy(target);
  triggers?.reset();
  respawnCooldown = 0.5;

  if (loc === "level5") {
    level5?.resetCheckpoints();
    levelState.level5Spawn.copy(level5?.getActiveSpawn() ?? levelState.level5Spawn);
    level5LastSection = null;
    applyLevel5Physics(level5?.getActiveSection(target) ?? "section1");
  } else if (loc === "level3") {
    player?.setSlipperyFactor(0.78);
    player?.setExternalAccel(new THREE.Vector3(0, 0, 0));
  } else if (loc === "level4") {
    player?.setSlipperyFactor(0.92);
    player?.setExternalAccel(new THREE.Vector3(0, 0, 8));
  } else {
    player?.setSlipperyFactor(0);
    player?.setExternalAccel(new THREE.Vector3(0, 0, 0));
  }

  islandPortalToL2?.setVisible(levelState.level1Beaten);
  islandPortalToL3?.setVisible(levelState.level2Beaten);
  islandPortalToL4?.setVisible(levelState.level3Beaten);
  islandPortalToL5?.setVisible(levelState.level4Beaten);
}

function applyLevel5Physics(section: "section1" | "section2" | "section3"): void {
  if (!player) return;
  if (level5LastSection === section) return;
  level5LastSection = section;
  if (section === "section1") {
    player.setSlipperyFactor(0);
    player.setExternalAccel(new THREE.Vector3(0, 0, 0));
  } else if (section === "section2") {
    player.setSlipperyFactor(0.78);
    player.setExternalAccel(new THREE.Vector3(0, 0, 0));
  } else {
    player.setSlipperyFactor(0.92);
    player.setExternalAccel(new THREE.Vector3(0, 0, 8));
  }
}

function respawnInCurrentLocation(): void {
  if (!player) return;
  let target: THREE.Vector3;
  if (levelState.current === "island") {
    target = water!.randomSpawn((x, z) => island!.getHeightAt(x, z));
  } else if (levelState.current === "level1") {
    target = levelState.level1Spawn.clone();
  } else if (levelState.current === "level2") {
    target = levelState.level2Spawn.clone();
  } else if (levelState.current === "level3") {
    target = levelState.level3Spawn.clone();
  } else if (levelState.current === "level4") {
    target = levelState.level4Spawn.clone();
  } else {
    target = (level5?.getActiveSpawn() ?? levelState.level5Spawn).clone();
  }
  player.teleport(target);
  triggers?.reset();
  respawnCooldown = 1.5;

  if (levelState.current === "level5" && level5) {
    level5LastSection = null;
    applyLevel5Physics(level5.getActiveSection(target));
  }
}

function bindInput(): void {
  window.addEventListener("keydown", (event) => {
    if (event.code === "KeyW") input.forward = true;
    if (event.code === "KeyS") input.backward = true;
    if (event.code === "KeyA") input.left = true;
    if (event.code === "KeyD") input.right = true;
    if (event.code === "Space") {
      input.jump = true;
      isJumping = true;
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

    let groundHeight: number | undefined;
    if (levelState.current === "island") {
      const h = island.getHeightAt(player.position.x, player.position.z);
      groundHeight = Number.isFinite(h) ? h : undefined;
    } else if (levelState.current === "level1" || levelState.current === "level2") {
      const lvl = levelState.current === "level1" ? level1 : level2;
      const h = lvl?.getHeightAt(player.position.x, player.position.z) ?? null;
      groundHeight = h ?? undefined;
    } else if (levelState.current === "level3") {
      const h = level3?.getHeightAt(player.position.x, player.position.z) ?? null;
      groundHeight = h ?? undefined;
    } else if (levelState.current === "level4") {
      const h = level4?.getHeightAt(player.position.x, player.position.z) ?? null;
      groundHeight = h ?? undefined;
    } else {
      const h = level5?.getHeightAt(player.position.x, player.position.z) ?? null;
      groundHeight = h ?? undefined;
    }
    player.update(dt, groundHeight);

    for (const obs of wipeouts) obs.update(dt);
    level1?.update(dt);
    level2?.update(dt);
    level3?.update(dt);
    level4?.update(dt);
    level5?.update(dt);
    fireworks?.update(dt);

    const activeWipeouts =
      levelState.current === "island"
        ? wipeouts
        : levelState.current === "level1"
          ? level1?.wipeouts ?? []
          : levelState.current === "level2"
            ? level2?.wipeouts ?? []
            : levelState.current === "level5"
              ? level5?.wipeouts ?? []
              : [];

    for (const obs of activeWipeouts) {
      const solid = obs.checkSolid(player.position);
      if (solid) player.position.add(solid);

      // Arm hit → respawn immediately (same cooldown as water respawn)
      if (obs.checkKnockback(player.position) && respawnCooldown === 0 && water) {
        respawnInCurrentLocation();
        break;
      }
    }

    if (water) {
      water.update(dt);
      respawnCooldown = Math.max(0, respawnCooldown - dt);
      if (player.position.y < WATER_LEVEL && respawnCooldown === 0) {
        respawnInCurrentLocation();
      }
    }

    for (const enemy of mushroomEnemies) {
    enemy.update(dt);
    if (enemy.checkHit(player.position) && respawnCooldown === 0 && water) {
      const spawn = water.randomSpawn((x, z) => island!.getHeightAt(x, z));
      player.teleport(spawn);
      respawnCooldown = 1.5;
      }
    }

    for (const coin of coins) {
    coin.update(dt);
    if (coin.checkCollect(player.position)) {
      hud?.addCoin();
    }
  }

    updatePortals(dt);

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

    const isMoving = input.forward || input.backward || input.left || input.right;

    if (isJumping || !player.isGrounded) {
      playerMesh.playAnimation("jump", true);
      if (player.isGrounded) isJumping = false;
    } else if (isMoving) {
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
    // 7. Bell + hoop + sky animation
    bell?.update(dt);
    hoop?.update(dt);
    sky?.update(dt);
  });

  renderer.render(scene, camera);
}

function updatePortals(dt: number): void {
  if (!player) return;

  islandPortalToL1?.update(dt);
  islandPortalToL2?.update(dt);
  islandPortalToL3?.update(dt);
  islandPortalToL4?.update(dt);
  islandPortalToL5?.update(dt);
  l1ExitToIsland?.update(dt);
  l1ExitToL2?.update(dt);
  l2ExitToIsland?.update(dt);
  l3ExitToIsland?.update(dt);
  l4ExitToIsland?.update(dt);
  l5ExitToIsland?.update(dt);
  l1StartToIsland?.update(dt);
  l2StartToIsland?.update(dt);
  l3StartToIsland?.update(dt);
  l4StartToIsland?.update(dt);
  l5StartToIsland?.update(dt);

  const pos = player.position;

  if (levelState.current === "island") {
    if (islandPortalToL1?.checkEnter(pos)) {
      transitionTo("level1");
      return;
    }
    if (
      islandPortalToL2?.group.visible &&
      islandPortalToL2.checkEnter(pos)
    ) {
      transitionTo("level2");
      return;
    }
    if (
      islandPortalToL3?.group.visible &&
      islandPortalToL3.checkEnter(pos)
    ) {
      transitionTo("level3");
      return;
    }
    if (
      islandPortalToL4?.group.visible &&
      islandPortalToL4.checkEnter(pos)
    ) {
      transitionTo("level4");
      return;
    }
    if (
      islandPortalToL5?.group.visible &&
      islandPortalToL5.checkEnter(pos)
    ) {
      transitionTo("level5");
    }
    return;
  }

  if (levelState.current === "level1") {
    if (l1StartToIsland?.checkEnter(pos)) {
      transitionTo("island");
      return;
    }
    if (l1ExitToIsland?.checkEnter(pos)) {
      levelState.level1Beaten = true;
      transitionTo("island");
      return;
    }
    if (l1ExitToL2?.checkEnter(pos)) {
      levelState.level1Beaten = true;
      transitionTo("level2");
    }
    return;
  }

  if (levelState.current === "level2") {
    if (l2StartToIsland?.checkEnter(pos)) {
      transitionTo("island");
      return;
    }
    if (l2ExitToIsland?.checkEnter(pos)) {
      levelState.level2Beaten = true;
      transitionTo("island");
    }
    return;
  }

  if (levelState.current === "level3") {
    if (l3StartToIsland?.checkEnter(pos)) {
      transitionTo("island");
      return;
    }
    if (l3ExitToIsland?.checkEnter(pos)) {
      levelState.level3Beaten = true;
      transitionTo("island");
    }
    return;
  }

  if (levelState.current === "level4") {
    if (l4StartToIsland?.checkEnter(pos)) {
      transitionTo("island");
      return;
    }
    if (l4ExitToIsland?.checkEnter(pos)) {
      levelState.level4Beaten = true;
      transitionTo("island");
    }
    return;
  }

  if (levelState.current === "level5") {
    if (l5StartToIsland?.checkEnter(pos)) {
      transitionTo("island");
      return;
    }
    if (l5ExitToIsland?.checkEnter(pos)) {
      transitionTo("island");
      fireworks?.celebrate(new THREE.Vector3(0, 22, 0));
    }
  }
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
