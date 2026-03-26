import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { scene } from '../engine/scene';
import { getGroundHeight } from './world';
import { showChatBubble } from './chatBubble';

// ─── 상수 ──────────────────────────────────────────────
const MODEL_PATH = '/models/Hitem3d-1774513198259.glb';
const FRIENDLY_DIST   = 5;
const ATTACK_DIST     = 10;
const FLEE_DIST       = 30;
const FLEE_RETURN_DIST   = 35;
const ATTACK_RETURN_DIST = 12;

const SPEED_WANDER   = 4;
const SPEED_FLEE     = 14;
const SPEED_ATTACK   = 12;
const SPEED_FRIENDLY = 3;

const WANDER_RADIUS   = 30;   // 목표 선택 반경
const WANDER_WAIT_MIN = 1.5;  // 도착 후 대기 최소 (초)
const WANDER_WAIT_MAX = 3.5;  // 도착 후 대기 최대 (초)
const ARRIVE_DIST     = 1.5;  // 목표 도착 판정 거리
const ORBIT_RADIUS    = 4;    // FRIENDLY 선회 반경
const LERP_SPEED      = 5;    // 부드러운 이동 감쇠 계수

// ─── 타입 ──────────────────────────────────────────────
type ParrotState = 'WANDER' | 'FLEE' | 'ATTACK' | 'FRIENDLY';

interface ParrotInstance {
  mesh: THREE.Group;
  state: ParrotState;
  targetPos: THREE.Vector3;
  wanderTimer: number;   // > 0 이면 대기 중 (이동 안 함)
  isFriendly: boolean;   // true 면 영구 FRIENDLY
  orbitAngle: number;    // FRIENDLY 선회 각도 (rad)
  bubbleShown: boolean;  // FRIENDLY 말풍선 1회 표시 여부
}

// ─── ParrotManager ─────────────────────────────────────
class ParrotManager {
  private parrots: ParrotInstance[] = [];

  async load(): Promise<void> {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        MODEL_PATH,
        (gltf) => {
          // 두 마리 배치 — 맵 중심 근처 랜덤 위치
          const offsets = [
            new THREE.Vector3(10 + Math.random() * 10, 0, 10 + Math.random() * 10),
            new THREE.Vector3(-10 - Math.random() * 10, 0, -10 - Math.random() * 10),
          ];

          for (const offset of offsets) {
            // 실제 GLB 메시 — 스케일과 로컬 방향 보정용
            const model = gltf.scene.clone(true) as THREE.Group;
            // 모델 크기 설정 — 너무 크거나 작으면 이 값을 조정
            model.scale.set(1, 1, 1);
            // 모델 앞 방향 보정 — lookAt()이 뒤를 향하면 Math.PI, 옆을 향하면 Math.PI/2
            model.rotation.y = 0;

            // 피벗 그룹 — 위치/회전 제어용
            const pivot = new THREE.Group();
            pivot.add(model);

            const gx = offset.x;
            const gz = offset.z;
            const gy = getGroundHeight(gx, gz);
            pivot.position.set(gx, gy, gz);
            scene.add(pivot);

            this.parrots.push({
              mesh: pivot,  // pivot을 mesh로 사용
              state: 'WANDER',
              targetPos: new THREE.Vector3(gx, gy, gz),
              wanderTimer: 0,
              isFriendly: false,
              orbitAngle: Math.random() * Math.PI * 2,
              bubbleShown: false,
            });
          }
          resolve();
        },
        undefined,
        (err) => {
          console.error('[Parrot] GLB 로드 실패:', err);
          reject(err);
        }
      );
    });
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    for (const parrot of this.parrots) {
      const dist = parrot.mesh.position.distanceTo(playerPos);

      // ── 상태 전환 ──────────────────────────────────────
      if (!parrot.isFriendly) {
        if (dist < FRIENDLY_DIST) {
          parrot.state = 'FRIENDLY';
          parrot.isFriendly = true;
        } else if (parrot.state === 'WANDER') {
          if (dist < ATTACK_DIST) {
            parrot.state = 'ATTACK';
          } else if (dist < FLEE_DIST) {
            parrot.state = 'FLEE';
          }
        } else if (parrot.state === 'FLEE' && dist > FLEE_RETURN_DIST) {
          parrot.state = 'WANDER';
          this.pickWanderTarget(parrot);
        } else if (parrot.state === 'ATTACK' && dist > ATTACK_RETURN_DIST) {
          parrot.state = 'WANDER';
          this.pickWanderTarget(parrot);
        }
      }

      // ── 상태별 이동 ────────────────────────────────────
      if (parrot.state === 'WANDER') {
        this.updateWander(parrot, dt);
      } else if (parrot.state === 'FLEE') {
        this.updateFlee(parrot, playerPos, dt);
      } else if (parrot.state === 'ATTACK') {
        this.updateAttack(parrot, playerPos, dt);
      } else if (parrot.state === 'FRIENDLY') {
        this.updateFriendly(parrot, playerPos, dt);
      }
    }
  }

  private moveAerial(parrot: ParrotInstance, dir: THREE.Vector3, speed: number, altitudeOffset: number, dt: number): void {
    parrot.mesh.position.x += dir.x * speed * dt;
    parrot.mesh.position.z += dir.z * speed * dt;
    const groundY = getGroundHeight(parrot.mesh.position.x, parrot.mesh.position.z);
    parrot.mesh.position.y += (groundY + altitudeOffset - parrot.mesh.position.y) * LERP_SPEED * dt;
  }

  private pickWanderTarget(parrot: ParrotInstance): void {
    const cx = parrot.mesh.position.x;
    const cz = parrot.mesh.position.z;
    const angle = Math.random() * Math.PI * 2;
    const dist = 5 + Math.random() * WANDER_RADIUS;
    const tx = cx + Math.cos(angle) * dist;
    const tz = cz + Math.sin(angle) * dist;
    const ty = getGroundHeight(tx, tz);
    parrot.targetPos.set(tx, ty, tz);
    parrot.wanderTimer = 0; // 이동 시작
  }

  private updateWander(parrot: ParrotInstance, dt: number): void {
    if (parrot.wanderTimer > 0) {
      // 대기 중
      parrot.wanderTimer -= dt;
      if (parrot.wanderTimer <= 0) {
        this.pickWanderTarget(parrot);
      }
      return;
    }

    const toTarget = parrot.targetPos.clone().sub(parrot.mesh.position);
    const horizDist = Math.sqrt(toTarget.x * toTarget.x + toTarget.z * toTarget.z);

    if (horizDist < ARRIVE_DIST) {
      // 목표 도착 → 대기 타이머 설정
      parrot.wanderTimer = WANDER_WAIT_MIN + Math.random() * (WANDER_WAIT_MAX - WANDER_WAIT_MIN);
      return;
    }

    // 수평 방향으로만 이동 (지면 위 걷기)
    const dir = new THREE.Vector3(toTarget.x, 0, toTarget.z).normalize();
    parrot.mesh.position.x += dir.x * SPEED_WANDER * dt;
    parrot.mesh.position.z += dir.z * SPEED_WANDER * dt;
    // 지면 높이 추적
    parrot.mesh.position.y = getGroundHeight(parrot.mesh.position.x, parrot.mesh.position.z);

    // 진행 방향을 바라봄
    const lookTarget = parrot.mesh.position.clone().add(dir);
    parrot.mesh.lookAt(lookTarget);
  }

  private updateFlee(parrot: ParrotInstance, playerPos: THREE.Vector3, dt: number): void {
    // 플레이어 반대 방향
    const away = new THREE.Vector3().subVectors(parrot.mesh.position, playerPos);
    away.y = 0;
    away.normalize();

    this.moveAerial(parrot, away, SPEED_FLEE, 8, dt);

    // 도망가는 방향 바라봄
    parrot.mesh.lookAt(parrot.mesh.position.clone().add(away));
  }

  private updateAttack(parrot: ParrotInstance, playerPos: THREE.Vector3, dt: number): void {
    // 플레이어 방향으로 돌진
    const toPlayer = new THREE.Vector3().subVectors(playerPos, parrot.mesh.position);
    toPlayer.y = 0;
    toPlayer.normalize();

    this.moveAerial(parrot, toPlayer, SPEED_ATTACK, 4, dt);

    // 플레이어 방향 바라봄
    parrot.mesh.lookAt(playerPos);
  }

  private updateFriendly(parrot: ParrotInstance, playerPos: THREE.Vector3, dt: number): void {
    // 처음 FRIENDLY 진입 시 말풍선 표시
    if (!parrot.bubbleShown) {
      parrot.bubbleShown = true;
      showChatBubble(parrot.mesh, '꽥!');
    }

    // 플레이어 주변 선회 (orbit)
    parrot.orbitAngle = (parrot.orbitAngle + SPEED_FRIENDLY * dt) % (Math.PI * 2);

    const tx = playerPos.x + Math.cos(parrot.orbitAngle) * ORBIT_RADIUS;
    const tz = playerPos.z + Math.sin(parrot.orbitAngle) * ORBIT_RADIUS;
    const groundY = getGroundHeight(tx, tz);
    const ty = groundY + 2;

    // 부드럽게 목표 위치로 이동
    parrot.mesh.position.x += (tx - parrot.mesh.position.x) * LERP_SPEED * dt;
    parrot.mesh.position.y += (ty - parrot.mesh.position.y) * LERP_SPEED * dt;
    parrot.mesh.position.z += (tz - parrot.mesh.position.z) * LERP_SPEED * dt;

    // 플레이어 방향 바라봄
    parrot.mesh.lookAt(playerPos);
  }
}

export const parrotManager = new ParrotManager();
