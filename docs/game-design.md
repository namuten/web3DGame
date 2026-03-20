# 게임 디자인 문서 — 전투 & 게임 루프

> 이 문서는 web3DGame의 게임 메카닉, 전투 수치, 물리 스펙을 정의합니다.
> 주요 구현 파일: `client/src/game/player.ts`, `client/src/game/bullets.ts`, `server/src/index.ts`

---

## 1. 게임 개요

| 항목 | 내용 |
|---|---|
| 장르 | 3인칭 멀티플레이어 TPS (Third-Person Shooter) |
| 플레이어 수 | 제한 없음 (단일 Lobby 룸) |
| 승리 조건 | 현재 없음 (자유 전투 데스매치) |
| 시점 | 3인칭 오비탈 카메라 |

---

## 2. 플레이어 물리 스펙

### 이동

| 항목 | 값 | 파일:변수 |
|---|---|---|
| 이동 속도 | 12 유닛/초 | `player.ts: speed` |
| 이동 방식 | 카메라 수평 기준 상대적 이동 | - |
| S키 동작 | 뒷걸음질 (몸 방향 고정) | - |
| 충돌 처리 | AABB 슬라이딩 (X축/Z축 분리) | `player.ts: checkCollision` |

### 점프 & 중력

| 항목 | 값 | 파일:변수 |
|---|---|---|
| 중력 | -25 유닛/초² | `player.ts: GRAVITY` |
| 점프 초속 | 12 유닛/초 | `player.ts: JUMP_FORCE` |
| 바닥 Y | 0 | `player.ts: GROUND_Y` |
| 장애물 착지 | 장애물 최상단에서 착지 가능 | - |
| 머리 충돌 | 점프 중 장애물 하단에 머리 충돌 시 속도 0 | - |

### 충돌 판정 (플레이어 바운딩 박스)

```
중심: position + (0, 1.25, 0)
크기: 0.75 × 1.5 × 0.75 유닛
```

---

## 3. 카메라 시스템

| 항목 | 값 |
|---|---|
| 타입 | 오비탈 (Spherical Orbit) |
| 거리 | 14 유닛 |
| 수직 범위 | φ: 0.1 ~ π/2.2 (약 5° ~ 81°) |
| 회전 가속도 | 5.0 |
| 회전 마찰력 | 0.92 (자연 감속) |
| 카메라 보간 | lerp 계수 7 × deltaTime |
| LookAt 보간 | lerp 계수 10 × deltaTime |

**조작 키:**
- `←→` : 수평 회전 (theta)
- `↑↓` : 수직 각도 (phi)

---

## 4. 전투 시스템

### 4-1. 탄환 (Bullet)

| 항목 | 값 | 파일:변수 |
|---|---|---|
| 속도 | 20 유닛/초 | `bullets.ts: BULLET_SPEED` |
| 수명 | 2.5초 | `bullets.ts: BULLET_LIFETIME` |
| 크기 | 반지름 0.5 (구체) | - |
| 동시 발사 수 | 1발 (로컬 플레이어) | `fireBullet()` |
| 발사 키 | F키 / 마우스 좌클릭 | `initBulletInput()` |
| 발사 기점 | 꽃 위치 (y=2.4) + 앙각 보정 | - |
| 컬러 | 발사자 플레이어 컬러와 동일 | - |
| 광원 | PointLight (강도 5, 범위 6) | - |

**발사 방향 계산:**
```
verticalAngle = (cameraPhi / PHI_MAX) - 1.1  // 아래 조준값
dir = (0, verticalAngle, 1) → 플레이어 quaternion 적용 → normalize
```

### 4-2. 충돌 판정

**1차: Raycast**
- 이동 벡터 방향으로 레이캐스트
- 범위: moveStep.length + 1.2 (여유 범위)
- 대상: 월드 장애물 + 다른 플레이어 전체 메시

**2차: 거리 기반 (Sphere Check)**
- Raycast 실패 시 보조 판정
- 기준: 탄환 끝점 ↔ 플레이어 중심 거리 1.2 이내

**명중 타겟 추출:**
```
hitObj.userData.playerId (상위 오브젝트까지 순회)
```

### 4-3. 데미지 & HP

| 항목 | 값 | 위치 |
|---|---|---|
| 초기 HP | 100 | 서버/클라이언트 공통 |
| 탄환 데미지 | 15 | `bullets.ts: TAKE_DAMAGE` |
| 사망 기준 | hp ≤ 0 | 서버 처리 |
| 리스폰 HP | 100 (풀 회복) | `server/src/index.ts` |
| 리스폰 위치 | 랜덤 (-10 ~ +10, y=1) | 서버 랜덤 생성 |

**HP 색상 단계:**

| HP 범위 | 색상 | Hex |
|---|---|---|
| 60 ~ 100 | 초록 (안전) | `#6BCB77` |
| 30 ~ 59 | 노랑 (경고) | `#FFD93D` |
| 0 ~ 29 | 빨강 (위험) | `#FF4D4D` |

### 4-4. 피격 효과

| 효과 | 상세 |
|---|---|
| Flash | 0.15초간 전체 메시를 빨강(`#FF0000`, emissive 2.0)으로 교체 |
| Knockback 강도 | 1.5 유닛 (방향 벡터 기반) + y +0.5 (살짝 뜸) |
| Knockback 감쇠 | 매 프레임 × 0.92 |

### 4-5. 명중 파티클 (Impact Effect)

| 항목 | 값 |
|---|---|
| 파티클 수 | 12개 |
| 크기 | 반지름 0.1 |
| 색상 | 주황 `#FFAA00` |
| 수명 | 0.5초 |
| 속도 | 랜덤 (x,z: ±7.5, y: 0~15) |
| 중력 | -30 유닛/초² |

---

## 5. 네트워크 프로토콜

### 클라이언트 → 서버

| 이벤트 | 데이터 | 설명 |
|---|---|---|
| `MOVE` | position, quaternion, upperYaw | 매 프레임 위치 전송 |
| `SHOOT` | origin, direction | 발사 시 전송 |
| `TAKE_DAMAGE` | targetId, damage(15), shooterId, direction | 명중 시 전송 |
| `CHAT_MESSAGE` | text | 채팅 전송 |
| `SET_NAME` | name | 이름 변경 |

### 서버 → 클라이언트

| 이벤트 | 데이터 | 설명 |
|---|---|---|
| `current_players` | 전체 플레이어 맵 | 접속 시 현황 |
| `player_joined` | 플레이어 정보 | 신규 접속 알림 |
| `player_left` | socket.id | 접속 해제 알림 |
| `STATE_UPDATE` | id, position, quaternion, upperYaw | 위치 동기화 |
| `SHOOT` | id, origin, direction | 원격 발사 중계 |
| `PLAYER_DAMAGED` | targetId, hp, shooterId, direction | 데미지 결과 |
| `PLAYER_RESPAWN` | id, hp, position | 리스폰 |
| `PLAYER_NAME` | id, name | 이름 동기화 |

---

## 6. 상체 회전 (Torso Rotation)

| 항목 | 값 |
|---|---|
| 회전 범위 | ±72도 (±π × 0.4) |
| 보간 속도 | LERP 계수 3.5 × deltaTime |
| 기준 | 카메라 yaw − 바디 yaw |

---

## 7. 밸런스 분석 (현재 기준)

| 항목 | 계산 | 결과 |
|---|---|---|
| TTK (Time-to-Kill) | 100hp ÷ 15데미지 = 7발 | 약 0.35초 (탄속 20, 사정거리 내) |
| 최대 교전 거리 | 20 유닛/초 × 2.5초 | 50 유닛 |
| 발사 간격 | 탄환 소멸 후 재발사 | 최소 ~0.1초 (명중/벽 충돌 기준) |

---

## 8. 향후 기획 (TODO)

### 전투 밸런스
- [ ] 연사 속도 제한 (쿨다운 도입, 예: 0.5초)
- [ ] 장거리 데미지 감소 (Damage Falloff)
- [ ] 헤드샷 판정 (2배 데미지)

### 게임 모드
- [ ] **데스매치**: 제한 시간 내 킬 수 최다 플레이어 승리
- [ ] **팀 데스매치**: 2팀으로 나눠 팀킬 수 경쟁
- [ ] **생존 모드**: 마지막 생존자가 승리

### 스코어보드
- [ ] 킬/데스 카운트 집계
- [ ] 화면 Tab키로 스코어보드 표시
- [ ] 세션 내 KDA 표시

### 아이템 시스템
- [ ] HP 회복 아이템 (맵에 스폰)
- [ ] 탄약 아이템 (발사 제한 도입 시)
- [ ] 스피드 부스트 아이템
