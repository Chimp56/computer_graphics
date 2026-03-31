import * as THREE from "three";

export class Renderer {
  public readonly instance: THREE.WebGLRenderer;

  constructor(containerId = "app") {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`#${containerId} not found`);

    this.instance = new THREE.WebGLRenderer({ antialias: true });
    this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.instance.setSize(window.innerWidth, window.innerHeight);
    this.instance.setClearColor(0x000000, 1);
    container.appendChild(this.instance.domElement);

    window.addEventListener("resize", this.onResize);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.instance.render(scene, camera);
  }

  get domElement(): HTMLCanvasElement {
    return this.instance.domElement;
  }

  private readonly onResize = (): void => {
    this.instance.setSize(window.innerWidth, window.innerHeight);
  };
}
