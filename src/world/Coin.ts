import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class Coin {
  public group: THREE.Group = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;

  load(scene: THREE.Scene): Promise<void> {
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load(
        "/models/gold_coin.glb",
        (gltf) => {
          const model = gltf.scene;
          model.scale.setScalar(0.5);

        model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({ color: 0xffd700 });
        }
        });

          this.group.add(model);
          scene.add(this.group);

          if (gltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);
            const action = this.mixer.clipAction(gltf.animations[0]);
            action.play();
          }

          resolve();
        },
        undefined,
        (err) => {
          console.error("Failed to load coin", err);
          resolve();
        }
      );
    });
  }

  private collected = false;

checkCollect(playerPos: THREE.Vector3): boolean {
  if (this.collected) return false;
  const dx = playerPos.x - this.group.position.x;
  const dz = playerPos.z - this.group.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 1.5) {
    this.collected = true;
    this.group.visible = false; // hide the coin when collected
    return true;
  }
  return false;
}

  update(dt: number): void {
    this.mixer?.update(dt);
    this.group.rotation.y += dt * 2; // spins on Y axis, adjust speed with the number
  }
}