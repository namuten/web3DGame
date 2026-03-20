import * as THREE from 'three';
import { scene } from '../engine/scene';
import { playerMesh, cameraPhi, PHI_MAX, getLocalBodyColor } from './player';
import { otherPlayers } from '../network/players';
import { socket } from '../network/socket';

// ─── 탄환 데이터 구조 ─────────────────────────────────────────
interface Bullet {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  velocity: THREE.Vector3;
  lifeTime: number;
  ownerId: string;
}

const BULLET_SPEED = 20;
const BULLET_LIFETIME = 2.5;

// 원격 플레이어 색상 저장
const remotePlayerColors: Record<string, number> = {};
export const setRemotePlayerColor = (id: string, color: number) => {
  remotePlayerColors[id] = color;
};

const bullets: Bullet[] = [];

// 파티클 (명중 효과)
interface Particle { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; }
const particles: Particle[] = [];

// ─── 탄환 생성 함수 ──────────────────────────────────────────
const createBullet = (origin: THREE.Vector3, direction: THREE.Vector3, ownerId: string): Bullet => {
  const color = ownerId === 'local' ? getLocalBodyColor() : (remotePlayerColors[ownerId] ?? 0xff4444);
  
  // 구체 메시 (크기 0.5로 키움)
  const geo = new THREE.SphereGeometry(0.5, 16, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.95
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(origin);
  scene.add(mesh);

  // 주변을 밝히는 포인트 라이트
  const light = new THREE.PointLight(color, 5, 6);
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

  // 발사 방향 계산 (카메라 시선 방향 반영)
  // cameraPhi가 작을수록 위에서 아래를 보는 것이므로, 아래로 더 많이 꺾어야 함
  // PHI_MAX일 때(약 81도) 거의 수평, PHI_MIN일 때(약 5도) 거의 수직 하강
  const verticalAngle = (cameraPhi / PHI_MAX) - 1.1; // -1.0 ~ 0 사이의 값으로 아래 조준
  
  const dir = new THREE.Vector3(0, verticalAngle, 1);
  dir.applyQuaternion(playerMesh.quaternion);
  dir.normalize();

  // 발사 기점 (머리 위 꽃 위치로 원복)
  // 캐릭터 위(1.6) + 줄기 길이(0.8) + 기울기에 따른 보정
  const tiltFactor = (cameraPhi / PHI_MAX) * 1.5;
  const topZ = 0.3 * tiltFactor;
  const topY = 1.6 + 0.8; 
  
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

    // 충돌 검사 대상을 합침 (월드 장애물 + 다른 플레이어들)
    const playersToHit = Object.values(otherPlayers);
    const targets = [...collidables, ...playersToHit];

    // 레이캐스팅 전 월드 행렬 강제 업데이트 (위치 오차 방지)
    targets.forEach(t => t.updateMatrixWorld());

    raycaster.set(startPos, b.velocity.clone().normalize());
    raycaster.far = moveStep.length() + 1.2; // 여유 범위 확대
    const intersects = raycaster.intersectObjects(targets, true);

    let hitOccurred = false;

    if (intersects.length > 0) {
      const hitObj = intersects[0].object;
      spawnImpact(intersects[0].point);

      // 내가 쏜 탄환이 다른 누군가를 맞췄을 때
      if (b.ownerId === 'local') {
        let current: THREE.Object3D | null = hitObj;
        let targetId: string | null = null;
        while (current) {
          if (current.userData && current.userData.playerId) {
            targetId = current.userData.playerId;
            break;
          }
          current = current.parent;
        }

        if (targetId) {
          socket.emit('TAKE_DAMAGE', {
            targetId: targetId,
            damage: 15,
            shooterId: socket.id,
            direction: b.velocity.clone().normalize()
          });
        }
      }
      hitOccurred = true;
    } 
    // 보조 수단: 레이캐스트 실패 시 플레이어 거리 기반 판정 (중심 거리 1.0 이내)
    else if (b.ownerId === 'local') {
      for (const id in otherPlayers) {
        const other = otherPlayers[id];
        const dist = endPos.distanceTo(other.position);
        if (dist < 1.2) { // 캡슐 반경 0.5 + 탄환 반경 0.5 + 여유 0.2
          spawnImpact(endPos);
          socket.emit('TAKE_DAMAGE', {
            targetId: id,
            damage: 15,
            shooterId: socket.id,
            direction: b.velocity.clone().normalize()
          });
          hitOccurred = true;
          break;
        }
      }
    }

    if (hitOccurred) {
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
