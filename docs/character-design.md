# 캐릭터 디자인 문서 — Ceramic Daisy

> 이 문서는 web3DGame의 플레이어 캐릭터 디자인 스펙을 정의합니다.
> 구현 파일: `client/src/game/characterModel.ts`

---

## 1. 컨셉 요약

**Ceramic Daisy** — 세라믹 질감의 2톤 알약 바디 위에 데이지 꽃이 달린 캐릭터.
단순하고 귀여운 실루엣, 각 플레이어마다 고유한 파스텔 컬러로 구분.

---

## 2. 바디 구조 (Body Structure)

```
         [꽃 (Flower)]
              |
        [상체 (Upper)]   ← 카메라 방향으로 좌우 회전 (±70도)
        ──────────────
        [하체 (Lower)]   ← 이동 방향 고정
```

### 2-1. 하체 (Lower Body) — 고정 흰색

| 파츠 | 형태 | 크기 | 컬러 |
|---|---|---|---|
| 하단 실린더 | CylinderGeometry | radius 0.5, height 0.5 | 흰색 `#FFFFFF` |
| 하단 반구 | SphereGeometry (하반부) | radius 0.5 | 흰색 `#FFFFFF` |

- roughness: 0.1 / metalness: 0 (세라믹 느낌)
- 위치: y = 0.5 ~ 1.0

### 2-2. 상체 (Upper Body) — 플레이어 고유 컬러

| 파츠 | 형태 | 크기 | 컬러 |
|---|---|---|---|
| 상단 실린더 | CylinderGeometry | radius 0.5, height 0.5 | 플레이어 컬러 |
| 상단 반구 | SphereGeometry (상반부) | radius 0.5 | 플레이어 컬러 |
| 바이저 | BoxGeometry | 0.6 × 0.15 × 0.1 | 다크그레이 `#333333` |

- 상체 허리 기준점: y = 1.0
- 바이저 위치: 정면(+Z) 0.48, y = 0.4 (상대좌표)
- 상체는 카메라 수평 회전에 따라 Y축 회전

### 2-3. 꽃 (Daisy Flower)

| 파츠 | 상세 |
|---|---|
| 줄기 | 8개 세그먼트 실린더, 높이 0.8, 색상 `#2d5a27` (진초록) |
| 잎사귀 | 납작한 구형, 줄기 0.2 지점에 부착 |
| 꽃 중심 | 납작한 구형 (scaleY 0.6), 색상 `#FFCC00` (노랑) |
| 꽃잎 | 18개, 납작 긴 형태, 색상 = 플레이어 컬러 |

- 꽃 위치: 상체 기준 y = 0.6 (머리 꼭대기)
- 꽃잎 반지름: 0.18 간격으로 방사형 배치
- 꽃잎 roughness: 0.1, metalness: 0

---

## 3. 컬러 시스템 (Color System)

### 3-1. 파스텔 팔레트

서버에서 접속 시 랜덤 배정. 바디 상단 + 꽃잎이 동일 컬러.

| 컬러명 | Hex | 용도 |
|---|---|---|
| Salmon Pink | `#FFB7B2` | 기본/예시 |
| Mint | `#B5EAD7` | 플레이어 2 |
| Lavender | `#C7CEEA` | 플레이어 3 |
| Lemon | `#FFDAC1` | 플레이어 4 |
| Sky Blue | `#AED6F1` | 플레이어 5 |
| Lilac | `#D7BDE2` | 플레이어 6 |
| Peach | `#FAD7A0` | 플레이어 7 |
| Soft Green | `#A9DFBF` | 플레이어 8 |

> 추가 컬러 확장 시 이 팔레트 기준으로 파스텔 채도 유지 권장.

### 3-2. 고정 컬러

| 파츠 | Hex | 변경 가능 여부 |
|---|---|---|
| 하체 전체 | `#FFFFFF` | 고정 |
| 바이저 | `#333333` | 고정 |
| 줄기/잎 | `#2D5A27` | 고정 |
| 꽃 중심 | `#FFCC00` | 고정 |

---

## 4. 애니메이션 & 물리 (Animation & Physics)

### 4-1. 상체 회전 (Torso Rotation)

- 트리거: 카메라 수평 방향
- 범위: ±70도 (하체 진행방향 기준)
- 메서드: `setUpperRotation(yRotation)`

### 4-2. 꽃 스프링 물리 (Flower Spring Physics)

- 이동 시 관성에 따라 줄기가 휘어짐
- forward(앞뒤), side(좌우) 값을 입력받아 각 줄기 세그먼트에 곡선 적용
- 줄기 곡률: `curve = t²` (끝부분이 더 많이 휨)
- 메서드: `updateFlowerPhysics(forward, side)`

### 4-3. 꽃 앙각 기울기 (Flower Tilt)

- 트리거: 카메라 상하 각도
- 카메라가 내려다볼수록 꽃이 앞으로 기울어짐
- 메서드: `updateFlowerTilt(tiltFactor)`

---

## 5. 네임태그 (Name Tag)

- 구현: `client/src/game/nameTag.ts`
- 스타일: 그래피티(Graffiti) 폰트 느낌
- 위치: 캐릭터 머리 위 (꽃 위쪽)
- 항상 카메라를 향해 Billboard 처리

---

## 6. HP 피격 효과 (Hit Effect)

| 효과 | 상세 |
|---|---|
| Flash (피격) | 전체 메시를 붉은색(`#FF0000`)으로 순간 전환 후 복구 |
| Knockback | 피격 방향 반대로 관성 적용 |

---

## 7. 향후 디자인 방향 (TODO)

### 캐릭터 커스터마이징
- [ ] 꽃 종류 선택 (데이지 외 튤립, 해바라기 등)
- [ ] 하체 패턴/텍스처 옵션
- [ ] 바이저 컬러/모양 변경

### 이모트 & 표현
- [ ] 춤추기 / 손흔들기 애니메이션
- [ ] 꽃잎 흔들기 (반응형 이모트)
- [ ] 사망 연출 (팽이처럼 쓰러짐)

### 아이템 장착 슬롯
- [ ] 등에 무기/배낭 장착 위치
- [ ] 머리 위 (꽃 옆) 악세서리 슬롯

---

## 8. 기술 참고

```typescript
// 캐릭터 생성
const model = createCharacterModel(bodyColor, flowerColor);

// 상체 회전
model.setUpperRotation(yRotation);

// 꽃 물리 업데이트 (매 프레임)
model.updateFlowerPhysics(forwardTilt, sideTilt);

// 꽃 앙각 기울기
model.updateFlowerTilt(tiltFactor);

// 색상 변경
model.setBodyColor(0xAED6F1);
model.setFlowerColor(0xAED6F1);
```
