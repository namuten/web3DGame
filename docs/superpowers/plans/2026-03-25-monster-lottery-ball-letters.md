# 몬스터 내부 글자 로또 공 물리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 몬스터 내부 글자들이 정지 시엔 카메라를 바라보며 가독성을 유지하고, 이동 시엔 로또 공처럼 역동적으로 튕겨다니게 만든다.

**Architecture:** `monster.ts`의 `MonsterManager`에 이동/정지 상태 머신을 추가하고, 상태에 따라 물리 파라미터와 빌보딩을 분기 적용한다. `animate()`에 `camera` 파라미터를 추가하고, 호출부 `main.ts`에서 전달한다.

**Tech Stack:** Three.js (THREE.Camera, THREE.Quaternion, THREE.Vector3), TypeScript

**Spec:** `docs/superpowers/specs/2026-03-25-monster-lottery-ball-letters-design.md`

---

## 파일 변경 범위

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `client/src/game/monster.ts` | Modify | 물리 파라미터 변경, 상태 머신 추가, 빌보딩 추가, animate() 시그니처 변경 |
| `client/src/main.ts` | Modify (line 64) | animate() 호출에 camera 파라미터 추가 |

새 파일 없음. 기존 파일 2개만 변경.

---

## Task 1: 물리 파라미터 업데이트

**Files:**
- Modify: `client/src/game/monster.ts` (animate 메서드 내 물리 상수들)

이 작업은 Three.js 게임이라 자동 테스트가 없다. 각 단계마다 브라우저에서 시각적으로 확인한다.

- [ ] **Step 1: 현재 물리 상수 위치 파악**

`monster.ts`의 `animate()` 메서드에서 다음 값들을 찾는다:
```
gravityForce = new THREE.Vector3(0, -60, 0)
dampingForce = char.vel.clone().multiplyScalar(-2.5)
centeringForceMag = 40
inertiaForce = worldAccel.multiplyScalar(-1.2)
restitution = 0.5 (두 곳: 벽 충돌, 글자간 충돌)
```

- [ ] **Step 2: 파라미터 변경**

`client/src/game/monster.ts`의 animate 메서드에서:

```ts
// 변경 전
const gravityForce = new THREE.Vector3(0, -60, 0);
const centeringForceMag = 40;
// ...
const dampingForce = char.vel.clone().multiplyScalar(-2.5);
// ...
const inertiaForce = worldAccel.multiplyScalar(-1.2);
// ...
const restitution = 0.5; // 벽 충돌
// ...
const restitution = 0.5; // 글자간 충돌

// 변경 후
const gravityForce = new THREE.Vector3(0, -8, 0);
const centeringForceMag = 5;
// ...
const dampingForce = char.vel.clone().multiplyScalar(-0.6);
// ...
const inertiaForce = worldAccel.multiplyScalar(-2.5);
// ...
const restitution = 0.82; // 벽 충돌
// ...
const restitution = 0.82; // 글자간 충돌
```

- [ ] **Step 3: 브라우저에서 시각 확인**

`cd client && npm run dev` 후 브라우저 열고 몬스터 생성 확인.
글자들이 이전보다 더 활발하게 튀고 오래 움직이면 성공.

- [ ] **Step 4: 커밋**

```bash
git add client/src/game/monster.ts
git commit -m "feat: tune physics params for lottery-ball feel"
```

---

## Task 2: 상태 머신 추가 (이동/정지 감지)

**Files:**
- Modify: `client/src/game/monster.ts` — `MonsterManager` 클래스에 필드 및 상태 로직 추가

- [ ] **Step 1: MonsterManager 클래스에 필드 추가**

`client/src/game/monster.ts`의 `MonsterManager` 클래스 상단 필드 선언부에 추가:

```ts
private isMoving: boolean = false;
private stopTimer: number = 0;
private readonly MOVE_THRESHOLD = 2.0;   // 이 속도 이상이면 이동 상태
private readonly STOP_DELAY = 0.5;       // 정지 전환 지연 (초)
```

- [ ] **Step 2: animate() 메서드에 상태 업데이트 로직 추가**

`animate()` 메서드에서 `worldVel`을 계산하는 부분 바로 아래에 삽입:

```ts
// 이동/정지 상태 업데이트
const speed = worldVel.length();
if (speed > this.MOVE_THRESHOLD) {
    this.isMoving = true;
    this.stopTimer = this.STOP_DELAY; // 타이머 리셋
} else {
    if (this.stopTimer > 0) {
        this.stopTimer -= deltaTime;
    } else {
        this.isMoving = false;
    }
}
```

- [ ] **Step 3: spawn()에서 상태 필드 초기화 확인**

`spawn()` 메서드 끝부분에 추가:

```ts
this.isMoving = false;
this.stopTimer = 0;
```

- [ ] **Step 4: 브라우저 console.log로 상태 확인**

임시로 animate() 안에 추가해 상태 전환이 잘 되는지 확인:
```ts
// 임시 디버그 (확인 후 제거)
if (this.isMoving !== prevIsMoving) {
    console.log('[Monster] State:', this.isMoving ? 'MOVING' : 'STOPPED');
}
```
몬스터가 움직일 때 "MOVING", 멈출 때 0.5초 후 "STOPPED" 로그가 찍히면 성공.
확인 후 console.log 제거.

- [ ] **Step 5: 커밋**

```bash
git add client/src/game/monster.ts
git commit -m "feat: add moving/stopped state machine to monster"
```

---

## Task 3: 상태별 물리 분기

**Files:**
- Modify: `client/src/game/monster.ts` — animate() 내 innerChars 루프

- [ ] **Step 1: 이동 상태에서만 inertia 적용**

현재 코드에서 `totalForce` 계산 부분을 수정:

```ts
// 변경 전
const totalForce = new THREE.Vector3()
    .add(inertiaForce)
    .add(gravityForce)
    .add(dampingForce)
    .add(centeringForce);

// 변경 후
const totalForce = new THREE.Vector3()
    .add(gravityForce)
    .add(dampingForce)
    .add(centeringForce);

if (this.isMoving) {
    totalForce.add(inertiaForce);
}
```

- [ ] **Step 2: 이동 상태에서만 노이즈 킥 + 에너지 하한선 추가**

`char.vel.add(totalForce.multiplyScalar(deltaTime));` 바로 아래에 추가:

```ts
if (this.isMoving) {
    // 노이즈 킥: 공기가 계속 불어주는 느낌
    char.vel.add(new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
    ).multiplyScalar(deltaTime));

    // 에너지 하한선: 절대 멈추지 않음
    if (char.vel.length() < 3.0) {
        char.vel.add(new THREE.Vector3(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5
        ));
    }
}
```

- [ ] **Step 3: rotVel 댐핑을 상태별로 분기**

현재 코드 `char.rotVel.multiplyScalar(0.92);` 를 수정:

```ts
// 변경 전
char.rotVel.multiplyScalar(0.92);

// 변경 후
char.rotVel.multiplyScalar(this.isMoving ? 0.92 : 0.85);
```

- [ ] **Step 4: 시각 확인**

브라우저에서:
- 몬스터 정지 시: 글자들이 서서히 안정됨 (덜 빙글빙글)
- 몬스터 이동 시: 글자들이 로또 공처럼 사방팔방 튕기며 계속 움직임

- [ ] **Step 5: 커밋**

```bash
git add client/src/game/monster.ts
git commit -m "feat: apply state-based physics split for moving/stopped"
```

---

## Task 4: 빌보딩 추가 (정지 상태에서 카메라 바라보기)

**Files:**
- Modify: `client/src/game/monster.ts` — animate() 시그니처 + 빌보딩 로직
- Modify: `client/src/main.ts` — animate() 호출부

- [ ] **Step 1: animate() 시그니처에 camera 파라미터 추가**

```ts
// 변경 전
animate(time: number, deltaTime: number = 0.016) {

// 변경 후
animate(time: number, deltaTime: number = 0.016, camera?: THREE.Camera) {
```

- [ ] **Step 2: 빌보딩 로직 추가**

innerChars 루프에서 `char.mesh.rotation.copy(char.rot);` 부분을 수정:

```ts
// 변경 전
char.rot.x += char.rotVel.x * deltaTime;
char.rot.y += char.rotVel.y * deltaTime;
char.rot.z += char.rotVel.z * deltaTime;
char.mesh.rotation.copy(char.rot);

// 변경 후
if (!this.isMoving && camera) {
    // 정지 상태: 카메라를 향해 서서히 회전 (billboarding)
    const worldPos = new THREE.Vector3();
    char.mesh.getWorldPosition(worldPos);
    const dir = camera.position.clone().sub(worldPos);

    const dummy = new THREE.Object3D();
    dummy.lookAt(dir);
    char.mesh.quaternion.slerp(dummy.quaternion, 0.1);
    // char.rot을 현재 quaternion과 동기화해 상태 전환 시 튀지 않게
    char.rot.setFromQuaternion(char.mesh.quaternion);
} else {
    // 이동 상태: 자유 회전
    char.rot.x += char.rotVel.x * deltaTime;
    char.rot.y += char.rotVel.y * deltaTime;
    char.rot.z += char.rotVel.z * deltaTime;
    char.mesh.rotation.copy(char.rot);
}
```

- [ ] **Step 3: main.ts 호출부 업데이트**

`client/src/main.ts` line 64:

```ts
// 변경 전
monsterManager.animate(time, deltaTime);

// 변경 후
monsterManager.animate(time, deltaTime, camera);
```

`camera`는 이미 line 5에서 import되어 있으므로 추가 import 불필요.

- [ ] **Step 4: 시각 확인**

브라우저에서:
- 몬스터 정지 시: 글자들이 서서히 카메라를 향해 정면으로 돌아와 읽힘
- 몬스터 이동 시: 글자들이 빙글빙글 돌며 읽기 어려움
- 이동 → 정지 전환 시: 0.5초 지연 후 글자가 서서히 정면으로 복귀

- [ ] **Step 5: 커밋**

```bash
git add client/src/game/monster.ts client/src/main.ts
git commit -m "feat: add camera billboarding for stopped state letter readability"
```

---

## 최종 확인

- [ ] 몬스터 정지 상태에서 글자를 읽을 수 있는가?
- [ ] 몬스터 이동 시 글자가 로또 공처럼 활발하게 움직이는가?
- [ ] 이동 → 정지 전환이 부드럽게 되는가? (튀거나 깜빡이지 않는가?)
- [ ] TypeScript 컴파일 오류 없는가? (`npm run build`)
