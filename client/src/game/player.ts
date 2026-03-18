import * as THREE from 'three';
import { scene } from '../engine/scene';
import { camera } from '../engine/camera';

// ─── 플레이어 메시 ────────────────────────────────────────────
const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 16);
const material = new THREE.MeshStandardMaterial({ 
  color: 0x4cc9f0,
  roughness: 0.2,
  metalness: 0.8 
});
export const playerMesh = new THREE.Group();
const body = new THREE.Mesh(geometry, material);
body.position.y = 1;
body.castShadow = true;
body.receiveShadow = true;
playerMesh.add(body);

// 바이저 (방향 표시)
const visorGeo = new THREE.BoxGeometry(0.7, 0.3, 0.3);
const visorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.9 });
const visor = new THREE.Mesh(visorGeo, visorMat);
visor.position.set(0, 1.4, -0.45);
playerMesh.add(visor);

// ─── 키보드 상태 ───────────────────────────────────────────────
const keys = {
  w: false, a: false, s: false, d: false,
  space: false,
  arrowLeft: false, arrowRight: false,
  arrowUp: false, arrowDown: false,
};

// ─── 궤도 카메라 (Spherical Orbit) 파라미터 ───────────────────
let cameraTheta = Math.PI;    // 수평 각도 (플레이어 뒤쪽에서 시작)
let cameraPhi = Math.PI / 5;  // 수직 각도 (앙각, 약 36도)
const CAMERA_DIST = 14;       // 플레이어로부터의 거리
const THETA_SPEED = 1.8;      // 좌우 회전 속도 (rad/s)
const PHI_SPEED = 1.2;        // 상하 회전 속도 (rad/s)
const PHI_MIN = 0.1;          // 최소 앙각 (거의 수평)
const PHI_MAX = Math.PI / 2.2; // 최대 앙각 (거의 수직)

// 카메라 보간 변수
const currentCameraPos = new THREE.Vector3(0, 8, 14);
const smoothLookAtPos = new THREE.Vector3(0, 1.5, 0);

// ─── 점프 & 중력 ──────────────────────────────────────────────
const GRAVITY = -25;
const JUMP_FORCE = 12;
const GROUND_Y = 0;
let verticalVelocity = 0;
let isOnGround = true;

// ─── 이동 속도 ────────────────────────────────────────────────
const speed = 12;
const playerVelocity = new THREE.Vector3();
const targetRotation = new THREE.Quaternion();

// ─── 초기화 ───────────────────────────────────────────────────
export const initPlayer = () => {
  scene.add(playerMesh);

  // 조작 안내 HUD
  const hint = document.createElement('div');
  hint.style.cssText = `
    position: absolute; top: 20px; right: 20px;
    color: #00f0ff; font-family: monospace; font-size: 12px;
    background: rgba(0,20,40,0.6); padding: 10px 14px;
    border-radius: 5px; border: 1px solid #00f0ff;
    pointer-events: none; line-height: 1.8;
  `;
  hint.innerHTML = `
    <b style="color:#fff">CONTROLS</b><br>
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
  // -- 카메라 각도 업데이트 (방향키) --
  if (keys.arrowLeft)  cameraTheta -= THETA_SPEED * deltaTime;
  if (keys.arrowRight) cameraTheta += THETA_SPEED * deltaTime;
  if (keys.arrowUp)    cameraPhi   = Math.max(PHI_MIN, cameraPhi - PHI_SPEED * deltaTime);
  if (keys.arrowDown)  cameraPhi   = Math.min(PHI_MAX, cameraPhi + PHI_SPEED * deltaTime);

  // -- 카메라의 현재 수평 방향 벡터 계산 (이동 기준) --
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

  if (playerVelocity.lengthSq() > 0) {
    playerVelocity.normalize();

    // 이동 방향으로 캐릭터 자연스럽게 회전 (Slerp)
    const angle = Math.atan2(playerVelocity.x, playerVelocity.z);
    targetRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    playerMesh.quaternion.slerp(targetRotation, Math.min(10 * deltaTime, 1.0));

    playerMesh.position.add(playerVelocity.multiplyScalar(speed * deltaTime));
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

  // 카메라가 플레이어를 부드럽게 주시
  const idealLookAt = playerMesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  smoothLookAtPos.lerp(idealLookAt, Math.min(10 * deltaTime, 1.0));
  camera.lookAt(smoothLookAtPos);
};
