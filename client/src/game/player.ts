import * as THREE from 'three';
import { scene } from '../engine/scene';
import { camera } from '../engine/camera';
import { worldCollidables, currentMapConfig, getGroundHeight } from './world';
import { otherPlayers } from '../network/players';
import { updatePartyMemberHP } from '../ui/partyUI';

import { createCharacterModel } from './characterModel';

// ─── 플레이어 메시 초기 세팅 (2톤 세라믹 캡슐 + 데이지 꽃) ──────────
export const playerMesh = new THREE.Group();

// 신형 캐릭터 모델 생성 (하부/상부 분리)
export const characterModel = createCharacterModel();
playerMesh.add(characterModel);

let localBodyColor: number = 0xffb7b2;
export const getLocalBodyColor = () => localBodyColor;

export const setPlayerColor = (bodyColor: number, flowerColor: number, visorColor?: number, flowerType: string = 'daisy', visorType: string = 'normal') => {
  localBodyColor = bodyColor;
  if ((characterModel as any).setBodyColor) {
    (characterModel as any).setBodyColor(bodyColor);
  }
  if ((characterModel as any).setFlowerStyle) {
    (characterModel as any).setFlowerStyle(flowerType, flowerColor);
  } else if ((characterModel as any).setFlowerColor) {
    (characterModel as any).setFlowerColor(flowerColor);
  }
  if (visorColor !== undefined && (characterModel as any).setVisorStyle) {
    (characterModel as any).setVisorStyle(visorColor, visorType);
  } else if (visorColor !== undefined && (characterModel as any).setVisorColor) {
    (characterModel as any).setVisorColor(visorColor);
  }
};

// ─── 키보드 상태 ───────────────────────────────────────────────
const keys = {
  w: false, a: false, s: false, d: false,
  space: false,
  arrowLeft: false, arrowRight: false,
  arrowUp: false, arrowDown: false,
};

// ─── 궤도 카메라 (Spherical Orbit) 파라미터 ───────────────────
export let cameraTheta = Math.PI;
export let cameraPhi = Math.PI / 2.8;
const CAMERA_DIST = 14;

// 카메라 회전 관성 변수
let thetaVelocity = 0;
let phiVelocity = 0;
const ROTATION_ACCEL = 5.0;   // 회전 가속도
const ROTATION_FRICTION = 0.92; // 마찰력 (자연스러운 멈춤)

const PHI_MIN = 0.1;
export const PHI_MAX = Math.PI / 2.2;

// 카메라 보간 변수
const currentCameraPos = new THREE.Vector3(0, 4, 14);
const smoothLookAtPos = new THREE.Vector3(0, 1.5, 0);

// ─── 점프 & 중력 ──────────────────────────────────────────────
const GRAVITY = -25;
const JUMP_FORCE = 12;
let verticalVelocity = 0;
let isOnGround = true;

// ─── HP & HUD ────────────────────────────────────────────────
let hp = 100;
(window as any).debugSetHP = (val: number) => {
  hp = val;
  updateHPHUD();
};
let hpHUD: HTMLDivElement | null = null;

const updateHPHUD = () => {
  if (hpHUD) {
    hpHUD.innerText = `HP: ${Math.max(0, Math.round(hp))}`;
    hpHUD.style.width = `${Math.max(0, hp)}%`;
    if (hp < 30) hpHUD.style.backgroundColor = '#ff4d4d';
    else if (hp < 60) hpHUD.style.backgroundColor = '#ffd93d';
    else hpHUD.style.backgroundColor = '#6bcb77';
  }
  updatePartyMemberHP('local', hp);
};

// ─── 넉백 물리 ───────────────────────────────────────────────
const knockbackVelocity = new THREE.Vector3();
const KNOCKBACK_DECAY = 0.92;

// ─── 데미지 시각 효과 ──────────────────────────────────────────
let damageFlashTimer = 0;
const flashMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 });
let originalMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]> = new Map();

let currentUpperYaw = 0;
let currentUpperPitch = 0;
export const getUpperYaw = () => currentUpperYaw;
export const getUpperPitch = () => currentUpperPitch;
const UPPER_LERP_SPEED = 3.5;

// 꽃 스프링 물리 변수
let flowerSpringFwd = 0, flowerSpringFwdVel = 0;
let flowerSpringSide = 0, flowerSpringSideVel = 0;
const SPRING_K = 18;   // 탄성 (클수록 빠르게 복원)
const SPRING_D = 5.5;  // 감쇠 (클수록 빨리 멈춤)

// 모델 반동 물리 변수 (Scale Squash & Stretch)
let modelScaleY = 1.0;
let modelScaleYVel = 0;
const RECOIL_K = 220;  // 반동 탄성
const RECOIL_D = 12;   // 반동 감쇠

// ─── 이동 속도 ────────────────────────────────────────────────
const BASE_SPEED = 12;
const playerVelocity = new THREE.Vector3();
const targetRotation = new THREE.Quaternion();

// -- 충돌 감지 헬퍼 --
const playerBox = new THREE.Box3();
const obstacleBox = new THREE.Box3();

/** 
 * 특정 위치에서 충돌 여부 확인 
 */
const checkCollision = (position: THREE.Vector3): boolean => {
  // 1. 벽/장애물 충돌 (AABB)
  // 플레이어의 바운딩 박스 설정 (캡슐 형태이므로 약간의 마진)
  // 박스 하단을 발바닥보다 0.25 올려서, 딛고 서 있는 면과 겹치지 않도록
  playerBox.setFromCenterAndSize(
    position.clone().add(new THREE.Vector3(0, 1.25, 0)),
    new THREE.Vector3(0.75, 1.5, 0.75)
  );

  for (const obj of worldCollidables) {
    if (obj instanceof THREE.Mesh) {
      // 윗면 지형은 충돌 제외 (탄환 용도)
      if (obj.userData && obj.userData.isFloor) continue;
      
      obstacleBox.setFromObject(obj);
      if (playerBox.intersectsBox(obstacleBox)) return true;
    }
  }

  // 2. 다른 플레이어와 충돌 (구체/거리 기반)
  for (const id in otherPlayers) {
    const other = otherPlayers[id];
    const distSq = position.distanceToSquared(other.position);
    // 두 플레이어 사이의 거리가 지름(1.0) 보다 작으면 충돌
    if (distSq < 0.9) return true; // 1.0 보다는 약간 여유를 줌
  }

  return false;
};

// ─── 초기화 ───────────────────────────────────────────────────
export const initPlayer = () => {
  scene.add(playerMesh);

  // 조작 안내 HUD
  const hint = document.createElement('div');
  hint.style.cssText = `
    position: absolute; top: 20px; right: 20px;
    color: #333; font-family: monospace; font-size: 12px;
    background: rgba(255, 255, 255, 0.7); padding: 10px 14px;
    border-radius: 5px; border: 1px solid #cccccc;
    pointer-events: none; line-height: 1.8;
  `;
  hint.innerHTML = `
    <b style="color:#000">CONTROLS</b><br>
    WASD &nbsp;&nbsp;: 이동<br>
    ↑↓←→ &nbsp;: 카메라 회전<br>
    Space : 점프<br>
    F / 클릭 : 발사<br>
    Enter : 채팅
  `;
  document.body.appendChild(hint);

  // HP HUD 생성
  const hpContainer = document.createElement('div');
  hpContainer.style.cssText = `
    position: absolute; bottom: 30px; left: 50%;
    transform: translateX(-50%);
    width: 250px; height: 24px;
    background: rgba(0, 0, 0, 0.5);
    border: 2px solid #fff; border-radius: 12px;
    overflow: hidden;
  `;
  hpHUD = document.createElement('div');
  hpHUD.style.cssText = `
    width: 100%; height: 100%;
    background: #6bcb77;
    transition: width 0.3s ease, background-color 0.3s ease;
    display: flex; align-items: center; justify-content: center;
    color: white; font-weight: bold; font-family: sans-serif;
    font-size: 14px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
  `;
  hpHUD.innerText = `HP: 100`;
  hpContainer.appendChild(hpHUD);
  document.body.appendChild(hpContainer);

  // 키 이벤트 등록
  window.addEventListener('keydown', (e) => {
    // 채팅 중엔 게임 조작 무시
    if (document.activeElement?.tagName === 'INPUT') return;

    if (e.code === 'KeyW') keys.w = true;
    if (e.code === 'KeyA') keys.a = true;
    if (e.code === 'KeyS') keys.s = true;
    if (e.code === 'KeyD') keys.d = true;
    if (e.code === 'ArrowLeft') keys.arrowLeft = true;
    if (e.code === 'ArrowRight') keys.arrowRight = true;
    if (e.code === 'ArrowUp') keys.arrowUp = true;
    if (e.code === 'ArrowDown') keys.arrowDown = true;

    // 점프 (HP가 0이면 불가)
    if (hp > 0 && e.code === 'Space' && isOnGround) {
      verticalVelocity = JUMP_FORCE;
      isOnGround = false;
      // 점프 시 순간적으로 위로 늘어남
      modelScaleYVel = 1.5;
      e.preventDefault(); // 스크롤 방지
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') keys.w = false;
    if (e.code === 'KeyA') keys.a = false;
    if (e.code === 'KeyS') keys.s = false;
    if (e.code === 'KeyD') keys.d = false;
    if (e.code === 'ArrowLeft') keys.arrowLeft = false;
    if (e.code === 'ArrowRight') keys.arrowRight = false;
    if (e.code === 'ArrowUp') keys.arrowUp = false;
    if (e.code === 'ArrowDown') keys.arrowDown = false;
  });
};

// ─── 매 프레임 업데이트 ───────────────────────────────────────
export const updatePlayer = (deltaTime: number) => {
  // -- 데미지 이펙트 타이머 업데이트 --
  if (damageFlashTimer > 0) {
    damageFlashTimer -= deltaTime;
    if (damageFlashTimer <= 0) {
      // 원래 머티리얼로 복구
      playerMesh.traverse((child) => {
        if (child instanceof THREE.Mesh && originalMaterials.has(child)) {
          child.material = originalMaterials.get(child)!;
        }
      });
    }
  }

  // -- 카메라 회전 가속도 적용 (관성 시스템) --
  if (keys.arrowLeft) thetaVelocity += ROTATION_ACCEL * deltaTime;
  if (keys.arrowRight) thetaVelocity -= ROTATION_ACCEL * deltaTime;
  if (keys.arrowUp) phiVelocity -= ROTATION_ACCEL * deltaTime;
  if (keys.arrowDown) phiVelocity += ROTATION_ACCEL * deltaTime;

  // 값 갱신
  cameraTheta += thetaVelocity * deltaTime;
  cameraPhi += phiVelocity * deltaTime;

  // 마찰력 적용 (자연스럽게 감속)
  thetaVelocity *= ROTATION_FRICTION;
  phiVelocity *= ROTATION_FRICTION;

  // 범위 제한
  cameraPhi = Math.max(PHI_MIN, Math.min(PHI_MAX, cameraPhi));

  // -- 카메라의 현재 수평 방향 벡터 계산 --
  // cameraTheta 기준으로 카메라가 바라보는 수평 방향 (플레이어 → 카메라 반대 = 플레이어 전방)
  const camHorizontalForward = new THREE.Vector3(
    -Math.sin(cameraTheta),
    0,
    -Math.cos(cameraTheta)
  );
  const camHorizontalRight = new THREE.Vector3(
    Math.cos(cameraTheta),
    0,
    -Math.sin(cameraTheta)
  );

  // -- WASD 이동 (카메라 수평 방향 기준) --
  playerVelocity.set(0, 0, 0);

  // HP가 0이면 이동 차단 (시선 회전만 가능)
  if (hp > 0) {
    if (keys.w) playerVelocity.add(camHorizontalForward);
    if (keys.s) playerVelocity.sub(camHorizontalForward);
    if (keys.a) playerVelocity.sub(camHorizontalRight);
    if (keys.d) playerVelocity.add(camHorizontalRight);
  }

  // -- 넉백 처리 및 최종 속력 계산 --
  if (knockbackVelocity.lengthSq() > 0.01) {
    playerVelocity.add(knockbackVelocity);
    knockbackVelocity.multiplyScalar(KNOCKBACK_DECAY);
  } else {
    knockbackVelocity.set(0, 0, 0);
  }

  // -- 캐릭터 회전 (항상 카메라의 수평 정면을 바라보도록 고정) --
  // 이를 통해 'S'키를 눌러 뒤로 갈 때 몸을 돌리지 않고 뒷걸음질(뒷모습 유지)을 치게 됩니다.
  const lookAtAngle = Math.atan2(camHorizontalForward.x, camHorizontalForward.z);
  targetRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), lookAtAngle);
  playerMesh.quaternion.slerp(targetRotation, Math.min(10 * deltaTime, 1.0));

  if (playerVelocity.lengthSq() > 0) {
    playerVelocity.normalize();

    // HP에 따른 동적 속도 계산 (HP 100 = 100%, HP 50 = 50%)
    const currentSpeed = BASE_SPEED * (hp / 100);

    // 이동 위치 계산 및 충돌 처리 (슬라이딩 로직)
    const moveStep = playerVelocity.clone().multiplyScalar(currentSpeed * deltaTime);

    // 1. X, Z 동시 이동 시도
    const testPosAll = playerMesh.position.clone().add(moveStep);
    if (!checkCollision(testPosAll)) {
      playerMesh.position.copy(testPosAll);
    } else {
      // 2. X축만 이동 시도 (벽 타고 미끄러지기)
      const testPosX = playerMesh.position.clone();
      testPosX.x += moveStep.x;
      if (!checkCollision(testPosX)) {
        playerMesh.position.x = testPosX.x;
      }

      // 3. Z축만 이동 시도
      const testPosZ = playerMesh.position.clone();
      testPosZ.z += moveStep.z;
      if (!checkCollision(testPosZ)) {
        playerMesh.position.z = testPosZ.z;
      }
    }
  }

  // -- 맵 경계 제한 (Clamp Position) --
  if (currentMapConfig) {
    const halfSize = currentMapConfig.floorSize / 2;
    const margin = 0.5;
    playerMesh.position.x = THREE.MathUtils.clamp(playerMesh.position.x, -halfSize + margin, halfSize - margin);
    playerMesh.position.z = THREE.MathUtils.clamp(playerMesh.position.z, -halfSize + margin, halfSize - margin);
  }

  // -- 수직 이동 (중력 + 점프 + 장애물 착지) --
  verticalVelocity += GRAVITY * deltaTime;
  const newY = playerMesh.position.y + verticalVelocity * deltaTime;

  // 현재 위치의 지면 높이 계산
  const currentGroundY = getGroundHeight(playerMesh.position.x, playerMesh.position.z);

  if (newY <= currentGroundY) {
    // 바닥 착지
    if (!isOnGround) {
      modelScaleYVel = -3.5;
    }
    playerMesh.position.y = currentGroundY;
    verticalVelocity = 0;
    isOnGround = true;
  } else {
    const px = playerMesh.position.x;
    const pz = playerMesh.position.z;
    const halfW = 0.38;
    const prevBottom = playerMesh.position.y + 0.1;
    const prevTop = playerMesh.position.y + 1.9;
    const newBottom = newY + 0.1;
    const newTop = newY + 1.9;

    let blocked = false;

    for (const obj of worldCollidables) {
      if (!(obj instanceof THREE.Mesh)) continue;
      if (obj.userData && obj.userData.isFloor) continue;
      obstacleBox.setFromObject(obj);

      // XZ 범위 밖이면 스킵
      if (px + halfW <= obstacleBox.min.x || px - halfW >= obstacleBox.max.x) continue;
      if (pz + halfW <= obstacleBox.min.z || pz - halfW >= obstacleBox.max.z) continue;

      if (verticalVelocity <= 0) {
        // 낙하 중: 장애물 위면에 착지
        if (prevBottom >= obstacleBox.max.y - 0.05 && newBottom <= obstacleBox.max.y) {
          playerMesh.position.y = obstacleBox.max.y - 0.1;
          verticalVelocity = 0;
          isOnGround = true;
          blocked = true;
          break;
        }
      } else {
        // 점프 중: 장애물 아랫면에 머리 충돌
        if (prevTop <= obstacleBox.min.y + 0.05 && newTop >= obstacleBox.min.y) {
          verticalVelocity = 0;
          blocked = true;
          break;
        }
      }
    }

    if (!blocked) {
      playerMesh.position.y = newY;
      // 공중에 뜬 경우 isOnGround 해제 (장애물 위에서 걸어나갔을 때)
      if (verticalVelocity < -0.5) isOnGround = false;
    }
  }

  // -- 궤도 카메라 위치 계산 (구면 좌표 → 데카르트 좌표) --
  const camOffset = new THREE.Vector3(
    CAMERA_DIST * Math.sin(cameraPhi) * Math.sin(cameraTheta),
    CAMERA_DIST * Math.cos(cameraPhi),
    CAMERA_DIST * Math.sin(cameraPhi) * Math.cos(cameraTheta)
  );
  const idealCameraPos = playerMesh.position.clone().add(camOffset);

  // 부드럽게 보간
  currentCameraPos.lerp(idealCameraPos, Math.min(7 * deltaTime, 1.0));
  camera.position.copy(currentCameraPos);

  // -- 꽃 스프링 물리 (이동 방향 반대로 쏠림) --
  // 이동 벡터를 캐릭터 로컬 좌표로 변환 (앞뒤/좌우)
  const movingFwd = playerVelocity.lengthSq() > 0
    ? playerVelocity.dot(camHorizontalForward)
    : 0;
  const movingSide = playerVelocity.lengthSq() > 0
    ? playerVelocity.dot(camHorizontalRight)
    : 0;

  // 목표: 이동 반대 방향으로 쏠림
  const targetFwd = -movingFwd * 0.9;
  const targetSide = movingSide * 0.6;

  // 스프링 공식: F = -k*(x - target) - d*v
  const forceFwd = (targetFwd - flowerSpringFwd) * SPRING_K - flowerSpringFwdVel * SPRING_D;
  const forceSide = (targetSide - flowerSpringSide) * SPRING_K - flowerSpringSideVel * SPRING_D;

  flowerSpringFwdVel += forceFwd * deltaTime;
  flowerSpringSideVel += forceSide * deltaTime;
  flowerSpringFwd += flowerSpringFwdVel * deltaTime;
  flowerSpringSide += flowerSpringSideVel * deltaTime;

  if ((characterModel as any).updateFlowerPhysics) {
    (characterModel as any).updateFlowerPhysics(flowerSpringFwd, flowerSpringSide);
  }

  // -- 모델 반동 물리 업데이트 (Scale Y) --
  const recoilAcc = (1.0 - modelScaleY) * RECOIL_K - modelScaleYVel * RECOIL_D;
  modelScaleYVel += recoilAcc * deltaTime;
  modelScaleY += modelScaleYVel * deltaTime;
  
  if ((characterModel as any).setVisualEffects) {
    // 바닥에 붙어 있도록 offsetY 조정 (1.0 - scaleY) * 모델높이/2
    const offsetY = (1.0 - modelScaleY) * 0.75; 
    (characterModel as any).setVisualEffects(modelScaleY, offsetY);
  }

  // 카메라가 바라보는 방향과 캐릭터 몸체 방향 사이의 차이 계산
  const cameraYaw = cameraTheta - Math.PI;
  const bodyEuler = new THREE.Euler().setFromQuaternion(playerMesh.quaternion, 'YXZ');
  const bodyYaw = bodyEuler.y;
  let relativeYaw = cameraYaw - bodyYaw;

  // 각도 정규화 (-PI ~ PI)
  while (relativeYaw > Math.PI) relativeYaw -= Math.PI * 2;
  while (relativeYaw < -Math.PI) relativeYaw += Math.PI * 2;

  // 상체 회전 범위를 -70도 ~ 70도로 제한 (허리가 꼬이지 않게)
  const clampedYaw = Math.max(-Math.PI * 0.4, Math.min(Math.PI * 0.4, relativeYaw));
  
  // 상하 시선 (Pitch) 계산: cameraPhi가 작을수록(위에서 볼수록) 고개를 숙임
  // 기본 Phi = PI/2.8(약 1.12)
  const targetPitch = (cameraPhi - Math.PI / 2.8) * 0.7;

  // 부드럽게 보간 (Snap 방지)
  currentUpperYaw = THREE.MathUtils.lerp(currentUpperYaw, clampedYaw, Math.min(UPPER_LERP_SPEED * deltaTime, 1.0));
  currentUpperPitch = targetPitch; // 피치는 즉각적으로 반영해도 무방

  if ((characterModel as any).setUpperRotation) {
    (characterModel as any).setUpperRotation(currentUpperYaw, currentUpperPitch);
  }

  // -- HP 기반 시각 효과 (Shake/Tilt) --
  if (hp <= 40 && hp > 0) {
    // 셰이크 강도: HP가 낮을수록 더 심하게 떰
    const shakeIntensity = (1 - hp / 40) * 0.05;
    playerMesh.rotation.z = Math.sin(performance.now() * 0.03) * shakeIntensity;
    playerMesh.rotation.x = Math.cos(performance.now() * 0.02) * shakeIntensity;
  } else if (hp <= 0) {
    // 사망 시 옆으로 약간 기울어짐 (무력화된 느낌)
    playerMesh.rotation.z = Math.PI / 2.5;
  } else {
    playerMesh.rotation.z = 0;
    playerMesh.rotation.x = 0;
  }

  // 카메라가 플레이어를 부드럽게 주시
  const idealLookAt = playerMesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  smoothLookAtPos.lerp(idealLookAt, Math.min(10 * deltaTime, 1.0));
  camera.lookAt(smoothLookAtPos);
};

// ─── 데미지 및 외부 상태 제어 API ──────────────────────────────
export const applyDamage = (newHP: number, direction?: THREE.Vector3) => {
  const isDamage = newHP < hp;
  hp = newHP;
  updateHPHUD();

  if (isDamage) {
    // 데미지를 입었을 때만 빨간색 깜빡임 효과
    damageFlashTimer = 0.15;
    originalMaterials.clear();
    playerMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        originalMaterials.set(child, child.material);
        child.material = flashMaterial;
      }
    });

    // 넉백 적용
    if (direction) {
      const kb = direction.clone().normalize().multiplyScalar(1.5); // 넉백 강도
      kb.y = 0.5; // 약간 위로 뜨게
      knockbackVelocity.add(kb);
    }
  }
};

export const respawnPlayer = (newHP: number, position: { x: number, y: number, z: number }) => {
  hp = newHP;
  updateHPHUD();
  playerMesh.position.set(position.x, position.y, position.z);
  knockbackVelocity.set(0, 0, 0);
  verticalVelocity = 0;
};

