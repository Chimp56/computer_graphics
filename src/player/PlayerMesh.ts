import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

export class PlayerMesh {
  public group: THREE.Group = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private animations: Record<string, THREE.AnimationAction> = {};
  private currentAction = "idle";
  private loader = new FBXLoader();

load(scene: THREE.Scene): Promise<void> {
  return new Promise((resolve) => {
    this.loader.load(
      "/character/character.fbx",
      (fbx) => {
        fbx.scale.setScalar(0.01);
        this.mixer = new THREE.AnimationMixer(fbx);
        this.group.add(fbx);
        scene.add(this.group);


        const anims = ["idle", "walk", "run", "jump", "crouch"];
        let loaded = 0;

        const checkDone = (): void => {
          loaded++;
          if (loaded === anims.length) resolve();
        };

        for (const name of anims) {
          this.loader.load(
            `/character/${name}.fbx`,
            (animFbx) => {
              if (this.mixer && animFbx.animations[0]) {
                const action = this.mixer.clipAction(animFbx.animations[0]);
                this.animations[name] = action;
                if (name === "idle") action.play();
              }
              checkDone();
            },
            undefined,
            () => {
              console.warn(`Failed to load animation: ${name}`);
              checkDone();
            },
          );
        }
      },
      undefined,
      (err) => {
        console.error("Failed to load character model", err);
        resolve(); 
      },
    );
  });
}

  playAnimation(name: string): void {
    if (this.currentAction === name) return;
    const prev = this.animations[this.currentAction];
    const next = this.animations[name];
    if (!next) return;
    if (prev) prev.fadeOut(0.2);
    next.reset().fadeIn(0.2).play();
    this.currentAction = name;
  }

  update(dt: number): void {
    this.mixer?.update(dt);
  }
}