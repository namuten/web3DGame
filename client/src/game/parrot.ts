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

  update(_dt: number, _playerPos: THREE.Vector3): void {
    // Task 3~4에서 구현
  }

  private pickWanderTarget(parrot: ParrotInstance): void {
    // Task 3에서 구현
  }
}

export const parrotManager = new ParrotManager();
