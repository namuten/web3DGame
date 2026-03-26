# Parrot NPC Design Spec
_Date: 2026-03-26_

## Overview

GLB 앵무새 모델 2마리를 게임 월드에 배치하여, 플레이어와의 거리에 따라 행동이 바뀌는 ambient NPC를 구현한다.

---

## Asset

- **파일**: `client/public/models/Hitem3d-1774513198259.glb`
- **인스턴스**: GLB 1회 로드 → `clone()`으로 2개 생성
- **초기 위치**: 맵 로드 시 랜덤한 두 지점에 배치

---

## State Machine

각 앵무새는 독립적으로 상태를 가진다.

```
WANDER ──(플레이어 10~30u 진입)──→ FLEE
FLEE   ──(플레이어 35u 이상)────→ WANDER
WANDER ──(플레이어 5~10u 진입)──→ ATTACK
ATTACK ──(플레이어 10u 이상)────→ WANDER
임의 상태 ──(플레이어 5u 미만)──→ FRIENDLY (영구)
```

### 상태별 행동

| 상태 | 이동 방식 | 높이 | 속도 | 부가 효과 |
|------|-----------|------|------|-----------|
| WANDER | 랜덤 목표 지점으로 이동, 도착 후 일정 시간 대기 후 재선택 | 지면 (getGroundHeight) | 느림 (4u/s) | — |
| FLEE | 플레이어 반대 방향으로 이동 | 공중 상승 (y+8) | 빠름 (14u/s) | — |
| ATTACK | 플레이어 방향으로 돌진 | 공중 (y+4) | 빠름 (12u/s) | — |
| FRIENDLY | 플레이어 주변 선회 (orbit) | 낮게 (y+2) | 느림 (3u/s) | 말풍선 "꽥!" 표시, 이후 영구 유지 |

### FRIENDLY 전환 규칙

- 어떤 상태에서든 플레이어와 5u 미만이 되면 FRIENDLY로 전환
- FRIENDLY 진입 시 한 번만 말풍선 표시
- 이후 플레이어가 멀리 가도 따라다니며 FRIENDLY 유지 (게임 종료까지)

---

## 파일 구조

```
client/src/game/parrot.ts   ← 신규 생성 (ParrotManager, Parrot 클래스)
client/src/main.ts          ← parrotManager.load(), update() 연동
```

---

## `parrot.ts` 설계

### 타입

```typescript
type ParrotState = 'WANDER' | 'FLEE' | 'ATTACK' | 'FRIENDLY';

interface ParrotInstance {
  mesh: THREE.Group;
  state: ParrotState;
  targetPos: THREE.Vector3;
  wanderTimer: number;    // WANDER 중 다음 목표 선택까지 남은 시간
  isFriendly: boolean;    // 한번 true가 되면 영구
}
```

### ParrotManager

```typescript
class ParrotManager {
  private parrots: ParrotInstance[] = [];

  async load(): Promise<void>
  // GLTFLoader로 GLB 로드 → clone() × 2 → scene에 추가 → 초기 위치 설정

  update(dt: number, playerPos: THREE.Vector3): void
  // 각 parrot에 대해:
  //   1. 거리 계산
  //   2. 상태 전환 판단 (isFriendly면 스킵)
  //   3. 상태별 이동 처리
  //   4. 지면/공중 높이 보정

  private pickWanderTarget(parrot: ParrotInstance): void
  // 현재 위치 기준 반경 30u 내 랜덤 지점 선택

  private showFriendlyBubble(parrot: ParrotInstance): void
  // 기존 chatBubble.ts의 showChatBubble 활용
}

export const parrotManager = new ParrotManager();
```

---

## main.ts 연동

```typescript
// 맵 로드 완료 후
await parrotManager.load();

// 게임 루프 animate()
parrotManager.update(deltaTime, playerMesh.position);
```

---

## 거리 임계값 (추후 조정 예정)

| 변수 | 값 | 설명 |
|------|----|------|
| FRIENDLY_DIST | 5 | 영구 친밀 전환 |
| ATTACK_DIST | 10 | 공격 전환 |
| FLEE_DIST | 30 | 도망 전환 |
| FLEE_RETURN_DIST | 35 | WANDER 복귀 |
| ATTACK_RETURN_DIST | 12 | WANDER 복귀 (진입값 10과 겹침 방지) |

---

## 의존성

- `three/examples/jsm/loaders/GLTFLoader` — GLB 로드
- `client/src/game/world.ts` → `getGroundHeight()` — 지면 높이
- `client/src/game/chatBubble.ts` → `showChatBubble()` — 말풍선
- `client/src/engine/scene.ts` → `scene` — 씬에 추가
