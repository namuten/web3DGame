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
            const mesh = gltf.scene.clone(true) as THREE.Group;
            mesh.scale.set(1, 1, 1); // 크기는 게임에서 확인 후 조정
            const gx = offset.x;
            const gz = offset.z;
            const gy = getGroundHeight(gx, gz);
            mesh.position.set(gx, gy, gz);
            scene.add(mesh);

            this.parrots.push({
              mesh,
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

  private updateFlee(_parrot: ParrotInstance, _playerPos: THREE.Vector3, _dt: number): void {
    // Task 4에서 구현
  }

  private updateAttack(_parrot: ParrotInstance, _playerPos: THREE.Vector3, _dt: number): void {
    // Task 4에서 구현
  }

  private updateFriendly(_parrot: ParrotInstance, _playerPos: THREE.Vector3, _dt: number): void {
    // Task 4에서 구현
  }
}

export const parrotManager = new ParrotManager();
