import * as THREE from "three";

const POST_HEIGHT = 3.6;
const RIM_HEIGHT = 3.05;
const RIM_DEPTH = 0.55;

/**
 * Simple basketball hoop made from primitive meshes.
 */
export class BasketHoop {
  readonly group = new THREE.Group();
  readonly targetBox: THREE.Box3;

  constructor(position: THREE.Vector3) {
    const poleMat = new THREE.MeshPhongMaterial({
      color: 0x5f5f68,
      shininess: 55,
      specular: new THREE.Color(0x7f7f90),
    });
    const boardMat = new THREE.MeshPhongMaterial({
      color: 0xf1f1f1,
      shininess: 25,
      specular: new THREE.Color(0xdddddd),
    });
    const rimMat = new THREE.MeshPhongMaterial({
      color: 0xd36324,
      shininess: 80,
      specular: new THREE.Color(0xffc9a5),
    });
    const netMat = new THREE.MeshPhongMaterial({
      color: 0xe6e6e6,
      transparent: true,
      opacity: 0.85,
      shininess: 10,
    });

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, POST_HEIGHT, 14),
      poleMat,
    );
    pole.position.y = POST_HEIGHT * 0.5;

    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.1, 0.6),
      poleMat,
    );
    arm.position.set(0, 3.3, 0.18);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 1, 0.08),
      boardMat,
    );
    board.position.set(0, 3.3, 0);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.035, 14, 26),
      rimMat,
    );
    rim.rotation.x = Math.PI * 0.5;
    rim.position.set(0, RIM_HEIGHT, RIM_DEPTH);

    const net = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.18, 0.45, 14, 1, true),
      netMat,
    );
    net.position.set(0, RIM_HEIGHT - 0.24, RIM_DEPTH);

    this.group.add(pole, arm, board, rim, net);
    this.group.position.copy(position);
    this.group.name = "BasketHoop";

    this.targetBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(0, RIM_HEIGHT, RIM_DEPTH).add(position),
      new THREE.Vector3(0.8, 0.5, 0.8),
    );
  }
}
