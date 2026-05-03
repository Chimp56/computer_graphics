import * as THREE from "three";

const DAY_CYCLE_SECONDS = 140;

export class Sky {
  readonly group = new THREE.Group();
  readonly hemisphereLight: THREE.HemisphereLight;
  readonly sunLight: THREE.DirectionalLight;

  private readonly sunVisual: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>;
  private elapsed = 0;
  private readonly dawnColor = new THREE.Color(0xffb36b);
  private readonly noonColor = new THREE.Color(0xffffff);
  private readonly duskVisualColor = new THREE.Color(0xff9f5c);

  constructor() {
    this.hemisphereLight = new THREE.HemisphereLight(0x9ed2ff, 0x6b5a43, 0.6);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.sunLight.position.set(80, 120, 40);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 20;
    this.sunLight.shadow.camera.far = 420;
    this.sunLight.shadow.camera.left = -150;
    this.sunLight.shadow.camera.right = 150;
    this.sunLight.shadow.camera.top = 150;
    this.sunLight.shadow.camera.bottom = -150;
    this.sunLight.shadow.bias = -0.00025;
    this.sunLight.shadow.normalBias = 0.02;

    this.sunVisual = new THREE.Mesh(
      new THREE.SphereGeometry(7, 20, 20),
      new THREE.MeshPhongMaterial({
        color: 0xfff3cc,
        emissive: 0xffc873,
        emissiveIntensity: 0.95,
        shininess: 0,
      }),
    );

    this.group.add(this.hemisphereLight, this.sunLight, this.sunLight.target, this.sunVisual);
    this.group.name = "Sky";
  }

  update(dt: number): void {
    this.elapsed += dt;

    const phase = (this.elapsed / DAY_CYCLE_SECONDS) * Math.PI * 2;
    const y = Math.sin(phase) * 125;

    this.sunLight.position.set(
      Math.cos(phase) * 150,
      y,
      Math.sin(phase * 0.7) * 95,
    );

    this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.target.updateMatrixWorld();

    this.sunVisual.position.copy(this.sunLight.position);

    const daylight = THREE.MathUtils.clamp((y + 22) / 130, 0, 1);

    this.sunLight.intensity = THREE.MathUtils.lerp(0.06, 0.8, daylight);
    this.hemisphereLight.intensity = THREE.MathUtils.lerp(0.16, 0.6, daylight);

    const warmth = 1 - daylight;
    this.sunLight.color.copy(this.noonColor).lerp(this.dawnColor, warmth * 0.85);

    this.sunVisual.material.color.set(0xfff3cc).lerp(this.duskVisualColor, warmth * 0.75);
    this.sunVisual.material.emissiveIntensity = THREE.MathUtils.lerp(0.35, 1.1, daylight);
    this.sunVisual.visible = y > -12;
  }
}
