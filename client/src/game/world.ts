import * as THREE from 'three';
import { scene } from '../engine/scene';

// 월드의 충돌가능 오브젝트들을 외부에서 참조하기 위한 배열
export const worldCollidables: THREE.Object3D[] = [];

export const initWorld = () => {
  scene.background = new THREE.Color(0xA2D2FF);
  scene.fog = new THREE.FogExp2(0xA2D2FF, 0.005);

  const hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0xB9F3FC, 1.0);
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

  // 잔디 텍스처 생성 (Canvas 절차적 생성)
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 256;
  grassCanvas.height = 256;
  const ctx = grassCanvas.getContext('2d')!;

  // 초록 베이스
  ctx.fillStyle = '#5a9e3a';
  ctx.fillRect(0, 0, 256, 256);

  // 잔디 색상 변화 (밝고 어두운 초록 점들)
  const rng = (seed: number) => {
    const x = Math.sin(seed) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 8000; i++) {
    const x = rng(i * 3.1) * 256;
    const y = rng(i * 7.4) * 256;
    const bright = rng(i * 2.2);
    const r = Math.floor(60 + bright * 40);
    const g = Math.floor(130 + bright * 60);
    const b = Math.floor(30 + bright * 20);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y, 2, rng(i * 5.7) * 4 + 1);
  }

  const grassTexture = new THREE.CanvasTexture(grassCanvas);
  grassTexture.wrapS = THREE.RepeatWrapping;
  grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(40, 40);

  // 바닥
  const floorSize = 400;
  const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize);
  const floorMaterial = new THREE.MeshStandardMaterial({
    map: grassTexture,
    roughness: 0.9,
    metalness: 0.0,
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // 탄환 충돌 대상으로 등록 (바닥 추가)
  worldCollidables.push(floor);

  // 시드 기반 난수 (모든 클라이언트 동일한 월드 생성)
  let seed = 42;
  const seededRandom = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };

  // 장애물 (아이들용 파스텔 톤 박스들)
  const neonColors = [0xFFADAD, 0xFFD6A5, 0xFDFFB6, 0xCAFFBF, 0x9BF6FF, 0xA0C4FF, 0xBDB2FF, 0xFFC6FF];

  for (let i = 0; i < 80; i++) {
    const height = seededRandom() * 15 + 2;
    const width = seededRandom() * 3 + 1;
    const depth = seededRandom() * 3 + 1;
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const boxColor = neonColors[Math.floor(seededRandom() * neonColors.length)];
    const wallMat = new THREE.MeshStandardMaterial({
      color: boxColor,
      roughness: 0.4,
      metalness: 0.0
    });
    const box = new THREE.Mesh(geometry, wallMat);

    box.position.set(
      seededRandom() * 160 - 80,
      height / 2,
      seededRandom() * 160 - 80
    );
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);

    // 탄환 충돌 대상으로 등록
    worldCollidables.push(box);
  }
};
