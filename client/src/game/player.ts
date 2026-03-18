import * as THREE from 'three';
import { scene } from '../engine/scene';
import { camera } from '../engine/camera';
import { worldCollidables } from './world';
import { otherPlayers } from '../network/players';

import { createCharacterModel } from './characterModel';

// ─── 플레이어 메시 초기 세팅 (2톤 세라믹 캡슐 + 데이지 꽃) ──────────
export const playerMesh = new THREE.Group();

// 신형 캐릭터 모델 생성 (하부/상부 분리)
const characterModel = createCharacterModel();
playerMesh.add(characterModel);

export const setPlayerColor = (bodyColor: number, flowerColor: number) => {
  if ((characterModel as any).setBodyColor) {
    (characterModel as any).setBodyColor(bodyColor);
  }
  if ((characterModel as any).setFlowerColor) {
    (characterModel as any).setFlowerColor(flowerColor);
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
let cameraTheta = Math.PI;    
export let cameraPhi = Math.PI / 5;  
const CAMERA_DIST = 14;       

// 카메라 회전 관성 변수
let thetaVelocity = 0;
let phiVelocity = 0;
const ROTATION_ACCEL = 5.0;   // 회전 가속도
const ROTATION_FRICTION = 0.92; // 마찰력 (자연스러운 멈춤)

const PHI_MIN = 0.1;          
export const PHI_MAX = Math.PI / 2.2; 

// 카메라 보간 변수
const currentCameraPos = new THREE.Vector3(0, 8, 14);
const smoothLookAtPos = new THREE.Vector3(0, 1.5, 0);

// ─── 점프 & 중력 ──────────────────────────────────────────────
const GRAVITY = -25;
const JUMP_FORCE = 12;
const GROUND_Y = 0;
let verticalVelocity = 0;
let isOnGround = true;

// 상체 회전 보간 변수
let currentUpperYaw = 0;
const UPPER_LERP_SPEED = 3.5; // 더 천천히 따라오게 변경 (5 -> 3.5)

// ─── 이동 속도 ────────────────────────────────────────────────
const speed = 12;
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
  playerBox.setFromCenterAndSize(
    position.clone().add(new THREE.Vector3(0, 1, 0)), 
    new THREE.Vector3(0.8, 1.8, 0.8) // 실제 0.5 보다는 약간 작게 해서 부드럽게
  );

  for (const obj of worldCollidables) {
    if (obj instanceof THREE.Mesh) {
      // 메시의 바운딩 박스 계산 (최적화를 위해 매번하기 보다는 월드 생성시 해두면 좋음)
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

  // 키 이벤트 등록
  window.addEventListener('keydown', (e) => {
    // 채팅 중엔 게임 조작 무시
    if (document.activeElement?.tagName === 'INPUT') return;

    if (e.code === 'KeyW') keys.w = true;
    if (e.code === 'KeyA') keys.a = true;
    if (e.code === 'KeyS') keys.s = true;
    if (e.code === 'KeyD') keys.d = true;
    if (e.code === 'ArrowLeft')  keys.arrowLeft  = true;
    if (e.code === 'ArrowRight') keys.arrowRight = true;
    if (e.code === 'ArrowUp')    keys.arrowUp    = true;
    if (e.code === 'ArrowDown')  keys.arrowDown  = true;

    // 점프
    if (e.code === 'Space' && isOnGround) {
      verticalVelocity = JUMP_FORCE;
      isOnGround = false;
      e.preventDefault(); // 스크롤 방지
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') keys.w = false;
    if (e.code === 'KeyA') keys.a = false;
    if (e.code === 'KeyS') keys.s = false;
    if (e.code === 'KeyD') keys.d = false;
    if (e.code === 'ArrowLeft')  keys.arrowLeft  = false;
    if (e.code === 'ArrowRight') keys.arrowRight = false;
    if (e.code === 'ArrowUp')    keys.arrowUp    = false;
    if (e.code === 'ArrowDown')  keys.arrowDown  = false;
  });
};

// ─── 매 프레임 업데이트 ───────────────────────────────────────
export const updatePlayer = (deltaTime: number) => {
  // -- 카메라 회전 가속도 적용 (관성 시스템) --
  if (keys.arrowLeft)  thetaVelocity -= ROTATION_ACCEL * deltaTime;
  if (keys.arrowRight) thetaVelocity += ROTATION_ACCEL * deltaTime;
  if (keys.arrowUp)    phiVelocity   -= ROTATION_ACCEL * deltaTime;
  if (keys.arrowDown)  phiVelocity   += ROTATION_ACCEL * deltaTime;

  // 값 갱신
  cameraTheta += thetaVelocity * deltaTime;
  cameraPhi   += phiVelocity * deltaTime;

  // 마찰력 적용 (자연스럽게 감속)
  thetaVelocity *= ROTATION_FRICTION;
  phiVelocity   *= ROTATION_FRICTION;

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
  if (keys.w) playerVelocity.add(camHorizontalForward);
  if (keys.s) playerVelocity.sub(camHorizontalForward);
  if (keys.a) playerVelocity.sub(camHorizontalRight);
  if (keys.d) playerVelocity.add(camHorizontalRight);

  // -- 캐릭터 회전 (항상 카메라의 수평 정면을 바라보도록 고정) --
  // 이를 통해 'S'키를 눌러 뒤로 갈 때 몸을 돌리지 않고 뒷걸음질(뒷모습 유지)을 치게 됩니다.
  const lookAtAngle = Math.atan2(camHorizontalForward.x, camHorizontalForward.z);
  targetRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), lookAtAngle);
  playerMesh.quaternion.slerp(targetRotation, Math.min(10 * deltaTime, 1.0));

  if (playerVelocity.lengthSq() > 0) {
    playerVelocity.normalize();

    // 이동 위치 계산 및 충돌 처리 (슬라이딩 로직)
    const moveStep = playerVelocity.clone().multiplyScalar(speed * deltaTime);
    
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

  // -- 수직 이동 (중력 + 점프) --
  verticalVelocity += GRAVITY * deltaTime;
  playerMesh.position.y += verticalVelocity * deltaTime;
  if (playerMesh.position.y <= GROUND_Y) {
    playerMesh.position.y = GROUND_Y;
    verticalVelocity = 0;
    isOnGround = true;
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

  // -- 상체 회전 및 꽃망울 애니메이션 (카메라 방향 연동) --
  const tiltFactor = (cameraPhi / PHI_MAX) * 1.5;
  if ((characterModel as any).updateFlowerTilt) {
    (characterModel as any).updateFlowerTilt(tiltFactor);
  }

  // 카메라가 바라보는 방향과 캐릭터 몸체 방향 사이의 차이 계산
  const cameraYaw = cameraTheta - Math.PI;
  const bodyYaw = playerMesh.rotation.y;
  let relativeYaw = cameraYaw - bodyYaw;

  // 각도 정규화 (-PI ~ PI)
  while (relativeYaw > Math.PI) relativeYaw -= Math.PI * 2;
  while (relativeYaw < -Math.PI) relativeYaw += Math.PI * 2;

  // 상체 회전 범위를 -90도 ~ 90도로 제한 (허리가 꼬이지 않게)
  const clampedYaw = Math.max(-Math.PI * 0.4, Math.min(Math.PI * 0.4, relativeYaw));
  
  // 부드럽게 보간 (Snap 방지)
  currentUpperYaw = THREE.MathUtils.lerp(currentUpperYaw, clampedYaw, Math.min(UPPER_LERP_SPEED * deltaTime, 1.0));
  
  if ((characterModel as any).setUpperRotation) {
    (characterModel as any).setUpperRotation(currentUpperYaw);
  }

  // 카메라가 플레이어를 부드럽게 주시
  const idealLookAt = playerMesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  smoothLookAtPos.lerp(idealLookAt, Math.min(10 * deltaTime, 1.0));
  camera.lookAt(smoothLookAtPos);
};
