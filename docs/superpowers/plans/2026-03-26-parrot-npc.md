# Parrot NPC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GLB 앵무새 2마리를 게임 월드에 배치하고, 플레이어 거리 기반 상태 머신(WANDER/FLEE/ATTACK/FRIENDLY)으로 행동하게 만든다.

**Architecture:** `client/src/game/parrot.ts`에 독립 `ParrotManager` 클래스를 구현한다. GLB 1회 로드 후 clone()으로 2개 인스턴스를 만들고, 매 프레임 `update(dt, playerPos)`로 상태를 갱신한다. main.ts에서 맵 로드 완료 후 `load()`를, 게임 루프에서 `update()`를 호출한다.

**Tech Stack:** Three.js 0.183.2, GLTFLoader (three/examples/jsm), TypeScript, Vite

---

## File Map

| 파일 | 변경 | 역할 |
|------|------|------|
| `client/src/game/parrot.ts` | **신규 생성** | ParrotManager, 상태 머신, GLB 로드 |
| `client/src/main.ts` | **수정** | parrotManager.load() + update() 연동 |

---

### Task 1: parrot.ts — 타입, 상수, 뼈대 생성

**Files:**
- Create: `client/src/game/parrot.ts`

- [ ] **Step 1: 파일 생성 — 타입, 상수, 빈 클래스**

`client/src/game/parrot.ts` 를 아래 내용으로 생성한다:

```typescript
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
    // Task 2에서 구현
  }

  update(_dt: number, _playerPos: THREE.Vector3): void {
    // Task 3~4에서 구현
  }

  private pickWanderTarget(parrot: ParrotInstance): void {
    // Task 3에서 구현
  }
}

export const parrotManager = new ParrotManager();
```

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
cd /Users/nagee/git/web3DGame/client && npx tsc --noEmit
```

Expected: 에러 없음 (또는 기존에 있던 에러만)

- [ ] **Step 3: Commit**

```bash
git add client/src/game/parrot.ts
git commit -m "feat: parrot.ts 뼈대 생성 — 타입, 상수 정의"
```

---

### Task 2: GLB 로드 및 두 마리 배치

**Files:**
- Modify: `client/src/game/parrot.ts` — `load()` 구현

- [ ] **Step 1: `load()` 메서드 구현**

`parrot.ts`의 `load()` 를 아래로 교체한다:

```typescript
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
```

- [ ] **Step 2: main.ts에 임시 연동 (로드 확인용)**

`client/src/main.ts` 에서 import 추가 및 `onMapConfig` 콜백 내 `initWorld(config)` 호출 바로 뒤에 아래 추가:

```typescript
// 상단 import 추가
import { parrotManager } from './game/parrot';

// onMapConfig 콜백 내, initWorld(config); 바로 뒤에 추가
parrotManager.load().catch((e) => console.error('[Parrot] load error:', e));
```

- [ ] **Step 3: 브라우저에서 확인**

```bash
cd /Users/nagee/git/web3DGame/client && npm run dev
```

브라우저에서 게임 실행 후 맵 입장 → 앵무새 2마리가 씬에 나타나는지 확인.
나타나지 않으면 콘솔에서 에러 확인.

> 모델 크기가 너무 크거나 작으면 `mesh.scale.set()` 값을 조정한다. 보통 GLB는 실제 크기에 맞게 export되므로 `0.01` ~ `2.0` 범위에서 시작.

- [ ] **Step 4: Commit**

```bash
git add client/src/game/parrot.ts client/src/main.ts
git commit -m "feat: GLB 앵무새 로드 및 씬 배치"
```

---

### Task 3: WANDER 상태 구현

**Files:**
- Modify: `client/src/game/parrot.ts` — `pickWanderTarget()`, `update()` WANDER 로직

- [ ] **Step 1: `pickWanderTarget()` 구현**

`parrot.ts`의 `pickWanderTarget()` 를 아래로 교체한다:

```typescript
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
```

- [ ] **Step 2: `update()` 에 WANDER 이동 로직 추가**

`parrot.ts`의 `update()` 를 아래로 교체한다:

```typescript
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
```

- [ ] **Step 3: main.ts 게임 루프에 update() 추가**

`client/src/main.ts`의 `animate()` 함수 내 `monsterManager.animate(...)` 바로 뒤에 추가:

```typescript
parrotManager.update(deltaTime, playerMesh.position);
```

- [ ] **Step 4: 브라우저 확인**

게임 실행 후 앵무새가 랜덤하게 이동하다 멈추고, 다시 방향을 바꾸는지 확인.

- [ ] **Step 5: Commit**

```bash
git add client/src/game/parrot.ts client/src/main.ts
git commit -m "feat: 앵무새 WANDER 상태 구현"
```

---

### Task 4: FLEE, ATTACK, FRIENDLY 상태 구현

**Files:**
- Modify: `client/src/game/parrot.ts` — `updateFlee`, `updateAttack`, `updateFriendly`

- [ ] **Step 1: `updateFlee()` 구현**

`parrot.ts`의 `updateFlee()` 를 아래로 교체한다:

```typescript
private updateFlee(parrot: ParrotInstance, playerPos: THREE.Vector3, dt: number): void {
  // 플레이어 반대 방향
  const away = parrot.mesh.position.clone().sub(playerPos);
  away.y = 0;
  away.normalize();

  parrot.mesh.position.x += away.x * SPEED_FLEE * dt;
  parrot.mesh.position.z += away.z * SPEED_FLEE * dt;

  // 공중으로 올라감 (목표 높이: 지면 + 8)
  const groundY = getGroundHeight(parrot.mesh.position.x, parrot.mesh.position.z);
  const targetY = groundY + 8;
  parrot.mesh.position.y += (targetY - parrot.mesh.position.y) * 5 * dt;

  // 도망가는 방향 바라봄
  const lookTarget = parrot.mesh.position.clone().add(away);
  parrot.mesh.lookAt(lookTarget);
}
```

- [ ] **Step 2: `updateAttack()` 구현**

`parrot.ts`의 `updateAttack()` 를 아래로 교체한다:

```typescript
private updateAttack(parrot: ParrotInstance, playerPos: THREE.Vector3, dt: number): void {
  // 플레이어 방향으로 돌진
  const toPlayer = playerPos.clone().sub(parrot.mesh.position);
  toPlayer.y = 0;
  toPlayer.normalize();

  parrot.mesh.position.x += toPlayer.x * SPEED_ATTACK * dt;
  parrot.mesh.position.z += toPlayer.z * SPEED_ATTACK * dt;

  // 공중 (지면 + 4)
  const groundY = getGroundHeight(parrot.mesh.position.x, parrot.mesh.position.z);
  const targetY = groundY + 4;
  parrot.mesh.position.y += (targetY - parrot.mesh.position.y) * 5 * dt;

  // 플레이어 방향 바라봄
  parrot.mesh.lookAt(playerPos);
}
```

- [ ] **Step 3: `updateFriendly()` 구현**

`parrot.ts`의 `updateFriendly()` 를 아래로 교체한다:

```typescript
private updateFriendly(parrot: ParrotInstance, playerPos: THREE.Vector3, dt: number): void {
  // 처음 FRIENDLY 진입 시 말풍선 표시
  if (!parrot.bubbleShown) {
    parrot.bubbleShown = true;
    showChatBubble(parrot.mesh, '꽥!');
  }

  // 플레이어 주변 선회 (orbit)
  parrot.orbitAngle += SPEED_FRIENDLY * dt;

  const tx = playerPos.x + Math.cos(parrot.orbitAngle) * ORBIT_RADIUS;
  const tz = playerPos.z + Math.sin(parrot.orbitAngle) * ORBIT_RADIUS;
  const groundY = getGroundHeight(tx, tz);
  const ty = groundY + 2;

  // 부드럽게 목표 위치로 이동
  parrot.mesh.position.x += (tx - parrot.mesh.position.x) * 5 * dt;
  parrot.mesh.position.y += (ty - parrot.mesh.position.y) * 5 * dt;
  parrot.mesh.position.z += (tz - parrot.mesh.position.z) * 5 * dt;

  // 플레이어 방향 바라봄
  parrot.mesh.lookAt(playerPos);
}
```

- [ ] **Step 4: 브라우저 확인 — 각 상태 테스트**

게임 실행 후:
1. 플레이어를 앵무새 방향으로 이동 → **FLEE**: 반대 방향으로 날아서 도망 확인
2. 플레이어를 더 가까이 빠르게 접근 → **ATTACK**: 플레이어 쪽으로 돌진 확인
3. 플레이어가 앵무새 바로 옆 (5u 이내) → **FRIENDLY**: 말풍선 "꽥!" + 선회 확인
4. FRIENDLY 상태에서 플레이어가 멀리 이동 → 앵무새가 계속 따라오는지 확인

- [ ] **Step 5: Commit**

```bash
git add client/src/game/parrot.ts
git commit -m "feat: 앵무새 FLEE/ATTACK/FRIENDLY 상태 구현"
```

---

### Task 5: 스케일 및 방향 보정

> GLB 모델은 export 기준에 따라 크기와 앞뒤 방향이 다를 수 있다. Task 2에서 브라우저 확인 시 이미 보정했다면 스킵해도 된다.

**Files:**
- Modify: `client/src/game/parrot.ts` — `load()` 내 scale/rotation 보정

- [ ] **Step 1: 모델 크기 확인 및 보정**

게임에서 캐릭터 높이(약 2~3 유닛)와 비교해 앵무새 크기가 적절한지 확인.
너무 크면 `load()` 내 `mesh.scale.set()` 값을 줄인다:

```typescript
// 예시: 너무 크면 0.3~0.5로 조정
mesh.scale.set(0.5, 0.5, 0.5);
```

- [ ] **Step 2: 앞 방향 보정 (필요 시)**

`lookAt()` 호출 시 앵무새가 뒤를 향하거나 옆을 향하면 모델 기본 회전이 맞지 않는 것이다.
`load()` 내 `mesh` 를 별도 피벗 그룹으로 감싼다:

```typescript
// 기존: scene.add(mesh) 대신
const pivot = new THREE.Group();
pivot.add(mesh);
mesh.rotation.y = Math.PI; // 180도 보정 (뒤를 향하는 경우)
scene.add(pivot);

// this.parrots.push 에서도 mesh → pivot 으로 교체
this.parrots.push({
  mesh: pivot,  // ← pivot을 mesh로 사용
  ...
});
```

- [ ] **Step 3: Commit (보정이 있었을 경우만)**

```bash
git add client/src/game/parrot.ts
git commit -m "fix: 앵무새 모델 스케일/방향 보정"
```

---

## 검증 체크리스트

- [ ] 앵무새 2마리가 맵 입장 시 씬에 나타남
- [ ] WANDER: 랜덤 방향으로 걷다가 멈추고 다시 이동
- [ ] FLEE: 플레이어가 30u 이내 접근 시 반대 방향 날아서 도망, 35u 이상이면 WANDER 복귀
- [ ] ATTACK: 플레이어가 10u 이내 접근 시 돌진, 12u 이상이면 WANDER 복귀
- [ ] FRIENDLY: 플레이어 5u 이내 시 말풍선 "꽥!" + 선회, 멀리 가도 따라다님
- [ ] FRIENDLY 진입 후 다른 상태로 전환되지 않음
- [ ] 말풍선은 FRIENDLY 진입 시 1회만 표시
