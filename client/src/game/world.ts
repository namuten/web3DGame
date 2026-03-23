import * as THREE from 'three';
import { scene } from '../engine/scene';
import type { MapConfig } from '../types/map';

export const worldCollidables: THREE.Object3D[] = [];
export let currentMapConfig: MapConfig | null = null;
let waterObj: THREE.Mesh | null = null;

/** 
 * 지면 높이 계산 함수 (노이즈 기반)
 */
export const getGroundHeight = (x: number, z: number): number => {
  if (!currentMapConfig) return 0;
  
  // 맵 범위를 벗어나면 기본 높이(-60) 또는 0 반환
  const half = currentMapConfig.floorSize / 2;
  if (Math.abs(x) > half || Math.abs(z) > half) return -60;

  const s = currentMapConfig.seed;
  // 여러 층의 정현파를 조합해 자연스러운 지형 생성
  const h = (Math.sin(x * 0.04 + s) * Math.cos(z * 0.04 + s) * 4.5) + 
            (Math.sin(x * 0.1 + z * 0.07) * 2.0) +
            (Math.cos(x * 0.2) * Math.sin(z * 0.2) * 0.5);
  return h;
};

export const updateWorld = (time: number) => {
  if (waterObj) {
    waterObj.position.y = -60 + Math.sin(time * 0.8) * 2;
  }
};

export const initWorld = (config: MapConfig) => {
  currentMapConfig = config;
  
  // 이전 맵 오브젝트 초기화
  worldCollidables.forEach(obj => scene.remove(obj));
  scene.children.filter(c => c.userData.isWorldObj).forEach(obj => scene.remove(obj));
  worldCollidables.length = 0;

  const bgColor = new THREE.Color(config.bgColor);
  scene.background = bgColor;
  scene.fog = new THREE.FogExp2(bgColor.getHex(), config.fogDensity);

  // 조명 (기존 조명 제거)
  scene.children.filter(c => c instanceof THREE.Light).forEach(l => scene.remove(l));

  const hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0x4444ff, 1.2);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
  dirLight.position.set(100, 200, 100);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -250;
  dirLight.shadow.camera.right = 250;
  dirLight.shadow.camera.top = 250;
  dirLight.shadow.camera.bottom = -250;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);

  // 1. 잔디 & 흙 텍스처 (절차적)
  const createGrassTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#5a9e3a';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 20000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = `rgb(${80 + Math.random() * 40}, ${140 + Math.random() * 60}, ${40 + Math.random() * 20})`;
      ctx.fillRect(x, y, 2, 2 + Math.random() * 8);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(config.floorSize / 15, config.floorSize / 15);
    return tex;
  };

  const createDirtTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#4d3319';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
        ctx.fillStyle = `rgb(${60+Math.random()*40}, ${40+Math.random()*20}, ${20+Math.random()*10})`;
        ctx.fillRect(Math.random()*256, Math.random()*256, 4, 4);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  };

  const grassTex = createGrassTexture();
  const dirtTex = createDirtTexture();

  // 2. 굴곡 있는 공중 섬 (Island with Bumpy Terrain)
  const islandThickness = 30;
  const segments = Math.floor(config.floorSize / 8); // 세그먼트 수 조절
  const islandGeo = new THREE.BoxGeometry(config.floorSize, islandThickness, config.floorSize, segments, 1, segments);
  
  // 지면 굴곡 적용
  const posAttr = islandGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    
    // 윗면(y > 0)인 정점들만 굴곡 적용
    if (y > 0) {
      const h = getGroundHeight(x, z);
      posAttr.setY(i, y + h);
    } else {
      // 아랫면은 살짝 불규칙하게 깎인 느낌 추가
      const h = (Math.sin(x*0.1) * Math.cos(z*0.1) * 2);
      posAttr.setY(i, y + h);
    }
  }
  islandGeo.computeVertexNormals();

  const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 });
  const dirtMat  = new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1 });
  
  const islandMats = [
    dirtMat, dirtMat, grassMat, dirtMat, dirtMat, dirtMat
  ];

  const floatingIsland = new THREE.Mesh(islandGeo, islandMats);
  floatingIsland.position.y = -islandThickness / 2;
  floatingIsland.receiveShadow = true;
  floatingIsland.userData.isWorldObj = true;
  scene.add(floatingIsland);

  // 3. 물 (강/바다)
  const waterGeo = new THREE.PlaneGeometry(5000, 5000);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2299ff,
    transparent: true,
    opacity: 0.6,
    roughness: 0.1,
    metalness: 0.5
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -60;
  water.userData.isWorldObj = true;
  waterObj = water;
  scene.add(water);

  // 4. 장애물 생성
  let seedVal = config.seed;
  const seededRandom = () => {
    seedVal = (seedVal * 1664525 + 1013904223) & 0xffffffff;
    return (seedVal >>> 0) / 0xffffffff;
  };

  const colors = config.obstacleColors.map(c => new THREE.Color(c).getHex());
  for (let i = 0; i < config.obstacleCount; i++) {
    const h = seededRandom() * 12 + 3;
    const w = seededRandom() * 4 + 2;
    const d = seededRandom() * 4 + 2;
    const color = colors[Math.floor(seededRandom() * colors.length)];

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
    );
    const limit = config.playZone;
    const rx = seededRandom() * limit * 2 - limit;
    const rz = seededRandom() * limit * 2 - limit;
    const groundY = getGroundHeight(rx, rz);

    box.position.set(rx, groundY + h / 2, rz);
    box.castShadow = box.receiveShadow = true;
    box.userData.isWorldObj = true;
    scene.add(box);
    worldCollidables.push(box);
  }
};
