import * as THREE from 'three';
import { scene } from '../engine/scene';
import type { MapConfig } from '../types/map';

export const worldCollidables: THREE.Object3D[] = [];
export let currentMapConfig: MapConfig | null = null;
let waterObj: THREE.Mesh | null = null;

// 하늘 요소 관리
const clouds: THREE.Group[] = [];
const birds: THREE.Group[] = [];
let celestialObj: THREE.Object3D | null = null; // 해 또는 달
let skyGroup: THREE.Group | null = null;

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
  // 1. 물 요동 애니메이션
  if (waterObj) {
    waterObj.position.y = -60 + Math.sin(time * 0.8) * 2;
  }

  // 2. 구름 이동 애니메이션
  clouds.forEach((cloud, i) => {
    cloud.position.x += 0.05 + (i * 0.01);
    cloud.position.y += Math.sin(time + i) * 0.01;
    if (cloud.position.x > 500) cloud.position.x = -500;
  });

  // 3. 새/드론 비행 및 날개짓 애니메이션
  birds.forEach((bird, i) => {
    const radius = 100 + i * 20;
    const speed = 0.5 + i * 0.1;
    bird.position.x = Math.cos(time * 0.2 * speed + i) * radius;
    bird.position.z = Math.sin(time * 0.2 * speed + i) * radius;
    bird.position.y = 40 + Math.sin(time * 0.5 + i) * 5;
    bird.lookAt(
        Math.cos((time + 0.1) * 0.2 * speed + i) * radius,
        40 + Math.sin((time + 0.1) * 0.5 + i) * 5,
        Math.sin((time + 0.1) * 0.2 * speed + i) * radius
    );

    // 날개짓 애니메이션 (자식 메시 회전)
    bird.children.forEach((wing, j) => {
        if (j === 0) wing.rotation.z = Math.sin(time * 10) * 0.5; // 왼쪽 날개
        if (j === 1) wing.rotation.z = -Math.sin(time * 10) * 0.5; // 오른쪽 날개
    });
  });

  // 4. 천체(해/달) 미세 움직임
  if (celestialObj) {
    celestialObj.rotation.y += 0.005;
  }
};

export const initWorld = (config: MapConfig) => {
  currentMapConfig = config;
  
  // 이전 맵 오브젝트 초기화
  worldCollidables.forEach(obj => scene.remove(obj));
  scene.children.filter(c => c.userData.isWorldObj).forEach(obj => scene.remove(obj));
  worldCollidables.length = 0;
  
  // 하늘 요소 초기화
  clouds.length = 0;
  birds.length = 0;
  if (skyGroup) scene.remove(skyGroup);
  skyGroup = new THREE.Group();
  scene.add(skyGroup);

  const bgColor = new THREE.Color(config.bgColor);
  scene.background = bgColor;
  scene.fog = new THREE.FogExp2(bgColor.getHex(), config.fogDensity);

  // 조명이 중복되지 않도록 정리 (기존 조명 제거)
  scene.children.filter(c => c instanceof THREE.Light).forEach(l => scene.remove(l));

  // 환경광 & 조명 설정
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  // 키 라이트 (그림자 담당)
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
  dirLight.position.set(100, 200, 100);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -250;
  dirLight.shadow.camera.right = 250;
  dirLight.shadow.camera.top = 250;
  dirLight.shadow.camera.bottom = -250;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);

  // 필 라이트 (반대편 그림자 채움)
  const fillLight = new THREE.DirectionalLight(0xaaccff, 1.5);
  fillLight.position.set(-10, 10, -10);
  scene.add(fillLight);

  // 하늘 고도화 (구름, 해/달, 새 등)
  initSky(config);

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
  floatingIsland.userData.isFloor = true;
  scene.add(floatingIsland);
  worldCollidables.push(floatingIsland);

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

  // 4. 테마별 장애물 생성 헬퍼
  const createThemeObstacle = (theme: string, color: number, seededRandom: () => number) => {
    const group = new THREE.Group();
    
    if (theme === 'pastel') {
      // 파스텔 정원: 나무 (원기둥 + 원뿔/구체)
      const trunkH = 2 + seededRandom() * 2;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.7, trunkH),
        new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 1 })
      );
      trunk.position.y = trunkH / 2;
      group.add(trunk);

      const leafMode = seededRandom();
      const leafColor = new THREE.Color(color).clone().lerp(new THREE.Color(0xffffff), 0.2).getHex();
      const leaves = new THREE.Mesh(
        leafMode > 0.5 ? new THREE.SphereGeometry(2 + seededRandom() * 2, 8, 8) : new THREE.ConeGeometry(3, 6, 8),
        new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.8 })
      );
      leaves.position.y = trunkH + (leafMode > 0.5 ? 1 : 2);
      group.add(leaves);

    } else if (theme === 'candy') {
      // 캔디 랜드: 막대 사탕 (얇은 기둥 + 큰 구체)
      const stickH = 4 + seededRandom() * 4;
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, stickH),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      );
      stick.position.y = stickH / 2;
      group.add(stick);

      const candy = new THREE.Mesh(
        new THREE.SphereGeometry(2, 16, 16),
        new THREE.MeshStandardMaterial({ 
          color, 
          roughness: 0.1, 
          metalness: 0.4,
          emissive: color,
          emissiveIntensity: 0.2
        })
      );
      candy.position.y = stickH;
      group.add(candy);

      // 도넛(토러스) 추가 (가끔)
      if (seededRandom() > 0.7) {
        const torus = new THREE.Mesh(
          new THREE.TorusGeometry(1.5, 0.6, 8, 16),
          new THREE.MeshStandardMaterial({ color: 0xff66aa, roughness: 0.2 })
        );
        torus.position.y = 1;
        torus.rotation.x = Math.PI / 2;
        group.add(torus);
      }

    } else if (theme === 'neon') {
      // 네온 시티: 발광하는 기하학적 기둥
      const h = 10 + seededRandom() * 25;
      const w = 3 + seededRandom() * 3;
      const d = 3 + seededRandom() * 3;
      
      const core = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.8 })
      );
      core.position.y = h / 2;
      group.add(core);

      // 테두리 네온 라인
      const edgeColor = color;
      const lineGeo = new THREE.BoxGeometry(w + 0.1, h * 0.1, d + 0.1);
      const lineMat = new THREE.MeshStandardMaterial({ 
        color: edgeColor, 
        emissive: edgeColor, 
        emissiveIntensity: 2 
      });
      
      const lineTop = new THREE.Mesh(lineGeo, lineMat);
      lineTop.position.y = h * 0.9;
      group.add(lineTop);

      const lineMid = new THREE.Mesh(lineGeo, lineMat);
      lineMid.position.y = h * 0.5;
      group.add(lineMid);

    } else {
      // 기본: 박스
      const h = seededRandom() * 12 + 3;
      const w = seededRandom() * 4 + 2;
      const d = seededRandom() * 4 + 2;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
      );
      box.position.y = h / 2;
      group.add(box);
    }

    return group;
  };

  let seedVal = config.seed;
  const seededRandom = () => {
    seedVal = (seedVal * 1664525 + 1013904223) & 0xffffffff;
    return (seedVal >>> 0) / 0xffffffff;
  };

  const colors = config.obstacleColors.map(c => new THREE.Color(c).getHex());
  for (let i = 0; i < config.obstacleCount; i++) {
    const color = colors[Math.floor(seededRandom() * colors.length)];
    const obstacle = createThemeObstacle(config.theme, color, seededRandom);
    
    const limit = config.playZone;
    const rx = seededRandom() * limit * 2 - limit;
    const rz = seededRandom() * limit * 2 - limit;
    const groundY = getGroundHeight(rx, rz);

    obstacle.position.set(rx, groundY, rz);
    
    obstacle.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = child.receiveShadow = true;
      }
    });

    obstacle.userData.isWorldObj = true;
    scene.add(obstacle);
    
    // 충돌 판정을 위해 Mesh들을 worldCollidables에 추가
    obstacle.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        worldCollidables.push(child);
      }
    });
  }
};

/**
 * 테마별 하늘 요소 초기화
 */
const initSky = (config: MapConfig) => {
    if (!skyGroup) return;

    // 1. 구름 생성
    const cloudCount = 12;
    const cloudColor = 0xffffff; // 모든 테마 구름 색상을 흰색으로 통일
    const cloudOpacity = config.theme === 'neon' ? 0.4 : 0.8;

    for (let i = 0; i < cloudCount; i++) {
        const cloud = createCloud(cloudColor, cloudOpacity);
        cloud.position.set(
            (Math.random() - 0.5) * 600,
            80 + Math.random() * 40,
            (Math.random() - 0.5) * 600
        );
        skyGroup.add(cloud);
        clouds.push(cloud);
    }

    // 2. 해 또는 달 생성
    let celestial;
    if (config.theme === 'neon') {
        celestial = createMoon(0xddddff, 0x00ccff); // 네온 맵은 푸른 달
    } else if (config.theme === 'candy') {
        celestial = createSun(0xffcccc, 0xff66bb); // 캔디 맵은 분홍 해
    } else if (config.theme === 'custom') {
        celestial = createSun(0xff8822, 0xff4422); // 커스텀(노을)은 붉은 해
    } else {
        celestial = createSun(0xffffcc, 0xffcc00); // 파스텔은 기본 해
    }
    celestial.position.set(150, 250, 150);
    skyGroup.add(celestial);
    celestialObj = celestial;

    // 3. 새 또는 드론 생성
    const birdCount = 3;
    for (let i = 0; i < birdCount; i++) {
        const bird = createBird(config.theme);
        skyGroup.add(bird);
        birds.push(bird);
    }
};

/** 구름 생성기 */
const createCloud = (color: number, opacity: number) => {
    const group = new THREE.Group();
    const count = 3 + Math.floor(Math.random() * 3);
    const material = new THREE.MeshStandardMaterial({ 
        color, 
        transparent: true, 
        opacity,
        roughness: 1,
        emissive: color,
        emissiveIntensity: opacity > 0.5 ? 0 : 0.5
    });

    for (let i = 0; i < count; i++) {
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(4 + Math.random() * 3, 7, 7),
            material
        );
        sphere.position.set(i * 3, Math.sin(i) * 2, Math.cos(i) * 2);
        group.add(sphere);
    }
    return group;
};

/** 해 생성기 */
const createSun = (innerColor: number, outerColor: number) => {
    const group = new THREE.Group();
    const sun = new THREE.Mesh(
        new THREE.SphereGeometry(15, 16, 16),
        new THREE.MeshBasicMaterial({ color: innerColor })
    );
    group.add(sun);

    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(18, 16, 16),
        new THREE.MeshBasicMaterial({ color: outerColor, transparent: true, opacity: 0.3 })
    );
    group.add(glow);
    return group;
};

/** 달 생성기 */
const createMoon = (color: number, ringColor: number) => {
    const group = new THREE.Group();
    const moon = new THREE.Mesh(
        new THREE.SphereGeometry(10, 16, 16),
        new THREE.MeshBasicMaterial({ color: color })
    );
    group.add(moon);

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(14, 0.5, 8, 32),
        new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.5 })
    );
    ring.rotation.x = Math.PI / 3;
    group.add(ring);
    return group;
};

/** 새/드론 생성기 */
const createBird = (theme: string) => {
    const group = new THREE.Group();
    const isNeon = theme === 'neon';
    
    // 몸체
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(isNeon ? 1.5 : 1, 0.3, isNeon ? 1.5 : 1.5),
        new THREE.MeshStandardMaterial({ 
            color: isNeon ? 0x333333 : 0x222222, 
            emissive: isNeon ? 0x00ffff : 0x000000 
        })
    );
    group.add(body);

    // 날개 (V자형)
    const wingGeo = new THREE.PlaneGeometry(isNeon ? 1.5 : 2, 0.8);
    const wingMat = new THREE.MeshStandardMaterial({ 
        color: isNeon ? 0xff00ff : 0x444444, 
        side: THREE.DoubleSide,
        emissive: isNeon ? 0xff00ff : 0x000000
    });

    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.x = isNeon ? -0.7 : -1;
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.x = isNeon ? 0.7 : 1;
    group.add(rightWing);

    return group;
};
