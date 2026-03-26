import * as THREE from 'three';

/**
 * 2톤 알약 캐릭터를 생성 (하단 흰색 고정, 상단 색상 가변)
 */
export const createCharacterModel = (bodyColor: number = 0xffb7b2, flowerColor: number = bodyColor, flowerType: string = 'daisy', visorType: string = 'normal') => {
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
  let visor = createVisorModel(0x333333, visorType);
  visor.position.set(0, 0.4, 0.48); // 허리 위 상대 좌표
  upperBody.add(visor);

  // 꽃 생성 및 추가
  let flower = createFlowerModel(flowerColor, flowerType);
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
    if ((visor as any).setVisorColor) (visor as any).setVisorColor(newColor);
  };
  (root as any).setVisorStyle = (newColor: number, newType: string) => {
    upperBody.remove(visor);
    visor = createVisorModel(newColor, newType);
    visor.position.set(0, 0.4, 0.48);
    upperBody.add(visor);
  };

  // 꽃 색상 변경
  (root as any).setFlowerColor = (newColor: number) => {
    if ((flower as any).setPetalColor) (flower as any).setPetalColor(newColor);
  };

  // 꽃 종류 및 색상을 한 번에 변경 (geometry 재생성)
  (root as any).setFlowerStyle = (newType: string, newColor: number) => {
    upperBody.remove(flower);
    flower = createFlowerModel(newColor, newType);
    flower.position.y = 0.6;
    upperBody.add(flower);
  };

  // 상체 회전 (허리 위만 회전 - 좌우 Yaw, 상하 Pitch)
  (root as any).setUpperRotation = (yaw: number, pitch: number = 0) => {
    upperBody.rotation.y = yaw;
    upperBody.rotation.x = pitch;
  };

  // 모델 전체 스케일/오프셋 조절 (반동 연출용)
  (root as any).setVisualEffects = (scaleY: number, offsetY: number) => {
    root.scale.set(1 / scaleY, scaleY, 1 / scaleY); // 부피 보존 스쿼시 & 스트레치
    root.position.y = offsetY;
  };

  // 꽃 물리 업데이트 (스프링 물리 연동)
  (root as any).updateFlowerPhysics = (forward: number, side: number) => {
    if ((flower as any).updateFlowerPhysics) (flower as any).updateFlowerPhysics(forward, side);
  };

  // 꽃 기울기 업데이트 (카메라 앙각 연동)
  (root as any).updateFlowerTilt = (tiltFactor: number) => {
    if ((flower as any).updateTilt) (flower as any).updateTilt(tiltFactor);
  };

  // 발사 애니메이션 트리거 (투석기 효과)
  (root as any).triggerShoot = (strength: number = 0.5) => {
    if ((flower as any).triggerShoot) (flower as any).triggerShoot(strength);
  };

  // 기 모으기 수치 반영 (0~1)
  (root as any).setChargeAmount = (val: number) => {
    if ((flower as any).setChargeAmount) (flower as any).setChargeAmount(val);
  };

  // 이름표 부착 (상체에 귀속시켜 상체 회전 시 같이 움직이게 함)
  (root as any).addNameTag = (tag: THREE.Object3D) => {
    // tag의 arc는 내부적으로 y=1.8 등에 위치하므로 그대로 추가
    // 단, upperBody가 y=1.0에 있으므로 상대 좌표 보정 필요
    tag.position.y -= 1.0;
    upperBody.add(tag);
  };

  return root;
};

/**
 * 데이지 꽃 모델 생성 (독립형)
 */
function createFlowerModel(flowerColor: number, flowerType: string = 'daisy') {
  const flowerGroup = new THREE.Group();
  const stemSegments: THREE.Mesh[] = [];
  const stemPointCount = 8;
  const stemHeight = 1.2; // 줄기 길이 2배
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

  const center = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffcc00 }));
  const createPetalMat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0 });
  const initialPetalMat = createPetalMat(flowerColor);
  let petalMeshes: THREE.Mesh[] = [];

  if (flowerType === 'rose') {
    center.material = new THREE.MeshStandardMaterial({ color: 0x880000 });
    center.scale.set(1.25, 0.75, 1.25);
    flowerHead.add(center);
    const petalGeo = new THREE.SphereGeometry(0.08, 8, 8);
    petalGeo.scale(1.25, 1.75, 0.3);
    for (let i = 0; i < 18; i++) {
      const petal = new THREE.Mesh(petalGeo, initialPetalMat);
      const angle = (i / 18) * Math.PI * 2 * 2;
      const radius = 0.075 + (i * 0.0075);
      petal.position.set(Math.cos(angle) * radius, i * 0.01, Math.sin(angle) * radius);
      petal.rotation.y = -angle + Math.PI / 2;
      petal.rotation.x = -0.1 - (i * 0.02);
      flowerHead.add(petal);
      petalMeshes.push(petal);
    }
  } else if (flowerType === 'tulip') {
    center.visible = false;
    flowerHead.add(center);
    const petalGeo = new THREE.SphereGeometry(0.1, 8, 8);
    petalGeo.scale(1.1, 2.75, 0.3);
    for (let i = 0; i < 6; i++) {
      const petal = new THREE.Mesh(petalGeo, initialPetalMat);
      const angle = (i / 6) * Math.PI * 2;
      petal.position.set(Math.cos(angle) * 0.1, 0.15, Math.sin(angle) * 0.1);
      petal.rotation.y = -angle + Math.PI / 2;
      petal.rotation.x = 0.15;
      flowerHead.add(petal);
      petalMeshes.push(petal);
    }
  } else if (flowerType === 'sunflower') {
    center.geometry = new THREE.CylinderGeometry(0.18, 0.18, 0.03, 16) as any;
    center.material = new THREE.MeshStandardMaterial({ color: 0x3d2314 });
    center.rotation.x = Math.PI / 2;
    flowerHead.add(center);
    const petalGeo = new THREE.SphereGeometry(0.04, 8, 8);
    petalGeo.scale(1.75, 0.3, 4.75);
    for (let i = 0; i < 24; i++) {
      const petal = new THREE.Mesh(petalGeo, initialPetalMat);
      const angle = (i / 24) * Math.PI * 2;
      const radius = 0.225;
      petal.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      petal.rotation.y = -angle;
      flowerHead.add(petal);
      petalMeshes.push(petal);
    }
  } else if (flowerType === 'clover') {
    center.visible = false;
    flowerHead.add(center);
    const petalGeo = new THREE.SphereGeometry(0.12, 8, 8);
    petalGeo.scale(1.6, 0.25, 1.6);
    for (let i = 0; i < 4; i++) {
      const petal = new THREE.Mesh(petalGeo, initialPetalMat);
      const angle = (i / 4) * Math.PI * 2;
      petal.position.set(Math.cos(angle) * 0.175, 0, Math.sin(angle) * 0.175);
      petal.rotation.y = -angle;
      flowerHead.add(petal);
      petalMeshes.push(petal);
    }
  } else {
    // Daisy (default)
    center.scale.set(1.5, 0.6, 1.5);
    flowerHead.add(center);
    const petalGeo = new THREE.SphereGeometry(0.06, 8, 8);
    petalGeo.scale(1.75, 0.2, 6.75);
    for (let i = 0; i < 18; i++) {
      const petal = new THREE.Mesh(petalGeo, initialPetalMat);
      const angle = (i / 18) * Math.PI * 2;
      const radius = 0.275;
      petal.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      petal.rotation.y = -angle;
      petal.rotation.z = 0.15;
      flowerHead.add(petal);
      petalMeshes.push(petal);
    }
  }

  let shootTimer = 0;
  let currentStrength = 0;
  let chargeAmount = 0;
  const SHOOT_DURATION = 0.5;

  (flowerGroup as any).triggerShoot = (strength: number = 0.5) => {
    shootTimer = SHOOT_DURATION;
    currentStrength = strength;
  };

  (flowerGroup as any).setChargeAmount = (val: number) => {
    chargeAmount = val;
  };

  // 물리 기반 꽃 움직임
  (flowerGroup as any).updateFlowerPhysics = (forward: number, side: number, dt: number = 0.016) => {
    const tiltBase = 0.4;
    
    let shootOffset = 0;
    if (shootTimer > 0) {
      shootTimer -= dt;
      const progress = 1.0 - (shootTimer / SHOOT_DURATION);
      
      if (progress < 0.2) {
        // 이미 기를 모은 상태에서 뒤로 더 휘어지게 (반동)
        shootOffset = -chargeAmount * 1.5 - (progress / 0.2) * 0.5;
      } else if (progress < 0.4) {
        // Snap forward (기 모은 만큼 세게)
        const p2 = (progress - 0.2) / 0.2;
        const snapMax = 1.0 + currentStrength * 2.5; 
        shootOffset = -chargeAmount * 2.0 + p2 * (snapMax + chargeAmount * 2.0);
      } else {
        // Recovery
        const p3 = (progress - 0.4) / 0.6;
        shootOffset = (1.0 + currentStrength * 2.5) * (1.0 - p3);
      }
    } else {
      // 충전 중일 때는 뒤로 휘어짐
      shootOffset = -chargeAmount * 2.2;
    }

    const totalFwd = forward + shootOffset;

    stemSegments.forEach((seg, i) => {
      const t = i / (stemSegments.length - 1);
      const curve = Math.pow(t, 2);
      seg.position.z = curve * totalFwd * 1.1;
      seg.position.x = curve * side * 1.1;
      seg.rotation.x = t * totalFwd * 1.8;
      seg.rotation.z = -t * side * 1.8;
    });
    flowerHead.position.set(side * 1.1, stemHeight, totalFwd * 1.1);
    flowerHead.rotation.x = tiltBase + totalFwd * 2.2;
    flowerHead.rotation.z = -side * 2.2;
  };

  (flowerGroup as any).updateTilt = (tiltFactor: number) => {
    (flowerGroup as any).updateFlowerPhysics(tiltFactor * 0.3, 0, 0); // Tilt는 정적
  };

  (flowerGroup as any).setPetalColor = (newColor: number) => {
    const newMat = createPetalMat(newColor);
    petalMeshes.forEach(p => p.material = newMat);
  };

  return flowerGroup;
}

const createStarShape = (outerRadius: number, innerRadius: number, points: number) => {
  const shape = new THREE.Shape();
  const PI2 = Math.PI * 2;
  for (let i = 0; i < points * 2; i++) {
    const r = (i % 2 === 0) ? outerRadius : innerRadius;
    const a = (i / (points * 2)) * PI2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
};

const createHeartShape = (scale: number) => {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.2 * scale);
  shape.bezierCurveTo(0.5 * scale, 0.6 * scale, 1.2 * scale, 0, 0, -0.8 * scale);
  shape.bezierCurveTo(-1.2 * scale, 0, -0.5 * scale, 0.6 * scale, 0, 0.2 * scale);
  return shape;
};

/**
 * 바이저 모델 생성 (독립형)
 */
function createVisorModel(visorColor: number, visorType: string = 'normal') {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: visorColor, roughness: 0.2, metalness: 0.1 });
  const extrudeSettings = { depth: 0.05, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.01, bevelThickness: 0.01 };

  if (visorType === 'glasses') {
    const lensL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 32), mat);
    lensL.rotation.x = Math.PI / 2;
    lensL.position.set(-0.2, 0, 0);
    group.add(lensL);

    const lensR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 32), mat);
    lensR.rotation.x = Math.PI / 2;
    lensR.position.set(0.2, 0, 0);
    group.add(lensR);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.02), mat);
    group.add(bridge);
  } else if (visorType === 'sunglasses') {
    const lensL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.05), mat);
    lensL.position.set(-0.19, 0, 0);
    group.add(lensL);

    const lensR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.05), mat);
    lensR.position.set(0.19, 0, 0);
    group.add(lensR);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.02), mat);
    group.add(bridge);
  } else if (visorType === 'star') {
    const starGeoL = new THREE.ExtrudeGeometry(createStarShape(0.2, 0.08, 5), extrudeSettings);
    starGeoL.center();
    const lensL = new THREE.Mesh(starGeoL, mat);
    lensL.position.set(-0.2, 0, 0);
    group.add(lensL);

    const starGeoR = new THREE.ExtrudeGeometry(createStarShape(0.2, 0.08, 5), extrudeSettings);
    starGeoR.center();
    const lensR = new THREE.Mesh(starGeoR, mat);
    lensR.position.set(0.2, 0, 0);
    group.add(lensR);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.02), mat);
    group.add(bridge);
  } else if (visorType === 'heart') {
    const heartGeoL = new THREE.ExtrudeGeometry(createHeartShape(0.25), extrudeSettings);
    heartGeoL.center();
    const lensL = new THREE.Mesh(heartGeoL, mat);
    lensL.position.set(-0.2, 0, 0);
    group.add(lensL);

    const heartGeoR = new THREE.ExtrudeGeometry(createHeartShape(0.25), extrudeSettings);
    heartGeoR.center();
    const lensR = new THREE.Mesh(heartGeoR, mat);
    lensR.position.set(0.2, 0, 0);
    group.add(lensR);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.02), mat);
    group.add(bridge);
  } else {
    // Normal visor
    const visorGeo = new THREE.BoxGeometry(0.65, 0.2, 0.1);
    const visor = new THREE.Mesh(visorGeo, mat);
    group.add(visor);
  }

  (group as any).setVisorColor = (color: number) => {
    mat.color.setHex(color);
  };

  return group;
}
