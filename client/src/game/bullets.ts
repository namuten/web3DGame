import * as THREE from 'three';
import { scene } from '../engine/scene';
import { playerMesh, cameraPhi, cameraTheta, PHI_MAX, getLocalBodyColor } from './player';
import { otherPlayers } from '../network/players';
import { monsterManager } from './monster';
import { showDamageText } from './floatingText';
import { soundManager } from '../audio/soundManager';

// ─── 탄환 데이터 구조 ─────────────────────────────────────────
interface Bullet {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  velocity: THREE.Vector3;
  lifeTime: number;
  ownerId: string;
  strength: number; // 발사 시의 힘 (0.0 ~ 1.0)
}

const BULLET_SPEED = 18; // 탄속 하향 (포물선 강조)
const BULLET_LIFETIME = 5.0; // 수명 연장
const BULLET_GRAVITY = -15.0; // 중력 강화 (돌 던지는 느낌 부여)

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
const createBullet = (origin: THREE.Vector3, direction: THREE.Vector3, ownerId: string, strength: number = 0.5): Bullet => {
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
    ownerId,
    strength
  };

  bullets.push(bullet);
  console.log(`[Bullet] Created for ${ownerId} with strength ${strength.toFixed(2)}. Active total: ${bullets.length}`);
  return bullet;
};

// ─── 로컬 플레이어 발사 ──────────────────────────────────────
// ─── 로컬 플레이어 발사 ──────────────────────────────────────
let _shootCallback: ((origin: THREE.Vector3, direction: THREE.Vector3) => void) | null = null;
export const setShootCallback = (cb: (origin: THREE.Vector3, direction: THREE.Vector3) => void) => {
  _shootCallback = cb;
};

let _damageCallback: ((targetId: string, damage: number, direction: THREE.Vector3) => void) | null = null;
export const setDamageCallback = (cb: (targetId: string, damage: number, direction: THREE.Vector3) => void) => {
  _damageCallback = cb;
};

export const fireBullet = (strength: number = 0.5) => {
  // 사용자의 요청: 발사된 탄환이 없어져야 새로 발사 가능
  const hasLocalBullet = bullets.some(b => b.ownerId === 'local');
  if (hasLocalBullet) {
    console.log("[Bullet] Previous bullet still active. Wait until it disappears.");
    return;
  }

  // 발사 방향 계산: 곡사(Lob) 보정을 위해 위쪽 벡터 가산
  // 60도 정도의 고각 발사를 위해 lobBoost를 Math.tan(60 * Math.PI / 180) ≈ 1.732로 설정
  const lobBoost = 1.732;
  const verticalAngle = (cameraPhi / PHI_MAX) - 1.0 + lobBoost;

  const fwdX = -Math.sin(cameraTheta);
  const fwdZ = -Math.cos(cameraTheta);
  const dir = new THREE.Vector3(fwdX, verticalAngle, fwdZ).normalize();

  // 발사 원점 (캐릭터 머리 위 꽃봉오리 위치)
  const origin = playerMesh.position.clone().add(
    new THREE.Vector3(fwdX * 0.5, 2.8, fwdZ * 0.5)
  );

  // 힘(strength)에 비례하여 속도 조절 (최소 8 ~ 최대 35)
  const finalSpeed = 8 + strength * 27;
  
  const bullet = createBullet(origin, dir, 'local', strength);
  soundManager.playShoot();
  bullet.velocity.copy(dir).multiplyScalar(finalSpeed);

  if (_shootCallback) {
    _shootCallback(origin, dir);
  }
};

// ─── 원격 플레이어 탄환 추가 (strength 포함 고안) ─────────────────
export const addRemoteBullet = (origin: any, direction: any, id: string, strength: number = 0.5) => {
  const o = new THREE.Vector3(origin.x, origin.y, origin.z);
  const d = new THREE.Vector3(direction.x, direction.y, direction.z);
  
  // 원격 플레이어가 보낸 방향과 힘을 그대로 적용
  const b = createBullet(o, d, id, strength);
  // 속도 재계계 (원격 탄환도 초기 속도 로직이 필요할 수 있음. 여기서는 넘겨받은 d가 정규화된 방향이라고 가정)
  const remoteSpeed = 8 + strength * 27;
  b.velocity.copy(d).normalize().multiplyScalar(remoteSpeed);
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
    
    // 중력 가속도 적용 (속도의 y축 성분 감소)
    b.velocity.y += BULLET_GRAVITY * deltaTime;
    
    const moveStep = b.velocity.clone().multiplyScalar(deltaTime);
    const endPos = startPos.clone().add(moveStep);

    // 충돌 검사 대상을 합침 (월드 장애물 + 다른 플레이어들 + 몬스터)
    const playersToHit = Object.values(otherPlayers);
    const targets = [...collidables, ...playersToHit];
    if (monsterManager.monsterMesh) {
      targets.push(monsterManager.monsterMesh);
    }

    // 레이캐스팅 전 월드 행렬 강제 업데이트 (위치 오차 방지)
    targets.forEach(t => t.updateMatrixWorld());

    raycaster.set(startPos, b.velocity.clone().normalize());
    raycaster.far = moveStep.length() + 0.5; // 이동 거리만큼만 레이캐스팅
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
          if (current.userData && current.userData.isMonster) {
            targetId = current.userData.monsterId;
            break;
          }
          current = current.parent;
        }

        if (targetId && _damageCallback) {
          // 기본 대미지 10 + 충전 위력에 따른 추가 대미지 (최대 40)
          const damageValue = Math.round(10 + b.strength * 30);
          soundManager.playHit();
          _damageCallback(targetId, damageValue, b.velocity.clone().normalize());
          
          // 대상의 스케일에 맞춰 텍스트 높이 조절
          let offsetY = 3.5;
          if (hitObj.userData && hitObj.userData.isMonster) {
            // 몬스터의 경우 현재 스케일에 비례하여 높이 조정 (기본 크기가 크므로 스케일 적용)
            offsetY = 1.0 + (monsterManager as any).currentScale * 6.0;
          }
          
          showDamageText(intersects[0].point, damageValue, '#ff3300', offsetY);
        }
      }
      hitOccurred = true;
    } 
    // 보조 수단: 레이캐스트 실패 시 거리 기반 판정 (중심 거리 1.0 이내)
    else if (b.ownerId === 'local') {
      let hitId: string | null = null;
      for (const id in otherPlayers) {
        const other = otherPlayers[id];
        const dist = endPos.distanceTo(other.position);
        if (dist < 1.2) { 
          hitId = id;
          break;
        }
      }
      if (!hitId && monsterManager.monsterMesh) {
        // 슬라임 반경은 좀 더 크므로 거리를 길게 잡음
        const monsterDist = endPos.distanceTo(monsterManager.monsterMesh.position);
        if (monsterDist < 8.0) { // 슬라임 스케일과 구체 반경 고려
          hitId = 'boss_slime';
        }
      }

      if (hitId && _damageCallback) {
        spawnImpact(endPos);
        const damageValue = Math.round(10 + b.strength * 30);
        soundManager.playHit();
        _damageCallback(hitId, damageValue, b.velocity.clone().normalize());
        
        // 대상이 몬스터인지 확인하여 높이 조절
        let offsetY = 3.5;
        if (hitId === 'boss_slime' || hitId.startsWith('monster')) {
            offsetY = 1.0 + (monsterManager as any).currentScale * 6.0;
        }
        
        showDamageText(endPos, damageValue, '#ff3300', offsetY);
        hitOccurred = true;
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
  soundManager.playImpact();
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
  // 입력 리스너는 player.ts로 통합됨
};
