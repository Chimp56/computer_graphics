import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class MushroomEnemy {
  public group: THREE.Group = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;

  load(scene: THREE.Scene): Promise<void> {
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load(
        "/models/mushroom_enemy.glb",
        (gltf) => {
          const model = gltf.scene;
          model.scale.setScalar(.01);
          this.group.add(model);
          scene.add(this.group);

          if (gltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);
            const action = this.mixer.clipAction(gltf.animations[0]);
            action.timeScale = 4;
            action.play();
          }

          resolve();
        },
        undefined,
        (err) => {
          console.error("Failed to load mushroom enemy", err);
          resolve();
        }
      );
    });
  }

  update(dt: number): void {
    this.mixer?.update(dt);
  }

  checkHit(playerPos: THREE.Vector3): boolean {
    const dx = playerPos.x - this.group.position.x;
    const dz = playerPos.z - this.group.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    return dist < 1.5;
  }
}
