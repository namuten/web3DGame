import * as THREE from 'three';

/**
 * 2톤 알약 캐릭터를 생성 (하단 흰색 고정, 상단 색상 가변)
 */
export const createCharacterModel = (bodyColor: number = 0xffb7b2, flowerColor: number = bodyColor) => {
  const root = new THREE.Group();
  
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.1, metalness: 0 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0 });

  // 1. 하체 그룹 (고정)
  const lowerBody = new THREE.Group();
  const bottomCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 32), whiteMat);
  bottomCyl.position.y = 0.75;
  lowerBody.add(bottomCyl);

  const bottomSphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), whiteMat);
  bottomSphere.position.y = 0.5;
  lowerBody.add(bottomSphere);
  root.add(lowerBody);

  // 2. 상체 그룹 (카메라 방향에 따라 회전 가능)
  const upperBody = new THREE.Group();
  upperBody.position.y = 1.0; // 허리 위치 기준점
  root.add(upperBody);

  // 상단 캡슐 (상대 좌표 y=0.5가 실제 높이 1.5 지점)
  const topCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 32), bodyMat);
  topCyl.position.y = 0.25;
  upperBody.add(topCyl);

  const topSphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
  topSphere.position.y = 0.5;
  upperBody.add(topSphere);

  // 바이저 (전면 표시)
  const visorGeo = new THREE.BoxGeometry(0.6, 0.15, 0.1);
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.2, metalness: 0.1 });
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.4, 0.48); // 허리 위 상대 좌표
  upperBody.add(visor);

  // 꽃 생성 및 추가
  const flower = createFlowerModel(flowerColor);
  flower.position.y = 0.6; // 머리 꼭대기 상대 좌표
  upperBody.add(flower);

  // 그림자 설정
  root.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // ─── 헬퍼 메서드 ─────────────────────────────
  
  // 몸체 색상 변경
  (root as any).setBodyColor = (newColor: number) => {
    const newMat = new THREE.MeshStandardMaterial({ color: newColor, roughness: 0.1, metalness: 0 });
    topCyl.material = newMat;
    topSphere.material = newMat;
  };

  // 바이저 색상 변경
  (root as any).setVisorColor = (newColor: number) => {
    visor.material = new THREE.MeshStandardMaterial({
      color: newColor,
      roughness: 0.2,
      metalness: 0.1,
    });
  };

  // 꽃 색상 변경
  (root as any).setFlowerColor = (newColor: number) => {
    if ((flower as any).setPetalColor) (flower as any).setPetalColor(newColor);
  };

  // 상체 회전 (허리 위만 회전)
  (root as any).setUpperRotation = (yRotation: number) => {
    upperBody.rotation.y = yRotation;
  };

  // 꽃 물리 업데이트 (스프링 물리 연동)
  (root as any).updateFlowerPhysics = (forward: number, side: number) => {
    if ((flower as any).updateFlowerPhysics) (flower as any).updateFlowerPhysics(forward, side);
  };

  // 꽃 기울기 업데이트 (카메라 앙각 연동)
  (root as any).updateFlowerTilt = (tiltFactor: number) => {
    if ((flower as any).updateTilt) (flower as any).updateTilt(tiltFactor);
  };

  return root;
};

/**
 * 데이지 꽃 모델 생성 (독립형)
 */
function createFlowerModel(flowerColor: number) {
  const flowerGroup = new THREE.Group();
  const stemSegments: THREE.Mesh[] = [];

  const stemPointCount = 8;
  const stemHeight = 0.8;
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });
  
  for (let i = 0; i < stemPointCount; i++) {
    const t = i / (stemPointCount - 1);
    const segment = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, stemHeight / stemPointCount), stemMat);
    segment.position.set(0, t * stemHeight, 0);
    flowerGroup.add(segment);
    stemSegments.push(segment);
  }

  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.04), stemMat);
  leaf.scale.set(0.5, 1, 2);
  leaf.position.set(0, 0.2, 0.05);
  leaf.rotation.x = 0.5;
  flowerGroup.add(leaf);

  const flowerHead = new THREE.Group();
  flowerHead.position.set(0, stemHeight, 0);
  flowerHead.rotation.x = 0.4;
  flowerGroup.add(flowerHead);

  const center = new THREE.Mesh(new THREE.SphereGeometry(0.08), new THREE.MeshStandardMaterial({ color: 0xffcc00 }));
  center.scale.set(1, 0.6, 1);
  flowerHead.add(center);

  const petalGeo = new THREE.SphereGeometry(0.03, 8, 8);
  petalGeo.scale(1.5, 0.2, 5);
  
  const createPetalMat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0 });
  const initialPetalMat = createPetalMat(flowerColor);

  for (let i = 0; i < 18; i++) {
    const petal = new THREE.Mesh(petalGeo, initialPetalMat);
    const angle = (i / 18) * Math.PI * 2;
    petal.position.set(Math.cos(angle) * 0.18, 0, Math.sin(angle) * 0.18);
    petal.rotation.y = -angle;
    petal.rotation.z = 0.1;
    flowerHead.add(petal);
  }

  // 물리 기반 꽃 움직임 (forward: 앞뒤 기울기, side: 좌우 기울기)
  (flowerGroup as any).updateFlowerPhysics = (forward: number, side: number) => {
    const tiltBase = 0.4;
    stemSegments.forEach((seg, i) => {
      const t = i / (stemSegments.length - 1);
      const curve = Math.pow(t, 2);
      seg.position.z = curve * forward * 1.1;
      seg.position.x = curve * side * 1.1;
      seg.rotation.x = t * forward * 1.8;
      seg.rotation.z = -t * side * 1.8;
    });
    flowerHead.position.set(side * 1.1, stemHeight, forward * 1.1);
    flowerHead.rotation.x = tiltBase + forward * 2.2;
    flowerHead.rotation.z = -side * 2.2;
  };

  (flowerGroup as any).updateTilt = (tiltFactor: number) => {
    (flowerGroup as any).updateFlowerPhysics(tiltFactor * 0.3, 0);
  };

  (flowerGroup as any).setPetalColor = (newColor: number) => {
    const newMat = createPetalMat(newColor);
    flowerHead.children.forEach(c => {
      if (c instanceof THREE.Mesh && c !== center) {
        c.material = newMat;
      }
    });
  };

  return flowerGroup;
}
