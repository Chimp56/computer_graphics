import * as THREE from "three";

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 100, 300);

  const ambient = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambient);

  return scene;
}
