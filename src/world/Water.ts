import * as THREE from "three";

export class Water {
  public readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhongMaterial>;

  constructor(texture: THREE.Texture) {
    configureWaterTexture(texture);

    const geometry = new THREE.PlaneGeometry(260, 260, 1, 1);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshPhongMaterial({
      map: texture,
      color: new THREE.Color(0x55aed9),
      transparent: true,
      opacity: 0.7,
      shininess: 110,
      specular: new THREE.Color(0xf7fdff),
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.y = 0.5;
    this.mesh.receiveShadow = true;
  }
}

function configureWaterTexture(texture: THREE.Texture): void {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
}
