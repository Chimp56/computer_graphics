import * as THREE from "three";

export class SkyRig {
  public readonly hemisphere: THREE.HemisphereLight;
  public readonly sun: THREE.DirectionalLight;
  private readonly sunTarget: THREE.Object3D;

  constructor() {
    this.hemisphere = new THREE.HemisphereLight(0xbfeaff, 0x3f6b3f, 0.6);

    this.sun = new THREE.DirectionalLight(0xfff2d3, 0.8);
    this.sun.position.set(55, 80, 30);

    this.sunTarget = new THREE.Object3D();
    this.sunTarget.position.set(0, 0, 0);
    this.sun.target = this.sunTarget;
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.hemisphere);
    scene.add(this.sun);
    scene.add(this.sunTarget);
  }
}
