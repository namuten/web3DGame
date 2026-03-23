import * as THREE from 'three';
import { scene } from '../engine/scene';
import type { MapConfig } from '../types/map';

export const worldCollidables: THREE.Object3D[] = [];

export const initWorld = (config: MapConfig) => {
  // 이전 맵 오브젝트 초기화 (재로드 시 대비)
  worldCollidables.length = 0;

  const bgColor = new THREE.Color(config.bgColor);
  scene.background = bgColor;
  scene.fog = new THREE.FogExp2(bgColor.getHex(), config.fogDensity);

  // 조명 (중복 추가 방지를 위해 기존 조명 제거 로직이 필요할 수 있으나 데모에선 생략)
  const hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0xB9F3FC, 1.0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
  dirLight.position.set(50, 100, -50);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width  = 4096;
  dirLight.shadow.mapSize.height = 4096;
  dirLight.shadow.camera.near    = 1;
  dirLight.shadow.camera.far     = 400;
  dirLight.shadow.camera.left    = -100;
  dirLight.shadow.camera.right   = 100;
  dirLight.shadow.camera.top     = 100;
  dirLight.shadow.camera.bottom  = -100;
  dirLight.shadow.bias = -0.001;
  scene.add(dirLight);

  // 잔디 텍스처 (Canvas 절차적 생성)
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width  = 256;
  grassCanvas.height = 256;
  const ctx = grassCanvas.getContext('2d')!;
  ctx.fillStyle = '#5a9e3a';
  ctx.fillRect(0, 0, 256, 256);
  const rng = (seed: number) => {
    const x = Math.sin(seed) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 8000; i++) {
    const x = rng(i * 3.1) * 256;
    const y = rng(i * 7.4) * 256;
    const bright = rng(i * 2.2);
    ctx.fillStyle = `rgb(${Math.floor(60+bright*40)},${Math.floor(130+bright*60)},${Math.floor(30+bright*20)})`;
    ctx.fillRect(x, y, 2, rng(i * 5.7) * 4 + 1);
  }
  const grassTexture = new THREE.CanvasTexture(grassCanvas);
  grassTexture.wrapS = THREE.RepeatWrapping;
  grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(40, 40);

  // 바닥
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(config.floorSize, config.floorSize),
    new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 0.9, metalness: 0.0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  worldCollidables.push(floor);

  // 시드 기반 난수
  let seedVal = config.seed;
  const seededRandom = () => {
    seedVal = (seedVal * 1664525 + 1013904223) & 0xffffffff;
    return (seedVal >>> 0) / 0xffffffff;
  };

  // 장애물 생성
  const colors = config.obstacleColors.map(c => new THREE.Color(c).getHex());

  for (let i = 0; i < config.obstacleCount; i++) {
    const height = seededRandom() * 15 + 2;
    const width  = seededRandom() * 3 + 1;
    const depth  = seededRandom() * 3 + 1;
    const color  = colors[Math.floor(seededRandom() * colors.length)];

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.0 })
    );
    box.position.set(
      seededRandom() * config.playZone * 2 - config.playZone,
      height / 2,
      seededRandom() * config.playZone * 2 - config.playZone
    );
    box.castShadow    = true;
    box.receiveShadow = true;
    scene.add(box);
    worldCollidables.push(box);
  }
};
