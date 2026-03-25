# 몬스터 내부 글자 - 로또 공 물리 디자인

**날짜:** 2026-03-25
**파일:** `client/src/game/monster.ts` 단독 변경

---

## 목표

몬스터 내부 글자들이 로또 기계 공처럼 역동적으로 움직이되, 플레이어가 글자를 읽을 수 있어야 한다. 글자 파악이 미션의 핵심이므로 **가독성과 역동성을 동시에** 만족해야 한다.

---

## 두 가지 상태

### 1. 정지 상태 (몬스터 속도 < 2.0)

- 글자 Group이 카메라를 향해 빌보딩 (`mesh.quaternion.slerp(targetQ, 0.1)` 매 프레임)
- 위치 바운스는 유지 (공처럼 튀는 느낌)
- `rotVel.multiplyScalar(0.85)` — 기존 0.92 대신 정지 상태에서만 이 값 사용 (더 빠르게 회전 멈춤)
- 플레이어가 글자를 읽을 수 있음

### 2. 이동 상태 (몬스터 속도 ≥ 2.0)

- 관성력이 글자를 사방으로 흔듦
- `rotVel.multiplyScalar(0.92)` — 기존 값 유지
- 매 프레임 노이즈 킥: 각 글자에 `randomUnitVector × 15` 힘 주입 (force magnitude)
- 에너지 하한선: 매 프레임 `vel.length() < 3.0`이면 `randomUnitVector × 5` 추가
- 읽기 어렵고 역동적

---

## 상태 전환

- **이동 판단:** `worldVel.length() > 2.0` → 이동 상태 즉시 전환
- **정지 전환 지연:** 이동 → 정지 전환 시 `stopTimer`로 정확히 0.5초 지연
- **`MonsterManager`에 추가할 필드 (구현의 일부):**
  ```
  private isMoving: boolean = false;
  private stopTimer: number = 0;
  ```

---

## 물리 파라미터 — 모두 동시에 변경

| 항목 | 현재 값 | 변경 값 |
|------|---------|---------|
| 중력 Y | `-60` | `-8` |
| 댐핑 배율 | `-2.5` | `-0.6` |
| 반발계수 (벽/글자 충돌) | `0.5` | `0.82` |
| 센터링 포스 | `40` | `5` |
| 관성 배율 | `1.2` | `2.5` |

---

## animate() 시그니처 변경

카메라 참조가 필요하므로 파라미터 추가:

```ts
// 변경 전
animate(time: number, deltaTime: number = 0.016)

// 변경 후
animate(time: number, deltaTime: number = 0.016, camera?: THREE.Camera)
```

- `camera`가 있고 정지 상태일 때만 빌보딩 적용
- 호출부(main.ts 등)에서 camera 인스턴스를 전달해야 함

---

## 빌보딩 상세

글자 mesh는 20장 레이어가 쌓인 `THREE.Group`. `Group.quaternion.slerp()`를 사용하면 모든 레이어가 함께 회전하므로 시각적 아티팩트 없음.

```
정지 상태 + camera 존재 시:
  // mesh 월드 좌표 기준, 카메라 방향으로 lookAt
  const worldPos = new THREE.Vector3()
  char.mesh.getWorldPosition(worldPos)
  const dir = camera.position.clone().sub(worldPos)  // mesh → camera 방향
  const dummy = new THREE.Object3D()
  dummy.lookAt(dir)
  char.mesh.quaternion.slerp(dummy.quaternion, 0.1)  // 매 프레임 10% 보간

// camera가 undefined인 경우: 빌보딩 스킵, 기존 rotVel 댐핑만 적용
```

## 이동/정지 상태별 물리 적용 범위

| 물리 요소 | 정지 상태 | 이동 상태 |
|-----------|-----------|-----------|
| 중력 | O | O |
| 관성력 (inertia) | X (적용 안 함) | O |
| 노이즈 킥 | X | O |
| 에너지 하한선 | X | O |
| 센터링 포스 | O | O |
| 댐핑 | O | O |
| 빌보딩 | O | X |
| rotVel 댐핑 | 0.85 (빠른 감속) | 0.92 (기존) |

## 랜덤 벡터 구현 방식

노이즈 킥은 true unit vector가 아닌 `(Math.random()-0.5)×magnitude` 방식 사용 — 기존 코드 패턴과 일관성 유지:

```
// 노이즈 킥 (이동 상태)
vel.add(new THREE.Vector3(
  (Math.random()-0.5) * 15,
  (Math.random()-0.5) * 15,
  (Math.random()-0.5) * 15
))

// 에너지 하한선 (이동 상태, vel.length() < 3.0 시)
vel.add(new THREE.Vector3(
  (Math.random()-0.5) * 5,
  (Math.random()-0.5) * 5,
  (Math.random()-0.5) * 5
))
```

---

## 범위 제한

- 변경 파일: `client/src/game/monster.ts` 단독
- `animate()` 호출부에서 camera 파라미터 전달 필요 (최소 변경)
- 새 파일 생성 없음
