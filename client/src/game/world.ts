import * as THREE from 'three';
import { scene } from '../engine/scene';

// 월드의 충돌가능 오브젝트들을 외부에서 참조하기 위한 배열
export const worldCollidables: THREE.Object3D[] = [];

export const initWorld = () => {
  scene.background = new THREE.Color(0xf0f4f8); // 맑고 밝은 배경색
  scene.fog = new THREE.FogExp2(0xf0f4f8, 0.012);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xddeeff, 0.8);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
  dirLight.position.set(50, 100, -50);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 4096;
  dirLight.shadow.mapSize.height = 4096;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 400;
  dirLight.shadow.camera.left = -100;
  dirLight.shadow.camera.right = 100;
  dirLight.shadow.camera.top = 100;
  dirLight.shadow.camera.bottom = -100;
  dirLight.shadow.bias = -0.001;
  scene.add(dirLight);

  // 바닥
  const floorSize = 400;
  const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize);
  const floorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffffff, // 깔끔한 흰색 바닥
    roughness: 0.2,
    metalness: 0
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // 부드러운 그리드
  const gridHelper = new THREE.GridHelper(floorSize, 100, 0xcccccc, 0xeeeeee);
  gridHelper.position.y = 0.05;
  (gridHelper.material as THREE.LineBasicMaterial).opacity = 0.2;
  (gridHelper.material as THREE.LineBasicMaterial).transparent = true;
  scene.add(gridHelper);

  // 장애물 (파스텔 톤 박스들)
  const pastelColors = [0xffd1dc, 0xffe4e1, 0xe0ffff, 0xdcfadc, 0xfffacd, 0xe6e6fa];
  
  for (let i = 0; i < 80; i++) {
    const height = Math.random() * 15 + 2;
    const width = Math.random() * 3 + 1;
    const depth = Math.random() * 3 + 1;
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const boxColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];
    const wallMat = new THREE.MeshStandardMaterial({ 
      color: boxColor, 
      roughness: 0.3, 
      metalness: 0.1
    });
    const box = new THREE.Mesh(geometry, wallMat);
    
    box.position.set(
      Math.random() * 160 - 80,
      height / 2,
      Math.random() * 160 - 80
    );
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);

    // 탄환 충돌 대상으로 등록
    worldCollidables.push(box);
  }
};
