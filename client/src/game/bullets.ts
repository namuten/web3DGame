import * as THREE from 'three';
import { scene } from '../engine/scene';
import { playerMesh, cameraPhi, PHI_MAX } from './player';

// ─── 탄환 데이터 구조 ─────────────────────────────────────────
interface Bullet {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  velocity: THREE.Vector3;
  lifeTime: number;
  ownerId: string;
}

const BULLET_SPEED = 20;       // 눈으로 따라가기 좋게 더 낮춤
const BULLET_LIFETIME = 2.5;   // 사거리 절반으로 단축
const BULLET_COLOR_LOCAL = 0xffff00;
const BULLET_COLOR_REMOTE = 0xff4444;

const bullets: Bullet[] = [];

// 파티클 (명중 효과)
interface Particle { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; }
const particles: Particle[] = [];

// ─── 탄환 생성 함수 ──────────────────────────────────────────
const createBullet = (origin: THREE.Vector3, direction: THREE.Vector3, ownerId: string): Bullet => {
  const color = ownerId === 'local' ? BULLET_COLOR_LOCAL : BULLET_COLOR_REMOTE;
  
  // 구체 메시 (크기 0.5로 키움)
  const geo = new THREE.SphereGeometry(0.5, 16, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 10,
    transparent: true,
    opacity: 0.9
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(origin);
  scene.add(mesh);

  // 주변을 밝히는 포인트 라이트
  const light = new THREE.PointLight(color, 30, 10);
  mesh.add(light);

  const bullet: Bullet = {
    mesh,
    light,
    velocity: direction.clone().normalize().multiplyScalar(BULLET_SPEED),
    lifeTime: BULLET_LIFETIME,
    ownerId
  };

  bullets.push(bullet);
  console.log(`[Bullet] Created for ${ownerId}. Active total: ${bullets.length}`);
  return bullet;
};

// ─── 로컬 플레이어 발사 ──────────────────────────────────────
let _shootCallback: ((origin: THREE.Vector3, direction: THREE.Vector3) => void) | null = null;
export const setShootCallback = (cb: (origin: THREE.Vector3, direction: THREE.Vector3) => void) => {
  _shootCallback = cb;
};

export const fireBullet = () => {
  // 한 번에 한 발만 조절
  if (bullets.some(b => b.ownerId === 'local')) {
    console.warn('[Bullet] Already has a local bullet in flight.');
    return;
  }

  // 발사 방향 (캐릭터가 보고 있는 정면)
  const dir = new THREE.Vector3(0, 0, 1);
  dir.applyQuaternion(playerMesh.quaternion);
  dir.normalize();

  // 발사 기점 (실시간으로 구부러지는 꽃 머리 위치 계산)
  const tiltFactor = (cameraPhi / PHI_MAX) * 1.5;
  const topZ = 0.3 * tiltFactor;
  const topY = 1.6 + 0.8; // 캐릭터 위(1.6) + 줄기 길이(0.8)
  
  const origin = playerMesh.position.clone()
    .add(new THREE.Vector3(0, topY, topZ).applyQuaternion(playerMesh.quaternion));

  createBullet(origin, dir, 'local');

  if (_shootCallback) {
    _shootCallback(origin, dir);
  }
};

// ─── 원격 플레이어 발사 ──────────────────────────────────────
export const addRemoteBullet = (origin: any, direction: any, id: string) => {
  const o = new THREE.Vector3(origin.x, origin.y, origin.z);
  const d = new THREE.Vector3(direction.x, direction.y, direction.z);
  createBullet(o, d, id);
};

// ─── 충돌 판정 ──────────────────────────────────────────────
const collidables: THREE.Object3D[] = [];
export const registerCollidables = (objs: THREE.Object3D[]) => {
  collidables.push(...objs);
};

const raycaster = new THREE.Raycaster();

// ─── 매 프레임 업데이트 ───────────────────────────────────────
export const updateBullets = (deltaTime: number) => {
  // 탄환 이동 및 수명 관리
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.lifeTime -= deltaTime;

    if (b.lifeTime <= 0) {
      removeBullet(i);
      continue;
    }

    const startPos = b.mesh.position.clone();
    const moveStep = b.velocity.clone().multiplyScalar(deltaTime);
    const endPos = startPos.clone().add(moveStep);

    // 충돌 검사
    raycaster.set(startPos, b.velocity.clone().normalize());
    raycaster.far = moveStep.length() + 0.5;
    const intersects = raycaster.intersectObjects(collidables, false);

    if (intersects.length > 0) {
      spawnImpact(intersects[0].point);
      removeBullet(i);
    } else {
      b.mesh.position.copy(endPos);
    }
  }

  // 파티클 업데이트
  updateParticles(deltaTime);
};

const removeBullet = (index: number) => {
  const b = bullets[index];
  scene.remove(b.mesh);
  bullets.splice(index, 1);
};

const spawnImpact = (pos: THREE.Vector3) => {
  for (let i = 0; i < 12; i++) {
    const pGeo = new THREE.SphereGeometry(0.1, 4, 4);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const pMesh = new THREE.Mesh(pGeo, pMat);
    pMesh.position.copy(pos);
    scene.add(pMesh);
    
    particles.push({
      mesh: pMesh,
      vel: new THREE.Vector3((Math.random()-0.5)*15, (Math.random())*15, (Math.random()-0.5)*15),
      life: 0.5
    });
  }
};

const updateParticles = (dt: number) => {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
      continue;
    }
    p.vel.y -= 30 * dt; // 중력
    p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
  }
};

// ─── 입력 바인딩 ─────────────────────────────────────────────
export const initBulletInput = () => {
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && document.activeElement?.tagName !== 'INPUT') {
      fireBullet();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF' && document.activeElement?.tagName !== 'INPUT') {
      fireBullet();
    }
  });
};
